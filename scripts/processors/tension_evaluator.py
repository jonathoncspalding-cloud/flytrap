"""
tension_evaluator.py
--------------------
Automated tension lifecycle management. Runs after signal processing to:

1. Discover new tensions — Claude analyzes recent trends and signals to identify
   emerging structural conflicts not captured by the current tension set.
2. Adjust weights — Recalibrate existing tension weights based on signal volume,
   platform spread, and cultural intensity over the last 7 days.
3. Flag dormancy — Tensions with declining signal intersection get flagged.

Runs weekly by default (checks last-run date), can be forced with --force.
"""

import os
import sys
import json
import logging
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

import anthropic
from notion_helper import query_database, create_page, update_page, get_page_title, rich_text

logger = logging.getLogger(__name__)

TENSIONS_DB = os.getenv("NOTION_TENSIONS_DB")
TRENDS_DB   = os.getenv("NOTION_TRENDS_DB")
EVIDENCE_DB = os.getenv("NOTION_EVIDENCE_DB")
TODAY        = date.today().isoformat()

DATA_DIR      = Path(__file__).parent.parent.parent / "data"
STATE_FILE    = DATA_DIR / "tension_eval_state.json"

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


# ── Data loading ───────────────────────────────────────────────────────────────

def load_tensions() -> list:
    """Load all tensions from Notion."""
    pages = query_database(TENSIONS_DB)
    tensions = []
    for p in pages:
        props = p["properties"]
        name     = get_page_title(p)
        weight   = (props.get("Weight") or {}).get("number") or 5
        status   = ((props.get("Status") or {}).get("select") or {}).get("name", "Active")
        desc_rt  = (props.get("Description") or {}).get("rich_text") or []
        desc     = desc_rt[0]["plain_text"] if desc_rt else ""
        tensions.append({
            "id": p["id"], "name": name, "weight": weight,
            "status": status, "description": desc,
        })
    return tensions


def load_recent_trends(days: int = 7) -> list:
    """Load trends updated in the last N days with their linked tensions."""
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    pages = query_database(
        TRENDS_DB,
        filter_obj={
            "and": [
                {"property": "Status", "select": {"does_not_equal": "Archived"}},
                {"property": "Last Updated", "date": {"on_or_after": cutoff}},
            ]
        },
    )
    trends = []
    for p in pages:
        props = p["properties"]
        name     = get_page_title(p)
        cps      = (props.get("Cultural Potency Score") or {}).get("number") or 0
        type_sel = (props.get("Type") or {}).get("select") or {}
        t_type   = type_sel.get("name", "")
        summary  = ((props.get("Summary") or {}).get("rich_text") or [{}])
        summary  = summary[0].get("plain_text", "") if summary and isinstance(summary[0], dict) else ""
        tension_rels = (props.get("Linked Tensions") or {}).get("relation") or []
        tension_ids  = [r["id"] for r in tension_rels]
        trends.append({
            "name": name, "cps": cps, "type": t_type,
            "summary": summary, "tension_ids": tension_ids,
        })
    return sorted(trends, key=lambda t: -t["cps"])


def load_recent_signals(days: int = 7) -> list:
    """Load recent processed signals for context."""
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    pages = query_database(
        EVIDENCE_DB,
        filter_obj={
            "and": [
                {"property": "Date Captured", "date": {"on_or_after": cutoff}},
                {"property": "Linked Trends", "relation": {"is_not_empty": True}},
            ]
        },
    )
    signals = []
    for p in pages:
        props    = p["properties"]
        title    = get_page_title(p)
        plat_sel = (props.get("Source Platform") or {}).get("select") or {}
        platform = plat_sel.get("name", "")
        summ_rt  = (props.get("Summary") or {}).get("rich_text") or []
        summary  = summ_rt[0]["plain_text"] if summ_rt else ""
        sent_sel = (props.get("Sentiment") or {}).get("select") or {}
        sentiment = sent_sel.get("name", "")
        signals.append({
            "title": title, "platform": platform,
            "summary": summary, "sentiment": sentiment,
        })
    return signals[:200]  # Cap for prompt size


# ── State management ────────────────────────────────────────────────────────

def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            return {}
    return {}


def save_state(state: dict):
    DATA_DIR.mkdir(exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))


def should_run(force: bool = False) -> bool:
    """Run weekly unless forced."""
    if force:
        return True
    state = load_state()
    last_run = state.get("last_run")
    if not last_run:
        return True
    days_since = (date.today() - date.fromisoformat(last_run)).days
    return days_since >= 7


