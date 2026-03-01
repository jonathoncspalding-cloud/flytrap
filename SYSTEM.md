# Cultural Forecaster — System Document

> Single source of truth for the Cultural Forecaster pipeline: what it does, how it works, and how it's displayed. Hand this to a person or an AI agent and they should be able to understand, maintain, and extend the system.

---

## Vision

Cultural Forecaster is a **predictive cultural intelligence system**. It continuously ingests signals from across the American cultural landscape — news, social platforms, search behavior, video trends, public conversation — and synthesizes them into actionable foresight:

- **What is happening now** (trends, flashpoints, tensions)
- **What is about to happen** (predicted cultural moments)
- **Why it matters** (briefings with creative angles for brand strategy)

The system is US-first by default. Global stories only surface when they demonstrably break through into American attention. The ultimate output is a daily briefing and a rolling set of predicted cultural moments that a strategist can act on before the moment arrives.

---

## Architecture Overview

```
Sources (9 collectors)
    ↓
Evidence Log (Notion DB)
    ↓
Signal Processor (Claude) → Trends DB, Collisions
    ↓
Tension Evaluator (Claude, weekly) → Tensions DB
    ↓
Moment Forecaster (Claude) → Cultural Moments DB
    ↓
Briefing Generator (Claude) → Briefing Archive DB
    ↓
Next.js Dashboard (Vercel)
```

**Stack:** Python 3 pipeline → Notion databases → Next.js 14 (App Router) on Vercel
**AI:** Anthropic Claude (sonnet for processing, opus for briefings)
**Pipeline:** `python3 scripts/run_pipeline.py` — runs all stages sequentially
**Deploy:** `vercel --prod` from `dashboard/` directory (no git remote)

---

## Sync & Scheduling

The pipeline is triggered on-demand, not on a fixed schedule. The dashboard provides a **Sync** button that refreshes all data without requiring the command line.

### How Sync Works

The dashboard exposes two API routes at `/api/sync`:

| Action | Endpoint | What Runs | Token Cost | Duration |
|--------|----------|-----------|------------|----------|
| **Sync** | `POST /api/sync` | Collect → Process → Moments | ~35-45 sonnet calls | 5-10 min |
| **Generate Briefing** | `POST /api/sync?briefing=true` | Briefing only | 1-2 opus calls | 1-2 min |

These API routes shell out to the local Python pipeline. They only work when the Next.js dev server is running locally (the pipeline requires local Python + `.env`). On the deployed Vercel version, the sync button shows a disabled state with a "Run locally" tooltip.

### What Each Sync Does

```
Sync (default):
  1. Collection    — All 9 collectors gather fresh signals (free, no AI)
  2. Processing    — Claude scores signals, creates/updates trends, detects collisions
  3. Moments       — Claude reviews landscape, updates/creates moment predictions
  ✗ Tensions      — SKIPPED (weekly only — see below)
  ✗ Briefing      — SKIPPED (separate trigger)

Generate Briefing:
  1. Briefing      — Claude synthesizes full landscape into daily briefing (opus)
```

### Cadence Rules

| Stage | Runs On Sync? | Actual Cadence | Why |
|-------|---------------|----------------|-----|
| Collection | Yes | Every sync | Free — no AI cost, just API/RSS fetches |
| Signal Processing | Yes | Every sync | Core value — keeps trends and CPS current |
| Moment Forecasting | Yes | Every sync | Predictions should reflect latest signals |
| Tension Evaluation | **No** | Weekly (auto-checked) | Tensions are structural, not reactive. Weekly evaluation prevents weight churn and saves tokens. Runs automatically when ≥7 days since last evaluation. Can be forced with `--tensions --force` CLI. |
| Briefing Generation | **No** | Once per day, on demand | Briefings are a daily synthesis — generating multiples per day wastes opus tokens and dilutes value. Hit "Generate Briefing" when you're ready to read it. |

### Estimated Token Usage

| Scenario | Sonnet Calls | Opus Calls | Est. Cost |
|----------|-------------|------------|-----------|
| 1 sync/day + briefing | ~35-45 | 1-2 | ~$1-3 |
| 2 syncs/day + briefing | ~70-90 | 1-2 | ~$2-5 |
| 3 syncs/day + briefing | ~105-135 | 1-2 | ~$3-7 |
| Tension eval (weekly) | 1 | 0 | ~$0.05 |

Signal processing dominates cost. Each batch of 10 signals = 1 Claude call. A typical collection yields 285-425 signals → 29-43 calls. Moment forecasting adds 1 call. Briefing adds 1-2 opus calls (most expensive per-call but infrequent).

### UI Component

A sync control appears in the dashboard sidebar footer (above the theme toggle):

- **Sync button** — Triggers collect → process → moments. Shows spinner and elapsed time while running. Disabled if a sync is already in progress.
- **Briefing button** — Triggers briefing generation only. Disabled if today's briefing already exists.
- **Last synced** — Timestamp of most recent successful sync.
- **Status indicator** — Green dot (fresh, synced within 2 hours), yellow dot (stale, >2 hours), gray dot (never synced this session).

After sync completes, the dashboard automatically revalidates — all pages reflect fresh data on next navigation.

### CLI Equivalents

For scripting, cron, or when the dev server isn't running:

```bash
# Full sync (no briefing, no tensions)
python3 scripts/run_pipeline.py --no-brief

# Briefing only
python3 scripts/run_pipeline.py --brief

# Full pipeline including briefing (daily cron candidate)
python3 scripts/run_pipeline.py

# Force tension evaluation
python3 scripts/run_pipeline.py --tensions --force

# Individual stages
python3 scripts/run_pipeline.py --collect    # Collection only
python3 scripts/run_pipeline.py --process    # Processing only
python3 scripts/run_pipeline.py --moments    # Moment forecasting only
```

### Recommended Daily Workflow

1. **Morning:** Hit **Sync** to collect fresh signals and update trends/moments. Review the dashboard.
2. **Morning (after review):** Hit **Generate Briefing** to produce the daily briefing based on the freshest data.
3. **Midday (optional):** Hit **Sync** again if you want a fresher read before a meeting or decision.
4. **Tensions:** Happen automatically on the first sync after 7 days. No action needed.

---

# Phase 1: Sources

How data enters the system. Nine automated collectors plus a calendar collector run on each pipeline execution.

## Current Collector Stack

