"""
briefing_generator.py  (v3)
----------------------------
Generates the daily cultural strategy briefing using the Claude API.
Reads all data from Notion + local data files, synthesizes into a
strategic briefing format grounded in Cultural Innovation Theory (Holt)
and Culture-as-Operating-System (Collins).

v3: Complete redesign — strategic briefing format replacing data report.
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
from notion_helper import (
    query_database, create_page, get_page_title, rich_text
)

logger = logging.getLogger(__name__)

TRENDS_DB    = os.getenv("NOTION_TRENDS_DB")
TENSIONS_DB  = os.getenv("NOTION_TENSIONS_DB")
CALENDAR_DB  = os.getenv("NOTION_CALENDAR_DB")
EVIDENCE_DB  = os.getenv("NOTION_EVIDENCE_DB")
BRIEFING_DB  = os.getenv("NOTION_BRIEFING_DB")
MOMENTS_DB   = os.getenv("NOTION_MOMENTS_DB")
TODAY        = date.today().isoformat()

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


# ── Data loading ───────────────────────────────────────────────────────────────

def load_trends_for_briefing() -> list:
    """Load all active trends sorted by CPS."""
    pages = query_database(
        TRENDS_DB,
        filter_obj={"property": "Status", "select": {"does_not_equal": "Archived"}}
    )
    trends = []
    for p in pages:
        props       = p["properties"]
        name        = get_page_title(p)
        cps         = (props.get("Cultural Potency Score") or {}).get("number") or 0
        momentum    = (props.get("Momentum Score") or {}).get("number") or 0
        status      = ((props.get("Status") or {}).get("select") or {}).get("name", "")
        trend_type  = ((props.get("Type") or {}).get("select") or {}).get("name", "")
        summary_rt  = (props.get("Summary") or {}).get("rich_text") or []
        summary     = summary_rt[0]["plain_text"] if summary_rt else ""
        pinned      = (props.get("Pinned") or {}).get("checkbox", False)
        sparkline_rt = (props.get("CPS Sparkline") or {}).get("rich_text") or []
        sparkline    = sparkline_rt[0]["plain_text"] if sparkline_rt else ""
        first_detected = ((props.get("First Detected") or {}).get("date") or {}).get("start", "")
        tensions = [r["id"] for r in ((props.get("Linked Tensions") or {}).get("relation") or [])]
        trends.append({
            "name": name, "cps": cps, "momentum": momentum, "status": status,
            "type": trend_type, "summary": summary, "pinned": pinned,
            "sparkline": sparkline, "first_detected": first_detected,
            "tension_ids": tensions,
        })

    return sorted(trends, key=lambda x: x["cps"], reverse=True)


def load_tensions_for_briefing() -> list:
    """Load active tensions with weights and descriptions."""
    pages = query_database(TENSIONS_DB)
    tensions = []
    for p in pages:
        props       = p["properties"]
        name        = get_page_title(p)
        weight      = (props.get("Weight") or {}).get("number") or 5
        status      = ((props.get("Status") or {}).get("select") or {}).get("name", "Active")
        desc_rt     = (props.get("Description") or {}).get("rich_text") or []
        description = desc_rt[0]["plain_text"] if desc_rt else ""
        tid         = p["id"]
        if status != "Dormant":
            tensions.append({"id": tid, "name": name, "weight": weight,
                             "status": status, "description": description})
    return sorted(tensions, key=lambda x: x["weight"], reverse=True)


def load_upcoming_calendar(days: int = 14) -> list:
    """Load calendar events in the next N days."""
    today    = date.today()
    end_date = (today + timedelta(days=days)).isoformat()
    pages    = query_database(
        CALENDAR_DB,
        filter_obj={
            "and": [
                {"property": "Date", "date": {"on_or_after": today.isoformat()}},
                {"property": "Date", "date": {"on_or_before": end_date}},
            ]
        }
    )
    events = []
    for p in pages:
        props      = p["properties"]
        name       = get_page_title(p)
        event_date = ((props.get("Date") or {}).get("date") or {}).get("start", "")
        cps        = (props.get("Cultural Potency Score") or {}).get("number") or 0
        event_type = ((props.get("Type") or {}).get("select") or {}).get("name", "")
        notes_rt   = (props.get("Notes") or {}).get("rich_text") or []
        notes      = notes_rt[0]["plain_text"] if notes_rt else ""
        categories = [o["name"] for o in ((props.get("Category") or {}).get("multi_select") or [])]
        events.append({"name": name, "date": event_date, "cps": cps,
                        "type": event_type, "notes": notes, "categories": categories})
    return sorted(events, key=lambda x: (x["date"], -x["cps"]))


def load_new_signals(hours: int = 48) -> list:
    """Load recent signals from Evidence Log (48h for richer context)."""
    days        = max(1, hours // 24)
    cutoff_date = (date.today() - timedelta(days=days)).isoformat()
    pages       = query_database(
        EVIDENCE_DB,
        filter_obj={"property": "Date Captured", "date": {"on_or_after": cutoff_date}}
    )
    signals = []
    for p in pages:
        props    = p["properties"]
        title    = get_page_title(p)
        platform = ((props.get("Source Platform") or {}).get("select") or {}).get("name", "")
        sum_rt   = (props.get("Summary") or {}).get("rich_text") or []
        summary  = sum_rt[0]["plain_text"] if sum_rt else ""
        sentiment = ((props.get("Sentiment") or {}).get("select") or {}).get("name", "")
        date_captured = ((props.get("Date Captured") or {}).get("date") or {}).get("start", "")
        signals.append({"title": title, "platform": platform, "summary": summary,
                         "sentiment": sentiment, "date": date_captured})
    # Sort by date desc, take top 40 for richer briefing context
    signals.sort(key=lambda x: x.get("date", ""), reverse=True)
    return signals[:40]


def load_active_moments() -> list:
    """Load active cultural moment predictions."""
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
            "name": name, "narrative": narrative[:600], "type": mtype,
            "horizon": horizon, "status": status, "confidence": confidence,
            "magnitude": magnitude, "watch_for": watch[:400],
            "reasoning": reasoning[:400],
            "window_start": window_start, "window_end": window_end,
        })
    return sorted(moments, key=lambda x: (-x["confidence"], -x["magnitude"]))


def load_cps_snapshot() -> dict:
    """Load previous CPS snapshot for delta computation."""
    path = DATA_DIR / "cps_snapshot.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def load_signal_velocity() -> dict:
    """Load signal velocity data for acceleration context."""
    path = DATA_DIR / "signal_velocity.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def load_collisions() -> list:
    """Load collision data from last signal_processor run."""
    path = DATA_DIR / "collisions.json"
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text())
    except Exception:
        return []


def load_brand_context() -> tuple[str, str]:
    """
    Load brand context files from data/brand-context/.
    Returns (formatted_context, comma_separated_brand_names).
    """
    brand_dir = DATA_DIR / "brand-context"
    if not brand_dir.exists():
        return "(no brand context files found)", ""

    contexts = []
    names = []
    for f in sorted(brand_dir.glob("*.md")):
        try:
            content = f.read_text().strip()
            # Extract brand name from first heading
            first_line = content.split("\n")[0]
            name = first_line.lstrip("# ").split("—")[0].strip()
            names.append(name)
            contexts.append(content)
        except Exception as e:
            logger.warning(f"Could not read brand context {f.name}: {e}")

    if not contexts:
        return "(no brand context files found)", ""

    return "\n\n---\n\n".join(contexts), ", ".join(names)


def load_historical_flashpoints() -> list:
    """Load historical flashpoint data for pattern matching."""
    path = DATA_DIR / "historical_flashpoints.json"
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text())
    except Exception:
        return []


# ── Data formatting ───────────────────────────────────────────────────────────

def _potency_band(cps: int) -> str:
    """Translate CPS into qualitative potency language."""
    if cps >= 90: return "very high"
    if cps >= 75: return "high"
    if cps >= 55: return "moderate"
    if cps >= 35: return "emerging"
    return "low"


def _direction_from_sparkline(sparkline: str) -> str:
    """Determine trend direction from sparkline data."""
    if not sparkline:
        return "unknown"
    values = [int(v.strip()) for v in sparkline.split(",") if v.strip().isdigit()]
    if len(values) < 2:
        return "new"
    recent = values[-3:] if len(values) >= 3 else values
    diff = recent[-1] - recent[0]
    if diff > 10: return "accelerating"
    if diff > 3: return "rising"
    if diff < -10: return "declining"
    if diff < -3: return "cooling"
    return "steady"


def _lifecycle_stage(cps: int, direction: str, first_detected: str) -> str:
    """Estimate lifecycle stage from available data."""
    if not first_detected:
        return "unknown"
    try:
        detected = date.fromisoformat(first_detected)
        age_days = (date.today() - detected).days
    except (ValueError, TypeError):
        age_days = 0

    if age_days < 7 and cps < 60:
        return "Undercurrent"
    if age_days < 14 and direction in ("accelerating", "rising"):
        return "Emergence"
    if direction == "accelerating" and cps >= 75:
        return "Acceleration"
    if direction in ("steady", "cooling") and cps >= 85:
        return "Peak"
    if direction in ("declining", "cooling") and cps >= 60:
        return "Saturation"
    if direction == "declining" and cps < 60:
        return "Backlash"
    if direction in ("accelerating", "rising"):
        return "Acceleration"
    return "Active"


def _conviction_label(confidence: int) -> str:
    """Translate confidence percentage to conviction language."""
    if confidence >= 85: return "high conviction"
    if confidence >= 65: return "confident"
    if confidence >= 45: return "watching closely"
    return "early signal"


def compute_cps_deltas(current_trends: list, snapshot: dict) -> list:
    """Compare current trend CPS values against snapshot. Returns list of movement dicts."""
    if not snapshot or "trends" not in snapshot:
        return []

    old_cps = snapshot["trends"]
    movements = []

    for t in current_trends:
        name = t["name"]
        current = t["cps"]
        if name in old_cps:
            diff = current - old_cps[name]
            if abs(diff) >= 10:
                movements.append({"name": name, "old": old_cps[name], "new": current, "diff": diff})
        else:
            movements.append({"name": name, "old": 0, "new": current, "diff": current, "is_new": True})

    movements.sort(key=lambda x: abs(x["diff"]), reverse=True)
    return movements[:12]


def format_trends_strategic(trends: list) -> str:
    """Format trends with qualitative indicators instead of raw scores."""
    lines = []
    for t in trends[:20]:
        direction = _direction_from_sparkline(t.get("sparkline", ""))
        lifecycle = _lifecycle_stage(t["cps"], direction, t.get("first_detected", ""))
        potency = _potency_band(t["cps"])
        line = (
            f"- {t['name']} | {t['type']} | Potency: {potency} | "
            f"Direction: {direction} | Stage: {lifecycle}"
            f"{' | 📌 PINNED' if t.get('pinned') else ''}"
            f"\n  {t['summary'][:250]}"
        )
        lines.append(line)
    return "\n".join(lines) if lines else "(no trends tracked yet)"


def format_tensions_strategic(tensions: list) -> str:
    """Format tensions with descriptions for dialectical analysis."""
    lines = []
    for t in tensions[:12]:
        intensity = "critical" if t["weight"] >= 9 else "high" if t["weight"] >= 7 else "active" if t["weight"] >= 5 else "background"
        line = f"- {t['name']} (intensity: {intensity})"
        if t.get("description"):
            line += f"\n  {t['description'][:200]}"
        lines.append(line)
    return "\n".join(lines) if lines else "(no tensions tracked)"


def format_movements(deltas: list) -> str:
    """Format CPS movements as qualitative direction changes."""
    if not deltas:
        return "(no significant movements since last briefing)"
    lines = []
    for m in deltas:
        if m.get("is_new"):
            lines.append(f"- NEW: \"{m['name']}\" — just detected, potency: {_potency_band(m['new'])}")
        else:
            direction = "surging" if m["diff"] > 20 else "rising" if m["diff"] > 0 else "dropping" if m["diff"] < -20 else "cooling"
            lines.append(f"- \"{m['name']}\" — {direction} (moved significantly since last briefing)")
    return "\n".join(lines)


def format_moments_strategic(moments: list) -> str:
    """Format moments with conviction language instead of confidence scores."""
    if not moments:
        return "(no active predictions)"
    lines = []
    for m in moments[:10]:
        conviction = _conviction_label(m["confidence"])
        status_note = f"Status: {m['status']}" + (f" (window: {m['window_start']} → {m['window_end']})" if m["window_start"] else "")
        line = (
            f"- \"{m['name']}\" [{m['type']}/{m['horizon']}] — {conviction}"
            f"\n  {status_note}"
            f"\n  {m['narrative']}"
        )
        if m.get("watch_for"):
            line += f"\n  Watch for: {m['watch_for']}"
        if m.get("reasoning"):
            line += f"\n  Reasoning: {m['reasoning'][:200]}"
        lines.append(line)
    return "\n".join(lines)


def format_calendar_strategic(calendar: list) -> str:
    """Format calendar with cultural context."""
    if not calendar:
        return "(no events in the next 7 days)"
    lines = []
    for e in calendar[:8]:
        cats = f" [{', '.join(e['categories'])}]" if e.get("categories") else ""
        line = f"- {e['date']}: {e['name']}{cats}"
        if e.get("notes"):
            line += f"\n  {e['notes'][:200]}"
        lines.append(line)
    return "\n".join(lines)


def format_signals_strategic(signals: list) -> str:
    """Format signals as evidence with platform attribution."""
    if not signals:
        return "(no new signals in last 48 hours)"
    lines = []
    for s in signals[:30]:
        line = f"- [{s['platform']}] {s['title'][:120]}"
        if s.get("summary"):
            line += f"\n  {s['summary'][:180]}"
        lines.append(line)
    return "\n".join(lines)


def format_collisions_strategic(collisions: list) -> str:
    """Format only high-specificity collisions as ideological confrontations."""
    if not collisions:
        return ""
    # Filter to collisions with <= 5 shared tensions (more specific = more interesting)
    specific = [c for c in collisions if len(c.get("shared_tensions", [])) <= 5]
    if not specific:
        specific = collisions[:3]
    lines = []
    for c in specific[:4]:
        line = (
            f"- \"{c['trend_a']}\" + \"{c['trend_b']}\" — "
            f"converging on: {', '.join(c['shared_tensions'][:4])}"
        )
        lines.append(line)
    return "NOTABLE COLLISIONS (trends converging on shared tensions):\n" + "\n".join(lines) if lines else ""


# ── Briefing prompt ───────────────────────────────────────────────────────────

BRIEFING_PROMPT = """You write a daily cultural briefing that smart, busy people actually want to read. Think: the friend who always knows what's going on before everyone else, explaining it over coffee. Not a strategy deck. Not an academic paper. A sharp, opinionated, useful read.