# ── Claude evaluation ─────────────────────────────────────────────────────────

TENSION_EVAL_PROMPT = """You are a senior cultural strategist evaluating whether the current set of cultural tensions accurately captures the structural conflicts visible in recent signal data.

CURRENT TENSIONS (with weights 1-10):
{tensions_list}

RECENT HIGH-SIGNAL TRENDS (last 7 days, sorted by cultural intensity):
{trends_list}

SAMPLE OF RECENT SIGNALS (last 7 days):
{signals_list}

Your tasks:

1. NEW TENSIONS: Identify 0-3 genuinely new structural cultural conflicts that are visible in the signal data but NOT captured by any existing tension. A valid new tension must:
   - Be a sustained, unresolved conflict between two opposing values (not just a trending topic)
   - Have evidence across multiple platforms/signals (not just one viral moment)
   - Be distinct from existing tensions (not a subset or reframing)
   - Be relevant to brand strategy and advertising

   SPECIFICITY RULE: A good tension is narrow enough that MOST signals do NOT intersect it.
   If a tension intersects >40% of recent trends, it is too broad and should be split.
   Do not propose broad tensions like "technology changing society" — propose the specific
   conflict within that theme. Example: instead of "trust in institutions declining," propose
   "healthcare system distrust vs. medical authority" or "media credibility crisis vs. citizen journalism."

2. WEIGHT ADJUSTMENTS: For each existing tension, evaluate whether its weight should change based on signal volume and intensity. Only recommend changes of ±1 or ±2 — weights should shift gradually. Consider:
   - How many recent trends intersect this tension?
   - Are signals hitting this tension increasing or decreasing?
   - Is this tension generating flashpoint-level (CPS 80+) activity?

3. DORMANCY FLAGS: Identify any tensions that should be moved to Dormant status because they have very low signal intersection and no recent cultural momentum.

Respond with a JSON object:
{{
  "new_tensions": [
    {{
      "name": "<tension name as X vs. Y format>",
      "weight": <1-10>,
      "description": "<2-3 sentences explaining both sides of the conflict>",
      "evidence": "<1 sentence: which trends/signals support this>"
    }}
  ],
  "weight_adjustments": [
    {{
      "name": "<exact existing tension name>",
      "current_weight": <current>,
      "new_weight": <proposed>,
      "reason": "<1 sentence explanation>"
    }}
  ],
  "dormancy_flags": [
    {{
      "name": "<exact existing tension name>",
      "reason": "<1 sentence>"
    }}
  ],
  "summary": "<2-3 sentence summary of the overall tension landscape shift>"
}}

Be conservative — only propose changes backed by clear evidence in the data. It's better to propose zero new tensions than to force weak ones. Respond ONLY with valid JSON."""


def evaluate_tensions(tensions: list, trends: list, signals: list) -> dict:
    """Ask Claude to evaluate the tension landscape."""
    tensions_list = "\n".join([
        f"- {t['name']} (weight: {t['weight']}/10, status: {t['status']}): {t['description'][:200]}"
        for t in tensions
    ])

    trends_list = "\n".join([
        f"- {t['name']} [{t['type']}] CPS:{t['cps']} — {t['summary'][:120]}"
        for t in trends[:30]
    ]) or "(no recent trends)"

    signals_list = "\n".join([
        f"- [{s['platform']}] {s['title'][:80]} ({s['sentiment']}) — {s['summary'][:100]}"
        for s in signals[:100]
    ]) or "(no recent signals)"

    prompt = TENSION_EVAL_PROMPT.format(
        tensions_list=tensions_list,
        trends_list=trends_list,
        signals_list=signals_list,
    )

    try:
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        # Token usage logging
        usage = message.usage
        logger.info(
            f"  [TOKENS] tension_evaluator: "
            f"input={usage.input_tokens} output={usage.output_tokens} "
            f"total={usage.input_tokens + usage.output_tokens} "
            f"cost=${usage.input_tokens * 3 / 1_000_000 + usage.output_tokens * 15 / 1_000_000:.4f}"
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"Claude response not valid JSON: {e}")
        return {}
    except Exception as e:
        logger.error(f"Claude API call failed: {e}")
        return {}


# ── Apply changes ─────────────────────────────────────────────────────────────