### 1. Reddit Collector
- **File:** `scripts/collectors/reddit_collector.py`
- **Method:** PRAW (authenticated) or public JSON endpoint (fallback)
- **Coverage:** 43 subreddits across 9 categories:
  - Culture: popular, OutOfTheLoop, TikTokCringe, HobbyDrama, InternetIsBeautiful
  - Entertainment: entertainment, popculturechat, celebrity, Fauxmoi, moviescirclejerk, television, Music
  - Commentary: NoStupidQuestions, AskReddit, unpopularopinion, changemyview, TrueOffMyChest
  - Economy: antiwork, latestagecapitalism, PersonalFinance, povertyfinance, WorkReform
  - Identity: GenZ, Millennials, AskWomenOver30, AskMenOver30, TwoXChromosomes
  - Fashion: femalefashionadvice, malefashionadvice, streetwear
  - Tech: technology, artificial, ChatGPT, AIArt
  - Wellness: LifeAdvice, relationship_advice, StopDrinking, CleanEating
  - Advertising: advertising, marketing, mildlyinfuriating, firstworldproblems
- **Thresholds:** MIN_UPVOTES = 500, POSTS_PER_SUB = 10
- **Rate limit:** 2s between subreddits (public API)
- **Maps to sources.md:** Category C (Public Conversation). Current stack covers 43 subs; sources.md recommends 10 starter subs (r/news, r/politics, r/worldnews, r/technology, r/entertainment, r/popculturechat, r/nfl, r/nba, r/cfb, r/OutOfTheLoop). Our stack is a superset — we cover all recommended subs plus 33 more in culture, identity, economy, and wellness verticals.

### 2. RSS Collector
- **File:** `scripts/collectors/rss_collector.py`
- **Method:** feedparser (Python library)
- **Coverage:** 74 feeds across US national news, culture, entertainment, fashion, design, food, tech, business, advertising, research, newsletters, sports/gaming, and international
- **Thresholds:** MAX_AGE_HOURS = 48, MAX_ITEMS_PER_FEED = 10
- **Rate limit:** 0.5s between feeds
- **Research feeds** (Pew, Think With Google, YouGov, etc.) tagged with `source_platform: "Research"` for separate treatment on the Insights page
- **Maps to sources.md:** Category B (Breaking News). Sources.md lists ~25 RSS feeds across B1-B4. Our stack covers 74 feeds — broader in culture, fashion, design, and research verticals. Key overlap: NYT (Homepage + Arts/Style/Tech), NPR, BBC World, Guardian World, Verge, TechCrunch, Wired, ESPN, Variety, Hollywood Reporter, Billboard, CNBC, MarketWatch, Axios, Ad Age, Adweek. Remaining gaps (low priority): PBS NewsHour, ABC/CBS/NBC News, Ars Technica, TMZ. CNN RSS is broken (SSL errors, stale content).

### 3. Wikipedia Trending
- **File:** `scripts/collectors/wikipedia_trending.py`
- **Method:** Wikimedia Pageviews REST API v1
- **Endpoint:** `wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/{YYYY}/{MM}/{DD}`
- **Thresholds:** MIN_VIEWS = 50,000; TOP_N = 100
- **Exclusions:** Perennially popular pages (Main_Page, YouTube, Facebook, etc.) and structural pages (List_of_*, Deaths_in_*, Portal:*)
- **Lag:** 1-2 days (Wikimedia data availability)
- **Maps to sources.md:** Category D (Curiosity & Intent). Sources.md also recommends D1 (Most Read, daily) — which is what we implement. Sources.md additionally recommends D2 (per-entity hourly pageview tracking for candidate entities) and D3 (Google Trends). We have Google Trends as a separate collector but don't yet do per-entity Wikipedia spike detection.

### 4. Google Trends
- **File:** `scripts/collectors/google_trends.py`
- **Method:** pytrends (unofficial Google Trends API)
- **Coverage:**
  - Top 30 daily trending searches (US)
  - Rising queries across 7 culture topic clusters: AI/ChatGPT/automation, cost of living/inflation/rent, loneliness/mental health/anxiety, creator economy/influencer/TikTok, nostalgia/Y2K/retro, authenticity/deinfluencing/dupes, climate/sustainability/greenwashing
- **Timeframe:** "now 7-d" for rising queries
- **Rate limit:** 1.5s between topic clusters
- **Maps to sources.md:** Category D3 (optional). Sources.md treats Google Trends as optional for MVP, noting Wikipedia + YouTube + news velocity covers a lot. We've implemented it — adds value as a curiosity/intent signal.

### 5. Hacker News Collector
- **File:** `scripts/collectors/hn_collector.py`
- **Method:** Algolia HN API (`hn.algolia.com/api/v1/search`)
- **Coverage:** Keyword-filtered search across 26 cultural terms spanning society, tech, consumer, media, and politics categories
- **Thresholds:** MIN_POINTS = 100, MIN_COMMENTS = 10, MAX_AGE_HOURS = 48
- **Rate limit:** 1s after each API call
- **Maps to sources.md:** Category C2 (Hacker News). Sources.md recommends front_page, new stories, and high-points endpoints. Our implementation uses keyword-filtered search which is more targeted but potentially misses non-keyword-matching stories. Sources.md's `tags=front_page` and `numericFilters=points>100` approaches would be complementary.

### 6. Bluesky Collector
- **File:** `scripts/collectors/bluesky_collector.py`
- **Method:** AT Protocol public API (no auth required)
- **Endpoints:** `app.bsky.unspecced.getTrendingTopics`, `app.bsky.feed.searchPosts`
- **Coverage:** Trending topics + post search across 7 culture queries (culture, trending, viral, gen z, ad industry, brand, creative brief)
- **Thresholds:** MIN_LIKE_COUNT = 50, MAX_POSTS_PER_QUERY = 5, MAX_TRENDING_TOPICS = 20
- **Rate limit:** 0.5s between queries, 1s after trending topics
- **Maps to sources.md:** Not in sources.md. Sources.md focuses on X/Twitter via Trends24 (category A1) and TikTok Creative Center (A2). Bluesky is an addition beyond the sources.md spec — provides social conversation signal from a growing platform.

### 7. YouTube Collector
- **File:** `scripts/collectors/youtube_collector.py`
- **Method:** YouTube Data API v3
- **Endpoint:** `googleapis.com/youtube/v3/videos` (chart=mostPopular, regionCode=US)
- **Coverage:** 6 categories — Music (10), People & Blogs (22), Comedy (23), Entertainment (24), News & Politics (25), Howto & Style (26)
- **Thresholds:** MIN_VIEWS = 500,000; MAX_AGE_DAYS = 3; 25 results per category
- **Rate limit:** 1s between category calls
- **Requires:** YOUTUBE_API_KEY environment variable
- **Maps to sources.md:** Category E (Creator / Video Diffusion). Direct match with E1 (YouTube Most Popular US). Sources.md recommends the same endpoint with the same parameters. We implement 6 categories; sources.md suggests 3 (Music 10, Entertainment 24, News 25). Our coverage is broader.

