"""
briefing_generator.py  (v2)
----------------------------
Generates the daily cultural briefing using the Claude API.
Reads all data from Notion, synthesizes into the standard briefing format,
and writes the result back to the Briefing Archive database.

v2 additions:
- Collision alerts: surfaces when multiple high-CPS trends converge on same tensions
- Historical flashpoints: gives Claude past cultural moments for calibration context
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

CLIENTS = "A&W, VLEX, Four Roses, LegoLand, Cup Noodles, Busch Light, Natural Light"

CLIENT_PROFILES = """
- A&W: QSR/fast food chain. Family-friendly Americana, core audience 25-54. Known for root beer heritage, nostalgic brand identity, and all-American comfort food positioning.
- VLEX: Legal tech / legal research platform. Audience is attorneys, law firms, legal departments 30-60. Brand is authoritative, modern, efficiency-focused. Cares about trust, institutions, regulation trends.
- Four Roses: Premium bourbon. Craft spirits enthusiasts 28-45. Heritage storytelling, craftsmanship positioning. Culturally adjacent to Southern identity, maker culture, slow living.
- LegoLand: Family entertainment / theme parks. Parents with kids 4-12, plus adult LEGO fans. Playful, creative, imagination-driven. Relevant to nostalgia, play culture, family experience trends.
- Cup Noodles: Instant ramen / convenience food. Young adults 18-34, college students, budget-conscious. Brand leans into internet culture, late-night energy, irreverent humor.
- Busch Light: Value beer, 21-34 male-skewing. Outdoor/rural identity, hunting and fishing culture. Humor-driven marketing, blue-collar authenticity, anti-pretension.
- Natural Light: Value beer, 21-30 college/post-college. Party culture, tailgating, affordability pride. Self-aware, meme-friendly, does not take itself seriously.
"""


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
        trends.append({"name": name, "cps": cps, "momentum": momentum, "status": status,
                        "type": trend_type, "summary": summary, "pinned": pinned})

    return sorted(trends, key=lambda x: x["cps"], reverse=True)


def load_tensions_for_briefing() -> list:
    """Load active tensions with weights."""
    pages = query_database(TENSIONS_DB)
    tensions = []
    for p in pages:
        props       = p["properties"]
        name        = get_page_title(p)
        weight      = (props.get("Weight") or {}).get("number") or 5
        status      = ((props.get("Status") or {}).get("select") or {}).get("name", "Active")
        if status != "Dormant":
            tensions.append({"name": name, "weight": weight, "status": status})
    return sorted(tensions, key=lambda x: x["weight"], reverse=True)


def load_upcoming_calendar(days: int = 30) -> list:
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
        events.append({"name": name, "date": event_date, "cps": cps, "type": event_type, "notes": notes})
    return sorted(events, key=lambda x: (x["date"], -x["cps"]))


def load_new_signals(hours: int = 24) -> list:
    """Load recent signals from Evidence Log."""
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
        signals.append({"title": title, "platform": platform, "summary": summary})
    return signals[:30]


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
        window_start = ((props.get("Predicted Window Start") or {}).get("date") or {}).get("start", "")
        window_end = ((props.get("Predicted Window End") or {}).get("date") or {}).get("start", "")
        moments.append({
            "name": name, "narrative": narrative[:300], "type": mtype,
            "horizon": horizon, "status": status, "confidence": confidence,
            "magnitude": magnitude, "watch_for": watch[:200],
            "window_start": window_start, "window_end": window_end,
        })
    # Sort by confidence desc, then magnitude desc
    return sorted(moments, key=lambda x: (-x["confidence"], -x["magnitude"]))


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
    """Load historical flashpoint data for calibration context."""
    path = DATA_DIR / "historical_flashpoints.json"
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text())
    except Exception:
        return []


# ── Briefing generation ────────────────────────────────────────────────────────

BRIEFING_PROMPT = """You are a senior cultural strategist at a top-tier creative agency. You've been doing this for 15 years. You see things before they're obvious and you say them plainly. You write like you're briefing the smartest person in the room — no hedging, no over-explaining, no throat-clearing.

