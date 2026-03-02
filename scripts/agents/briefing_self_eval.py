"""
briefing_self_eval.py (Strategist)
------------------------------------
Post-briefing self-evaluation. Scores the latest briefing on specificity,
actionability, originality, and evidence grounding.

Run: python3 scripts/agents/briefing_self_eval.py
Schedule: After each briefing via GitHub Actions
"""
from __future__ import annotations

import os
import sys
import re
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

from notion_helper import query_database, get_page_title

BRIEFING_DB = os.getenv("NOTION_BRIEFING_DB")

# Generic phrases that signal weak writing
GENERIC_PATTERNS = [
    r"brands should (consider|pay attention|take note|be aware)",
    r"could potentially",
    r"might want to",
    r"it remains to be seen",
    r"time will tell",
    r"it's worth noting",
    r"in today's landscape",
    r"it's important to",
    r"stakeholders should",
    r"the implications are",
]


def get_rich_text(page: dict, prop_name: str) -> str:
    """Extract plain text from a rich_text property."""
    prop = page.get("properties", {}).get(prop_name, {})
    if prop.get("type") == "rich_text":
        return "".join(t.get("plain_text", "") for t in prop.get("rich_text", []))
    return ""


def get_date_val(page: dict, prop_name: str) -> str | None:
    """Extract date from a page property."""
    prop = page.get("properties", {}).get(prop_name, {})
    if prop.get("type") == "date" and prop.get("date"):
        return prop["date"].get("start")
    return None


def score_briefing(content: str) -> dict:
    """Score a briefing on key quality dimensions."""
    scores = {}

    # Specificity: presence of numbers, names, dates
    numbers = len(re.findall(r"\b\d+[\d,]*\b", content))
    proper_nouns = len(re.findall(r"[A-Z][a-z]+(?:\s[A-Z][a-z]+)*", content))
    word_count = len(content.split())

    specificity = min(10, (numbers * 2 + proper_nouns) // max(1, word_count // 100))
    scores["specificity"] = max(1, specificity)

    # Actionability: presence of action-oriented language
    action_phrases = len(re.findall(
        r"(the play|here's how|the angle|the opportunity|the risk|act now|watch for|prepare for)",
        content, re.IGNORECASE
    ))
    scores["actionability"] = min(10, max(1, action_phrases * 2))

    # Evidence grounding: references to sources, data points
    source_refs = len(re.findall(
        r"(Reddit|RSS|Bluesky|Hacker News|YouTube|Wikipedia|Google Trends|according to|data shows|signals indicate)",
        content, re.IGNORECASE
    ))
    scores["evidence_grounding"] = min(10, max(1, source_refs * 2))

    # Generic language penalty
    generic_count = 0
    for pattern in GENERIC_PATTERNS:
        generic_count += len(re.findall(pattern, content, re.IGNORECASE))
    scores["generic_phrases"] = generic_count

    # Overall quality (rough composite)
    penalty = min(3, generic_count)
    scores["overall"] = max(1, min(10, (
        scores["specificity"] + scores["actionability"] + scores["evidence_grounding"]
    ) // 3 - penalty))

    scores["word_count"] = word_count
    return scores


def main():
    print("=== Strategist: Briefing Self-Evaluation ===")

    if not BRIEFING_DB:
        print("  ERROR: NOTION_BRIEFING_DB not set")
        return

    # Fetch latest briefing
    briefings = query_database(BRIEFING_DB)
    if not briefings:
        print("  No briefings found")
        return

    # Sort by title (which is the date string, e.g. "2026-02-28") — most recent first
    briefings.sort(
        key=lambda b: get_page_title(b) or "",
        reverse=True,
    )

    latest = briefings[0]
    title = get_page_title(latest)  # Title IS the date in Briefings DB
    content = get_rich_text(latest, "Briefing Content") or get_rich_text(latest, "Key Highlights")
    date = title  # The page title is the date

    if not content:
        print(f"  Latest briefing '{title}' has no content to evaluate")
        return

    print(f"  Evaluating: {title} ({date})")

    # Score it
    scores = score_briefing(content)

    # Build report
    lines = [f"Briefing Self-Eval — {date or 'Unknown date'}"]
    lines.append(f"Briefing: {title}")
    lines.append(f"Word count: {scores['word_count']}")
    lines.append("")
    lines.append("SCORES (1-10):")
    lines.append(f"  Specificity:        {scores['specificity']}/10")
    lines.append(f"  Actionability:      {scores['actionability']}/10")
    lines.append(f"  Evidence grounding: {scores['evidence_grounding']}/10")
    lines.append(f"  Overall quality:    {scores['overall']}/10")
    lines.append(f"  Generic phrases:    {scores['generic_phrases']} found")

    if scores["generic_phrases"] > 0:
        lines.append("")
        lines.append("Generic language detected — these weaken the briefing.")
        lines.append("Replace with specific, actionable language.")

    if scores["overall"] < 5:
        lines.append("")
        lines.append("ALERT: Briefing quality below threshold. Review prompt template.")

    report = "\n".join(lines)
    print(report)

    # Write to Agent Activity Log
    from agent_report_writer import write_report

    priority = "high" if scores["overall"] < 5 else "medium"
    summary = f"Quality: {scores['overall']}/10. "
    summary += f"Specificity: {scores['specificity']}, Actionability: {scores['actionability']}, "
    summary += f"Evidence: {scores['evidence_grounding']}. "
    if scores["generic_phrases"] > 0:
        summary += f"{scores['generic_phrases']} generic phrases."

    write_report(
        agent="strategist",
        report_type="self_eval",
        title=f"Briefing Eval — {date or datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        summary=summary,
        details=report,
        priority=priority,
    )

    # Update shared agent state
    from agent_state import update_agent
    eval_issues = []
    if scores["overall"] < 5:
        eval_issues.append(f"Briefing quality below threshold: {scores['overall']}/10")
    if scores["generic_phrases"] > 0:
        eval_issues.append(f"{scores['generic_phrases']} generic phrases detected")
    if not eval_issues:
        eval_issues.append("Briefing quality nominal.")
    update_agent(
        agent="strategist",
        status="warning" if scores["overall"] < 5 else "healthy",
        findings=eval_issues,
    )

    return scores


if __name__ == "__main__":
    main()