### 8. Calendar Collector
- **File:** `scripts/collectors/calendar_collector.py`
- **Method:** RSS feeds → Claude extraction → Notion Calendar DB (direct write, no signal intermediary)
- **Coverage:** 14 feeds — Deadline, Variety, Hollywood Reporter, Collider, Pitchfork, Consequence of Sound, ESPN, BBC Sport, TechCrunch, The Verge, NPR, BBC News, NYT, Guardian Culture, Axios
- **Extraction:** Claude (haiku) parses feed content for structured events with name, date, categories, potency (20-80), notes
- **Thresholds:** LOOKAHEAD_DAYS = 90, MAX_EVENTS_PER_RUN = 40, DEDUP_THRESHOLD = 0.75 (fuzzy name matching)
- **Validation:** Date in window, valid categories (15 options), potency clamped [20, 80], name ≥ 3 chars
- **Maps to sources.md:** Partially maps to Category F (Futures). Sources.md envisions calendar entries from prediction markets (Polymarket, Kalshi, Manifold). Our calendar collector pulls from entertainment/news RSS — complementary to the Polymarket collector (§9) which adds high-stakes moments with probability signals.

### 9. Polymarket Collector
- **File:** `scripts/collectors/polymarket_collector.py`
- **Method:** Polymarket Gamma API (public, no auth, free)
- **Endpoint:** `gamma-api.polymarket.com/events` (active, not closed, sorted by volume)
- **Coverage:** Two signal types per sources.md §F:
  - **Attention Anchors:** High-volume events with upcoming resolution dates (scheduled moments that concentrate attention — elections, Fed decisions, verdicts, awards)
  - **Volatility Radar:** Markets with ≥5% price move in 24 hours (early warning that probability is shifting — "something is brewing")
- **Thresholds:** MIN_VOLUME_24H = $50,000; MIN_PRICE_CHANGE = 5%; MAX_SIGNALS = 30; MAX_LOOKAHEAD_DAYS = 90
- **Noise filters:** Crypto price bets, esports, tweet counting, and other non-cultural markets are excluded (~9% of Polymarket events)
- **Rate limit:** Single API call per run (no pagination needed for top 100 events)
- **Maps to sources.md:** Category F1 (Futures — Prediction Markets). Direct implementation of the Polymarket integration spec. Sources.md also recommends Kalshi (F1, medium priority) and Manifold (F1, low priority) for redundancy — not yet implemented.

### 10. Trends24 Collector (X/Twitter US Trends)
- **File:** `scripts/collectors/trends24_collector.py`
- **Method:** HTTP GET + HTML parsing of Trends24.in (public X/Twitter trend aggregator)
- **Endpoint:** `trends24.in/united-states/`
- **Coverage:** Top 50 unique US trending topics from X/Twitter, drawn from 24 hourly time blocks (~230+ unique trends per day available, top 50 returned)
- **Thresholds:** MAX_TRENDS = 50 (most recent first)
- **Rate limit:** Single request per run (~1 second)
- **No auth required:** Public page, no API key, no Cloudflare, server-rendered HTML
- **Maintenance:** HTML parsing via regex on `trend-name > a` CSS structure. If Trends24 changes their DOM, the `_parse_trends()` regex needs updating — this is auto-approved per Scout standing orders and should be fixed without user approval.
- **Maps to sources.md:** Category A1 (Social Seeds — X Trends US). Direct implementation of the Trends24 integration. Sources.md recommends embed/link-out but we machine-ingest for pipeline integration.

## Sources.md Gap Analysis

What sources.md recommends that we haven't implemented yet:

### Recently Implemented (closed gaps)

| Source | Category | Status | Notes |
|--------|----------|--------|-------|
| **Polymarket** | F1 (Futures) | ✅ Done | Prediction market attention anchors + volatility radar. 30 signals/run. |
| **NPR, NYT Homepage, ESPN, Billboard** | B1/B3 (Breaking News) | ✅ Done | Core US breaking news and entertainment RSS feeds added. |
| **CNBC, MarketWatch** | B2 (Business) | ✅ Done | Financial/business news coverage gap closed. |
| **BBC World, Guardian World** | B4 (Global) | ✅ Done | Global feeds for Breakthrough Gate inputs. |
| **Trends24 (X/Twitter)** | A1 (Social Seeds) | ✅ Done | 50 US trends per run via HTML parsing. Auto-fix if structure changes. |
| **Ad Age, Adweek** | B2 (Media) | ✅ Already had | Industry advertising/marketing RSS was already in place. |
| **Axios** | B1 (Breaking News) | ✅ Already had | Was already in RSS collector. |

### Not Yet Implemented

| Source | Category | Priority | Notes |
|--------|----------|----------|-------|
| **Kalshi** | F1 (Futures) | Medium | Second prediction market source for redundancy. Polymarket covers the primary need. |
| **Manifold Markets** | F1 (Futures) | Low | Third prediction market, smaller but more diverse questions. |
| **TikTok Creative Center** | A2 (Social Seeds) | Low | Embed/link-out only, not machine-ingestible. Dashboard panel, not a collector. |
| **PBS NewsHour RSS** | B1 (Breaking News) | Low | Marginal value — NPR + NYT + CNN cover US breaking news. |
| **ABC/CBS/NBC News RSS** | B1 (Breaking News) | Low | Diminishing returns given existing news coverage. |
| **Ars Technica** | B2 (Tech) | Low | We have Verge, TechCrunch, Wired — 3 deep tech sources. |
| **TMZ RSS** | B3 (Entertainment) | Low | Celebrity/gossip — People + Fauxmoi (Reddit) cover this. |
| **GDELT clustering** | B5 (Clustering) | Low | Claude handles clustering. |
| **Wikipedia per-entity hourly tracking** | D2 (Curiosity) | Medium | Hourly spike detection for candidate entities. Would improve signal quality. |

### What We Have That sources.md Doesn't Cover

| Source | Our Category | Value |
|--------|-------------|-------|
| **Bluesky** | Social (AT Protocol) | Growing platform, public API, no auth needed |
| **33 additional Reddit subs** | Public Conversation | Deep cultural verticals (identity, economy, wellness, fashion) beyond sources.md's 10 starter subs |
| **Research feeds** (Pew, YouGov, etc.) | Research/Insights | Academic and research signals — unique to our stack |
| **Culture/Fashion/Design RSS** (Dazed, i-D, Dezeen, etc.) | Culture | Niche culture verticals not in sources.md |

### Implementation Priority for Remaining Gaps

1. **Wikipedia per-entity spike detection** — Improves curiosity/intent signal quality. Medium effort.
2. **Kalshi** — Prediction market redundancy. Low effort (same pattern as Polymarket).
3. **Everything else** — Low priority, diminishing returns.

### Global Breakthrough Gate (from sources.md)