Your job: tell people what's happening in culture right now, why it matters, and what to do about it. Skip the jargon. Say it plain. If something is complicated, make it simple without making it dumb.

HOW TO THINK ABOUT THIS:
- Lead with "here's what's actually going on" not "here's what the data shows"
- When something is changing, say what changed and why anyone should care
- When you see an opportunity, describe it like you're telling a friend about a gap in the market
- Use real examples from the signals — name the Reddit post, the TikTok trend, the news story
- If two things are colliding in interesting ways, just say that plainly
- Don't hedge. If you're not sure, say "too early to call" — don't say "this may potentially suggest"
- Bold trend names: **Trend Name**

Today is {today}.

---

CULTURAL MOVEMENTS (reference data — never show scores in the briefing):
{trends_data}

WHAT MOVED SINCE YESTERDAY:
{movements_data}

ACTIVE TENSIONS (the push-pull forces underneath everything):
{tensions_data}

PREDICTIONS WE'RE TRACKING (weave in naturally — don't list with scores):
{moments_data}

UPCOMING EVENTS (next 7 days):
{calendar_data}

RECENT SIGNALS — LAST 48 HOURS (your evidence — cite by platform + title):
{signals_data}

{collisions_data}

HISTORICAL PATTERNS:
{historical_data}

CLIENT BRAND CONTEXT (for the opportunities section):
{brand_context}

