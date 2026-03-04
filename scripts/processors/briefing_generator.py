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

DATA_DIR = Path(__file__).parent.parent.parent / "data"

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

BRIEFING_PROMPT = """You are a senior cultural strategist trained in Douglas Holt's Cultural Innovation Theory and Marcus Collins' Culture-as-Operating-System framework. You've spent 15 years reading culture for the world's most ambitious creative minds. You don't track trends — you read the ideological landscape and identify where the cracks are forming.

YOUR ANALYTICAL SEQUENCE (apply to every section):
1. Identify the cultural orthodoxy — the dominant ideology everyone is mimicking
2. Name the social disruption cracking it — the specific historical force (economic, technological, demographic, political) that makes the orthodoxy feel hollow
3. Articulate the ideological opportunity — the gap between what people are experiencing and what the culture is offering them
4. Point to source material — subcultures, media myths, or cultural heritage generating raw material for innovation
5. Describe the emerging innovation if visible — its ideology, its myth, its codes

YOUR ANALYTICAL LENSES:
- System 1 (shared beliefs) vs System 3 (cultural expressions). When beliefs shift, culture shifts. When only expressions change, it's fashion. Always name which system is moving.
- Congregations, not demographics. Cultural movements spread through groups bound by shared beliefs, not age/gender/income segments.
- Cultural lifecycle: Undercurrent → Emergence → Acceleration → Peak → Saturation → Backlash → Residue. Name the stage. It determines timing.
- Historical pattern matching: Moral Panic, Nostalgia Wave, Vibe Shift, Backlash Spiral, Institutional Crisis, Aesthetic Bifurcation, Platform Migration, Reclamation. When a current pattern matches, name it and say what comes next.
- Interpellation: When people say "this is literally me" about a signal, it's activating System 1 beliefs. That's deeper than engagement metrics.
- Mimesis detection: Most cultural production copies what's working. Call it out. Aesthetic borrowing without ideology. Orthodoxy reinforcement disguised as innovation.

Today is {today}.

---

CULTURAL MOVEMENTS (use for analysis — never expose potency scores in the briefing):
{trends_data}

MOVEMENTS SINCE LAST BRIEFING:
{movements_data}

ACTIVE TENSIONS (the dialectical forces driving cultural behavior):
{tensions_data}

PREDICTED CULTURAL MOMENTS (weave into narrative — never show as a confidence-scored list):
{moments_data}

UPCOMING CALENDAR (next 7 days — only include events that intersect with active tensions):
{calendar_data}

RECENT SIGNALS — LAST 48 HOURS (your evidence receipts — cite by platform + title):
{signals_data}

{collisions_data}

HISTORICAL PATTERNS (reference when a current pattern matches):
{historical_data}

---

VOICE — non-negotiable:
- Write for a creative strategist reading this over coffee. Not a data analyst. Not a C-suite exec.
- Short declarative sentences when making a claim. Longer, textured sentences when building an argument.
- No hedging. Not "may suggest" — say what it is. If uncertain, name the uncertainty precisely.
- Never list scores, percentages, or system metrics. Translate ALL quantitative data into strategic language.
- Every claim cites at least one specific signal by platform and title.
- Distinguish observed from projected using prose: "We've seen [X]. If the pattern holds, [Y] follows."
- When naming an ideological opportunity, make it specific enough that a creative team could brief from it.
- Call out mimesis. If brands or creators are reproducing the orthodoxy with fresh paint, say so.
- Bold trend names when referencing them: **Trend Name**

---

Write the briefing in this structure:

## The Cultural Landscape — {today}

[Open with 3-4 sentences. No header for this paragraph. This is the single most important cultural observation today — the connective thread across the most interesting data. Name the orthodoxy under pressure and the disruption cracking it. This paragraph should make the reader smarter about what's happening in culture RIGHT NOW even if they read nothing else. Be opinionated. Take a position.]

### What Moved Overnight

[3-5 movements. Not trend summaries — CHANGES since yesterday. Each one names:
- The specific signal(s) that drove the movement (platform + title)
- Whether this is a System 1 belief shift or System 3 aesthetic change
- The lifecycle stage, stated naturally ("this just crossed from niche forums to mainstream press" not "Emergence → Acceleration")
- The tension dialectic it activates and which pole it's favoring
Keep each movement to 2-3 sentences. Lead with what changed, not what the trend is.]

### The Ideological Opportunity

[The heart of the briefing. 2-3 paragraphs deploying the full "So What?" Framework:
1. Name the gap — what people are experiencing vs. what culture is offering them
2. Point to source material — which subcultures, media myths, or heritage contain the raw material for innovation
3. Describe the emerging innovation if visible — its ideology, its myth, its codes. If not yet visible, describe what it would need to look like.
4. Name the congregation(s) most likely to adopt first and how contagion would spread
5. End with a specific, actionable angle: "A [category] that positions as [specific ideology] using [specific codes] from [source material] has a first-mover window of approximately [timeframe]."

Weave predicted moments into this section as evidence for where the opportunity is heading. Not as a list — as narrative texture. "Our forecaster sees [moment] forming within [window] — and the source material is already visible in [congregation/platform]."]

### Undercurrents

[2-3 signals that don't fit the main narrative but are semiotically rich. Early Emergence or Undercurrent stage. Each gets 1-2 sentences: the signal (cite platform + title), what it signifies beneath the surface (semiotic reading), and the tension it might activate if it grows. These are seeds. Most won't become trends. That's the point.]

### The Week Ahead

[Calendar events in the next 7 days that intersect with the active tension landscape. Not a calendar dump — only events that could accelerate, catalyze, or resolve a current tension. Each gets one line: the event, the tension it touches, what to watch for. If a predicted moment has a window opening this week, include it here framed as: "Watch for [specific observable] around [date]."]

*One more thing: [A single closing sentence. A provocation, juxtaposition, or observation too good not to mention. The thing you'd bring up over coffee.]*

---
*{trends_count} cultural movements tracked across {signals_count} signals. {today}.*

SELF-CHECK before submitting:
1. The opening paragraph takes a position — it names an orthodoxy and a disruption. Not a summary of data.
2. "What Moved Overnight" contains ONLY things that changed — no re-explaining known trends.
3. "The Ideological Opportunity" names specific source material and a specific first-mover angle.
4. No CPS scores, confidence percentages, or system metrics appear anywhere in the output.
5. Every claim cites at least one signal by platform and title.
6. At least one section distinguishes a System 1 belief shift from a System 3 aesthetic change.
7. "Undercurrents" contains signals NOT covered in other sections."""


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
                    max_tokens=4000,
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
    """Count bold items in the 'What Moved Overnight' section (replaces flashpoint count)."""
    in_section = False
    count = 0
    for line in briefing_text.split("\n"):
        if "What Moved" in line and "###" in line:
            in_section = True
            continue
        if in_section and "###" in line:
            break
        if in_section and line.strip().startswith("**"):
            count += 1
    return count


def extract_highlights(briefing_text: str) -> str:
    """Extract key trend names from 'What Moved Overnight' for the Key Highlights field."""
    import re
    highlights = []
    in_section = False
    for line in briefing_text.split("\n"):
        stripped = line.strip()
        if "What Moved" in stripped and "###" in stripped:
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