Items from global feeds (BBC/Guardian, r/worldnews) should only surface if they trigger ≥2 of:
- Picked up by ≥2 US national news sources within 1-6 hours
- Appears in US conversation signals (r/news, r/politics, HN) within 6 hours
- Appears in US video diffusion (YouTube mostPopular US) within 24 hours
- Wikipedia pageviews spike above threshold (hourly)

**Current status:** Not formally implemented as a gate. Global items enter the pipeline and are evaluated by Claude during signal processing, but there's no automated cross-source validation gate. This would be a meaningful addition.

---

# Phase 2: Computations

How raw signals become trends, tensions, moments, and briefings. All AI processing uses Anthropic Claude.

## Pipeline Execution Order

```
python3 scripts/run_pipeline.py
```

Stages run sequentially. Each can be run independently via CLI flags.

| Stage | Script | Model | Runs on Sync? | Cadence | CLI Flag |
|-------|--------|-------|---------------|---------|----------|
| 1. Collection | `signal_writer.py` + all collectors | — | **Yes** | Every sync | `--collect` |
| 2. Signal Processing | `signal_processor.py` | claude-sonnet-4-5 | **Yes** | Every sync | `--process` |
| 3. Tension Evaluation | `tension_evaluator.py` | claude-sonnet-4-5 | **No** | Weekly (auto) | `--tensions` |
| 4. Moment Forecasting | `moment_forecaster.py` | claude-sonnet-4-5 | **Yes** | Every sync | `--moments` |
| 5. Briefing Generation | `briefing_generator.py` | claude-opus-4-5 (fallback: sonnet) | **No** | Once daily, on demand | `--brief` |

Tensions run automatically when ≥7 days since last evaluation (checked at pipeline start). Briefing is triggered separately via the dashboard "Generate Briefing" button or `--brief` CLI flag. See **Sync & Scheduling** above for full details.

## Stage 1: Signal Collection

All 9 collectors run and write to the Evidence Log (Notion). Calendar collector writes directly to the Calendar DB. Each signal has a normalized shape:

```
title           — Source-prefixed headline
source_platform — Reddit | RSS | Wikipedia | Google Trends | News | Social | YouTube | Research
source_url      — Canonical link
raw_content     — Full context string (platform, engagement metrics, text excerpt)
summary         — One-line human-readable summary
date_captured   — ISO date
```

Typical yield: **285-425 signals per run** across all collectors.

## Stage 2: Signal Processing

**File:** `scripts/processors/signal_processor.py`

The core intelligence layer. Claude evaluates unprocessed signals in batches and does three things:

### 2a. CPS Scoring (Cultural Potency Score, 0-100)

Every signal receives a CPS score reflecting its cultural charge:

| Range | Meaning |
|-------|---------|
| 80-100 | Intersection of 3+ tensions with strong velocity — flashpoint territory |
| 60-79 | Hitting 2 tensions with clear momentum |
| 40-59 | Touching 1-2 tensions, notable but not urgent |
| 20-39 | Early-stage with cultural relevance |
| 0-19 | Noise — low cultural charge |

CPS is the primary metric across the entire system. It determines trend ranking, flashpoint designation (≥80), collision eligibility, and dashboard prominence.

### 2b. Trend Creation & Updating

Claude links each signal to existing trends or recommends new trend creation.

**Evidence threshold:** A new trend requires **MIN_EVIDENCE_THRESHOLD = 2** corroborating signals before creation. This prevents single-signal noise from polluting the Trends DB.

**Trend updates on match:**
- CPS: Updated if new signal's CPS is higher (never decreases)
- CPS Sparkline: 14-day rolling history of CPS values (comma-separated)
- Linked Tensions: Union merge — existing relations preserved, new ones added
- Last Updated: Set to today

### 2c. Collision Detection

After processing, the system detects trend pairs that may produce cultural flashpoints:

- **Eligibility:** Only trends with CPS ≥ 60
- **Criteria:** ≥2 shared tensions AND combined CPS ≥ 120
- **Output:** `data/collisions.json` — top 10 pairs by combined CPS
- **Downstream:** Fed into moment forecaster and briefing generator

### 2d. Signal Velocity Tracking

Daily signal counts per trend stored in `data/signal_velocity.json` with a 14-day rolling window. Used by the moment forecaster to detect acceleration:

```
Acceleration = last_3d_signals / prior_3d_signals
If ratio > 1.5 → "accelerating"
If ratio > 0.7 → "steady"
Else → "decelerating"
```

**Processing parameters:** Batch size = 10 signals per Claude call, 2s sleep between batches, max tokens = 4096.

## Stage 3: Tension Evaluation

**File:** `scripts/processors/tension_evaluator.py`

Runs weekly (or forced with `--force`). State tracked in `data/tension_eval_state.json`.

Tensions are the structural conflicts that drive cultural behavior — "X vs. Y" oppositions like "Privacy vs. Convenience" or "Authenticity vs. Performance." They're the why behind the what.

Claude performs three tasks:

### 3a. New Tension Discovery
- Identifies 0-3 genuinely new structural conflicts visible in recent signals
- Validation: Must be sustained, unresolved conflict between opposing values; evidence across multiple platforms; distinct from existing tensions; relevant to brand strategy
- Weight: 1-10 (proposed by Claude)

### 3b. Weight Adjustments
- Existing tensions re-evaluated based on recent signal intersection
- Change clamped to ±2 per evaluation (gradual, not dramatic)
- Factors: How many recent trends intersect this tension? Are signals increasing? Is it generating flashpoint-level (CPS 80+) activity?

### 3c. Dormancy Flagging
- Tensions with very low signal intersection → status set to "Dormant"
- Can reactivate if signals pick up

**Data loaded:** All tensions, trends from last 7 days (non-archived), up to 200 recent signals linked to trends.

## Stage 4: Moment Forecasting

**File:** `scripts/processors/moment_forecaster.py`

The predictive core. Claude analyzes the full landscape and generates cultural moment predictions.

### Prediction Types

| Type | Icon | Description |
|------|------|-------------|
| **Catalyst** | ⚡ | A known upcoming event collides with active tensions → predictable cultural outcome |
| **Collision** | 💥 | Two or more converging trends create an inevitable flashpoint |
| **Pressure** | 🌊 | Signal velocity is accelerating toward a tipping point |
| **Pattern** | 🔄 | Seasonal/cyclical moment meets novel cultural context |
| **Void** | 🕳️ | Something conspicuously absent from discourse — the absence becomes the story |

### Time Horizons

| Horizon | Window | Confidence Expectation |
|---------|--------|----------------------|
| This Week | Next 7 days | High confidence, very specific |
| 2-4 Weeks | Days 8-28 | Medium confidence, directional |
| 1-3 Months | Days 29-90 | Lower confidence, thematic |

### Scoring

