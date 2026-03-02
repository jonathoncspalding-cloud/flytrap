# Flytrap Pipeline Rebuild — Cost + Quality Optimization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Flytrap pipeline to cut costs by ~60-75% while improving signal quality, briefing usefulness, and prediction credibility. Zero degradation in cultural intelligence capability — this is about doing the same job smarter, not doing less.

**Context:** Audit by Optimize, Scout, Oracle, and Strategist on 2026-03-01 identified systemic issues: every signal hitting expensive Claude Sonnet regardless of quality, broken data plumbing in briefings, zero validation on predictions, noise-heavy collection, and performative precision in scoring. Current spend: ~$24/month. Target: ~$10/month with better output.

**Tech Stack:** Python 3.11, sentence-transformers (new dep), Claude Haiku/Sonnet, Notion API, Next.js dashboard

**Phases:** 4 phases, ordered by dependency. Phase 1 has no deps and fixes broken things. Phase 2 is the big cost win. Phase 3 improves briefing quality. Phase 4 makes predictions real.

---

## Phase 1: Fix What's Broken (Zero Cost, Immediate Impact)

These are bugs and gaps that cost nothing to fix and immediately improve quality.

---

### Task 1.1: Fix Collision Data Path

**Problem:** `signal_processor.py` writes `collisions.json` to `DATA_DIR` (which resolves to `forecaster/data/`). `briefing_generator.py` reads from the same `DATA_DIR` — BUT historically the collision file may have been written to a different path. The briefing has shown "0 collisions" despite the signal processor detecting 1,139+. Verify both files resolve `DATA_DIR` identically and collisions flow end-to-end.

**Files:**
- Check: `scripts/processors/signal_processor.py` — `DATA_DIR` definition + `save_collisions()`
- Check: `scripts/processors/briefing_generator.py` — `DATA_DIR` definition + `load_collisions()`
- Verify: After a pipeline run, `data/collisions.json` exists and briefing log shows collision count > 0

**Steps:**
1. Read both files, trace `DATA_DIR` resolution. Confirm they point to the same absolute path.
2. If they differ, fix `briefing_generator.py` to read from the correct path.
3. Run `python3 scripts/run_pipeline.py --process` to generate collision data, then `python3 scripts/run_pipeline.py --brief` and check the log for collision count.
4. If collisions.json doesn't exist on disk, check if the pipeline has run recently enough to generate it. Run `--process` first if needed.

**Verification:** Pipeline log shows "X collisions" in briefing data loading, and the briefing output contains a "⚡ Collision Alerts" section.

---

### Task 1.2: Store Yesterday's CPS Snapshot for Briefing Deltas

**Problem:** The briefing prompt says "lead with what CHANGED" but has no access to yesterday's data. Claude can't compute deltas without a baseline.

**Files:**
- Modify: `scripts/processors/signal_processor.py` — after processing, save a CPS snapshot
- Create: `data/cps_snapshot.json` — `{ "date": "YYYY-MM-DD", "trends": { "trend_name": cps_score, ... } }`
- Modify: `scripts/processors/briefing_generator.py` — load yesterday's snapshot, compute deltas, add to prompt

**Steps:**
1. At the end of `signal_processor.run()`, after all processing, save current trend CPS scores to `data/cps_snapshot.json`:
   ```python
   snapshot = {
       "date": TODAY,
       "trends": {t["name"]: t["cps"] for t in trends}
   }
   ```
2. In `briefing_generator.py`, add `load_cps_snapshot()` that reads the previous snapshot.
3. Compute deltas: for each current trend, compare to snapshot. Flag trends where CPS changed by ±5 or more.
4. Add a `DELTA DATA` section to the briefing prompt:
   ```
   CPS CHANGES SINCE LAST BRIEFING:
   - "Brand Voice Homogenization" CPS: 45 → 62 (+17) ⬆️
   - "AI Regulation Fatigue" CPS: 71 → 58 (-13) ⬇️
   - (new) "Creator Economy Burnout" — first detected today, CPS: 54
   ```
5. Update the briefing prompt's FRAMING section to reference this delta data explicitly.

**Verification:** Second pipeline run produces a briefing that references specific CPS movements by number.

---

### Task 1.3: Kill Dead RSS Feeds and Duplicates

