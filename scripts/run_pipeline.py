"""
run_pipeline.py
---------------
Main pipeline runner. Orchestrates the full Cultural Forecaster data flow:

1. Signal Collection  — pulls from all data sources + auto-populates calendar
2. Signal Writing     — writes raw signals to Notion Evidence Log
3. Signal Processing  — Claude evaluates signals, scores CPS, creates/links trends, tracks velocity
4. Tension Evaluation — Claude reviews tension landscape: discovers new tensions, adjusts weights (weekly)
5. Moment Forecasting — Claude predicts upcoming cultural moments
6. Briefing Generation (daily only) — Claude synthesizes everything into the daily briefing

Usage:
    python run_pipeline.py              # Full pipeline (collection + processing + tensions + moments + briefing)
    python run_pipeline.py --collect    # Collection only
    python run_pipeline.py --process    # Processing only (no new collection)
    python run_pipeline.py --tensions   # Tension evaluation only
    python run_pipeline.py --moments    # Moment forecasting only
    python run_pipeline.py --brief      # Briefing only
    python run_pipeline.py --no-brief   # Skip briefing (useful for 6-hourly runs)
    python run_pipeline.py --sync       # Dashboard sync: collect → process → moments (no tensions/briefing)
    python run_pipeline.py --sync --sync-state  # Same, but writes progress to data/sync_state.json
"""

import os
import sys
import json
import logging
import argparse
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "collectors"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "processors"))

from dotenv import load_dotenv
load_dotenv(override=True)

# Configure logging
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
logging.basicConfig(
    level=logging.INFO,
    format=LOG_FORMAT,
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            os.path.join(os.path.dirname(__file__), "..", "pipeline.log"),
            mode="a",
        ),
    ],
)
logger = logging.getLogger("pipeline")

# Path to sync state file (read by dashboard for progress polling)
SYNC_STATE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "sync_state.json")


def write_sync_state(stage: str, status: str = "running", error: str | None = None):
    """Atomically write sync progress to data/sync_state.json."""
    state = {
        "stage": stage,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if error:
        state["error"] = error
    tmp = SYNC_STATE_PATH + ".tmp"
    os.makedirs(os.path.dirname(SYNC_STATE_PATH), exist_ok=True)
    with open(tmp, "w") as f:
        json.dump(state, f)
    os.replace(tmp, SYNC_STATE_PATH)


def run_collection(skip_calendar: bool = False) -> dict:
    """Run all data collectors, write to Evidence Log, and optionally update calendar."""
    from processors.signal_writer import run_all_collectors
    logger.info("=== STAGE 1: Signal Collection ===")
    summary = run_all_collectors()
    logger.info(f"Collection complete: {summary}")

    # Calendar auto-collector — skipped in sync mode (events don't change intraday)
    if not skip_calendar:
        try:
            from collectors.calendar_collector import collect as collect_calendar
            logger.info("=== STAGE 1b: Calendar Auto-Collection ===")
            cal_summary = collect_calendar()
            logger.info(f"Calendar collection complete: {cal_summary}")
            summary["calendar"] = cal_summary
        except Exception as e:
            logger.warning(f"Calendar collection failed (non-fatal): {e}")

    return summary


def run_processing() -> dict:
    """Run Claude signal processing on unprocessed Evidence Log entries."""
    from processors.signal_processor import run as process
    logger.info("=== STAGE 2: Signal Processing ===")
    result = process(hours=24, batch_size=15)
    logger.info(f"Processing complete: {result}")
    return result


def run_tensions() -> dict:
    """Run automated tension evaluation (new tensions, weight adjustments, dormancy)."""
    from processors.tension_evaluator import run as evaluate
    logger.info("=== STAGE 3: Tension Evaluation ===")
    result = evaluate()
    logger.info(f"Tension evaluation complete: {result}")
    return result


def run_moments() -> dict:
    """Run cultural moment forecasting."""
    from processors.moment_forecaster import run as forecast
    logger.info("=== STAGE 4: Moment Forecasting ===")
    result = forecast()
    logger.info(f"Moment forecasting complete: {result}")
    return result


def run_briefing() -> dict:
    """Generate and save today's cultural briefing."""
    from processors.briefing_generator import run as brief
    logger.info("=== STAGE 5: Briefing Generation ===")
    result = brief()
    logger.info(f"Briefing complete: {result}")
    return result


def main():
    parser = argparse.ArgumentParser(description="Cultural Forecaster Pipeline")
    parser.add_argument("--collect", action="store_true", help="Collection stage only")
    parser.add_argument("--process", action="store_true", help="Processing stage only")
    parser.add_argument("--tensions", action="store_true", help="Tension evaluation only")
    parser.add_argument("--moments", action="store_true", help="Moment forecasting only")
    parser.add_argument("--brief", action="store_true", help="Briefing stage only")
    parser.add_argument("--no-brief", action="store_true", help="Skip briefing (for intraday runs)")
    parser.add_argument("--sync", action="store_true", help="Dashboard sync: collect → process → moments")
    parser.add_argument("--sync-state", action="store_true", help="Write progress to data/sync_state.json")
    parser.add_argument("--force", action="store_true", help="Force tension evaluation regardless of weekly cadence")
    args = parser.parse_args()

    use_state = args.sync_state

    def update_state(stage: str, status: str = "running", error: str | None = None):
        if use_state:
            write_sync_state(stage, status, error)

    start = datetime.now(timezone.utc)
    logger.info(f"=== Cultural Forecaster Pipeline Starting: {start.isoformat()} ===")

    results = {}

    if args.sync:
        # Dashboard sync: collect → process → moments (no tensions, no briefing)
        try:
            update_state("collecting")
            results["collection"] = run_collection(skip_calendar=True)

            update_state("processing")
            results["processing"] = run_processing()

            update_state("forecasting")
            results["moments"] = run_moments()

            elapsed = (datetime.now(timezone.utc) - start).total_seconds()
            update_state("complete", status="complete")
            logger.info(f"=== Sync complete in {elapsed:.0f}s ===")
            logger.info(f"Summary: {results}")
        except Exception as e:
            update_state("error", status="error", error=str(e))
            logger.error(f"Sync failed: {e}", exc_info=True)
            raise
        return results

    if args.collect:
        results["collection"] = run_collection()
    elif args.process:
        results["processing"] = run_processing()
    elif args.tensions:
        results["tensions"] = run_tensions()
    elif args.moments:
        results["moments"] = run_moments()
    elif args.brief:
        results["briefing"] = run_briefing()
    else:
        # Full pipeline
        results["collection"] = run_collection()
        results["processing"] = run_processing()
        results["tensions"] = run_tensions()
        results["moments"] = run_moments()
        if not args.no_brief:
            results["briefing"] = run_briefing()

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    logger.info(f"=== Pipeline complete in {elapsed:.0f}s ===")
    logger.info(f"Summary: {results}")

    return results


if __name__ == "__main__":
    main()