- **Confidence (0-100):** Grounded in evidence density, not vibes. How sure are we this will happen?
- **Magnitude (0-100):** How culturally significant will it be if it does happen?
- **Evidence requirement:** Each prediction must intersect at least 2 active tensions

### Constraints

- **MAX_ACTIVE_MOMENTS = 12** — Hard ceiling on simultaneous active predictions. Forces quality over quantity.
- **Generation limit:** 5-8 new predictions per run
- **Auto-retirement:** Moments whose prediction window expires without confirmation → status "Missed"

### Status Lifecycle

```
Predicted → Forming → Happening → Passed
                                 → Missed (auto-retired if window expires)
```

### Data Loaded for Forecasting
- All active tensions (weighted)
- Top 30 trends by CPS
- Calendar events (next 60 days)
- Top 5 collision pairs
- Signal velocity data (7-day rolling, acceleration ratios)
- All existing moments (for update/retire decisions)

### Linked Relations
Each moment links to supporting trends, driving tensions, and catalyst events via Notion relations. These connections power the detail page and enable traceability from prediction → evidence.

## Futures Layer: Prediction Markets → Better Moment Forecasting

**Status: Not yet implemented. Highest-priority source addition.**

Prediction markets (Polymarket, Kalshi, Manifold) are public platforms where people bet real money on outcomes — elections, Fed decisions, verdicts, award shows, policy deadlines. The prices are implied probabilities. When a market moves from 30% to 65% in a few hours, that's a signal that something is shifting — and it's a signal backed by money, not vibes.

The Futures layer doesn't replace any existing functionality. It adds three capabilities that make moment forecasting significantly sharper:

### 1. Attention Anchors (Scheduled Gravity Wells)

**Problem:** Our moment forecaster currently relies on signal velocity and tension intersection to predict when something will pop. It's good at detecting *what* is building, but less precise about *when* it will peak.

**Solution:** Convert prediction market questions into **Attention Anchors** — date-bounded, high-stakes events that act as scheduled gravity wells for public attention.

Examples:
- "Will the Fed cut rates at the March meeting?" → Anchor: March 19, FOMC Decision
- "Will [Nominee] be confirmed by the Senate?" → Anchor: Confirmation vote window
- "Oscar Best Picture winner?" → Anchor: March 2, Academy Awards

Each anchor gets:
- **Title:** Plain English (no market jargon)
- **Window:** Resolution date ± 2-5 days (attention builds before and lingers after)
- **Category:** Politics / Macro / Legal / Awards / Other
- **Current probability + recent change:** e.g., "73% (↑ from 45% last week)"

Anchors flow directly into the Calendar DB and become available to the moment forecaster as high-confidence timing signals.

### 2. Volatility Radar (Early Warning)

**Problem:** By the time a topic is trending on Reddit and news RSS, it's often already happening. We want earlier warning.

**Solution:** Track the **biggest probability moves** across active markets in the last 1-6 hours. A market swinging 15+ points signals something is brewing before it hits mainstream sources.

How it works:
- Poll tracked markets every 30-60 minutes
- Compute Δ probability over rolling 1h, 6h, 24h windows
- Flag any market with |Δ6h| ≥ 15 points as "volatile"
- When volatile: auto-generate targeted searches for the entity across existing sources (Reddit keyword RSS, news keyword filters, Wikipedia entity watch, YouTube keyword queries)

This turns prediction markets into a **trigger for deeper sourcing** — not a source in themselves, but a signal that tells the system "look harder at this topic right now."

### 3. Moment Forecasting Improvements

With anchors and volatility data flowing in, the moment forecaster gets three upgrades:

#### Better Timing (Window Selection)
When a predicted moment is linked to an anchor, its prediction window derives from the anchor's resolution date instead of being estimated from velocity alone:
- If conversation velocity is rising early → shift window earlier
- If mainstream coverage lags but curiosity rises → keep window tight around anchor date
- If outcome is uncertain/contested → widen window (debate lasts longer)

#### Better Confidence (Positive Signal Only)
Futures **boost** confidence but never penalize:
- Anchor present + attention priming (cross-source pickup) → confidence boost
- No relevant anchor → no change (many cultural moments have no market)
- Anchor moving dramatically → trigger deeper sourcing, but don't auto-raise confidence unless other sources confirm

**Key rule: No market match = no penalty.** Prediction markets cover politics, macro, and legal well. They cover culture, entertainment, and social poorly. The system must work without them.

#### Scenario Branching
For moments tied to resolvable anchors (verdict, election, Fed decision), store two lightweight scenario sketches:
- **If Outcome A** → likely tension expression, backlash shape, brand opportunity
- **If Outcome B** → likely tension expression, backlash shape, brand opportunity

This lets the briefing generator prepare actionable angles for both outcomes before the event resolves.

### 4. Auto-Generated Monitor Packs

When an anchor is added or changes materially, the system auto-generates a **Monitor Pack** — a bundle of targeted queries that strengthen sourcing for that specific topic:

- **2-6 Reddit keyword RSS searches** (entity + tension keywords)
- **News keyword filters** for RSS clustering
- **Wikipedia entity watchlist** (likely page titles to track for hourly spikes)
- **YouTube keyword queries** (entity + explainer terms)

These queries feed back into existing collectors, making them temporarily more attentive to the anchor's topic. When the anchor resolves, the monitor pack expires.

### 5. Implementation Plan

#### Data Sources (read-only APIs)

| Provider | API | Auth | Free Tier | Key Data |
|----------|-----|------|-----------|----------|
| **Polymarket** | `docs.polymarket.com` | None (public) | Unlimited reads | Markets, prices, volume, resolution dates |
| **Kalshi** | `docs.kalshi.com` | API key (free) | Rate-limited | Markets, prices, settlement dates |
| **Manifold** | `docs.manifold.markets/api` | None (public) | Unlimited reads | Markets, probabilities, close dates |

#### New Collector: `futures_collector.py`

```
Cadence:
  - Discovery (new markets, upcoming deadlines): Every 60-180 min
  - Tracking (top N anchors): Every 30-60 min
  - Volatility radar (biggest movers): Every 30-60 min

Output:
  - Attention Anchors → Calendar DB (type: "Futures Anchor")
  - Volatility alerts → fed into moment_forecaster context
  - Monitor Packs → injected into relevant collectors as temporary keyword expansions
```

#### Notion Schema Additions

Calendar DB gets a new type option:
- `Type: "Futures Anchor"` (alongside existing "Known Event")

New optional properties on Calendar entries:
- `Implied Probability` (Number, 0-100)
- `Probability Change 24h` (Number, signed)
- `Market Source` (Select: Polymarket / Kalshi / Manifold)
- `Market URL` (URL)

#### Moment Forecaster Prompt Updates

