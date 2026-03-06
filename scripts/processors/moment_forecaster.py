"""
moment_forecaster.py
--------------------
The cultural moments prediction engine. This is the core intelligence layer that
predicts upcoming cultural moments before they happen.

Takes the full cultural landscape as input:
  - Active tensions (with weights)
  - Top trends (with CPS, velocity, collisions)
  - Calendar events (upcoming catalysts)
  - Collision pairs (converging forces)
  - Signal velocity data (acceleration)
  - Existing moment predictions (for update/retirement)

Produces/updates Cultural Moment predictions in Notion:
  - Catalyst Moments:  Known event + active tensions → prediction
  - Collision Moments:  Converging trends → inevitable flashpoint
  - Pressure Moments:  Building signal velocity → tipping point
  - Pattern Moments:   Seasonal/cyclical + current context
  - Void Moments:      Conspicuous absence → the absence itself becomes the story

Each prediction has:
  - Time horizon: This Week / 2-4 Weeks / 1-3 Months
  - Confidence score (0-100) grounded in evidence density
  - Magnitude score (how culturally significant if it happens)
  - "Watch for" indicators (concrete signals to confirm it's happening)
  - Structured reasoning chain

Called after signal processing, before briefing generation.
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

TRENDS_DB   = os.getenv("NOTION_TRENDS_DB")
TENSIONS_DB = os.getenv("NOTION_TENSIONS_DB")
CALENDAR_DB = os.getenv("NOTION_CALENDAR_DB")
EVIDENCE_DB = os.getenv("NOTION_EVIDENCE_DB")
MOMENTS_DB  = os.getenv("NOTION_MOMENTS_DB")
TODAY       = date.today().isoformat()

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

# Max active predictions at any time
MAX_ACTIVE_MOMENTS = 12

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


# ── Data loading ───────────────────────────────────────────────────────────────

def load_tensions() -> list:
    """Load active tensions with weights."""
    pages = query_database(TENSIONS_DB)
    tensions = []
    for p in pages:
        props = p["properties"]
        name = get_page_title(p)
        weight = (props.get("Weight") or {}).get("number") or 5
        status = ((props.get("Status") or {}).get("select") or {}).get("name", "Active")
        desc_rt = (props.get("Description") or {}).get("rich_text") or []
        desc = desc_rt[0]["plain_text"] if desc_rt else ""
        if status != "Dormant":
            tensions.append({
                "id": p["id"], "name": name, "weight": weight,
                "status": status, "description": desc[:200],
            })
    return sorted(tensions, key=lambda x: -x["weight"])


def load_top_trends(limit: int = 30) -> list:
    """Load top trends by CPS."""
    pages = query_database(
        TRENDS_DB,
        filter_obj={"property": "Status", "select": {"does_not_equal": "Archived"}},
    )
    trends = []
    for p in pages:
        props = p["properties"]
        name = get_page_title(p)
        cps = (props.get("Cultural Potency Score") or {}).get("number") or 0
        momentum = (props.get("Momentum Score") or {}).get("number") or 0
        status = ((props.get("Status") or {}).get("select") or {}).get("name", "")
        ttype = ((props.get("Type") or {}).get("select") or {}).get("name", "")
        summary_rt = (props.get("Summary") or {}).get("rich_text") or []
        summary = summary_rt[0]["plain_text"] if summary_rt else ""
        spark_rt = (props.get("CPS Sparkline") or {}).get("rich_text") or []
        sparkline_str = spark_rt[0]["plain_text"] if spark_rt else ""
        tension_ids = [r["id"] for r in (props.get("Linked Tensions") or {}).get("relation", [])]
        trends.append({
            "id": p["id"], "name": name, "cps": cps, "momentum": momentum,
            "status": status, "type": ttype, "summary": summary[:200],
            "sparkline": sparkline_str, "tension_ids": tension_ids,
        })
    trends.sort(key=lambda x: -x["cps"])
    return trends[:limit]


def load_calendar_events(days: int = 60) -> list:
    """Load upcoming calendar events."""
    today = date.today()
    end = (today + timedelta(days=days)).isoformat()
    pages = query_database(
        CALENDAR_DB,
        filter_obj={
            "and": [
                {"property": "Date", "date": {"on_or_after": today.isoformat()}},
                {"property": "Date", "date": {"on_or_before": end}},
            ]
        },
    )
    events = []
    for p in pages:
        props = p["properties"]
        name = get_page_title(p)
        event_date = ((props.get("Date") or {}).get("date") or {}).get("start", "")
        cps = (props.get("Cultural Potency Score") or {}).get("number") or 0
        etype = ((props.get("Type") or {}).get("select") or {}).get("name", "")
        notes_rt = (props.get("Notes") or {}).get("rich_text") or []
        notes = notes_rt[0]["plain_text"] if notes_rt else ""
        categories = [o["name"] for o in (props.get("Category") or {}).get("multi_select", [])]
        events.append({
            "id": p["id"], "name": name, "date": event_date, "cps": cps,
            "type": etype, "notes": notes[:200], "categories": categories,
        })
    return sorted(events, key=lambda x: x["date"])


def load_collisions() -> list:
    """Load collision data from the last signal processing run."""
    path = DATA_DIR / "collisions.json"
    if not path.exists():
        return []
    try:
        collisions = json.loads(path.read_text())
        # Only return top collisions to keep prompt manageable
        return sorted(collisions, key=lambda x: -x.get("combined_cps", 0))[:10]
    except Exception:
        return []


def load_velocity() -> dict:
    """Load signal velocity data: { trend_name: { date: count } }"""
    path = DATA_DIR / "signal_velocity.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def load_social_pulse(days: int = 2, limit: int = 10) -> list:
    """
    Load recent high-engagement social signals (TikTok, X/Twitter, Reddit, Bluesky)
    from the Evidence DB. These are fast-moving signals that may not yet be linked
    to trends but carry early-warning intelligence for moment prediction.

    Prioritizes signals with enrichment context (Google News) and high engagement.
    """
    if not EVIDENCE_DB:
        return []
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    social_platforms = ["TikTok", "Social", "Reddit", "Bluesky"]
    signals = []

    for platform in social_platforms:
        try:
            pages = query_database(
                EVIDENCE_DB,
                filter_obj={
                    "and": [
                        {"property": "Source Platform", "select": {"equals": platform}},
                        {"property": "Date Captured", "date": {"on_or_after": cutoff}},
                    ]
                },
            )
            for p in pages:
                props = p["properties"]
                title = get_page_title(p)
                raw_rt = (props.get("Raw Content") or {}).get("rich_text") or []
                raw = raw_rt[0]["plain_text"] if raw_rt else ""
                summary_rt = (props.get("Summary") or {}).get("rich_text") or []
                summary = summary_rt[0]["plain_text"] if summary_rt else ""
                # Prioritize enriched signals (those with Context:)
                has_context = "Context:" in raw
                signals.append({
                    "title": title,
                    "platform": platform,
                    "raw": raw[:400],
                    "summary": summary[:200],
                    "has_context": has_context,
                })
        except Exception as e:
            logger.warning(f"Failed to load social pulse for {platform}: {e}")

    # Sort: enriched first, then by title (proxy for recency/rank)
    signals.sort(key=lambda s: (not s["has_context"], s["title"]))
    return signals[:limit]


def load_prediction_market_signals(days: int = 7) -> list:
    """
    Load recent prediction market signals from the Evidence DB.
    These carry unique intelligence: probabilities, resolution dates, volume, volatility.
    """
    if not EVIDENCE_DB:
        return []
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    pages = query_database(
        EVIDENCE_DB,
        filter_obj={
            "and": [
                {"property": "Source Platform", "select": {"equals": "Prediction Market"}},
                {"property": "Date Captured", "date": {"on_or_after": cutoff}},
            ]
        },
    )
    signals = []
    for p in pages:
        props = p["properties"]
        title = get_page_title(p)
        raw_rt = (props.get("Raw Content") or {}).get("rich_text") or []
        raw = raw_rt[0]["plain_text"] if raw_rt else ""
        summary_rt = (props.get("Summary") or {}).get("rich_text") or []
        summary = summary_rt[0]["plain_text"] if summary_rt else ""
        signals.append({"title": title, "raw": raw[:400], "summary": summary[:200]})
    return signals[:20]


def load_existing_moments() -> list:
    """Load all non-Passed, non-Missed moment predictions."""
    if not MOMENTS_DB:
        return []
    pages = query_database(
        MOMENTS_DB,
        filter_obj={
            "and": [
                {"property": "Status", "select": {"does_not_equal": "Passed"}},
                {"property": "Status", "select": {"does_not_equal": "Missed"}},
            ]
        },
    )
    moments = []
    for p in pages:
        props = p["properties"]
        name = get_page_title(p)
        narrative_rt = (props.get("Narrative") or {}).get("rich_text") or []
        narrative = narrative_rt[0]["plain_text"] if narrative_rt else ""
        mtype = ((props.get("Type") or {}).get("select") or {}).get("name", "")
        horizon = ((props.get("Horizon") or {}).get("select") or {}).get("name", "")
        status = ((props.get("Status") or {}).get("select") or {}).get("name", "Predicted")
        confidence = (props.get("Confidence") or {}).get("number") or 0
        magnitude = (props.get("Magnitude") or {}).get("number") or 0
        watch_rt = (props.get("Watch For") or {}).get("rich_text") or []
        watch = watch_rt[0]["plain_text"] if watch_rt else ""
        reasoning_rt = (props.get("Reasoning") or {}).get("rich_text") or []
        reasoning = reasoning_rt[0]["plain_text"] if reasoning_rt else ""
        window_start = ((props.get("Predicted Window Start") or {}).get("date") or {}).get("start", "")
        window_end = ((props.get("Predicted Window End") or {}).get("date") or {}).get("start", "")
        moments.append({
            "id": p["id"], "name": name, "narrative": narrative[:300],
            "type": mtype, "horizon": horizon, "status": status,
            "confidence": confidence, "magnitude": magnitude,
            "watch_for": watch[:200], "reasoning": reasoning[:200],
            "window_start": window_start, "window_end": window_end,
        })
    return moments


def compute_velocity_summary(velocity: dict) -> list:
    """
    Compute velocity summaries for each trend: total signals in last 7d,
    acceleration (last 3d vs prior 3d).
    """
    today_d = date.today()
    summaries = []

    for trend_name, daily_counts in velocity.items():
        # Last 7 days total
        last_7d = sum(
            count for d, count in daily_counts.items()
            if d >= (today_d - timedelta(days=7)).isoformat()
        )
        # Last 3 days vs prior 3 days (acceleration)
        last_3d = sum(
            count for d, count in daily_counts.items()
            if d >= (today_d - timedelta(days=3)).isoformat()
        )
        prior_3d = sum(
            count for d, count in daily_counts.items()
            if (today_d - timedelta(days=6)).isoformat() <= d < (today_d - timedelta(days=3)).isoformat()
        )

        if last_7d > 0:
            accel = "accelerating" if last_3d > prior_3d * 1.5 else (
                "decelerating" if prior_3d > last_3d * 1.5 else "steady"
            )
            summaries.append({
                "trend": trend_name,
                "signals_7d": last_7d,
                "signals_3d": last_3d,
                "acceleration": accel,
            })

    return sorted(summaries, key=lambda x: -x["signals_7d"])[:20]


# ── Claude moment generation ──────────────────────────────────────────────────

MOMENT_PROMPT = """You are a cultural moment forecaster — the best in the world at predicting what's about to take over the conversation before it happens. You don't predict the obvious. You predict the specific.