Today is {today}.

FRAMING: This is a DAILY briefing. Your reader saw yesterday's briefing. Lead with what CHANGED:
- New signals that were not present yesterday
- Trends that moved significantly in CPS or momentum
- Moments that changed status (Predicted → Forming, Forming → Happening)
- Calendar events that entered the 7-day window
Do not re-explain trends your reader already knows. Say what is NEW about them today.

PREDICTED CULTURAL MOMENTS (our forecaster's active predictions — LEAD WITH THESE):
{moments_data}

TRACKED TRENDS (by Cultural Potency Score — higher = more culturally urgent):
{trends_data}

ACTIVE CULTURAL TENSIONS (the underlying forces driving consumer behavior):
{tensions_data}

UPCOMING CALENDAR:
{calendar_data}

NEW SIGNALS — LAST 24 HOURS:
{signals_data}

{collision_section}

HISTORICAL CALIBRATION (past cultural moments for context):
{historical_data}

CLIENTS AND POSITIONING:
{client_profiles}

---

VOICE RULES — these are non-negotiable:
- Short sentences. One idea per sentence. Hard stops.
- No hedging. Not "may suggest" or "could indicate." Say what it is.
- If it's obvious, skip it. Surface what's early, weird, or underappreciated.
- Bold ONLY the trend name — never include CPS scores or numbers inside bold text.
  CORRECT: **Broadcast Truth Suppression** — it's moving fast.
  WRONG: **Broadcast Truth Suppression (CPS: 89)** — don't do this.

CLIENT RULES — keep clients contained:
- Do NOT mention specific clients by name anywhere EXCEPT "The Brief" section at the end.
- Flashpoints, What's Moving, Signals Worth Watching, etc. should be pure cultural analysis.
- The Brief is the ONLY place where you connect trends to specific client opportunities.

EVIDENCE RULES — every claim needs receipts:
- Every claim in Flashpoints and What's Moving must reference at least one specific signal by platform and title. Example: "Reddit thread 'Why I quit streaming' + HN discussion on creator burnout = this is accelerating."
- If you cannot cite a specific signal from the data provided, do not make the claim.
- When recommending a brand angle, connect it to a specific tension or trend — not vibes.

PREDICTION vs. OBSERVATION — make the distinction unmistakable:
- OBSERVED events have happened. They have proof: a signal, a post, a data point, a news story. State them as fact.
- PREDICTED events have NOT happened yet. They are forecasts from our moment forecaster or your own synthesis. Always label these clearly.
- Use these markers consistently:
  🔮 = prediction/forecast (has not happened yet)
  📍 = observed/confirmed (evidence exists in the signal data)
- In any section where predictions and observations coexist, prefix each item so the reader never has to guess.
- The Predicted Moments section is ALL predictions — no need to mark each one. But in Flashpoints, What's Moving, and Collision Alerts, if you reference a predicted moment alongside observed signals, distinguish them clearly.

---

Write the briefing in EXACTLY this format. No deviations.

## {today} Cultural Briefing

### 🔮 Predicted Moments

**Tier 1 — High Conviction (Confidence 70%+):**
[These are near-certainties. For each: **Moment Title** — The prediction in one sentence. Current status. The specific window. Which client must have a plan ready and by when.]

**Tier 2 — Watch Closely (Confidence 40-69%):**
[Worth monitoring. For each: **Moment Title** — The prediction in one sentence. The specific trigger event that would escalate this to Tier 1.]

**Tier 3 — Weak Signal (Confidence <40%):**
[One line each. The moment name and what evidence would make you believe it more.]

[If no moment predictions exist yet, write: "Moment forecaster initializing — predictions will appear after the next pipeline run."]

### 🔴 Flashpoints
[Trends that need immediate attention. If none score 80+, list the 3 closest to breaking.]
[Format per trend: **Trend Name** — What it is in one sentence. The specific signal(s) driving urgency right now (cite by platform + title). Why this matters culturally and where it's heading. Mark each item 📍 (observed) or 🔮 (prediction) to clarify what's proven vs. projected.]

### 📈 What's Moving
[The 4-6 trends gaining the most momentum. What CHANGED today — not a summary of the trend, but what is new. Cite the signal(s) that moved the needle. Where this is heading next — be specific about the next cultural beat, not just "rising."]

{collision_briefing_section}

### 🌊 Signals Worth Watching
[5-7 signals from the last 24h. Choose signals that meet at least ONE of these criteria:
- Not yet linked to any tracked trend (genuinely new territory)
- Contradicts the current momentum of a high-CPS trend
- Comes from a platform where this topic has not previously appeared
- Has unusually high engagement relative to the source's baseline
Lead with the signal, follow with the implication.]

### 🗓️ On Deck
[Cultural moments in the next 14 days with real brand potential. One line each — the event and the angle.]

### 💡 The Brief
[3-4 specific, actionable creative angles. These should be good enough to start a real brief.]
[Format: **[Client]** — [Trend] → [One sentence that could become a campaign thought.]]
[Use the client profiles above. The angle must fit the client's audience, category, and brand voice. Generic angles like "could lean into this" are not acceptable — be specific about the execution.]

---
*{trends_count} trends tracked · {signals_count} new signals · {moments_count} predicted moments · {today}*

SELF-CHECK before submitting — verify all of these:
1. Every Flashpoint cites at least one specific signal by name and platform.
2. Every brand angle in The Brief references a specific client by name and fits their positioning.
3. No sentence contains "may," "could," "might," "potentially," or "it remains to be seen."
4. The Predicted Moments section is at least 25% of the briefing by length.
5. No trend name inside bold text includes a CPS score or number.
6. No client names appear ANYWHERE outside The Brief section.
7. Every item mixing predictions with observations uses 📍 (observed) or 🔮 (prediction) markers so the reader always knows which is which."""


COLLISION_SECTION_TEMPLATE = """
ACTIVE TREND COLLISIONS (multiple high-CPS trends converging on the same tensions — highest risk of cultural explosion):
{collision_list}
"""

COLLISION_BRIEFING_SECTION = """### ⚡ Collision Alerts
[For each collision: name both trends, the shared tensions driving convergence, and ONE bold prediction about what happens when they fully collide — give this a specific date window]
[If no collisions, omit this section entirely]
"""


def _format_collision_section(collisions: list) -> tuple[str, str]:
    """Returns (prompt_context_str, briefing_section_template_str)."""
    if not collisions:
        return "", ""

    collision_list = "\n".join([
        f"- '{c['trend_a']}' (CPS {c['cps_a']}) + '{c['trend_b']}' (CPS {c['cps_b']}) "
        f"→ shared tensions: {', '.join(c['shared_tensions'])} "
        f"[combined: {c['combined_cps']}]"
        for c in collisions[:5]
    ])
    context  = COLLISION_SECTION_TEMPLATE.format(collision_list=collision_list)
    briefing = COLLISION_BRIEFING_SECTION
    return context, briefing


def generate_briefing() -> str:
    """Generate the daily briefing text using Claude."""
    logger.info("Loading data for briefing...")

    trends     = load_trends_for_briefing()
    tensions   = load_tensions_for_briefing()
    calendar   = load_upcoming_calendar(days=30)
    signals    = load_new_signals(hours=24)
    collisions = load_collisions()
    historical = load_historical_flashpoints()
    moments    = load_active_moments()

    logger.info(
        f"Data: {len(trends)} trends, {len(tensions)} tensions, "
        f"{len(calendar)} events, {len(signals)} signals, "
        f"{len(collisions)} collisions, {len(historical)} historical flashpoints, "
        f"{len(moments)} active moments"
    )

    # Format data sections
    if trends:
        trends_data = "\n".join([
            f"- {t['name']} [{t['type']}] CPS:{t['cps']} Status:{t['status']}"
            f" {'📌 PINNED' if t['pinned'] else ''}"
            f"\n  {t['summary'][:200]}"
            for t in trends[:25]
        ])
    else:
        trends_data = "(no trends tracked yet — system just launched)"

    tensions_data = "\n".join([
        f"- {t['name']} (weight: {t['weight']}/10)"
        for t in tensions[:14]
    ])

    if calendar:
        cal_14 = [e for e in calendar if e["date"] <= (date.today() + timedelta(days=14)).isoformat()]
        calendar_data = "\n".join([
            f"- {e['date']}: {e['name']} [CPS:{e['cps']}] — {e['notes'][:150]}"
            for e in cal_14[:10]
        ]) or "(no events in next 14 days)"
    else:
        calendar_data = "(calendar not yet loaded)"

    signals_data = "\n".join([
        f"- [{s['platform']}] {s['title'][:100]}\n  {s['summary'][:150]}"
        for s in signals[:20]
    ]) or "(no new signals in last 24 hours)"

    # Historical flashpoints
    if historical:
        historical_data = "\n".join([
            f"- {h['name']} ({h['year']}, CPS:{h['peak_cps']}): {h['summary']}"
            for h in historical[:12]
        ])
    else:
        historical_data = "(no historical data loaded)"

    # Moments data
    if moments:
        moments_data = "\n".join([
            f"- \"{m['name']}\" [{m['type']}/{m['horizon']}] Status:{m['status']} "
            f"Confidence:{m['confidence']} Magnitude:{m['magnitude']}"
            f"\n  {m['narrative']}"
            f"\n  Watch for: {m['watch_for']}"
            f"\n  Window: {m['window_start']} → {m['window_end']}"
            for m in moments[:10]
        ])
    else:
        moments_data = "(moment forecaster has not run yet — no predictions available)"

    # Collision sections
    collision_section, collision_briefing_section = _format_collision_section(collisions)

    prompt = BRIEFING_PROMPT.format(
        today=TODAY,
        moments_data=moments_data,
        trends_data=trends_data,
        tensions_data=tensions_data,
        calendar_data=calendar_data,
        signals_data=signals_data,
        collision_section=collision_section,
        collision_briefing_section=collision_briefing_section,
        historical_data=historical_data,
        client_profiles=CLIENT_PROFILES,
        trends_count=len(trends),
        signals_count=len(signals),
        moments_count=len(moments),
    )

    logger.info("Calling Claude API for briefing generation...")
    import time as _time
    for model, attempt in [("claude-sonnet-4-5", 1), ("claude-opus-4-5", 2)]:
        for retry in range(3):
            try:
                message = client.messages.create(
                    model=model,
                    max_tokens=3000,
                    messages=[{"role": "user", "content": prompt}],
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
    """Count bold trend names in the Flashpoints section."""
    in_section = False
    count = 0
    for line in briefing_text.split("\n"):
        if "Flashpoints" in line and "###" in line:
            in_section = True
            continue
        if in_section and "###" in line:
            break
        if in_section and line.strip().startswith("**"):
            count += 1
    return count


def extract_highlights(briefing_text: str) -> str:
    """Extract top 3 flashpoint trend names for the Key Highlights field."""
    import re
    highlights = []
    in_flashpoints = False
    for line in briefing_text.split("\n"):
        stripped = line.strip()
        # Enter flashpoints section
        if "Flashpoints" in stripped and "###" in stripped:
            in_flashpoints = True
            continue
        # Exit on next section
        if in_flashpoints and stripped.startswith("###"):
            break
        if in_flashpoints:
            # Extract bold trend names: **Trend Name**
            matches = re.findall(r"\*\*([^*]+)\*\*", stripped)
            for m in matches:
                # Strip any lingering CPS annotations
                clean = re.sub(r"\s*\(CPS:?\s*\d+\)\s*$", "", m).strip()
                if clean and clean not in highlights:
                    highlights.append(clean)
            if len(highlights) >= 4:
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
    logger.info("=== Daily Cultural Briefing Generation ===")
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