---

Write the briefing in this structure. Keep the whole thing scannable — someone should get value from skimming the bold text alone.

## What's Going On — {today}

[3-4 sentences max. The one thing happening in culture right now that matters most. Not a summary of everything — pick the thread that connects the most interesting signals and pull it. Be opinionated. Take a side. This paragraph should make someone smarter about the world even if they read nothing else.]

### What Changed

[3-5 things that actually moved since yesterday. Not trend explainers — movements. Each one is 2-3 sentences max:
- What specifically happened (cite the signal — platform + title)
- Why it matters / what it tells us
- Whether it's early, peaking, or dying
Lead with the change, not the background.]

### The Big Opportunity

[2-3 short paragraphs. The most interesting gap between what people want and what they're being offered right now:
- What's the gap?
- Who's already doing something interesting in this space? (creators, communities, subcultures)
- What would it look like to get this right?
- Is the window opening, wide open, or closing?

If we have predictions forming around this, mention them naturally: "We're watching for [thing] in the next [timeframe] — early signs are already showing up on [platform]."]

### On Our Radar

[2-3 small signals worth watching. Early, unformed, might be nothing. Each gets 1-2 sentences: what we saw, what it might mean. These are seeds, not trends.]

### The Week Ahead

[Only calendar events that intersect with something culturally interesting right now. Each gets one line: what's happening, why it matters for the current landscape, what to watch for. Skip anything that's just a date on a calendar with no cultural charge.]

