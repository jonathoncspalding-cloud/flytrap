"""
signal_processor.py  (v2)
--------------------------
The intelligence layer. Takes raw signals from the Evidence Log and uses the Claude API to:
1. Classify each signal (trend type)
2. Score Cultural Potency (CPS) based on active tensions
3. Link to existing trends or accumulate evidence for new ones
4. Enforce evidence threshold: new trends require MIN_EVIDENCE_THRESHOLD corroborating signals
5. Detect collisions: multiple high-CPS trends converging on the same tensions
6. Update CPS sparkline history on each trend page

Called daily after signal collection.
"""

import os
import sys
import json
import time
import logging
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

import anthropic
from notion_helper import (
    query_database, create_page, update_page, get_page, get_page_title, rich_text
)

logger = logging.getLogger(__name__)

EVIDENCE_DB = os.getenv("NOTION_EVIDENCE_DB")
TENSIONS_DB = os.getenv("NOTION_TENSIONS_DB")
TRENDS_DB   = os.getenv("NOTION_TRENDS_DB")
TODAY       = date.today().isoformat()

# New trends require this many corroborating signals before being created.
# Prevents single-signal noise trends from polluting the Trends DB.
MIN_EVIDENCE_THRESHOLD = 2

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# Signal velocity: tracks per-trend signal counts over time for acceleration detection
VELOCITY_FILE = DATA_DIR / "signal_velocity.json"

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


# ── Helpers ────────────────────────────────────────────────────────────────────

def _normalize(name: str) -> str:
    """Case-insensitive key for trend-name matching."""
    return name.lower().strip().replace("-", " ")


# ── Data loading ───────────────────────────────────────────────────────────────

def load_active_tensions() -> list:
    """Load all active cultural tensions from Notion."""
    pages = query_database(TENSIONS_DB)
    tensions = []
    for p in pages:
        props = p["properties"]
        name        = get_page_title(p)
        weight      = (props.get("Weight") or {}).get("number") or 5
        status_sel  = (props.get("Status") or {}).get("select") or {}
        status      = status_sel.get("name", "Active")
        desc_rt     = (props.get("Description") or {}).get("rich_text") or []
        desc        = desc_rt[0]["plain_text"] if desc_rt else ""
        tensions.append({"id": p["id"], "name": name, "weight": weight, "status": status, "description": desc})
    return tensions


def load_existing_trends() -> list:
    """Load all non-archived trends from Notion."""
    pages = query_database(
        TRENDS_DB,
        filter_obj={"property": "Status", "select": {"does_not_equal": "Archived"}},
    )
    trends = []
    for p in pages:
        props = p["properties"]
        name        = get_page_title(p)
        type_sel    = (props.get("Type") or {}).get("select") or {}
        trend_type  = type_sel.get("name", "")
        cps         = (props.get("Cultural Potency Score") or {}).get("number") or 0
        summary_rt  = (props.get("Summary") or {}).get("rich_text") or []
        summary     = summary_rt[0]["plain_text"] if summary_rt else ""
        # Load existing tension relations for collision detection seeding
        tensions_rel = (props.get("Linked Tensions") or {}).get("relation") or []
        tension_ids = [r["id"] for r in tensions_rel]
        trends.append({"id": p["id"], "name": name, "type": trend_type, "cps": cps,
                        "summary": summary, "tension_ids": tension_ids})
    return trends