**Problem:** RSS collector has 67 feeds including dead publications and duplicates. Each dead feed either returns nothing (wasted HTTP call + latency) or returns stale content that gets sent to Claude.

**Files:**
- Modify: `scripts/collectors/rss_collector.py` — prune the feed list

**Steps:**
1. Read `rss_collector.py`, find the feeds list.
2. Remove confirmed dead feeds:
   - BuzzFeed News (shut down April 2023)
   - OneZero / Medium (defunct)
   - GEN / Medium (defunct)
   - SI Culture (unreliable after ownership changes)
   - Duplicate HBR entry (appears twice)
3. Review remaining feeds. Flag any that haven't produced a signal scoring CPS 30+ in the last 30 days (check Notion Evidence DB if possible, otherwise use judgment on source quality).
4. Target: reduce from 67 to ~40 high-quality feeds.
5. Add a comment at the top of the feeds list: `# Last audited: YYYY-MM-DD. Review quarterly.`

**Verification:** `python3 -m py_compile scripts/collectors/rss_collector.py` passes. Collection run completes faster.

---

### Task 1.4: Reduce Reddit RSS Mode Noise

**Problem:** When running in RSS mode (GitHub Actions, no PRAW creds), there is zero engagement filtering. Every hot post from 42 subreddits gets through — up to 420 unfiltered signals per run.

**Files:**
- Modify: `scripts/collectors/reddit_collector.py`

**Steps:**
1. Read the collector. Find the subreddit list and the RSS collection path.
2. Reduce `POSTS_PER_SUB` from 10 to 5 for RSS mode (top 5 hot posts carry the signal).
3. Curate the subreddit list down to ~25 highest-signal subs. Keep:
   - High cultural signal: `OutOfTheLoop`, `TikTokCringe`, `movies`, `television`, `gaming`, `technology`, `AskReddit`, `unpopularopinion`, `changemyview`, `GenZ`, `popculturechat`, `Fauxmoi`, `books`, `MadeMeSmile`, `NoStupidQuestions`, `ChatGPT`, `collapse`, `mildlyinfuriating`, `Futurology`, `entertainment`
   - Brand/consumer: `antiwork`, `BuyItForLife`, `HailCorporate`, `advertising`
   - Cut niche low-signal subs (check if any not listed above have produced CPS 40+ signals; if so, keep them)
4. Add a title-length heuristic in RSS mode: skip posts with titles under 20 characters (likely memes/low-content).

**Verification:** RSS collection run produces ~100-125 signals instead of ~420. `python3 -m py_compile` passes.

---

### Task 1.5: Fix Google Trends Signals — Skip Claude or Enrich

**Problem:** Google Trends signals are just a topic name with zero context. "Trending: Lakers" costs $0.003 for Claude to say "CPS: 8, noise." Wasted.

**Files:**
- Modify: `scripts/collectors/google_trends.py`
- Possibly modify: `scripts/processors/signal_processor.py`

**Steps:**
1. Read the Google Trends collector. Understand the signal format.
2. **Option A (recommended):** Enrich signals with related queries. The pytrends API supports `related_queries()` — add the top 3 related rising queries to raw_content so Claude has context:
   ```
   "Trending on Google Trends (US): Lakers. Related rising queries: Lakers trade deadline, LeBron retirement, NBA playoff race"
   ```
3. **Option B (if enrichment is too slow/flaky):** Skip Google Trends signals from Claude processing entirely. Instead, use them as velocity boosters: if a Google Trends topic matches an existing trend name (fuzzy match), increment that trend's signal velocity count without a Claude call.
4. If Option B: modify `signal_processor.py` to identify and skip Google Trends signals, handling them with a simple name-matching function instead.

**Verification:** Either (A) Google Trends signals have richer raw_content, or (B) they bypass Claude entirely and show up in velocity data.

---

### Task 1.6: Fix Bluesky Keyword Search Noise

**Problem:** Bluesky keyword search pulls posts with as few as 5 likes. With 15 queries × 8 posts = up to 120 low-quality signals. Trending topics part is good; keyword search is noise.

**Files:**
- Modify: `scripts/collectors/bluesky_collector.py`

