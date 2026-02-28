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

DATA_DIR = Path(__file__).parent.parent.parent / "data"

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

Respond with a JSON object. No other text. Format:
{{
  "updates": [
    {{
      "id": "<existing moment Notion ID>",
      "new_status": "Predicted | Forming | Happening | Passed | Missed",
      "new_confidence": <0-100 or null to keep unchanged>,
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


def generate_moments(tensions, trends, velocity_summaries, events, collisions, existing_moments):
    """Call Claude to generate/update moment predictions."""

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
        existing_moments=existing_str,
        max_moments=MAX_ACTIVE_MOMENTS,
    )

    logger.info("Calling Claude for moment predictions...")
    logger.info(f"  Active: {active_count}, Slots: {slots_available}")

    for model in ["claude-sonnet-4-5", "claude-sonnet-4-5"]:
        try:
            message = client.messages.create(
                model=model,
                max_tokens=8192,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = message.content[0].text.strip()

            # Parse JSON (handle markdown code blocks)
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]

            # Try direct parse
            try:
                result = json.loads(raw)
                return result
            except json.JSONDecodeError:
                # Try to repair truncated JSON by finding the last complete moment
                # and closing the arrays/object
                logger.warning("JSON parse failed, attempting repair...")
                repaired = _repair_truncated_json(raw)
                if repaired:
                    return repaired
                logger.error(f"JSON repair also failed. First 500 chars: {raw[:500]}")
                return {"updates": [], "new_moments": []}

        except anthropic.APIStatusError as e:
            if e.status_code == 529:
                logger.warning(f"API overloaded, retrying with {model}...")
                time.sleep(10)
            else:
                raise
        except Exception as e:
            logger.error(f"Claude API call failed: {e}")
            return {"updates": [], "new_moments": []}

    return {"updates": [], "new_moments": []}


def _repair_truncated_json(raw: str):
    """Attempt to repair truncated JSON from Claude responses."""
    import re

    try:
        # Strategy 1: Find the last complete object in new_moments array
        # Look for the pattern where we have complete objects
        last_brace = raw.rfind("}")
        if last_brace == -1:
            return None

        # Try progressively trimming from the end
        for end_pos in range(len(raw), max(0, len(raw) - 2000), -1):
            candidate = raw[:end_pos]
            # Try closing off the JSON structure
            for suffix in ["]}", "]}}", "]}}",  "]}]}}", "]\n}", "]\n  }\n}"]:
                try:
                    result = json.loads(candidate + suffix)
                    if isinstance(result, dict):
                        logger.info(f"JSON repaired by truncating at position {end_pos}")
                        return result
                except json.JSONDecodeError:
                    continue

        return None

    except Exception:
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

        try:
            update_page(moment_id, props)
            logger.info(
                f"  Updated: '{moment_map[moment_id]['name']}' "
                f"→ {new_status or 'no status change'} "
                f"(confidence: {new_conf or 'unchanged'})"
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

    logger.info(
        f"Context: {len(tensions)} tensions, {len(trends)} trends, "
        f"{len(events)} events, {len(collisions)} collisions, "
        f"{len(velocity_summaries)} velocity entries, "
        f"{len(existing_moments)} existing moments"
    )

    # Auto-retire expired predictions
    retired = retire_expired_moments(existing_moments)
    if retired:
        logger.info(f"Auto-retired {retired} expired prediction(s)")
        # Reload after retirement
        existing_moments = [m for m in existing_moments if m["status"] in ("Predicted", "Forming", "Happening")]

    # Generate / update via Claude
    result = generate_moments(
        tensions, trends, velocity_summaries, events, collisions, existing_moments
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