def apply_new_tensions(new_tensions: list, existing_names: set) -> int:
    """Create new tensions in Notion. Returns count created."""
    created = 0
    for t in new_tensions:
        name = t.get("name", "").strip()
        if not name or name in existing_names:
            logger.info(f"  Skipping '{name}' — already exists or empty")
            continue
        try:
            create_page(TENSIONS_DB, {
                "Name":        {"title": [{"text": {"content": name}}]},
                "Weight":      {"number": min(10, max(1, t.get("weight", 5)))},
                "Status":      {"select": {"name": "Active"}},
                "Description": {"rich_text": rich_text(t.get("description", ""))},
            })
            logger.info(f"  + New tension: '{name}' (weight: {t.get('weight', 5)})")
            created += 1
        except Exception as e:
            logger.error(f"  Failed to create tension '{name}': {e}")
    return created


def apply_weight_adjustments(adjustments: list, tension_lookup: dict) -> int:
    """Update tension weights in Notion. Returns count adjusted."""
    adjusted = 0
    for adj in adjustments:
        name        = adj.get("name", "").strip()
        new_weight  = adj.get("new_weight")
        if not name or name not in tension_lookup or new_weight is None:
            continue
        tension = tension_lookup[name]
        if tension["weight"] == new_weight:
            continue
        # Clamp change to ±2 per evaluation
        clamped = max(1, min(10, new_weight))
        diff = clamped - tension["weight"]
        if abs(diff) > 2:
            clamped = tension["weight"] + (2 if diff > 0 else -2)
            clamped = max(1, min(10, clamped))
        try:
            update_page(tension["id"], {
                "Weight":         {"number": clamped},
                "Last Evaluated": {"date": {"start": TODAY}},
            })
            logger.info(f"  ~ Weight: '{name}' {tension['weight']} → {clamped} ({adj.get('reason', '')})")
            adjusted += 1
        except Exception as e:
            logger.error(f"  Failed to update weight for '{name}': {e}")
    return adjusted


def apply_dormancy_flags(flags: list, tension_lookup: dict) -> int:
    """Mark tensions as Dormant. Returns count flagged."""
    flagged = 0
    for f in flags:
        name = f.get("name", "").strip()
        if not name or name not in tension_lookup:
            continue
        tension = tension_lookup[name]
        if tension["status"] == "Dormant":
            continue
        try:
            update_page(tension["id"], {
                "Status":         {"select": {"name": "Dormant"}},
                "Last Evaluated": {"date": {"start": TODAY}},
            })
            logger.info(f"  ⏸ Dormant: '{name}' ({f.get('reason', '')})")
            flagged += 1
        except Exception as e:
            logger.error(f"  Failed to flag '{name}' as dormant: {e}")
    return flagged


# ── Main ──────────────────────────────────────────────────────────────────────

def run(force: bool = False) -> dict:
    """Run tension evaluation. Returns summary dict."""
    if not should_run(force):
        logger.info("Tension evaluation: skipping — last run < 7 days ago")
        return {"skipped": True, "reason": "ran recently"}

    logger.info("Starting tension evaluation...")

    tensions = load_tensions()
    trends   = load_recent_trends(days=7)
    signals  = load_recent_signals(days=7)

    logger.info(f"Loaded: {len(tensions)} tensions, {len(trends)} recent trends, {len(signals)} recent signals")

    if not trends and not signals:
        logger.info("No recent data to evaluate against — skipping.")
        return {"skipped": True, "reason": "no recent data"}

    result = evaluate_tensions(tensions, trends, signals)
    if not result:
        logger.error("Tension evaluation returned no results.")
        return {"error": "empty result"}

    existing_names = {t["name"] for t in tensions}
    tension_lookup = {t["name"]: t for t in tensions}

    new_count = apply_new_tensions(result.get("new_tensions", []), existing_names)
    adj_count = apply_weight_adjustments(result.get("weight_adjustments", []), tension_lookup)
    dor_count = apply_dormancy_flags(result.get("dormancy_flags", []), tension_lookup)

    summary = result.get("summary", "")
    logger.info(f"Tension evaluation complete: +{new_count} new, ~{adj_count} adjusted, ⏸{dor_count} dormant")
    if summary:
        logger.info(f"  Summary: {summary}")

    # Save state
    save_state({
        "last_run": TODAY,
        "new_tensions": new_count,
        "weight_adjustments": adj_count,
        "dormancy_flags": dor_count,
        "summary": summary,
    })

    return {
        "new_tensions": new_count,
        "weight_adjustments": adj_count,
        "dormancy_flags": dor_count,
        "summary": summary,
    }


if __name__ == "__main__":
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description="Tension Evaluator")
    parser.add_argument("--force", action="store_true", help="Force run even if ran recently")
    args = parser.parse_args()
    result = run(force=args.force)
    print(json.dumps(result, indent=2))