**Steps:**
1. Read the collector. Identify the keyword search vs trending topics code paths.
2. Raise `MIN_LIKE_COUNT` from 5 to 25 for keyword search results.
3. Reduce keyword queries from 15 to 8 (keep the most culturally relevant ones, cut generic terms).
4. OR: Remove keyword search entirely and keep only the trending topics endpoint. This is the more aggressive but cleaner option — trending topics are inherently pre-filtered by engagement.

**Verification:** Bluesky collection produces ~20-40 signals instead of ~120. `python3 -m py_compile` passes.

---

## Phase 2: Tiered Signal Processing (The Big Cost Win)

This is the highest-impact change. Currently every signal goes through Sonnet. After this phase, only ~15-20% of signals need Sonnet.

**Dependency:** Phase 1 should be done first to reduce raw signal volume. The tiered system works better with cleaner input.

---

### Task 2.1: Add sentence-transformers Dependency

**Files:**
- Modify: `requirements.txt`

**Steps:**
1. Add `sentence-transformers>=2.2.0` to `requirements.txt`.
2. The model `all-MiniLM-L6-v2` is ~80MB and runs on CPU. It will be downloaded on first use.
3. Test locally: `pip install sentence-transformers && python3 -c "from sentence_transformers import SentenceTransformer; m = SentenceTransformer('all-MiniLM-L6-v2'); print('OK')"`
4. Note for GitHub Actions: the model will need to be cached or downloaded during the pip install step. Add a cache key for the model directory or accept the ~30s download on first run.

**Verification:** Import works locally. `pip install -r requirements.txt` succeeds.

---

### Task 2.2: Build Embedding Pre-Filter (Tier 0)

**Files:**
- Create: `scripts/processors/signal_filter.py`

**Purpose:** Takes a list of raw signals + existing trend names/summaries + tension names. Uses embedding cosine similarity to classify each signal into one of three buckets:
- **AUTO_LINK** (similarity > 0.6 to an existing trend): skip Claude, auto-link to that trend
- **DISCARD** (similarity < 0.25 to ALL trends AND all tensions): noise, save minimal metadata, done
- **AMBIGUOUS** (0.25-0.6): needs Claude evaluation, pass to Tier 1

**Steps:**
1. Create `scripts/processors/signal_filter.py` with:
   ```python
   from sentence_transformers import SentenceTransformer

   model = SentenceTransformer('all-MiniLM-L6-v2')

   def classify_signals(signals, trends, tensions):
       """
       Returns: {
           "auto_link": [(signal, trend_name, similarity_score), ...],
           "discard": [signal, ...],
           "ambiguous": [signal, ...]
       }
       """
   ```
2. Embed all trend names+summaries and tension names+descriptions once per run (these are the "reference embeddings").
3. Embed all signal titles+raw_content.
4. For each signal, compute cosine similarity against all reference embeddings.
5. Classify based on max similarity score using thresholds above.
6. For AUTO_LINK signals: return the best-matching trend name.
7. Add logging: `logger.info(f"Tier 0: {len(auto_link)} auto-linked, {len(discard)} discarded, {len(ambiguous)} → Tier 1")`

**Important notes:**
- The embedding model runs locally on CPU. No API cost. ~2-5 seconds for 300 signals.
- Thresholds (0.6 / 0.25) are starting points. They should be tuned after observing results.
- AUTO_LINK signals should still get a basic summary written (can be generated from the raw content without Claude, or use a template like "Signal matched to existing trend: {trend_name}").

**Verification:** Unit test with 10 sample signals (5 obvious matches, 3 obvious noise, 2 ambiguous) returns expected classifications.

---

### Task 2.3: Build Haiku Triage (Tier 1)

**Files:**
- Create: `scripts/processors/signal_triage.py`

**Purpose:** Takes the AMBIGUOUS signals from Tier 0 and sends them to Claude Haiku in large batches (30-40 at a time) with a minimal prompt. Returns relevance scores and suggested trend links.

**Steps:**
1. Create `scripts/processors/signal_triage.py` with:
   ```python
   TRIAGE_PROMPT = """Rate each signal's cultural relevance (1-10) and suggest which existing trend it belongs to (or "new" or "none").

   EXISTING TRENDS:
   {trend_names}

   SIGNALS:
   {signals}

   Return JSON array: [{"title": "...", "relevance": N, "trend": "name or null"}, ...]"""
   ```