### Client Opportunities

[For each client below, 1-2 concrete thought starters connecting today's cultural landscape to their brand. These aren't campaigns — they're "have you thought about this?" prompts. Be specific enough that someone could walk into a meeting and start a conversation.

Each entry should:
- Name the cultural movement or tension it connects to
- Explain the connection in plain language (why this matters for THIS brand specifically)
- Suggest a direction, not a tactic (what territory to explore, not what ad to make)

Format as:

**Brand Name**
Thought starter text here. Reference the specific trend or signal that sparked it.

Include entries for: {brand_names}

If nothing from today's signals connects meaningfully to a brand, say so — "Nothing jumping out today" is better than forcing it.]

*One more thing: [A single closing thought. The thing that didn't fit anywhere else but is too interesting not to mention.]*

---
*Tracking {trends_count} cultural movements across {signals_count} signals. {today}.*

SELF-CHECK:
1. Could a smart 25-year-old read this without a strategy glossary? If not, simplify.
2. "What Changed" has ONLY things that changed — not trend explainers.
3. "The Big Opportunity" is specific enough to pitch, not just "there's a space here."
4. No scores, percentages, or system jargon anywhere in the output.
5. Every claim references at least one specific signal.
6. Client opportunities are grounded in today's data, not generic brand advice.
7. The whole briefing could be read in under 5 minutes."""


# ── Briefing generation ────────────────────────────────────────────────────────

def generate_briefing() -> str:
    """Generate the daily briefing text using Claude."""
    logger.info("Loading data for briefing...")

    trends      = load_trends_for_briefing()
    tensions    = load_tensions_for_briefing()
    calendar    = load_upcoming_calendar(days=7)
    signals     = load_new_signals(hours=48)
    collisions  = load_collisions()
    historical  = load_historical_flashpoints()
    moments     = load_active_moments()
    snapshot    = load_cps_snapshot()
    velocity    = load_signal_velocity()
    deltas      = compute_cps_deltas(trends, snapshot)
    brand_context, brand_names = load_brand_context()

    logger.info(
        f"Data: {len(trends)} trends, {len(tensions)} tensions, "
        f"{len(calendar)} events, {len(signals)} signals, "
        f"{len(collisions)} collisions, {len(historical)} historical, "
        f"{len(moments)} active moments, {len(deltas)} CPS movements"
    )

    # Format all data sections strategically
    trends_data     = format_trends_strategic(trends)
    movements_data  = format_movements(deltas)
    tensions_data   = format_tensions_strategic(tensions)
    moments_data    = format_moments_strategic(moments)
    calendar_data   = format_calendar_strategic(calendar)
    signals_data    = format_signals_strategic(signals)
    collisions_data = format_collisions_strategic(collisions)

    # Historical patterns
    if historical:
        historical_data = "\n".join([
            f"- {h['name']} ({h['year']}): {h['summary']}"
            for h in historical[:10]
        ])
    else:
        historical_data = "(no historical patterns loaded)"

    prompt = BRIEFING_PROMPT.format(
        today=TODAY,
        trends_data=trends_data,
        movements_data=movements_data,
        tensions_data=tensions_data,
        moments_data=moments_data,
        calendar_data=calendar_data,
        signals_data=signals_data,
        collisions_data=collisions_data,
        historical_data=historical_data,
        brand_context=brand_context,
        brand_names=brand_names,
        trends_count=len(trends),
        signals_count=len(signals),
    )

    logger.info("Calling Claude API for briefing generation...")
    import time as _time
    for model, attempt in [("claude-sonnet-4-5", 1), ("claude-opus-4-5", 2)]:
        for retry in range(3):
            try:
                message = client.messages.create(
                    model=model,
                    max_tokens=5000,
                    messages=[{"role": "user", "content": prompt}],
                )
                usage = message.usage
                input_rate = 15 if "opus" in model else 3
                output_rate = 75 if "opus" in model else 15
                cost = usage.input_tokens * input_rate / 1_000_000 + usage.output_tokens * output_rate / 1_000_000
                logger.info(
                    f"  [TOKENS] briefing_generator ({model}): "
                    f"input={usage.input_tokens} output={usage.output_tokens} "
                    f"total={usage.input_tokens + usage.output_tokens} "
                    f"cost=${cost:.4f}"
                )
                if attempt == 2:
                    logger.info(f"Briefing generated with fallback model: {model}")
                return message.content[0].text.strip()
            except anthropic.APIStatusError as e:
                if e.status_code == 529:
                    wait = (retry + 1) * 15
                    logger.warning(f"API overloaded (529), retry {retry+1}/3 in {wait}s...")
                    _time.sleep(wait)
                else:
                    raise
        logger.warning(f"{model} overloaded after 3 retries, trying fallback...")
    raise RuntimeError("Both claude-sonnet-4-5 and claude-opus-4-5 returned 529 overloaded")


def count_flashpoints(briefing_text: str) -> int:
    """Count bold items in the 'What Changed' section (replaces flashpoint count)."""
    in_section = False
    count = 0
    for line in briefing_text.split("\n"):
        if ("What Changed" in line or "What Moved" in line) and "###" in line:
            in_section = True
            continue
        if in_section and "###" in line:
            break
        if in_section and line.strip().startswith("**"):
            count += 1
    return count


def extract_highlights(briefing_text: str) -> str:
    """Extract key trend names from 'What Changed' for the Key Highlights field."""
    import re
    highlights = []
    in_section = False
    for line in briefing_text.split("\n"):
        stripped = line.strip()
        if ("What Changed" in stripped or "What Moved" in stripped) and "###" in stripped:
            in_section = True
            continue
        if in_section and stripped.startswith("###"):
            break
        if in_section:
            matches = re.findall(r"\*\*([^*]+)\*\*", stripped)
            for m in matches:
                clean = re.sub(r"\s*\(.*?\)\s*$", "", m).strip()
                if clean and clean not in highlights:
                    highlights.append(clean)
            if len(highlights) >= 5:
                break
    return " · ".join(highlights) if highlights else ""


def chunk_rich_text(text: str, max_bytes: int = 1900) -> list:
    """Split text into Notion rich_text blocks, respecting Notion's 2000-byte limit."""
    chunks = []
    while text:
        encoded     = text.encode("utf-8")
        chunk_bytes = encoded[:max_bytes]
        chunk       = chunk_bytes.decode("utf-8", errors="ignore")
        if not chunk and text:
            chunk = text[:100]
        chunks.append({"text": {"content": chunk}})
        text = text[len(chunk):]
    return chunks


def save_briefing(briefing_text: str) -> str:
    """Save the briefing to Notion Briefing Archive. Returns page ID."""
    flashpoints = count_flashpoints(briefing_text)
    highlights  = extract_highlights(briefing_text)

    page = create_page(BRIEFING_DB, {
        "Date":             {"title": [{"text": {"content": TODAY}}]},
        "Briefing Content": {"rich_text": chunk_rich_text(briefing_text)},
        "Flashpoint Count": {"number": flashpoints},
        "Key Highlights":   {"rich_text": rich_text(highlights[:1999])},
    })
    logger.info(f"Briefing saved to Notion: {page['id']}")
    return page["id"]


def run() -> dict:
    """Main briefing job. Generates and saves today's briefing."""
    logger.info("=== Daily Cultural Strategy Briefing ===")
    try:
        briefing_text = generate_briefing()
        page_id       = save_briefing(briefing_text)

        print("\n" + "="*60)
        print(briefing_text)
        print("="*60)
        print(f"\nBriefing saved to Notion (ID: {page_id})")

        return {"success": True, "page_id": page_id, "length": len(briefing_text)}
    except Exception as e:
        logger.error(f"Briefing generation failed: {e}")
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    result = run()
    if not result["success"]:
        print(f"\nFailed: {result.get('error')}")
        sys.exit(1)