The Bezos wedding? You'd have called it — billionaire spectacle during peak wealth-inequality tension. An Olympic athlete going viral? You'd have seen it — massive global stage meets a public hungry for authentic joy during cultural exhaustion.

Your job: look at the cultural landscape below and predict SPECIFIC cultural moments that are likely to crystallize in the coming days, weeks, and months. Not "something will happen" — but "THIS is what will happen, because of THESE forces, and HERE'S what to watch for."

Today: {today}

═══ ACTIVE CULTURAL TENSIONS (the underlying forces) ═══
{tensions_data}

═══ TOP TRENDS (what's moving right now) ═══
{trends_data}

═══ SIGNAL VELOCITY (what's accelerating) ═══
{velocity_data}

═══ UPCOMING CATALYSTS (events that could trigger moments) ═══
{calendar_data}

═══ ACTIVE COLLISIONS (converging trends — explosion points) ═══
{collision_data}

═══ SOCIAL PULSE (fast-moving signals, last 48h) ═══
{social_pulse_data}

These are raw social signals from TikTok, X/Twitter, Reddit, and Bluesky — the fastest-moving layer of the cultural landscape. Many haven't coalesced into formal trends yet. Use them to:
- Spot moments FORMING on social before they show up in trend data
- Identify narrative velocity that isn't captured by 7-day trend windows
- Cross-reference with tensions and trends to predict what social chatter becomes a cultural moment
Signals marked with [ENRICHED] have news context explaining WHY they're trending.

═══ PREDICTION MARKET INTELLIGENCE (money-backed probabilities) ═══
{prediction_market_data}

HOW TO USE PREDICTION MARKETS:
Polymarket data serves two distinct roles depending on what the market is about:

1. SOME MARKETS ARE CULTURAL MOMENTS THEMSELVES:
   "Will an AI-generated film win a major award?" — that IS a cultural flashpoint. The market existing with $500k volume tells you the cultural tension is real and money-backed. Use probability + volume as direct evidence for confidence scoring.
   "Will a major brand exit International Women's Day?" — same. The market IS the cultural signal.
   When a market is directly about culture, identity, media, or consumer behavior, treat it as high-quality moment evidence.

2. SOME MARKETS ARE CATALYSTS FOR CULTURAL MOMENTS:
   "Fed cuts rates" is a world event. But it CATALYZES cultural moments: "Rate cut triggers generational housing despair discourse" or "Financial influencers clash over 'told you so' narratives."
   "Ukraine ceasefire" is geopolitics. But it catalyzes: "Ceasefire becomes backdrop for fractured trust-in-institutions debate."
   For these, use resolution dates for TIMING and probabilities to assess WHETHER the catalyst fires — but predict the CULTURAL FALLOUT, not the event.

USE prediction markets for:
- TIMING: Resolution dates = when attention concentrates. Combine with calendar events and tensions.
- CONVICTION: High volume ($500k+) = significant public stakes. Use as evidence density.
- NARRATIVE SHIFT: Large price swings (10%+) = something just changed. Ask what cultural conversation this accelerates.
- PROBABILITY: Factor into whether a catalyst will fire and calibrate confidence accordingly.

GUARD AGAINST:
- Filling predictions with events that lack cultural dimension (pure finance, sports outcomes, crypto)
- Every prediction must still intersect 2+ cultural tensions — Polymarket data strengthens the case but doesn't replace the tension requirement
- If a prediction reads like a betting slip rather than a cultural forecast, rewrite it

═══ EXISTING PREDICTIONS (update or retire these) ═══
{existing_moments}

═══════════════════════════════════════════════════

INSTRUCTIONS:

1. REVIEW existing predictions first:
   - For each existing prediction, decide: KEEP (update confidence if warranted), UPGRADE to "Forming" or "Happening" if you see evidence, RETIRE to "Missed" if the window has passed, or KEEP as-is.
   - Return updates as part of your response.

2. GENERATE new predictions (only if they're genuinely novel — don't duplicate existing ones):
   - Each prediction must trace a clear reasoning chain: [tensions] + [trends/velocity] + [catalyst] = [predicted moment]
   - Include 3-5 specific "watch for" indicators
   - Score confidence (0-100) based on evidence density, NOT vibes
   - Score magnitude (0-100) based on how culturally significant this would be

3. PREDICTION TYPES:
   - Catalyst: A known upcoming event + active tensions → specific cultural outcome
   - Collision: Two or more converging trends → inevitable flashpoint
   - Pressure: Building signal velocity → breakout/tipping point
   - Pattern: Seasonal/cyclical moment + current cultural context → novel expression
   - Void: Something conspicuously absent from discourse → the absence becomes the story

4. TIME HORIZONS:
   - "This Week": High confidence, very specific. Window: next 7 days.
   - "2-4 Weeks": Medium confidence, directional. Window: 8-28 days.
   - "1-3 Months": Lower confidence, thematic. Window: 29-90 days.

5. QUALITY RULES:
   - Be SPECIFIC. Not "something will go viral" but "a [type of thing] will [specific outcome] because [reasoning]"
   - Every prediction must intersect at least 2 active tensions
   - Don't predict things that are already well-known/obvious (Super Bowl will be big — no shit)
   - DO predict the non-obvious outcome OF obvious events (which SPECIFIC narrative will dominate the Super Bowl conversation)
   - Maximum {max_moments} active predictions total (including existing ones)
   - Generate 5-8 new predictions maximum per run — focus on quality over quantity
   - Keep narratives to 2-3 sentences, watch_for to 3-4 items, reasoning to 2 sentences
   - If you can't find strong evidence for a prediction, don't force it

6. TEMPORAL ACCURACY (critical):
   - When referencing future events, ALWAYS include the specific date or year in the narrative. "YouTube-only Oscars starting in 2029" not "Oscars moving to YouTube."
   - The prediction window (window_start/window_end) is when the CULTURAL CONVERSATION happens, NOT when the event itself occurs. An event in 2029 can trigger cultural discourse THIS WEEK — but the narrative must make that distinction crystal clear.
   - Never frame a distant future event as imminent. If the event is years away, the prediction is about the REACTION to the announcement or the DISCOURSE it triggers, and that must be explicit.
   - A reader should never be confused about whether you're predicting the event itself or the conversation about it.

Respond with a JSON object. No other text. Format:
{{
  "updates": [
    {{
      "id": "<existing moment Notion ID>",
      "new_status": "Predicted | Forming | Happening | Passed | Missed",
      "new_confidence": <0-100 or null to keep unchanged>,
      "new_narrative": "<revised narrative if the current one is factually wrong, temporally misleading, or stale — otherwise omit>",
      "reason": "<1 sentence on why you're changing this>"
    }}
  ],
  "new_moments": [
    {{
      "title": "<Specific, evocative title — 5-10 words>",
      "narrative": "<2-3 sentences: what will happen, why, and why it matters>",
      "type": "Catalyst | Collision | Pressure | Pattern | Void",
      "horizon": "This Week | 2-4 Weeks | 1-3 Months",
      "confidence": <0-100>,
      "magnitude": <0-100>,
      "watch_for": "<3-5 specific indicators, separated by semicolons>",
      "reasoning": "<The chain: these tensions + these trends + this catalyst = this moment>",
      "window_start": "YYYY-MM-DD",
      "window_end": "YYYY-MM-DD",
      "linked_trend_names": ["trend name 1", "trend name 2"],
      "linked_tension_names": ["tension name 1", "tension name 2"],
      "linked_event_names": ["event name 1"]
    }}
  ]
}}"""


def generate_moments(tensions, trends, velocity_summaries, events, collisions, existing_moments, prediction_market_signals=None, social_pulse=None):
    """Call Claude to generate/update moment predictions."""
    if prediction_market_signals is None:
        prediction_market_signals = []
    if social_pulse is None:
        social_pulse = []

    tensions_data = "\n".join([
        f"- {t['name']} (weight: {t['weight']}/10): {t['description']}"
        for t in tensions[:15]
    ]) or "(no active tensions)"

    trends_data = "\n".join([
        f"- {t['name']} [{t['type']}] CPS:{t['cps']} Status:{t['status']} "
        f"Sparkline:[{t['sparkline']}]"
        f"\n  {t['summary']}"
        for t in trends[:25]
    ]) or "(no active trends)"

    velocity_data = "\n".join([
        f"- {v['trend']}: {v['signals_7d']} signals/7d, {v['signals_3d']} signals/3d — {v['acceleration']}"
        for v in velocity_summaries[:15]
    ]) or "(no velocity data yet — first run)"

    calendar_data = "\n".join([
        f"- {e['date']}: {e['name']} [CPS:{e['cps']}] ({', '.join(e['categories'])})"
        f"\n  {e['notes']}"
        for e in events[:20]
    ]) or "(no upcoming events)"

    collision_data = "\n".join([
        f"- '{c['trend_a']}' (CPS {c['cps_a']}) + '{c['trend_b']}' (CPS {c['cps_b']}) "
        f"→ shared: {', '.join(c['shared_tensions'])} [combined: {c['combined_cps']}]"
        for c in collisions[:8]
    ]) or "(no active collisions)"

    social_pulse_data = "\n".join([
        f"- {'[ENRICHED] ' if s.get('has_context') else ''}[{s['platform']}] {s['title']}"
        f"\n  {s['raw'][:300]}"
        for s in social_pulse
    ]) or "(no recent social signals)"

    prediction_market_data = "\n".join([
        f"- {s['title']}\n  {s['raw']}"
        for s in prediction_market_signals
    ]) or "(no prediction market data available)"

    existing_str = "\n".join([
        f"- [{m['id']}] \"{m['name']}\" ({m['type']}, {m['horizon']}, {m['status']}) "
        f"confidence:{m['confidence']} magnitude:{m['magnitude']}"
        f"\n  {m['narrative']}"
        f"\n  Window: {m['window_start']} → {m['window_end']}"
        for m in existing_moments
    ]) or "(no existing predictions — this is the first run)"

    # Calculate how many new moments we can add
    active_count = len([m for m in existing_moments if m["status"] in ("Predicted", "Forming", "Happening")])
    slots_available = max(0, MAX_ACTIVE_MOMENTS - active_count)

    prompt = MOMENT_PROMPT.format(
        today=TODAY,
        tensions_data=tensions_data,
        trends_data=trends_data,
        velocity_data=velocity_data,
        calendar_data=calendar_data,
        collision_data=collision_data,
        social_pulse_data=social_pulse_data,
        prediction_market_data=prediction_market_data,
        existing_moments=existing_str,
        max_moments=MAX_ACTIVE_MOMENTS,
    )

    logger.info("Calling Claude for moment predictions...")
    logger.info(f"  Active: {active_count}, Slots: {slots_available}")

    max_retries = 2
    for attempt in range(max_retries):
        try:
            messages = [{"role": "user", "content": prompt}]

            # On retry, add a brevity instruction after a truncation failure
            if attempt > 0:
                logger.info(f"  Retry {attempt}/{max_retries - 1}: requesting shorter response...")
                messages.append({"role": "assistant", "content": '{"updates": ['})
                messages[0]["content"] += (
                    "\n\nIMPORTANT: Your previous response was truncated because it was too long. "
                    "Keep narratives to 1-2 sentences, watch_for to 3 items max, reasoning to 1 sentence. "
                    "Generate at most 4 new predictions. Brevity is critical — the response MUST fit within the token limit."
                )

            message = client.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=8192,
                messages=messages,
            )
            # Token usage logging
            usage = message.usage
            logger.info(
                f"  [TOKENS] moment_forecaster: "
                f"input={usage.input_tokens} output={usage.output_tokens} "
                f"total={usage.input_tokens + usage.output_tokens} "
                f"cost=${usage.input_tokens * 3 / 1_000_000 + usage.output_tokens * 15 / 1_000_000:.4f}"
            )
            raw = message.content[0].text.strip()
            stop_reason = message.stop_reason

            # If we prefilled on retry, prepend the prefill
            if attempt > 0:
                raw = '{"updates": [' + raw

            # Parse JSON (handle markdown code blocks)
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]

            # Check if response was truncated (hit max_tokens instead of natural stop)
            if stop_reason == "max_tokens":
                logger.warning(f"Claude response truncated (hit max_tokens). Attempt {attempt + 1}/{max_retries}.")
                # Try repair before retrying
                repaired = _repair_truncated_json(raw)
                if repaired:
                    logger.info("Successfully repaired truncated JSON.")
                    return repaired
                # If repair failed and we have retries left, try again
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                logger.error("JSON repair failed after truncation and no retries left.")
                return {"updates": [], "new_moments": []}

            # Try direct parse
            try:
                result = json.loads(raw)
                return result
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parse failed: {e}")
                # Try repair
                repaired = _repair_truncated_json(raw)
                if repaired:
                    logger.info("Successfully repaired malformed JSON.")
                    return repaired
                # If we have retries left, try again
                if attempt < max_retries - 1:
                    logger.warning("Repair failed, will retry with brevity instruction...")
                    time.sleep(2)
                    continue
                logger.error(f"JSON repair failed. First 500 chars: {raw[:500]}")
                return {"updates": [], "new_moments": []}

        except anthropic.APIStatusError as e:
            if e.status_code == 529:
                logger.warning("API overloaded, waiting 10s before retry...")
                time.sleep(10)
                continue
            else:
                raise
        except Exception as e:
            logger.error(f"Claude API call failed: {e}")
            return {"updates": [], "new_moments": []}

    return {"updates": [], "new_moments": []}


def _repair_truncated_json(raw: str):
    """
    Attempt to repair truncated JSON from Claude responses.

    Strategies (in order):
    1. Close unterminated strings, then try closing brackets/braces
    2. Find the last complete JSON object and close the structure
    3. Progressive truncation to find a parseable prefix
    """
    if not raw or not raw.strip():
        return None

    try:
        # Strategy 1: Fix unterminated strings then close the structure
        # Count quotes to see if we have an unterminated string
        repaired = _close_unterminated_string(raw)
        if repaired:
            # Now try closing the JSON structure by finding the last complete object
            result = _try_close_structure(repaired)
            if result:
                logger.info("JSON repaired via unterminated string fix + structure close")
                return result

        # Strategy 2: Find the last complete object boundary and truncate there
        # Look for the last "}," or "}" that could end a complete array element
        result = _truncate_to_last_complete_object(raw)
        if result:
            logger.info("JSON repaired via truncation to last complete object")
            return result

        # Strategy 3: Progressive truncation (original approach but more efficient)
        # Start from the last "}" and work backwards in larger steps
        last_brace = raw.rfind("}")
        if last_brace == -1:
            return None

        # Try at each "}" position working backwards
        pos = last_brace
        while pos > 0:
            candidate = raw[:pos + 1]
            for suffix in ["", "]}", "\n]}", "\n  ]\n}"]:
                try:
                    result = json.loads(candidate + suffix)
                    if isinstance(result, dict):
                        logger.info(f"JSON repaired by truncating at position {pos}")
                        return result
                except json.JSONDecodeError:
                    continue
            # Jump to the previous "}"
            pos = raw.rfind("}", 0, pos)

        return None

    except Exception as e:
        logger.debug(f"JSON repair exception: {e}")
        return None


def _close_unterminated_string(raw: str) -> str:
    """
    If the JSON has an unterminated string (odd number of unescaped quotes),
    close it with a quote character.
    """
    # Count unescaped quotes
    in_string = False
    i = 0
    while i < len(raw):
        ch = raw[i]
        if ch == '\\' and in_string:
            i += 2  # skip escaped character
            continue
        if ch == '"':
            in_string = not in_string
        i += 1

    if in_string:
        # We're inside an unterminated string -- close it
        # Strip any trailing incomplete escape sequence
        stripped = raw.rstrip('\\')
        return stripped + '"'

    return raw


def _try_close_structure(raw: str):
    """
    Try to close a JSON structure by appending combinations of brackets/braces.
    More targeted than brute force: counts open brackets to determine what's needed.
    """
    # Count unclosed brackets/braces (outside of strings)
    open_braces = 0
    open_brackets = 0
    in_string = False
    i = 0
    while i < len(raw):
        ch = raw[i]
        if ch == '\\' and in_string:
            i += 2
            continue
        if ch == '"':
            in_string = not in_string
        elif not in_string:
            if ch == '{':
                open_braces += 1
            elif ch == '}':
                open_braces -= 1
            elif ch == '[':
                open_brackets += 1
            elif ch == ']':
                open_brackets -= 1
        i += 1

    if open_braces < 0 or open_brackets < 0:
        return None  # More closes than opens -- something is deeply wrong

    # Build the closing suffix
    # The structure is typically: { "updates": [...], "new_moments": [...] }
    # So we need to close: any open string, then ] for arrays, then } for objects
    suffix = "]" * open_brackets + "}" * open_braces

    if not suffix:
        # Already balanced -- try parsing as-is
        try:
            result = json.loads(raw)
            return result if isinstance(result, dict) else None
        except json.JSONDecodeError:
            return None

    # The raw might end mid-value (e.g., after a comma or colon).
    # Try with and without trimming the trailing partial value.
    candidates = [raw]

    # Also try stripping a trailing partial key-value or array element
    # (e.g., raw ends with '  "watch_for": "some text that got cut')
    # Find the last comma before the end and truncate there
    last_comma = raw.rfind(",")
    if last_comma > len(raw) * 0.5:  # Only if comma is in the latter half
        candidates.append(raw[:last_comma])

    for candidate in candidates:
        # Recount for this candidate
        ob, obrk = 0, 0
        in_s = False
        j = 0
        while j < len(candidate):
            c = candidate[j]
            if c == '\\' and in_s:
                j += 2
                continue
            if c == '"':
                in_s = not in_s
            elif not in_s:
                if c == '{':
                    ob += 1
                elif c == '}':
                    ob -= 1
                elif c == '[':
                    obrk += 1
                elif c == ']':
                    obrk -= 1
            j += 1

        if in_s:
            candidate = candidate.rstrip('\\') + '"'
            # Don't recount -- the quote just closes the string

        close = "]" * max(0, obrk) + "}" * max(0, ob)
        try:
            result = json.loads(candidate + close)
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            continue

    return None


def _truncate_to_last_complete_object(raw: str):
    """
    Find the last complete JSON object in an array context and close the structure.
    Looks for '},' or '}]' patterns that indicate a complete array element.
    """
    import re

    # Find all positions where a complete object ends ("},")
    # These are reliable truncation points
    pattern = re.compile(r'\}\s*,')
    matches = list(pattern.finditer(raw))

    # Try from the last match backwards
    for match in reversed(matches):
        # Truncate right after the "}"
        candidate = raw[:match.start() + 1]

        # Try closing the structure
        for suffix in ["]}", "\n  ]\n}", "\n]\n}"]:
            try:
                result = json.loads(candidate + suffix)
                if isinstance(result, dict):
                    return result
            except json.JSONDecodeError:
                continue

    return None


# ── Notion write operations ───────────────────────────────────────────────────

def apply_updates(updates: list, existing_moments: list):
    """Apply status/confidence updates to existing moments."""
    moment_map = {m["id"]: m for m in existing_moments}

    for upd in updates:
        moment_id = upd.get("id")
        if moment_id not in moment_map:
            logger.warning(f"  Unknown moment ID in update: {moment_id}")
            continue

        props = {"Last Updated": {"date": {"start": TODAY}}}

        new_status = upd.get("new_status")
        if new_status and new_status in ("Predicted", "Forming", "Happening", "Passed", "Missed"):
            props["Status"] = {"select": {"name": new_status}}

        new_conf = upd.get("new_confidence")
        if new_conf is not None:
            props["Confidence"] = {"number": max(0, min(100, int(new_conf)))}

        new_narrative = upd.get("new_narrative")
        if new_narrative:
            props["Narrative"] = {"rich_text": rich_text(new_narrative[:2000])}

        try:
            update_page(moment_id, props)
            logger.info(
                f"  Updated: '{moment_map[moment_id]['name']}' "
                f"→ {new_status or 'no status change'} "
                f"(confidence: {new_conf or 'unchanged'})"
                f"{' [narrative revised]' if new_narrative else ''}"
            )
        except Exception as e:
            logger.warning(f"  Failed to update moment {moment_id}: {e}")

        time.sleep(0.35)


def create_new_moments(
    new_moments: list,
    trends: list,
    tensions: list,
    events: list,
    max_to_create: int,
):
    """Create new moment predictions in Notion."""
    trend_name_to_id = {t["name"]: t["id"] for t in trends}
    tension_name_to_id = {t["name"]: t["id"] for t in tensions}
    event_name_to_id = {e["name"]: e["id"] for e in events}

    created = 0
    for moment in new_moments[:max_to_create]:
        try:
            title = moment.get("title", "Unnamed Moment")[:200]
            narrative = moment.get("narrative", "")[:2000]
            mtype = moment.get("type", "Catalyst")
            horizon = moment.get("horizon", "2-4 Weeks")
            confidence = max(0, min(100, int(moment.get("confidence", 50))))
            magnitude = max(0, min(100, int(moment.get("magnitude", 50))))
            watch_for = moment.get("watch_for", "")[:2000]
            reasoning = moment.get("reasoning", "")[:2000]
            window_start = moment.get("window_start", TODAY)
            window_end = moment.get("window_end", (date.today() + timedelta(days=30)).isoformat())

            # Build relation arrays
            linked_trends = []
            for tname in moment.get("linked_trend_names", []):
                tid = trend_name_to_id.get(tname)
                if tid:
                    linked_trends.append({"id": tid})

            linked_tensions = []
            for tname in moment.get("linked_tension_names", []):
                tid = tension_name_to_id.get(tname)
                if tid:
                    linked_tensions.append({"id": tid})

            linked_events = []
            for ename in moment.get("linked_event_names", []):
                eid = event_name_to_id.get(ename)
                if eid:
                    linked_events.append({"id": eid})

            props = {
                "Name": {"title": [{"text": {"content": title}}]},
                "Narrative": {"rich_text": rich_text(narrative)},
                "Type": {"select": {"name": mtype}},
                "Horizon": {"select": {"name": horizon}},
                "Status": {"select": {"name": "Predicted"}},
                "Confidence": {"number": confidence},
                "Magnitude": {"number": magnitude},
                "Watch For": {"rich_text": rich_text(watch_for)},
                "Reasoning": {"rich_text": rich_text(reasoning)},
                "Predicted Window Start": {"date": {"start": window_start}},
                "Predicted Window End": {"date": {"start": window_end}},
                "Created Date": {"date": {"start": TODAY}},
                "Last Updated": {"date": {"start": TODAY}},
            }

            if linked_trends:
                props["Linked Trends"] = {"relation": linked_trends}
            if linked_tensions:
                props["Linked Tensions"] = {"relation": linked_tensions}
            if linked_events:
                props["Linked Calendar Events"] = {"relation": linked_events}

            create_page(MOMENTS_DB, props)
            created += 1
            logger.info(
                f"  + New moment: \"{title}\" "
                f"[{mtype}/{horizon}] confidence:{confidence} magnitude:{magnitude}"
            )

            time.sleep(0.35)

        except Exception as e:
            logger.error(f"  Failed to create moment '{moment.get('title', '?')}': {e}")

    return created


# ── Auto-retire expired predictions ──────────────────────────────────────────

def retire_expired_moments(existing_moments: list) -> int:
    """
    Auto-retire moments whose prediction window has passed without
    being marked as Happening or Passed.
    """
    retired = 0
    today_d = date.today()

    for m in existing_moments:
        if m["status"] not in ("Predicted", "Forming"):
            continue

        window_end = m.get("window_end")
        if not window_end:
            continue

        try:
            end_d = date.fromisoformat(window_end[:10])
            if end_d < today_d:
                update_page(m["id"], {
                    "Status": {"select": {"name": "Missed"}},
                    "Last Updated": {"date": {"start": TODAY}},
                    "Outcome Notes": {"rich_text": rich_text("Auto-retired: prediction window expired without confirmation.")},
                })
                logger.info(f"  Retired (expired): '{m['name']}' (window ended {window_end})")
                retired += 1
                time.sleep(0.35)
        except (ValueError, TypeError):
            continue

    return retired


# ── Main ──────────────────────────────────────────────────────────────────────

def run() -> dict:
    """
    Full moment forecasting job:
    1. Load all context data
    2. Auto-retire expired predictions
    3. Call Claude to generate/update moments
    4. Apply updates and create new moments
    """
    if not MOMENTS_DB:
        logger.error("NOTION_MOMENTS_DB not set — cannot run moment forecaster")
        return {"error": "NOTION_MOMENTS_DB not set"}

    logger.info("=== Cultural Moments Forecaster ===")

    # Load context
    logger.info("Loading cultural landscape data...")
    tensions = load_tensions()
    trends = load_top_trends(30)
    events = load_calendar_events(60)
    collisions = load_collisions()
    velocity = load_velocity()
    velocity_summaries = compute_velocity_summary(velocity)
    existing_moments = load_existing_moments()

    prediction_market_signals = load_prediction_market_signals(days=7)
    social_pulse = load_social_pulse(days=2, limit=10)

    logger.info(
        f"Context: {len(tensions)} tensions, {len(trends)} trends, "
        f"{len(events)} events, {len(collisions)} collisions, "
        f"{len(velocity_summaries)} velocity entries, "
        f"{len(existing_moments)} existing moments, "
        f"{len(prediction_market_signals)} prediction market signals, "
        f"{len(social_pulse)} social pulse signals"
    )

    # Auto-retire expired predictions
    retired = retire_expired_moments(existing_moments)
    if retired:
        logger.info(f"Auto-retired {retired} expired prediction(s)")
        # Reload after retirement
        existing_moments = [m for m in existing_moments if m["status"] in ("Predicted", "Forming", "Happening")]

    # Generate / update via Claude
    result = generate_moments(
        tensions, trends, velocity_summaries, events, collisions, existing_moments,
        prediction_market_signals=prediction_market_signals,
        social_pulse=social_pulse,
    )

    updates = result.get("updates", [])
    new_moments = result.get("new_moments", [])

    logger.info(f"Claude returned: {len(updates)} updates, {len(new_moments)} new moments")

    # Apply updates
    if updates:
        logger.info(f"Applying {len(updates)} update(s)...")
        apply_updates(updates, existing_moments)

    # Create new moments
    active_count = len([m for m in existing_moments if m["status"] in ("Predicted", "Forming", "Happening")])
    slots = max(0, MAX_ACTIVE_MOMENTS - active_count)
    created = 0
    if new_moments and slots > 0:
        logger.info(f"Creating up to {slots} new moment(s)...")
        created = create_new_moments(new_moments, trends, tensions, events, slots)

    summary = {
        "existing_moments": len(existing_moments),
        "retired": retired,
        "updates_applied": len(updates),
        "new_created": created,
        "total_active": active_count + created,
    }

    logger.info(f"\nMoment forecasting complete: {summary}")
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    result = run()
    print(f"\nResults: {result}")