2. Use `claude-haiku-4-5-20251001` model. Batch size: 30-40 signals per call.
3. Send only trend NAMES (not summaries, not CPS scores) — keep the prompt tiny.
4. Signals scoring relevance >= 5 get promoted to Tier 2 (full Sonnet processing).
5. Signals scoring < 5: save triage result as summary, mark as processed, done.
6. Add token logging: `[TOKENS] signal_triage: input=X output=Y cost=$Z`
7. Return two lists: `promoted` (for Sonnet) and `triaged` (done).

**Cost estimate:** ~30-40 signals per Haiku call. Haiku pricing: $1/MTok input, $5/MTok output. One call with 30 signals ≈ $0.005. Maybe 2-3 calls per run = ~$0.01-0.02/day.

**Verification:** Triage correctly identifies culturally relevant signals (test with known high-CPS signals from recent runs).

---

### Task 2.4: Integrate Tiered Processing into Signal Processor

**Files:**
- Modify: `scripts/processors/signal_processor.py` — refactor `run()` to use tiers
- Modify: `scripts/run_pipeline.py` — no changes needed if `signal_processor.run()` API stays the same

**Steps:**
1. In `signal_processor.run()`, after loading signals, tensions, and trends:
   ```python
   from signal_filter import classify_signals
   from signal_triage import triage_signals

   # Tier 0: Embedding pre-filter
   classified = classify_signals(signals, trends, tensions)
   logger.info(f"Tier 0: {len(classified['auto_link'])} auto-linked, "
               f"{len(classified['discard'])} discarded, "
               f"{len(classified['ambiguous'])} ambiguous")

   # Handle auto-linked signals (write to Notion, update velocity, no Claude)
   for signal, trend_name, score in classified['auto_link']:
       # find trend ID, write link to Notion, update signal counts
       ...

   # Handle discarded signals (write minimal summary, mark done)
   for signal in classified['discard']:
       update_signal_in_notion(signal['id'], {
           "summary": "Low cultural relevance (auto-filtered)",
           "sentiment": "Neutral"
       })

   # Tier 1: Haiku triage on ambiguous signals
   promoted, triaged = triage_signals(classified['ambiguous'], trends)
   logger.info(f"Tier 1: {len(promoted)} promoted to Sonnet, {len(triaged)} triaged out")

   # Handle triaged-out signals
   for signal, result in triaged:
       update_signal_in_notion(signal['id'], result)

   # Tier 2: Full Sonnet processing (existing batch logic) — only on promoted signals
   # ... existing batch loop, but using `promoted` instead of `signals`
   ```
2. Keep the existing `process_signals_batch()` function unchanged — it handles the Sonnet calls.
3. The MAX_SIGNALS_PER_RUN cap (300) now applies before Tier 0, so the cap is on raw signals, not Sonnet calls.
4. Update the cost summary to show per-tier costs.

**Verification:**
- Run pipeline with `--process` flag.
- Log output shows all three tiers with signal counts.
- Total Sonnet calls should be ~3-5 instead of ~15-25.
- `[TOKENS]` log lines confirm lower total token usage.
- Spot-check: compare a few auto-linked signals against what Sonnet would have assigned. Are the trend links reasonable?

---

### Task 2.5: Weekly Novelty Scan for Tier-0 Rejects

**Problem:** The embedding filter is biased toward existing trends. Genuinely novel cultural phenomena that don't match anything would get discarded. This weekly scan catches them.

**Files:**
- Create: `scripts/processors/novelty_scanner.py`
- Modify: `scripts/run_pipeline.py` — add `--novelty` flag, run weekly

**Steps:**
1. Create `novelty_scanner.py`:
   - Query Notion Evidence DB for signals from last 7 days where Summary = "Low cultural relevance (auto-filtered)"
   - Batch them (up to 100) into a single Sonnet call with prompt:
     ```
     These signals were auto-filtered as low relevance. Review them for any
     genuinely novel cultural patterns not captured by existing trends.
     Most are noise — but flag any that represent emerging phenomena.
     Return JSON: [{"title": "...", "novel": true/false, "reasoning": "..."}]
     ```
   - For signals flagged as novel: re-run them through full Sonnet processing.
2. Add `--novelty` flag to `run_pipeline.py`.
3. Schedule weekly in GitHub Actions (e.g., Sundays alongside tension evaluation).
4. Cost: ~1 Sonnet call/week = ~$0.05-0.10/week.