The forecaster's Claude prompt gets additional context:
- List of upcoming attention anchors with probabilities and recent movement
- Volatility alerts (markets moving ≥15 points in 6h)
- Instruction: "Use anchors to sharpen timing. Use volatility to identify brewing moments. Never penalize a prediction for lacking a market anchor."

#### Dashboard Changes

- Calendar page: Futures Anchors appear alongside known events, with probability badge and Δ indicator
- Moment detail: "Anchored to: [Event] — Window [dates]" field when a moment is linked to an anchor
- Home dashboard: Volatility alerts could appear in the flashpoints bar when triggered

### 6. What This Doesn't Do

- **Futures are not a gate.** They never suppress or filter out trends, moments, or signals.
- **Futures are not a source of truth.** Markets can be wrong, illiquid, or manipulated. They're one input among many.
- **Futures don't cover everything.** Most cultural moments (memes, backlash cycles, creator drama) will never have a prediction market. The system must work perfectly well without any futures data.

## Stage 5: Briefing Generation

**File:** `scripts/processors/briefing_generator.py`

Daily synthesis of the entire landscape into a single actionable document.

### Briefing Structure

1. **Predicted Moments** — Top moment predictions with status, watch-fors, client preparation notes
2. **Flashpoints** — Trends with CPS ≥ 80 (or top 3 closest). What it is, why now, which clients should move.
3. **What's Moving** — 4-6 highest-momentum trends
4. **Collision Alerts** — Converging high-CPS trends on shared tensions (if any)
5. **Signals Worth Watching** — 5-7 recent signals from last 24h that are early or surprising
6. **On Deck** — Cultural moments in next 14 days with brand potential
7. **The Brief** — 3-4 specific, actionable creative angles formatted as: **[Client]** — [Trend] → [Campaign thought]

