"""
prediction_reviewer.py  (Weekly)
---------------------------------
Reviews active moment predictions against recent signals to detect
confirmation or disconfirmation. Tracks prediction accuracy over time.

Runs weekly (Sundays). Updates moment statuses in Notion and maintains
a persistent prediction log for calibration.

Cost: ~1 Sonnet call/week = ~$0.08/week.
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
    query_database, update_page, get_page_title, rich_text
)

logger = logging.getLogger(__name__)

MOMENTS_DB  = os.getenv("NOTION_MOMENTS_DB")
EVIDENCE_DB = os.getenv("NOTION_EVIDENCE_DB")

DATA_DIR = Path(__file__).parent.parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)
PREDICTION_LOG_PATH = DATA_DIR / "prediction_log.json"

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

REVIEW_PROMPT = """You are a cultural intelligence calibration analyst. Your job is to determine whether predicted cultural moments are materializing based on recent signal evidence.

ACTIVE PREDICTIONS:
{predictions}

RECENT SIGNALS (last 7 days):
{signals}

For each prediction, determine its status:
- "Predicted" — no change, insufficient evidence either way
- "Forming" — early signals suggest this is beginning to materialize (cite specific signals)
- "Happening" — clear evidence this moment has arrived (cite specific signals)
- "Missed" — the prediction window has passed without materialization
- "Fading" — initial signals appeared but momentum has stalled

Return ONLY a JSON array:
[{{
  "prediction_title": "exact title",
  "new_status": "Predicted|Forming|Happening|Missed|Fading",
  "confidence_delta": <-20 to +20 integer — how much confidence should shift>,
  "evidence": "1-2 sentences citing specific signals or explaining why no evidence was found"
}}]

Be conservative. Do NOT upgrade to "Happening" unless multiple independent signals confirm it.
Do NOT mark as "Missed" unless the prediction window has definitively passed.
Most predictions should stay as "Predicted" or shift to "Forming" — that's normal."""


def load_active_predictions() -> list:
    """Load active predictions from Notion Moments DB."""
    if not MOMENTS_DB:
        return []

    pages = query_database(
        MOMENTS_DB,
        filter_obj={
            "and": [
                {"property": "Status", "select": {"does_not_equal": "Passed"}},
                {"property": "Status", "select": {"does_not_equal": "Missed"}},
                {"property": "Status", "select": {"does_not_equal": "Happening"}},
            ]
        },
    )

    predictions = []
    for p in pages:
        props = p["properties"]
        name = get_page_title(p)
        narrative_rt = (props.get("Narrative") or {}).get("rich_text") or []
        narrative = narrative_rt[0]["plain_text"] if narrative_rt else ""
        status = ((props.get("Status") or {}).get("select") or {}).get("name", "Predicted")
        confidence = (props.get("Confidence") or {}).get("number") or 0
        watch_rt = (props.get("Watch For") or {}).get("rich_text") or []
        watch = watch_rt[0]["plain_text"] if watch_rt else ""
        window_end = ((props.get("Predicted Window End") or {}).get("date") or {}).get("start", "")
        mtype = ((props.get("Type") or {}).get("select") or {}).get("name", "")

        predictions.append({
            "id": p["id"],
            "name": name,
            "narrative": narrative[:400],
            "status": status,
            "confidence": confidence,
            "watch_for": watch[:300],
            "window_end": window_end,
            "type": mtype,
        })

    return predictions


def load_recent_signals(days: int = 7) -> list:
    """Load signals from the last N days."""
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    pages = query_database(
        EVIDENCE_DB,
        filter_obj={"property": "Date Captured", "date": {"on_or_after": cutoff}},
    )

    signals = []
    for p in pages[:200]:  # Cap at 200 to control prompt size
        title = get_page_title(p)
        sum_rt = (p["properties"].get("Summary") or {}).get("rich_text") or []
        summary = sum_rt[0]["plain_text"] if sum_rt else ""
        if summary and summary != "Low cultural relevance (auto-filtered)":
            signals.append(f"- {title[:100]}: {summary[:150]}")

    return signals