**Verification:** Weekly scan runs, identifies 0-3 genuinely novel signals, logs results.

---

## Phase 3: Briefing Quality Rebuild

**Dependency:** Phase 1 (collision fix, CPS snapshot) must be complete. Phase 2 (tiered processing) is nice-to-have but not required.

---

### Task 3.1: Two-Step Briefing — Triage Then Synthesize

**Problem:** One giant prompt asks Claude to simultaneously triage, analyze, forecast, and write copy. It satisfices on everything instead of excelling at anything.

**Files:**
- Modify: `scripts/processors/briefing_generator.py`

**Steps:**
1. **Step 1 — Haiku Triage Call:** Create a new function `compute_briefing_deltas()`:
   - Input: today's trends (with CPS), yesterday's CPS snapshot, today's signals, active moments
   - Prompt (Haiku): "What changed? Which trends moved? Which signals are novel? Which moments shifted? Return structured JSON of deltas."
   - Output: JSON with `moved_trends`, `novel_signals`, `moment_updates`, `new_collisions`
   - Cost: ~$0.01
2. **Step 2 — Sonnet Synthesis Call:** Modify `generate_briefing()`:
   - Instead of sending ALL 25 trends, 20 signals, etc., send only the deltas from Step 1 plus relevant context for those specific items.
   - The prompt is now focused: "Here's what changed. Write the briefing about THESE changes."
   - This produces a shorter, more focused, higher-quality briefing.
   - Cost: ~$0.03-0.04 (less input = cheaper)
3. Remove `CLIENT_PROFILES` and "The Brief" section from the daily briefing prompt entirely. (See Task 3.3.)
4. Total briefing cost: ~$0.04-0.05/call (same or less than current, better output).

**Verification:** Briefing references specific CPS movements and clearly identifies what changed vs. what's ongoing.

---

### Task 3.2: Move to 3×/Week Briefing Cadence

**Problem:** Cultural landscapes don't shift meaningfully every 24 hours. Daily briefings are repetitive.

**Files:**
- Modify: `.github/workflows/pipeline.yml`
- Modify: `scripts/run_pipeline.py` (optional: add day-of-week check)

**Steps:**
1. In `pipeline.yml`, change the daily full pipeline cron to run Mon/Wed/Fri:
   ```yaml
   schedule:
     # Full pipeline (with briefing) Mon/Wed/Fri at 12 UTC
     - cron: "0 12 * * 1,3,5"
     # Collection + processing (no briefing) Tue/Thu/Sat/Sun at 12 UTC
     - cron: "0 12 * * 0,2,4,6"
     # Intraday collection-only
     - cron: "0 0,6,18 * * *"
   ```
2. Update the stage determination logic: on non-briefing days, run `--no-brief`.
3. Signal collection and processing still run daily — data accumulates. Briefings just synthesize 3× instead of 7×.
4. This means each briefing covers 2-3 days of signal accumulation, giving richer deltas.

**Verification:** GitHub Actions schedule shows correct cron patterns. Non-briefing days still run collection + processing.

---

### Task 3.3: Client Angles → On-Demand Chatbot Feature

**Problem:** 2-line client profiles in a daily briefing can't produce actionable creative strategy. Generic angles waste prompt tokens and degrade briefing focus.

**Files:**
- Modify: `scripts/processors/briefing_generator.py` — remove CLIENT_PROFILES from prompt, remove "The Brief" section
- Modify (or note for Architect): `dashboard/components/Chatbot.tsx` — add a "Generate Client Brief" feature

**Steps:**
1. In `briefing_generator.py`:
   - Remove `CLIENT_PROFILES` constant from the prompt
   - Remove "The Brief" section from the output format
   - Remove the self-check rule about client angles
   - This saves ~300-400 input tokens and simplifies Claude's task
2. Document the client brief feature spec for Architect/Strategist to implement later:
   - User selects a trend + client from the dashboard
   - System sends a focused prompt with full trend context, tension data, and detailed client profile
   - Returns a dedicated creative brief (not a one-liner in a daily report)
   - This is a better product AND cheaper (one call when needed vs. daily overhead)
3. This task only removes the angles from the briefing. The chatbot feature is a separate task for Architect.

**Verification:** Briefing generates without "The Brief" section. Prompt is shorter. Output is more focused on cultural analysis.