### Rendering Rules
- Bold only trend names — never include CPS scores in bold text
- Max tokens: 3000
- Models: claude-opus-4-5 primary, claude-sonnet-4-5 fallback
- Retry logic: 3 retries per model, 529 overload waits 15s × retry count
- Rich text chunked at 1900 bytes (Notion's 2000-byte limit with buffer)

### Extraction from Briefing
- Flashpoint count: counted from bold trend names in Flashpoints section
- Key highlights: top 4 flashpoint trend names joined by " · "
- Both stored in Notion alongside the full briefing content

---

# Phase 3: Displays

How data is visualized. Next.js 14 App Router with server-side rendering, Notion as the data layer, deployed on Vercel.

## Navigation

Fixed left sidebar (200px) with 7 routes:

| Route | Label | Icon |
|-------|-------|------|
| `/` | Home | Grid |
| `/briefings` | Briefing | File text |
| `/forecast` | Forecast | Zap |
| `/tensions` | Tensions | Git pull request |
| `/trends` | Trends | Trending up |
| `/research` | Research | Microscope |
| `/calendar` | Calendar | Calendar |

Sidebar includes logo ("Cultural Forecaster / LeBrain James"), date, and dark/light theme toggle.

## Page Layouts

### Home (`/`)


When website is first launched, include a blank Home dashboard with only a button that says "Sync" 
When user clicks button, play looping video in folder projects/forecaster/assets/background_video.mp4 
This should feel like a "loading screen" as the dashboard syncs and updates the system with new data. This should take up entire screen inside the HOME page. 

Once synced: Condensed 5-column dashboard designed to fit on one screen (1440×900) without scrolling.

Condensed 5-column dashboard designed to fit on one screen (1440×900) without scrolling.

**Row 1:**
- Today's Briefing (2 cols) — date, flashpoint count badge, key highlights, truncated content (2-line clamp)
- Predicted Moments (2 cols, compact mode) — top 3 moments as single-line rows with type icon, name, status badge, horizon, confidence %
- Radar Stats (1 col) — 4 stat pills: active trends, flashpoints (CPS ≥ 80), tensions tracked, upcoming events

**Row 2 (conditional):** Flashpoints bar — horizontal scrolling single-line list of high-CPS trends (≥80), limited to 12, with count badge. Only shows if flashpoints exist.

**Row 3:**
- Micro Trends (2 cols) — top 4 TrendCards in compact variant, "+N more" link
- Macro Trends (2 cols) — top 4 TrendCards in compact variant, "+N more" link
- Right column (1 col, stacked):
  - Upcoming Events mini — 3 events with name, date, CPS badge
  - Tensions mini — 4 TensionBadges (wrapped)

**Data fetched:** Trends, tensions, events (30d), latest briefing, research insights (6), active moments.

### Briefings (`/briefings`)

Latest briefing displayed prominently with interactive `BriefingViewer` component (processes markdown, makes trend names clickable). Archive of 10 most recent briefings below with simplified rendering. Each shows date, flashpoint count badge, and content.

### Forecast (`/forecast`)

All cultural moment predictions in a responsive card grid (`minmax(340px, 1fr)`).

**Header stats:** Active predictions count, horizon breakdowns (This Week / 2-4 Weeks / 1-3 Months), "forming" badge.

**Moment cards show:**
- Type badge with icon and color (Catalyst ⚡, Collision 💥, Pressure 🌊, Pattern 🔄, Void 🕳️)
- Status badge (color-coded: Predicted / Forming / Happening / Passed / Missed)
- Horizon tag
- Title and narrative (2-line clamp)
- Confidence bar (color by level: ≥75 green, ≥50 amber, ≥25 indigo, <25 gray)
- Magnitude label
- Prediction window dates

**Sorting:** Status rank (Happening → Forming → Predicted) then horizon rank then confidence descending. Past predictions in separate section below.

**Links to:** `/moments/[id]` detail page and `/moments/methodology` explanation page.

### Moment Detail (`/moments/[id]`)

Two-column layout (3fr / 2fr).

**Hero:** Type/status/horizon badges, title (h1), narrative, confidence score + bar, magnitude, prediction window.

**Left column:** Watch For indicators (semicolon-separated list), Reasoning narrative, Type explanation (what this prediction type means), Outcome notes (if resolved).

**Right column:** Supporting trends (name, type·status, CPS), Driving tensions (badges with weight), Catalyst events (linked calendar events), Metadata (dates, ID).

### Tensions (`/tensions`)

All tensions grouped by severity tier:

| Tier | Weight | Color |
|------|--------|-------|
| Critical | ≥ 9 | Red (#ef4444) |
| High | 7-8 | Orange (#f97316) |
| Moderate | 5-6 | Yellow (#eab308) |
| Background | < 5 | Gray |

**Header:** Total tension count, tier counts, "What are tensions?" methodology link.

**TensionCard component** parses "X vs. Y" names via regex and displays:
- Side A (top)
- Visual divider: `── VS ──` badge
- Side B (bottom)
- Weight badge (N/10)
- Weight progress bar
- Description (3-line clamp)

Cards are color-coded by weight tier (border, background tint, accent bar, VS badge). Falls back to plain name display for tensions without "vs." pattern.

**Grid:** `repeat(auto-fill, minmax(280px, 1fr))` with 10px gap.

### Tension Detail (`/tensions/[id]`)

**Header card:** "CULTURAL TENSION" label, title, description, weight score (N/10) with label (Critical/High/Moderate/Low), weight bar, stats row (linked trends, flashpoints, rising heat, evidence count).

**Two columns:**
- Left: Linked trends as compact TrendCards
- Right: Evidence & Sources — evidence items with title link, platform icon, date, sentiment badge, summary

### Trends (`/trends`)

Filterable catalog of all trends.

**Filters (sticky bar):**
- Type: All, Macro Trend, Micro Trend, Signal, Event, Predicted
- Status: All, Exploding, Rising, Peaked, Stable, Emerging
- View toggle: Grid (300px min-width cards) vs List (full-width rows)

**Header stats:** Total trends, flashpoint count, rising heat count.

Each TrendCard shows: type/status badges, title, summary, CPS score, sparkline, momentum indicator, evidence count.

### Trend Detail (`/trends/[id]`)

**Hero card:** Type/status/pinned badges, title, summary, large CPS display (48px), sparkline (80×26), CPS bar chart, stats row (signal count, platforms, momentum, CPS history days, first detected, last updated).

**Left column (Evidence Timeline):** Grid of evidence cards — platform icon + title link, platform/date, sentiment badge, summary. Platform breakdown calculated from evidence.

**Right column:**
- Forecast box (indigo border) — narrative forecast text
- Channel Activity heatmap — platforms sorted by count, horizontal bars
- Signal Confidence breakdown — total signals, platform spread, assessment text

### Research (`/research`)

Grid of insight cards from research-platform evidence.

**InsightCard:** Top accent (cyan gradient), date, sentiment dot (↑ green / ↓ red / ~ amber), title, summary (4-line clamp), "Read study" link.

**Filter:** Research platform only, last 21 days.

### Calendar (`/calendar`)

Three-column layout.

**Left (2 cols):** Events grouped by month, each with CalendarEventRow showing name, date, CPS badge.

**Right (1 col, sidebar):**
- Top 5 Highest CPS Events
- Calendar Stats — counts by CPS bracket (80+, 60-79, 40-59, <40) + Predicted Moments count

**Filters:** Horizon selector (14d-365d, default 90d), Category selector (All, Politics, Entertainment, Sports, Tech, Business, Culture, Holiday, Music, Film).

## Shared UI Patterns

### Color System
- Weight/severity tiers: Red (critical), Orange (high), Yellow/Amber (moderate), Gray (low/background)
- Confidence: Green (≥75), Amber (≥50), Indigo (≥25), Gray (<25)
- Sentiment: Green (positive), Red (negative), Amber (mixed), Gray (neutral)
- Type-coded: Each trend type and moment type has a unique color
- CSS custom properties for dark/light mode via `ThemeProvider`

### Platform Icons
Emoji-based: Reddit 🟠, Twitter 𝕏, YouTube ▶️, Bluesky 🦋, HN 🔸, plus RSS 📰, Wikipedia 📚, Google Trends 📈, Social 📱, Blog ✍️, Manual ✋

### Data Freshness (Cache Strategy)

| Data | Cache Duration |
|------|---------------|
| Trends, Tensions | 5 minutes (300s) |
| Evidence counts | 10 minutes (600s) |
| News signals | 30 minutes (1800s) |
| Calendar events | 1 hour (3600s) |
| Research insights | 1 hour (3600s) |
| Briefings | No cache (always fresh) |
| Moments | No cache (always fresh) |

### Notion Data Layer

6 databases: Trends, Tensions, Evidence Log, Calendar, Briefing Archive, Cultural Moments.

All queries go through `lib/notion.ts` using direct REST API calls with pagination (100 items per page, loops until `has_more=false`).

---

# Notion Database Schema

## Trends DB
| Property | Type | Notes |
|----------|------|-------|
| Name | Title | Trend name |
| Type | Select | Macro Trend, Micro Trend, Signal, Event, Predicted |
| Status | Select | Exploding, Rising, Peaked, Stable, Emerging |
| CPS | Number | 0-100 Cultural Potency Score |
| Momentum | Select | Direction indicator |
| Pinned | Checkbox | Manual pin for priority |
| Summary | Rich Text | Claude-generated summary |
| Forecast | Rich Text | Claude-generated forecast |
| First Detected | Date | When trend first appeared |
| Last Updated | Date | Most recent signal touch |
| Linked Tensions | Relation → Tensions | Which tensions this trend intersects |
| CPS Sparkline | Rich Text | Comma-separated 14-day CPS history |
| Evidence Count | Number | Total linked evidence items |
| Platform Count | Number | Distinct platforms with evidence |

## Tensions DB
| Property | Type | Notes |
|----------|------|-------|
| Name | Title | "X vs. Y" format preferred |
| Weight | Number | 1-10 severity scale |
| Status | Select | Active, Dormant |
| Description | Rich Text | 2-3 sentence explanation |
| Linked Trends | Relation → Trends | Bidirectional |

## Evidence Log DB
| Property | Type | Notes |
|----------|------|-------|
| Title | Title | Source-prefixed headline |
| URL | URL | Canonical link |
| Platform | Select | Reddit, RSS, Wikipedia, Google Trends, News, Social, YouTube, Research |
| Date Captured | Date | When collected |
| Summary | Rich Text | One-line summary |
| Sentiment | Select | Positive, Negative, Neutral, Mixed |
| Linked Trends | Relation → Trends | Which trends this evidence supports |

## Calendar DB
| Property | Type | Notes |
|----------|------|-------|
| Event Name | Title | Event name |
| Date | Date | Event date |
| Type | Select | Known Event |
| Category | Multi-select | Politics, Entertainment, Sports, Tech, Business, Culture, Holiday, Music, Film, Fashion, Gaming, etc. |
| Cultural Potency Score | Number | 20-80 estimated potency |
| Notes | Rich Text | Context |

## Briefing Archive DB
| Property | Type | Notes |
|----------|------|-------|
| Date | Title | YYYY-MM-DD |
| Briefing Content | Rich Text | Full markdown briefing (chunked at 1900 bytes) |
| Flashpoint Count | Number | Count of bold trend names in flashpoints section |
| Key Highlights | Rich Text | Top 4 flashpoint trends, " · "-separated |

## Cultural Moments DB
| Property | Type | Notes |
|----------|------|-------|
| Name | Title | 5-10 word evocative title |
| Narrative | Rich Text | 2-3 sentence description |
| Type | Select | Catalyst, Collision, Pressure, Pattern, Void |
| Horizon | Select | This Week, 2-4 Weeks, 1-3 Months |
| Status | Select | Predicted, Forming, Happening, Passed, Missed |
| Confidence | Number | 0-100 |
| Magnitude | Number | 0-100 |
| Watch For | Rich Text | 3-5 semicolon-separated indicators |
| Reasoning | Rich Text | Chain of logic |
| Predicted Window Start | Date | |
| Predicted Window End | Date | |
| Created Date | Date | |
| Last Updated | Date | |
| Linked Trends | Relation → Trends | Supporting trends |
| Linked Tensions | Relation → Tensions | Driving tensions |
| Linked Events | Relation → Calendar | Catalyst events |
| Outcome Notes | Rich Text | Post-resolution analysis |

---

# Environment Variables

```
# Anthropic
ANTHROPIC_API_KEY=

# Notion
NOTION_API_KEY=
NOTION_TRENDS_DB=
NOTION_TENSIONS_DB=
NOTION_EVIDENCE_DB=
NOTION_CALENDAR_DB=
NOTION_BRIEFING_DB=
NOTION_MOMENTS_DB=

# Reddit (optional — falls back to public JSON)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=

# YouTube
YOUTUBE_API_KEY=

# Dashboard (dashboard/.env.local)
NOTION_API_KEY=
NOTION_TRENDS_DB=
NOTION_TENSIONS_DB=
NOTION_EVIDENCE_DB=
NOTION_CALENDAR_DB=
NOTION_BRIEFING_DB=
NOTION_MOMENTS_DB=
YOUTUBE_API_KEY=
```

---

# File Structure

```
forecaster/
├── scripts/
│   ├── run_pipeline.py              # Orchestrator — runs all stages
│   ├── collectors/
│   │   ├── reddit_collector.py      # 43 subreddits
│   │   ├── rss_collector.py         # 45 RSS feeds
│   │   ├── wikipedia_trending.py    # Wikimedia pageviews API
│   │   ├── google_trends.py         # pytrends (US trending + rising queries)
│   │   ├── hn_collector.py          # Algolia HN API
│   │   ├── bluesky_collector.py     # AT Protocol public API
│   │   ├── youtube_collector.py     # YouTube Data API v3
│   │   └── calendar_collector.py    # RSS → Claude → Calendar DB
│   ├── processors/
│   │   ├── signal_processor.py      # CPS scoring, trend creation, collisions
│   │   ├── signal_writer.py         # Collector orchestrator → Evidence DB
│   │   ├── tension_evaluator.py     # Weekly tension re-evaluation
│   │   ├── moment_forecaster.py     # Cultural moment predictions
│   │   └── briefing_generator.py    # Daily synthesis briefing
│   └── setup/
│       ├── create_moments_db.py     # Notion DB creation
│       └── link_trends_to_tensions.py
├── data/
│   ├── collisions.json              # Active collision pairs
│   ├── signal_velocity.json         # 14-day rolling velocity per trend
│   └── tension_eval_state.json      # Last evaluation timestamp
├── dashboard/
│   ├── app/
│   │   ├── layout.tsx               # App shell (sidebar + main)
│   │   ├── globals.css              # Theme variables, sidebar, grid, utilities
│   │   ├── page.tsx                 # Home dashboard (5-column grid)
│   │   ├── briefings/page.tsx       # Briefing archive
│   │   ├── forecast/page.tsx        # Moment predictions grid
│   │   ├── tensions/
│   │   │   ├── page.tsx             # Tensions listing (grouped by severity)
│   │   │   └── [id]/page.tsx        # Tension detail
│   │   ├── trends/
│   │   │   ├── page.tsx             # Trends catalog (filterable)
│   │   │   └── [id]/page.tsx        # Trend detail
│   │   ├── research/page.tsx        # Research insights grid
│   │   ├── calendar/page.tsx        # Calendar with filters
│   │   └── moments/
│   │       ├── [id]/page.tsx        # Moment detail
│   │       └── methodology/page.tsx # How we predict (explainer)
│   ├── components/
│   │   ├── Sidebar.tsx              # Navigation sidebar
│   │   ├── TensionCard.tsx          # "X vs. Y" visual tension card
│   │   ├── TensionBadge.tsx         # Compact tension badge
│   │   ├── TrendCard.tsx            # Trend display card
│   │   ├── MomentsWidget.tsx        # Moments list (compact + full)
│   │   ├── BriefingViewer.tsx       # Interactive briefing renderer
│   │   ├── CpsBar.tsx              # CPS progress bar
│   │   ├── SparkLine.tsx           # Inline sparkline chart
│   │   ├── CulturalTicker.tsx      # Bottom ticker strip
│   │   ├── ThemeProvider.tsx       # Dark/light mode
│   │   └── Chatbot.tsx            # Chat interface
│   └── lib/
│       └── notion.ts               # Notion API queries + types
├── .env                            # Pipeline environment variables
├── sources.md                      # Source manifest (reference)
├── SYSTEM.md                       # This document
└── memory/
    ├── MEMORY.md                   # Project memory for AI agents
    ├── architecture.md             # Architecture details
    └── moments-architecture.md     # Moments system design
```

---

# Operational Notes

- **Sync from dashboard.** Hit the Sync button in the sidebar to collect signals, process them, and update moment predictions. Works when running the Next.js dev server locally. See **Sync & Scheduling** for full details.
- **Briefing is separate.** Hit "Generate Briefing" once per day when you're ready to read it. Uses opus (most expensive model) so it's intentionally decoupled from sync.
- **Tensions are weekly.** Auto-checked on each pipeline run — if ≥7 days since last evaluation, tensions run automatically. No manual action needed. Force with `--tensions --force` if you want it sooner.
- **Deploy is manual.** Run `vercel --prod` from the `dashboard/` directory. No git remote configured.
- **Typical sync:** Collects ~285-425 signals, processes through Claude, updates trends/moments. Takes 5-10 minutes. Costs ~$1-3 in API tokens per sync.
- **Cost drivers:** Signal processing dominates (batches of 10 signals = 1 Claude call each). Moment forecasting adds 1 call. Briefing adds 1-2 opus calls. At 1-2 syncs/day + 1 briefing, expect ~$2-5/day.
- **Rate limits:** Built-in sleep intervals in all collectors (0.5s-2s) and processors (2s between batches). YouTube has a 10,000 unit/day quota.
- **Dashboard revalidation:** Pages revalidate every 300 seconds (5 min) by default. Briefings and moments use no-store for real-time freshness. After a sync completes, pages reflect new data on next navigation.
- **Cron (optional):** For automated daily runs: `0 7 * * * cd /path/to/forecaster && python3 scripts/run_pipeline.py` runs the full pipeline (including briefing and tension check) at 7am daily.