def load_prediction_log() -> dict:
    """Load persistent prediction tracking log."""
    if PREDICTION_LOG_PATH.exists():
        try:
            return json.loads(PREDICTION_LOG_PATH.read_text())
        except Exception:
            pass
    return {
        "predictions_total": 0,
        "confirmed": 0,
        "missed": 0,
        "fading": 0,
        "still_active": 0,
        "hit_rate": 0.0,
        "last_reviewed": None,
        "reviews": [],
    }


def save_prediction_log(log: dict):
    """Save prediction tracking log to disk."""
    PREDICTION_LOG_PATH.write_text(json.dumps(log, indent=2))


def run() -> dict:
    """Main prediction review job."""
    logger.info("=== Weekly Prediction Review ===")

    predictions = load_active_predictions()
    if not predictions:
        logger.info("No active predictions to review.")
        return {"reviewed": 0, "status_changes": 0}

    signals = load_recent_signals(days=7)
    logger.info(f"Reviewing {len(predictions)} predictions against {len(signals)} recent signals")

    # Format prompt data
    pred_text = "\n".join(
        f"- \"{p['name']}\" [{p['type']}] Status: {p['status']} "
        f"Confidence: {p['confidence']}%\n"
        f"  Narrative: {p['narrative']}\n"
        f"  Watch for: {p['watch_for']}\n"
        f"  Window ends: {p['window_end']}"
        for p in predictions
    )

    signals_text = "\n".join(signals[:100])  # Cap signals in prompt

    try:
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=3000,
            messages=[{"role": "user", "content": REVIEW_PROMPT.format(
                predictions=pred_text,
                signals=signals_text,
            )}],
        )

        # Token usage logging
        usage = message.usage
        cost = usage.input_tokens * 3 / 1_000_000 + usage.output_tokens * 15 / 1_000_000
        logger.info(
            f"  [TOKENS] prediction_reviewer: "
            f"input={usage.input_tokens} output={usage.output_tokens} "
            f"cost=${cost:.4f}"
        )

        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        results = json.loads(raw)
        status_changes = 0
        pred_log = load_prediction_log()

        for result in results:
            title = result.get("prediction_title", "")
            new_status = result.get("new_status", "Predicted")
            confidence_delta = result.get("confidence_delta", 0)
            evidence = result.get("evidence", "")

            # Find matching prediction
            match = [p for p in predictions if p["name"] == title]
            if not match:
                continue

            pred = match[0]
            old_status = pred["status"]

            # Only update if status changed
            if new_status != old_status:
                try:
                    props = {"Status": {"select": {"name": new_status}}}
                    # Adjust confidence
                    new_confidence = max(0, min(100, pred["confidence"] + confidence_delta))
                    if confidence_delta != 0:
                        props["Confidence"] = {"number": new_confidence}
                    update_page(pred["id"], props)
                    status_changes += 1
                    logger.info(
                        f"  {old_status} → {new_status}: \"{title}\" "
                        f"(confidence {pred['confidence']} → {new_confidence})"
                    )
                except Exception as e:
                    logger.error(f"Failed to update '{title}': {e}")

            # Update prediction log
            if new_status in ("Happening",):
                pred_log["confirmed"] = pred_log.get("confirmed", 0) + 1
            elif new_status in ("Missed",):
                pred_log["missed"] = pred_log.get("missed", 0) + 1
            elif new_status in ("Fading",):
                pred_log["fading"] = pred_log.get("fading", 0) + 1

        # Update log totals
        pred_log["predictions_total"] = len(predictions)
        pred_log["still_active"] = len(predictions) - pred_log.get("confirmed", 0) - pred_log.get("missed", 0)
        total_resolved = pred_log.get("confirmed", 0) + pred_log.get("missed", 0)
        pred_log["hit_rate"] = round(pred_log.get("confirmed", 0) / total_resolved, 3) if total_resolved > 0 else 0.0
        pred_log["last_reviewed"] = date.today().isoformat()
        pred_log.setdefault("reviews", []).append({
            "date": date.today().isoformat(),
            "reviewed": len(predictions),
            "status_changes": status_changes,
        })

        save_prediction_log(pred_log)
        logger.info(f"Prediction log updated: {pred_log}")

        return {"reviewed": len(predictions), "status_changes": status_changes}

    except Exception as e:
        logger.error(f"Prediction review failed: {e}")
        return {"reviewed": 0, "status_changes": 0, "error": str(e)}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    result = run()
    print(f"\nResults: {result}")