---

### Task 3.4: Quote Moment Predictions Directly

**Problem:** The briefing model re-synthesizes moment predictions that the moment forecaster already wrote narratives for. Double processing.

**Files:**
- Modify: `scripts/processors/briefing_generator.py`

**Steps:**
1. In `load_active_moments()`, include the full narrative and watch_for text (don't truncate as aggressively).
2. Change the briefing prompt's Predicted Moments section from "interpret and rewrite these" to "present these predictions with your editorial commentary on what changed since last briefing":
   ```
   ### 🔮 Predicted Moments
   [Present each prediction AS WRITTEN by the forecaster. Add only:
   - Whether confidence moved up/down since last briefing (use delta data)
   - Whether any watch-for indicators have been observed in today's signals
   Do NOT rewrite the prediction narratives — they are already written.]
   ```
3. This reduces output token usage (less rewriting) and improves consistency (one voice per prediction).

**Verification:** Briefing's moment section uses forecaster language directly, with added delta commentary.

---

## Phase 4: Prediction Credibility

**Dependency:** Phase 1 (basic fixes). Independent of Phases 2-3.

---

### Task 4.1: Collapse CPS to 5 Buckets

**Problem:** CPS 0-100 implies precision that doesn't exist. The difference between 62 and 58 is noise.

**Files:**
- Modify: `scripts/processors/signal_processor.py` — update SIGNAL_PROCESSING_PROMPT
- Modify: dashboard components that display CPS (note for Architect)

**Steps:**
1. Change the CPS scoring rubric in the prompt to use named buckets:
   ```
   Score cultural potency as one of these levels:
   - FLASHPOINT (5): Intersection of 3+ active tensions with strong velocity. Immediate cultural urgency.
   - HOT (4): Hits 2 tensions with clear cultural momentum. Worth tracking closely.
   - NOTABLE (3): Touches 1-2 tensions, meaningful but not urgent.
   - EARLY (2): Some cultural relevance, early-stage signal.
   - NOISE (1): Mostly informational, low cultural charge.
   ```
2. Map buckets to numeric CPS for backward compatibility: NOISE=10, EARLY=30, NOTABLE=50, HOT=70, FLASHPOINT=90.
3. Update the JSON response format: `"cps_level": "HOT"` alongside `"cps": 70`.
4. This is more honest about what the system actually knows and gives Claude clearer instructions.
5. Note for Architect: dashboard CPS displays could show the bucket name + color instead of a raw number. Document this as a future task.

**Verification:** Signal processor outputs bucket-mapped CPS values. Trends DB still has numeric CPS for sorting.

---

### Task 4.2: Add Prediction Confirmation Workflow

**Problem:** Moment predictions are never confirmed or denied. The system can't learn. All predictions auto-retire as "Missed."

**Files:**
- Modify: `scripts/processors/moment_forecaster.py` — add confirmation detection
- Create: `scripts/agents/prediction_reviewer.py` — weekly review script
- Modify: dashboard (note for Architect) — add manual confirmation UI

**Steps:**
1. Create `scripts/agents/prediction_reviewer.py`:
   - Runs weekly (Sunday, alongside tension evaluator)
   - Loads all active predictions + last 7 days of signals
   - Sends to Claude: "For each prediction, has any signal provided evidence this is materializing? Return status updates."
   - Writes status changes to Notion (Predicted → Forming → Happening)
   - Logs confirmation/miss rates for calibration
2. Add to GitHub Actions weekly schedule.
3. Maintain a `data/prediction_log.json` that tracks:
   ```json
   {
     "predictions_total": 24,
     "confirmed": 3,
     "missed": 18,
     "still_active": 3,
     "hit_rate": 0.143,
     "last_reviewed": "2026-03-01"
   }
   ```
4. Document for Architect: add a prediction review UI to the dashboard where users can manually mark predictions as confirmed/missed with notes.
5. Cost: 1 Sonnet call/week ≈ $0.08/week.

**Verification:** After 2 weeks, `prediction_log.json` has real data. At least some predictions have been reviewed.

---

### Task 4.3: Split Mega-Tensions

**Problem:** "Trust in institutions declining" is so broad that everything intersects it, producing 1,139 false collision pairs. A tension that touches everything discriminates nothing.

**Files:**
- This is a Notion data change + tension evaluator prompt update
- Modify: `scripts/processors/tension_evaluator.py` — add guidance about tension specificity

**Steps:**
1. Identify the broadest tensions by checking which ones appear most frequently in collision pairs and trend links. "Trust in institutions declining" is the known offender.
2. Manually split in Notion (or via script):
   - "Trust in institutions declining" → split into:
     - "Healthcare system distrust vs. medical authority"
     - "Media credibility crisis vs. citizen journalism"
     - "Government competence skepticism vs. civic participation"
     - "Corporate accountability demands vs. shareholder primacy"
   - Set each sub-tension to weight 6-7 (inheriting parent's importance but now specific)
   - Archive the parent tension
3. Review all tensions for similar over-breadth. Target: 12-15 specific tensions, each one narrow enough that intersecting 2 of them identifies a real cultural flashpoint.
4. Update tension evaluator prompt to include a rule:
   ```
   SPECIFICITY RULE: A good tension is narrow enough that MOST signals do NOT
   intersect it. If a tension intersects >40% of recent trends, it is too broad
   and should be split. Do not propose broad tensions like "technology changing
   society" — propose the specific conflict within that theme.
   ```
5. After splitting, re-run signal processor on recent signals to rebuild trend-tension links with the new specific tensions.

**Verification:** Collision detection produces <100 pairs (down from 1,139). Each collision represents a genuinely meaningful convergence.

---

### Task 4.4: Tighten Collision Detection Thresholds

**Problem:** Even after tension splitting, collision detection needs tighter criteria to produce actionable output.

**Files:**
- Modify: `scripts/processors/signal_processor.py` — `detect_collisions()` function

**Steps:**
1. Add CPS differential threshold: `abs(cps_a - cps_b) <= 25`. Trends at wildly different intensity levels aren't really colliding.
2. Add tension weight filter: only count shared tensions with weight >= 5. Two trends sharing a dormant weight-2 tension shouldn't count.
3. Consider raising `min_shared_tensions` from 2 to 3 if collision count is still too high after tension splitting.
4. Add a `collision_score` that weights by tension importance:
   ```python
   collision_score = combined_cps * sum(tension_weights_of_shared) / 10
   ```
5. Only report collisions above a collision_score threshold.

**Verification:** Collision output is <50 pairs, each one representing a genuine convergence of culturally significant forces.

---

## Cost Projection

| Component | Current $/month | After Rebuild $/month |
|-----------|----------------|----------------------|
| Signal Processing (Sonnet) | ~$18-21 | ~$5-7 |
| Signal Triage (Haiku) | $0 | ~$0.50 |
| Embedding filter | $0 | $0 (local) |
| Moment Forecaster | ~$2.40 | ~$2.40 |
| Briefing (3×/week) | ~$1.80 | ~$0.60 |
| Tension Evaluator | ~$0.17 | ~$0.17 |
| Novelty Scanner | $0 | ~$0.40 |
| Prediction Reviewer | $0 | ~$0.35 |
| **Total** | **~$24/month** | **~$9-11/month** |

---

## Implementation Order

**Week 1:** Phase 1 (all tasks — these are quick fixes, most are 30-60 min each)
**Week 2:** Phase 2, Tasks 2.1-2.3 (build the tiered components independently)
**Week 3:** Phase 2, Task 2.4 (integrate tiers into signal processor — this is the big integration task)
**Week 4:** Phase 3 (briefing rebuild) + Phase 4 (prediction credibility)
**Ongoing:** Task 2.5 novelty scanner + Task 4.2 prediction reviewer run weekly

---

## Success Criteria

1. **Cost:** Monthly Anthropic API spend < $12 (measured via [TOKENS] logging)
2. **Signal quality:** <20% of Sonnet-evaluated signals score as NOISE bucket (currently estimated ~40-50%)
3. **Briefing quality:** User rates briefings 7+/10 (up from 5/10) — specifically: references real deltas, cites specific signals, no repetition
4. **Prediction credibility:** After 30 days, `prediction_log.json` has reviewed all expired predictions and shows a measurable hit rate (even if it's 10%, that's data)
5. **Collision quality:** <50 collision pairs per run, each representing genuine cultural convergence
6. **Pipeline runtime:** Full run completes in <15 minutes (down from 46+ minutes with backlog)