def load_unprocessed_signals(hours: int = 24) -> list:
    """Load Evidence Log entries from the last N days not yet processed.

    A signal is considered processed once it has a Summary (written by
    update_signal_in_notion).  Previously this filtered on Linked Trends
    being empty, but signals scored as noise never get a trend link — so
    they were re-sent to Claude every run, creating an ever-growing backlog.
    """
    days        = max(1, hours // 24)
    cutoff_date = (date.today() - timedelta(days=days)).isoformat()
    pages = query_database(
        EVIDENCE_DB,
        filter_obj={
            "and": [
                {"property": "Date Captured", "date": {"on_or_after": cutoff_date}},
                {"property": "Summary",       "rich_text": {"is_empty": True}},
            ]
        },
    )
    signals = []
    for p in pages:
        props       = p["properties"]
        title       = get_page_title(p)
        raw_rt      = (props.get("Raw Content") or {}).get("rich_text") or []
        raw         = raw_rt[0]["plain_text"] if raw_rt else ""
        plat_sel    = (props.get("Source Platform") or {}).get("select") or {}
        platform    = plat_sel.get("name", "")
        signals.append({"id": p["id"], "title": title, "raw": raw, "platform": platform})
    return signals


# ── Claude processing ──────────────────────────────────────────────────────────

SIGNAL_PROCESSING_PROMPT = """You are a cultural intelligence analyst working for a creative director at an advertising agency.
Your job is to evaluate raw signals and determine their cultural relevance.

ACTIVE CULTURAL TENSIONS (with user-assigned weights 1-10):
{tensions_list}

CURRENTLY TRACKED TRENDS:
{trends_list}

RAW SIGNALS TO EVALUATE (batch of {batch_size}):
{signals_list}

For each signal, respond with a JSON array. Each item must have:
{{
  "signal_title": "<exact title from input>",
  "trend_type": "<Macro Trend | Micro Trend | Emerging Signal | Scheduled Event | Predicted Moment>",
  "cps_level": "<FLASHPOINT | HOT | NOTABLE | EARLY | NOISE>",
  "cps": <mapped numeric: NOISE=10, EARLY=30, NOTABLE=50, HOT=70, FLASHPOINT=90>,
  "cps_reasoning": "<1 sentence: which tensions this hits and why>",
  "intersected_tensions": ["<tension name 1>", "<tension name 2>"],
  "linked_trend": "<exact name of existing trend this belongs to, or null>",
  "new_trend_recommendation": "<name of new trend to create, or null — only recommend if signal is novel and culturally significant>",
  "summary": "<1-2 sentence cultural analysis of why this signal matters>",
  "sentiment": "<Positive | Negative | Neutral | Mixed>"
}}

CULTURAL POTENCY LEVELS (choose exactly one):
- FLASHPOINT (cps: 90): Intersection of 3+ active tensions with strong velocity. Immediate cultural urgency.
- HOT (cps: 70): Hits 2 tensions with clear cultural momentum. Worth tracking closely.
- NOTABLE (cps: 50): Touches 1-2 tensions, meaningful but not urgent.
- EARLY (cps: 30): Some cultural relevance, early-stage signal.
- NOISE (cps: 10): Mostly informational, low cultural charge.

PREDICTION MARKET SIGNALS (Platform: "Prediction Market"):
These are Polymarket signals — real money bets on outcomes. They carry unique intelligence:
- PROBABILITIES are money-backed crowd consensus. 73% = strong conviction backed by real stakes.
- VOLUME ($500k+ = major, $100-500k = notable) reflects how much public attention is building.
- VOLATILITY (large price moves like "↑12%") signals that something in the narrative just shifted.
- RESOLUTION DATES are hard deadlines when attention will concentrate — events resolving within 14 days with high volume should be scored as Scheduled Events.

IMPORTANT — how to score prediction market signals:
- Some markets ARE directly cultural. Score on cultural merits — they can be FLASHPOINT if they intersect tensions.
- Some markets are about world events that BECOME cultural catalysts. Score the cultural dimension, not the event itself.
- Some markets have no cultural dimension. Score as NOISE regardless of volume.
- CPS should always be grounded in TENSION INTERSECTION — volume and probability are supporting evidence, not substitutes for cultural relevance.

Be selective about recommending new trends — only suggest one when the signal represents a genuinely
novel cultural phenomenon not already captured by existing trends.

Respond ONLY with a valid JSON array. No preamble, no explanation outside the JSON."""


def process_signals_batch(signals: list, tensions: list, trends: list) -> list:
    """Send a batch of signals to Claude. Returns list of result dicts."""
    if not signals:
        return []

    tensions_list = "\n".join([
        f"- {t['name']} (weight: {t['weight']}/10): {t['description'][:150]}"
        for t in tensions if t["status"] != "Dormant"
    ])

    # Tiered context: full detail for high-CPS trends, names-only for the tail.
    # Saves ~1,000+ tokens/call without losing trend-linking accuracy.
    CPS_DETAIL_THRESHOLD = 40
    sorted_trends = sorted(trends, key=lambda t: -t["cps"])
    top_trends = [t for t in sorted_trends if t["cps"] >= CPS_DETAIL_THRESHOLD]
    tail_trends = [t for t in sorted_trends if t["cps"] < CPS_DETAIL_THRESHOLD]

    top_lines = "\n".join([
        f"- {t['name']} [{t['type']}] CPS:{t['cps']} — {t['summary'][:100]}"
        for t in top_trends
    ])
    tail_line = ""
    if tail_trends:
        tail_names = ", ".join(t["name"] for t in tail_trends)
        tail_line = (
            f"\nOTHER TRACKED TRENDS (link signals to these if relevant — "
            f"do not recommend duplicates):\n{tail_names}"
        )
    trends_list = (top_lines + tail_line) or "(no existing trends yet)"

    signals_list = "\n".join([
        f"{i+1}. Title: {s['title']}\n   Platform: {s['platform']}\n   Content: {s['raw'][:200]}"
        for i, s in enumerate(signals)
    ])

    prompt = SIGNAL_PROCESSING_PROMPT.format(
        tensions_list=tensions_list,
        trends_list=trends_list,
        batch_size=len(signals),
        signals_list=signals_list,
    )

    try:
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=6000,
            messages=[{"role": "user", "content": prompt}],
        )
        # Token usage logging
        usage = message.usage
        logger.info(
            f"  [TOKENS] signal_processor batch: "
            f"input={usage.input_tokens} output={usage.output_tokens} "
            f"total={usage.input_tokens + usage.output_tokens} "
            f"cost=${usage.input_tokens * 3 / 1_000_000 + usage.output_tokens * 15 / 1_000_000:.4f}"
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        results = json.loads(raw)
        return results if isinstance(results, list) else []
    except json.JSONDecodeError as e:
        logger.error(f"Claude response not valid JSON: {e}")
        return []
    except Exception as e:
        logger.error(f"Claude API call failed: {e}")
        return []


# ── Notion write helpers ───────────────────────────────────────────────────────

def find_or_create_trend(trend_name: str, trend_type: str, summary: str,
                          cps: int, tensions: list, tension_map: dict) -> str:
    """Find or create a trend. Returns Notion page ID."""
    pages = query_database(TRENDS_DB, filter_obj={"property": "Name", "title": {"equals": trend_name}})
    if pages:
        return pages[0]["id"]

    props = {
        "Name":                   {"title": [{"text": {"content": trend_name}}]},
        "Type":                   {"select": {"name": trend_type}},
        "Status":                 {"select": {"name": "Emerging"}},
        "Cultural Potency Score": {"number": cps},
        "Momentum Score":         {"number": 1},
        "Summary":                {"rich_text": rich_text(summary)},
        "First Detected":         {"date": {"start": TODAY}},
        "Last Updated":           {"date": {"start": TODAY}},
    }
    page = create_page(TRENDS_DB, props)
    logger.info(f"  + Created new trend: '{trend_name}' (CPS: {cps})")
    return page["id"]


def update_signal_in_notion(signal_id: str, result: dict, trend_id: str = None):
    """Write Claude's analysis back to an Evidence Log entry."""
    props = {
        "Summary":   {"rich_text": rich_text(result.get("summary", ""))},
        "Sentiment": {"select": {"name": result.get("sentiment", "Neutral")}},
    }
    if trend_id:
        props["Linked Trends"] = {"relation": [{"id": trend_id}]}
    update_page(signal_id, props)


# ── Collision detection ────────────────────────────────────────────────────────

def detect_collisions(
    trends_with_tensions: list,
    tension_weights: dict = None,
    min_combined_cps: int = 150,
    min_shared_tensions: int = 3,
    max_cps_differential: int = 25,
    min_tension_weight: int = 5,
    ambient_prevalence_threshold: float = 0.50,
    max_collisions: int = 20,
) -> list:
    """
    Find pairs of high-CPS trends that converge on shared *specific* tensions.

    Key concept: "ambient" tensions (linked to >50% of active trends) are excluded
    from the shared tension count. They're cultural background radiation — real, but
    not predictive of where a flashpoint will be.

    Filters (tightened 2026-03-01):
    - Both trends must have CPS >= 75
    - CPS differential must be <= 25 (collisions are between peers)
    - Only non-ambient tensions with weight >= 5 count as "shared"
    - Need >= 3 shared specific tensions
    - Combined CPS must meet minimum threshold
    - Output capped at top 20 by specificity-weighted score
    """
    if tension_weights is None:
        tension_weights = {}

    # Pre-pass: compute tension prevalence across all candidate trends
    high = [t for t in trends_with_tensions if t["cps"] >= 75 and t["tensions"]]
    if not high:
        return []

    tension_trend_count = {}
    for t in high:
        for tension in t["tensions"]:
            tension_trend_count[tension] = tension_trend_count.get(tension, 0) + 1

    n_trends = len(high)
    ambient_tensions = {
        t for t, count in tension_trend_count.items()
        if count / n_trends > ambient_prevalence_threshold
    }
    if ambient_tensions:
        logger.info(
            f"  Collision filter: {len(ambient_tensions)} ambient tensions excluded "
            f"(linked to >{ambient_prevalence_threshold*100:.0f}% of {n_trends} candidate trends)"
        )

    # Compute specificity for non-ambient tensions: specificity = 1 - prevalence
    tension_specificity = {
        t: 1.0 - (count / n_trends)
        for t, count in tension_trend_count.items()
        if t not in ambient_tensions
    }

    collisions = []
    for i in range(len(high)):
        for j in range(i + 1, len(high)):
            t1, t2 = high[i], high[j]

            # CPS differential check — collisions are between peers
            if abs(t1["cps"] - t2["cps"]) > max_cps_differential:
                continue

            # Shared tensions: exclude ambient, filter by weight
            shared_raw = set(t1["tensions"]) & set(t2["tensions"])
            shared = {
                t for t in shared_raw
                if t not in ambient_tensions
                and tension_weights.get(t, 5) >= min_tension_weight
            }

            combined = t1["cps"] + t2["cps"]
            if len(shared) >= min_shared_tensions and combined >= min_combined_cps:
                # Specificity-weighted score: rewards rare tension overlaps
                specificity_sum = sum(tension_specificity.get(t, 0.5) for t in shared)
                collision_score = combined * specificity_sum / 10
                collisions.append({
                    "trend_a":         t1["name"],
                    "cps_a":           t1["cps"],
                    "trend_b":         t2["name"],
                    "cps_b":           t2["cps"],
                    "shared_tensions": sorted(shared),
                    "combined_cps":    combined,
                    "collision_score": round(collision_score, 1),
                    "detected_date":   TODAY,
                })

    sorted_collisions = sorted(collisions, key=lambda x: -x["collision_score"])

    if len(sorted_collisions) > max_collisions:
        logger.info(
            f"  Collision cap: {len(sorted_collisions)} found, returning top {max_collisions}"
        )

    return sorted_collisions[:max_collisions]


def save_collisions(collisions: list):
    path = DATA_DIR / "collisions.json"
    path.write_text(json.dumps(collisions, indent=2))
    logger.info(f"Saved {len(collisions)} collision(s) → {path}")


# ── Signal Velocity ──────────────────────────────────────────────────────────

def load_velocity_data() -> dict:
    """Load existing velocity data: { trend_name: { "YYYY-MM-DD": signal_count, ... } }"""
    if VELOCITY_FILE.exists():
        try:
            return json.loads(VELOCITY_FILE.read_text())
        except Exception:
            return {}
    return {}


def update_velocity(velocity: dict, trend_signal_counts: dict) -> dict:
    """
    Update velocity data with today's signal counts per trend.
    Keeps a rolling 14-day window.
    trend_signal_counts: { trend_name: count_of_signals_today }
    """
    cutoff = (date.today() - timedelta(days=14)).isoformat()

    for trend_name, count in trend_signal_counts.items():
        if trend_name not in velocity:
            velocity[trend_name] = {}
        velocity[trend_name][TODAY] = velocity[trend_name].get(TODAY, 0) + count
        # Prune old entries
        velocity[trend_name] = {
            d: c for d, c in velocity[trend_name].items() if d >= cutoff
        }

    return velocity


def save_velocity(velocity: dict):
    """Save velocity data to disk."""
    VELOCITY_FILE.write_text(json.dumps(velocity, indent=2))
    logger.info(f"Saved velocity data for {len(velocity)} trends → {VELOCITY_FILE}")


# ── CPS Sparkline ──────────────────────────────────────────────────────────────

def update_cps_sparkline(trend_id: str, trend_name: str, current_cps: int):
    """Append today's CPS score to the trend's rolling sparkline history (14 days max)."""
    try:
        pages = query_database(TRENDS_DB, filter_obj={"property": "Name", "title": {"equals": trend_name}})
        if not pages:
            return
        page          = pages[0]
        spark_prop    = (page["properties"].get("CPS Sparkline") or {}).get("rich_text") or []
        existing      = spark_prop[0]["plain_text"] if spark_prop else ""
        values        = [v.strip() for v in existing.split(",") if v.strip()] if existing else []
        values.append(str(current_cps))
        values        = values[-14:]   # Rolling 14-day window
        update_page(trend_id, {"CPS Sparkline": {"rich_text": rich_text(",".join(values))}})
        logger.debug(f"  Sparkline updated: {trend_name} → {values}")
    except Exception as e:
        logger.warning(f"Could not update sparkline for '{trend_name}': {e}")


# ── Linked Tensions updater ───────────────────────────────────────────────────

def update_linked_tensions(trend_id: str, trend_name: str, new_tension_names: set, tension_map: dict):
    """
    Merge new tension relations into a Trend page without overwriting existing ones.
    Reads current relations first, unions with new ones, writes back only if changed.
    """
    try:
        page = get_page(trend_id)
        existing_ids = {
            r["id"] for r in
            page.get("properties", {}).get("Linked Tensions", {}).get("relation", [])
        }
        new_ids = {tension_map[name] for name in new_tension_names if name in tension_map}
        to_add = new_ids - existing_ids
        if not to_add:
            return  # Nothing new to write
        merged = [{"id": tid} for tid in (existing_ids | new_ids)]
        update_page(trend_id, {"Linked Tensions": {"relation": merged}})
        logger.debug(f"  Tension links updated: '{trend_name}' → +{len(to_add)} tensions")
    except Exception as e:
        logger.warning(f"Could not update linked tensions for '{trend_name}': {e}")


# ── Main loop ──────────────────────────────────────────────────────────────────

def run(hours: int = 24, batch_size: int = 10, dry_run: bool = False) -> dict:
    """
    Full signal processing job (v3 — tiered processing):
    Tier 0: Embedding pre-filter (local, $0) → auto-link / discard / ambiguous
    Tier 1: Haiku triage (cheap) → promoted / triaged-out
    Tier 2: Sonnet deep analysis (expensive) → only on promoted signals
    Then: collision detection, sparklines, velocity, CPS snapshot
    """
    logger.info("Starting signal processing (v3 — tiered processing)...")

    # Safety cap: max signals per run to prevent runaway costs.
    MAX_SIGNALS_PER_RUN = 300

    tensions = load_active_tensions()
    trends   = load_existing_trends()
    signals  = load_unprocessed_signals(hours=hours)

    if len(signals) > MAX_SIGNALS_PER_RUN:
        logger.warning(
            f"⚠️ {len(signals)} unprocessed signals exceeds cap of {MAX_SIGNALS_PER_RUN}. "
            f"Processing first {MAX_SIGNALS_PER_RUN} only — remainder will be caught next run."
        )
        signals = signals[:MAX_SIGNALS_PER_RUN]

    logger.info(f"Loaded: {len(tensions)} tensions, {len(trends)} trends, {len(signals)} unprocessed signals")

    if not signals:
        logger.info("No unprocessed signals — nothing to do.")
        return {"processed": 0, "new_trends": 0}

    tension_map = {t["name"]: t["id"] for t in tensions}
    # Reverse map: tension_id → tension_name (for seeding trend_tensions_map)
    tension_id_to_name = {t["id"]: t["name"] for t in tensions}

    processed       = 0
    new_trends      = 0
    high_cps_count  = 0
    tier_stats      = {"auto_linked": 0, "discarded": 0, "triaged_out": 0, "sonnet_processed": 0}

    # pending_new_trends: normalised_name → [(signal_dict, result_dict), ...]
    pending_new_trends: dict = {}
    # trend_tensions_map: trend_name → set of tension names
    # Seed from existing Notion tension relations (Oracle fix: durable collision detection)
    trend_tensions_map: dict = {}
    for t in trends:
        if t.get("tension_ids"):
            known_tensions = {tension_id_to_name[tid] for tid in t["tension_ids"]
                              if tid in tension_id_to_name}
            if known_tensions:
                trend_tensions_map[t["name"]] = known_tensions

    # touched_trends: trend_id → (trend_name, current_cps)
    touched_trends: dict = {}
    # trend_signal_counts: trend_name → number of signals linked today (for velocity)
    trend_signal_counts: dict = {}

    # ══════════════════════════════════════════════════════════════════════════
    # TIER 0: Embedding pre-filter (local, $0)
    # ══════════════════════════════════════════════════════════════════════════
    try:
        from signal_filter import classify_signals
        classified = classify_signals(signals, trends, tensions)
    except ImportError:
        logger.warning("signal_filter.py not available — skipping Tier 0, all signals → Sonnet")
        classified = {"auto_link": [], "discard": [], "ambiguous": list(signals)}
    except Exception as e:
        logger.warning(f"Tier 0 failed: {e} — all signals → Sonnet")
        classified = {"auto_link": [], "discard": [], "ambiguous": list(signals)}

    logger.info(
        f"Tier 0: {len(classified['auto_link'])} auto-linked, "
        f"{len(classified['discard'])} discarded, "
        f"{len(classified['ambiguous'])} ambiguous → Tier 1"
    )

    # ── Handle auto-linked signals (matched to existing trend, no Claude) ────
    for signal, trend_name, trend_id, sim_score in classified["auto_link"]:
        try:
            if not dry_run:
                update_signal_in_notion(signal["id"], {
                    "summary": f"Auto-linked to '{trend_name}' (similarity: {sim_score:.2f})",
                    "sentiment": "Neutral",
                }, trend_id)
            # Update velocity count for the matched trend
            trend_signal_counts[trend_name] = trend_signal_counts.get(trend_name, 0) + 1
            # Record as touched for sparkline update (write current CPS per Oracle)
            matched = [t for t in trends if t["id"] == trend_id]
            if matched:
                touched_trends[trend_id] = (trend_name, matched[0]["cps"])
            processed += 1
            tier_stats["auto_linked"] += 1
        except Exception as e:
            logger.error(f"Error auto-linking signal '{signal['title'][:50]}': {e}")

    # ── Handle discarded signals (noise, save minimal metadata) ──────────────
    for signal in classified["discard"]:
        try:
            if not dry_run:
                update_signal_in_notion(signal["id"], {
                    "summary": "Low cultural relevance (auto-filtered)",
                    "sentiment": "Neutral",
                })
            processed += 1
            tier_stats["discarded"] += 1
        except Exception as e:
            logger.error(f"Error discarding signal '{signal['title'][:50]}': {e}")

    # ══════════════════════════════════════════════════════════════════════════
    # TIER 1: Haiku triage on ambiguous signals
    # ══════════════════════════════════════════════════════════════════════════
    ambiguous = classified["ambiguous"]

    # Separate low-context signals (Trends24/X Trending without enrichment).
    # Bare topic names with no content stay Haiku-only. But enriched signals
    # (those with "Context:" in raw content from Google News) have enough
    # substance for Sonnet to score CPS and intersect tensions — let them through.
    def _is_bare_x_trending(s: dict) -> bool:
        if not s.get("title", "").startswith("X Trending"):
            return False
        return "Context:" not in s.get("raw", "")

    haiku_only = [s for s in ambiguous if _is_bare_x_trending(s)]
    full_pipeline = [s for s in ambiguous if not _is_bare_x_trending(s)]

    if haiku_only:
        logger.info(f"  {len(haiku_only)} low-context signals (Trends24) → Haiku-only triage")

    promoted_signals = full_pipeline  # Default: if triage fails, all go to Sonnet

    # Triage both pools through Haiku, but only full_pipeline signals get promoted
    all_ambiguous = full_pipeline + haiku_only
    if all_ambiguous:
        try:
            from signal_triage import triage_signals
            promoted_all, triaged = triage_signals(all_ambiguous, trends)

            # Filter: bare (unenriched) X Trending signals stay Haiku-only.
            # Enriched X Trending signals (with Context:) go to Sonnet.
            promoted_signals = [s for s in promoted_all
                                if not _is_bare_x_trending(s)]

            # Bare Trends24 signals that Haiku scored high get auto-linked metadata
            trends24_promoted = [s for s in promoted_all
                                 if _is_bare_x_trending(s)]
            for signal in trends24_promoted:
                try:
                    if not dry_run:
                        update_signal_in_notion(signal["id"], {
                            "summary": "X/Twitter trending topic (Haiku-classified as culturally relevant)",
                            "sentiment": "Neutral",
                        })
                    processed += 1
                    tier_stats["triaged_out"] += 1  # Counted as triaged (didn't hit Sonnet)
                except Exception as e:
                    logger.error(f"Error saving Trends24 signal '{signal['title'][:50]}': {e}")

            # Handle triaged-out signals (from both pools)
            for signal, triage_result in triaged:
                try:
                    if not dry_run:
                        update_signal_in_notion(signal["id"], triage_result)
                    processed += 1
                    tier_stats["triaged_out"] += 1
                except Exception as e:
                    logger.error(f"Error saving triage for '{signal['title'][:50]}': {e}")

        except ImportError:
            logger.warning("signal_triage.py not available — all ambiguous signals → Sonnet")
            promoted_signals = full_pipeline  # Still exclude bare Trends24 from Sonnet fallback
        except Exception as e:
            logger.warning(f"Tier 1 failed: {e} — all ambiguous signals → Sonnet")
            promoted_signals = full_pipeline

    logger.info(f"Tier 2: {len(promoted_signals)} signals promoted to Sonnet processing")

    # ══════════════════════════════════════════════════════════════════════════
    # TIER 2: Full Sonnet processing (existing batch logic, only on promoted)
    # ══════════════════════════════════════════════════════════════════════════
    for i in range(0, len(promoted_signals), batch_size):
        batch   = promoted_signals[i:i + batch_size]
        logger.info(f"Sonnet batch {i//batch_size + 1}: signals {i+1}–{i+len(batch)}")

        results = process_signals_batch(batch, tensions, trends)
        if not results:
            logger.warning(f"  No results for Sonnet batch {i//batch_size + 1}")
            continue

        for signal, result in zip(batch, results):
            try:
                cps                 = result.get("cps", 0)
                linked_trend_name   = result.get("linked_trend")
                new_trend_name      = result.get("new_trend_recommendation")
                trend_type          = result.get("trend_type", "Emerging Signal")
                summary             = result.get("summary", "")
                intersected         = result.get("intersected_tensions", [])

                if cps >= 60:
                    high_cps_count += 1

                if linked_trend_name:
                    # ── Link to existing trend ────────────────────────────
                    matches = [t for t in trends if t["name"] == linked_trend_name]
                    if matches:
                        t        = matches[0]
                        trend_id = t["id"]

                        # Lift CPS if signal is stronger
                        if cps > t["cps"] and not dry_run:
                            update_page(trend_id, {
                                "Cultural Potency Score": {"number": cps},
                                "Last Updated":           {"date": {"start": TODAY}},
                            })
                            t["cps"] = cps

                        trend_tensions_map.setdefault(t["name"], set()).update(intersected)
                        touched_trends[trend_id] = (t["name"], t["cps"])
                        trend_signal_counts[t["name"]] = trend_signal_counts.get(t["name"], 0) + 1

                        if not dry_run:
                            update_signal_in_notion(signal["id"], result, trend_id)
                    else:
                        logger.warning(f"  Unknown trend referenced: '{linked_trend_name}'")
                        if not dry_run:
                            update_signal_in_notion(signal["id"], result, None)

                elif new_trend_name and cps >= 30:
                    # ── Accumulate evidence for potential new trend ───────
                    norm = _normalize(new_trend_name)
                    pending_new_trends.setdefault(norm, []).append((signal, result))
                    # Signal will be updated after threshold decision

                else:
                    # Low signal — save analysis, no trend
                    if not dry_run:
                        update_signal_in_notion(signal["id"], result, None)

                processed += 1
                tier_stats["sonnet_processed"] += 1

            except Exception as e:
                logger.error(f"Error on signal '{signal['title'][:50]}': {e}")

        if i + batch_size < len(promoted_signals):
            time.sleep(0.5)

    # ── Evidence threshold: decide which new trends to create ─────────────────
    logger.info(f"\nEvaluating {len(pending_new_trends)} new trend candidates "
                f"(threshold ≥ {MIN_EVIDENCE_THRESHOLD} signals):")

    for norm_name, pending_list in sorted(pending_new_trends.items(), key=lambda x: -len(x[1])):
        count = len(pending_list)
        if count >= MIN_EVIDENCE_THRESHOLD:
            best_sig, best_res = max(pending_list, key=lambda x: x[1].get("cps", 0))
            canonical   = best_res.get("new_trend_recommendation", norm_name)
            t_type      = best_res.get("trend_type", "Emerging Signal")
            t_summary   = best_res.get("summary", "")
            t_cps       = best_res.get("cps", 0)
            t_tensions  = best_res.get("intersected_tensions", [])

            trend_id = None
            if not dry_run:
                trend_id = find_or_create_trend(canonical, t_type, t_summary, t_cps, tensions, tension_map)
                trends.append({"id": trend_id, "name": canonical, "type": t_type, "cps": t_cps,
                                "summary": t_summary, "tension_ids": []})
                for sig, res in pending_list:
                    update_signal_in_notion(sig["id"], res, trend_id)
                trend_tensions_map.setdefault(canonical, set()).update(t_tensions)
                touched_trends[trend_id] = (canonical, t_cps)
                trend_signal_counts[canonical] = trend_signal_counts.get(canonical, 0) + count

            new_trends += 1
            logger.info(f"  ✓ '{canonical}' — {count} signals, CPS {t_cps}")
        else:
            # Too few signals — still save the analysis, just no trend
            if not dry_run:
                for sig, res in pending_list:
                    update_signal_in_notion(sig["id"], res, None)
            logger.info(f"  ✗ '{norm_name}' — only {count}/{MIN_EVIDENCE_THRESHOLD} signals (skipped)")

    # ── Collision detection ────────────────────────────────────────────────────
    # Uses trend_tensions_map seeded from Notion + enriched from this run's Sonnet output
    collisions_detected = 0
    if trend_tensions_map:
        enriched = [
            {
                "name":     t["name"],
                "cps":      t["cps"],
                "tensions": list(trend_tensions_map.get(t["name"], set())),
            }
            for t in trends
            if trend_tensions_map.get(t["name"])
        ]
        tension_weights = {t["name"]: t["weight"] for t in tensions}
        collisions = detect_collisions(enriched, tension_weights=tension_weights)
        collisions_detected = len(collisions)
        save_collisions(collisions)

        if collisions:
            logger.info(f"\n⚡ {collisions_detected} collision(s) detected:")
            for c in collisions[:3]:
                logger.info(
                    f"  [{c['combined_cps']} combined] '{c['trend_a']}' + '{c['trend_b']}'"
                    f" — shared: {', '.join(c['shared_tensions'])}"
                )
    else:
        save_collisions([])  # Clear stale collision file

    # ── CPS Sparkline + Linked Tensions updates (single pass) ────────────────
    if touched_trends and not dry_run:
        trend_name_to_id = {t["name"]: t["id"] for t in trends}
        logger.info(f"\nUpdating sparklines + linked tensions for {len(touched_trends)} trend(s)...")
        for trend_id, (trend_name, cps) in touched_trends.items():
            update_cps_sparkline(trend_id, trend_name, cps)
            tension_names = trend_tensions_map.get(trend_name)
            if tension_names:
                update_linked_tensions(trend_id, trend_name, tension_names, tension_map)
            time.sleep(0.35)  # Stay within Notion rate limits
        # Handle any trends with tension updates but not in touched_trends
        for trend_name, tension_names in trend_tensions_map.items():
            trend_id = trend_name_to_id.get(trend_name)
            if trend_id and trend_id not in touched_trends and tension_names:
                update_linked_tensions(trend_id, trend_name, tension_names, tension_map)
                time.sleep(0.35)

    # ── Signal Velocity updates ──────────────────────────────────────────────
    if trend_signal_counts and not dry_run:
        logger.info(f"\nUpdating signal velocity for {len(trend_signal_counts)} trend(s)...")
        velocity = load_velocity_data()
        velocity = update_velocity(velocity, trend_signal_counts)
        save_velocity(velocity)

    # ── CPS Snapshot (for briefing deltas) ────────────────────────────────
    cps_snapshot_path = DATA_DIR / "cps_snapshot.json"
    try:
        snapshot = {
            "date": TODAY,
            "trends": {t["name"]: t["cps"] for t in trends},
        }
        cps_snapshot_path.write_text(json.dumps(snapshot, indent=2))
        logger.info(f"Saved CPS snapshot ({len(snapshot['trends'])} trends) → {cps_snapshot_path}")
    except Exception as e:
        logger.warning(f"Could not save CPS snapshot: {e}")

    summary = {
        "processed":            processed,
        "new_trends":           new_trends,
        "high_cps":             high_cps_count,
        "total_signals":        len(signals),
        "collisions_detected":  collisions_detected,
        "tiers":                tier_stats,
    }
    logger.info(f"\nSignal processing complete: {summary}")
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    result = run(hours=24)
    print(f"\nResults: {result}")
