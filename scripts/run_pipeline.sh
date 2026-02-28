#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Cultural Forecaster — Daily Pipeline Runner
# Run manually or via cron. Logs output to logs/pipeline.log
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/pipeline.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Create logs dir if needed
mkdir -p "$LOG_DIR"

echo "" >> "$LOG_FILE"
echo "═══════════════════════════════════════" >> "$LOG_FILE"
echo "[$TIMESTAMP] Pipeline started" >> "$LOG_FILE"
echo "═══════════════════════════════════════" >> "$LOG_FILE"

# Activate virtualenv
source "$PROJECT_DIR/venv/bin/activate"

# 1. Collect signals
echo "[$TIMESTAMP] Step 1/3: Collecting signals..." | tee -a "$LOG_FILE"
python3 "$PROJECT_DIR/scripts/collectors/run_collectors.py" >> "$LOG_FILE" 2>&1
echo "[$TIMESTAMP] Collection complete." | tee -a "$LOG_FILE"

# 2. Process signals
echo "[$TIMESTAMP] Step 2/3: Processing signals..." | tee -a "$LOG_FILE"
python3 "$PROJECT_DIR/scripts/processors/signal_processor.py" >> "$LOG_FILE" 2>&1
echo "[$TIMESTAMP] Processing complete." | tee -a "$LOG_FILE"

# 3. Generate briefing
echo "[$TIMESTAMP] Step 3/3: Generating briefing..." | tee -a "$LOG_FILE"
python3 "$PROJECT_DIR/scripts/processors/briefing_generator.py" >> "$LOG_FILE" 2>&1
echo "[$TIMESTAMP] Briefing complete." | tee -a "$LOG_FILE"

echo "[$TIMESTAMP] ✓ Pipeline finished." | tee -a "$LOG_FILE"
