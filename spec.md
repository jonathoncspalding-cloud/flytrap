# Cultural Forecaster — Product Specification Document
### A LeBrain James Module
**Version:** 2.0 — Post-Build / Live System
**Author:** Jonathon (Creative Director, Cornett) + Claude
**Original Spec Date:** February 24, 2026
**Last Updated:** February 25, 2026
**Status:** ✅ Phases 1–4 Complete. System live and running.

---

## 1. Executive Summary

The Cultural Forecaster is a trend monitoring, analysis, and prediction tool designed for a creative director working in advertising. It is a module within the LeBrain James personal knowledge management ecosystem.

**The core problem it solves:** Advertising agencies that can predict cultural moments — days, weeks, or months before they peak — can activate campaigns that ride those moments instead of reacting to them. The canonical example: Mischief anticipated the Jeff Bezos wedding as a cultural flashpoint (wealth spectacle + cost-of-living rage + celebrity gossip) and had time to execute an earned media stunt for JCPenney. This tool exists to systematically enable that kind of foresight.

**What makes it different from existing tools:**
- Enterprise cultural intelligence platforms (WGSN, Nichefire) do pieces of this but cost $10K+/year and are built for CPG product teams, not creative directors
- Mid-tier trend tools (Exploding Topics, Glimpse) track search volume trends but lack narrative/cultural intelligence
- Social listening tools (Brandwatch, Meltwater) monitor brand mentions but don't forecast cultural moments
- No existing tool combines trend tracking + cultural tension mapping + event forecasting + creative opportunity generation at an individual practitioner's budget

**The tool's unique value:** It connects the *why* behind cultural movements (underlying societal tensions) to the *what* (specific events and moments) to generate the *so what* (actionable creative opportunities for specific clients).

---

## 2. User Profile

**Primary user:** Jonathon — Creative Director at Cornett advertising agency
**Clients:** A&W, VLEX, Four Roses, LegoLand, Cup Noodles, Busch Light, Natural Light
**Usage pattern:** Daily check-in (dashboard review), with deeper dives 2-3x per week
**Secondary audience:** Jonathon's creative and strategy teams at Cornett (via shared briefs and reports)
**Future audience:** Substack subscribers (long-term; not in MVP scope)

---

## 3. Trend Taxonomy

All tracked items in the system are classified into one of five types:

| Type | Description | Lifecycle | Examples |
|------|-------------|-----------|----------|
| **Macro Trend** | Deep, slow-moving societal shifts. These are the "tectonic plates" of culture. | Years to decades | Cost of living crisis, enshittification, loneliness epidemic, decline of trust in institutions |
| **Micro Trend** | Faster-moving, more specific cultural behaviors and aesthetics. Often expressions of macro trends. | Weeks to months | Brat summer, demure, underconsumption core, rat girl summer |
| **Emerging Signal** | Earliest-stage chatter that *might* become a micro trend. High noise, high potential value. | Days to weeks | A meme format gaining traction, a niche subreddit blowing up, a TikTok sound going viral |
| **Scheduled Event** | Known calendar items with cultural potential. Fixed dates. | Single occurrence or recurring | Super Bowl, elections, award shows, movie premieres, album drops, product launches |
| **Predicted Moment** | Events not on any public calendar but forming based on converging signals. The "Bezos wedding" category. | Variable — flagged when confidence threshold is met | Celebrity events, corporate moves, political flashpoints, cultural collisions |

**Relationships:** Micro trends often nest inside macro trends. Emerging signals may graduate to micro trends. Scheduled events may catalyze predicted moments. The system must support these relationships.

---

## 4. Cultural Tensions Framework

### 4.1 Concept

Cultural tensions are the underlying societal conflicts that give cultural moments their charge. A trend or event becomes culturally potent when it sits at the intersection of one or more active tensions.

**Example:** The Bezos wedding was potent because it intersected:
- Wealth inequality vs. conspicuous consumption
- Corporate enshittification / Amazon's reputation
- Celebrity culture vs. populist resentment
- Cost of living crisis

### 4.2 Starter Tensions List

The system launches with a curated set of active cultural tensions. This list is living — Claude helps generate and update it, but the user can manually boost, demote, add, or remove tensions.

Initial tensions (to be expanded):
- Wealth inequality vs. conspicuous consumption
- AI replacing jobs vs. AI as creative empowerment
- Authenticity vs. performance (social media culture)
- Corporate enshittification vs. "made by humans" / indie movement
- Cost of living crisis vs. "treat yourself" / little luxuries
- Trust in institutions declining (government, media, corporations)
- Loneliness epidemic vs. hyper-connectivity
- Climate anxiety vs. consumption culture
- Privacy erosion vs. convenience
- Political polarization and culture war fatigue
- Health/wellness industrial complex vs. anti-wellness backlash
- Creator economy promise vs. creator burnout reality
- Nostalgia as comfort vs. nostalgia as avoidance
- Remote work freedom vs. return-to-office mandates

### 4.3 Cultural Potency Score

When a new signal, event, or trend enters the system, it is evaluated against the active tensions list. Each tension it intersects adds to its **Cultural Potency Score (CPS)**. The score is further modified by:
- **Tension weight** — user can manually boost/demote individual tensions (e.g., "wealth inequality is especially hot right now")
- **Signal velocity** — how fast conversation is accelerating
- **Multi-platform presence** — appearing across Reddit, TikTok, news, AND Twitter scores higher than a single platform
- **Scheduled event proximity** — a converging tension near a known event date increases potency

The CPS is displayed as a simple numerical score (1-100) with a qualitative label:
- 80-100: 🔴 **Cultural Flashpoint** — high likelihood of becoming a major moment
- 60-79: 🟠 **Rising Heat** — building momentum, worth close monitoring
- 40-59: 🟡 **Simmer** — notable but not yet urgent
- 20-39: 🔵 **Low Burn** — early stage, worth tracking
- 0-19: ⚪ **Background Noise** — logged but not prioritized

---

## 5. Dashboard Architecture

The dashboard is the primary interface. It follows a **pyramid structure** with three tiers of information density.

### 5.1 Tier 1 — The Radar (Top of Dashboard)

**Purpose:** What demands attention right now. Scan in 30 seconds.

**Contents:**
- **Forecast Spotlight** — The 3-5 highest-CPS predicted moments and trends, displayed prominently with projected timelines (3/6/12 month outlook)
- **Spiking Now** — Real-time feed of trends and signals experiencing sudden acceleration. Functions like Twitter's trending page but filtered through cultural intelligence. Includes:
  - Trends that are newly exploding
  - Pinned trends that have had significant momentum changes
  - Emerging signals that just crossed a threshold
- **Pinned Trend Alerts** — Updates on any user-pinned trends that have materially changed since last check (new evidence, momentum shift, status change)

**Display format:** Card-based layout. Each card shows: trend name, type badge, CPS score, brief AI-generated summary (1-2 sentences), and a sparkline showing recent trajectory.

### 5.2 Tier 2 — The Analysis Layer (Scrollable / Expandable)

**Purpose:** The user's workspace for doing their own forecasting. "Maybe I can see something the AI can't."

**Contents:**
- **Cultural Tension Overlay** — Visual representation of currently active tensions, weighted by the user's manual boosts. Shows which tensions are most active and which trends cluster around them.
- **Trend Lines with Status Badges** — Each tracked trend displayed with its historical line graph and status badge (Exploding / Rising / Peaked / Stable / Emerging).
- **Momentum Scores** — Velocity metric for each tracked trend. Not just "how big" but "how fast is it accelerating."
- **Meta Trend / Cluster Map** — Visual showing how micro trends connect to macro trends. Helps the user see patterns the AI might miss.

**Display format:** Scrollable grid/list view with expandable cards. Filterable by trend type, tension, status, and CPS range.

### 5.3 Tier 3 — The Evidence Layer (Drill-Down)

**Purpose:** When the user clicks into a specific trend, this is the supporting detail.

**Contents:**
- **Timeline of Evidence** — Chronological list of all articles, posts, data points, and manually added items linked to this trend. Each item timestamped and source-attributed.
- **Channel Heatmap** — Where this trend is currently active: TikTok, Reddit, Twitter/X, Instagram, YouTube, news outlets, blogs, forums. Indicates which platforms are leading vs. lagging.
- **Related Trends** — Other trends in the system that share tensions or signals with this one.
- **AI Analysis** — Claude-generated narrative explaining the cultural forces behind this trend, why it matters, and where it might go.
- **Opportunity Starters** (secondary feature) — AI-generated thought starters connecting this trend to the user's specific clients.

---

## 6. Cultural Calendar / Timeline

### 6.1 Structure

A 12-month rolling timeline (not a traditional calendar grid) that is updated daily. Two layers of events coexist:

**Layer 1: Known Events** — Auto-populated from public sources
- National and cultural holidays
- Election dates and political milestones
- Movie premieres, album drops, TV season launches
- Award shows (Oscars, Grammys, Emmys, etc.)
- Major sporting events (Super Bowl, World Series, NBA Finals, etc.)
- Earnings calls and product launches from major companies
- Seasonal cultural moments (back to school, summer kickoff, etc.)

**Layer 2: Predicted / Emerging Moments** — AI-flagged
- Events surfaced when multiple signals converge around a future date
- Situations where chatter velocity around a known person/event crosses a threshold
- Moments where a cultural tension is reaching a tipping point and a scheduled event could catalyze it

### 6.2 Visualization

The timeline uses a **weighted visual system** where events that are generating more cultural conversation are represented with greater visual prominence (e.g., longer bars, larger nodes, brighter colors). This creates an at-a-glance sense of which upcoming moments carry the most cultural weight.

Events are color-coded by type (known vs. predicted) and tagged with their CPS score. Users can filter by tension, trend type, or client relevance.

### 6.3 Update Cadence

- Known events: Populated on setup, refreshed weekly for new announcements
- Predicted moments: Evaluated daily during the scheduled briefing generation
- CPS scores on calendar events: Recalculated daily based on fresh signal data

---

## 7. Daily/Weekly Cultural Briefing

### 7.1 Generation

A scheduled job runs daily (configurable time, default: 7:00 AM ET) that:
1. Collects all new signals from data sources since last run
2. Evaluates new signals against the cultural tensions framework
3. Checks for momentum changes on all pinned trends
4. Scans the cultural calendar for upcoming events within the next 30 days
5. Synthesizes everything into a structured briefing via Claude API call

An on-demand "refresh" function is also available from the web dashboard.

### 7.2 Briefing Format

The briefing is structured as follows:

```
## [DATE] Cultural Briefing

### 🔴 Flashpoints (CPS 80+)
[Highest-priority items with brief analysis]

### 📈 Momentum Shifts
[Pinned trends that moved significantly — up or down]

### 🗓️ Upcoming on the Calendar (Next 14 Days)
[Events with cultural potential, sorted by CPS]

### 🌊 New Signals Detected
[Fresh emerging signals worth watching]

### 💡 Opportunity Starters (Optional Section)
[Quick one-line briefs connecting top trends to specific clients]
Example: "Bezos wedding this weekend — wealth spectacle meets cost-of-living rage. Busch Light opp: working class counter-programming."
```

### 7.3 Delivery

- **Primary:** Auto-generated as a Notion page in the Cultural Forecaster workspace
- **Secondary:** Surfaced in the web dashboard with a "latest briefing" section
- **Future:** Email digest option (not in MVP)

---

## 8. Data Sources (MVP — Free / Very Cheap Tier)

### 8.1 Automated Sources

| Source | What It Provides | Cost | Update Frequency |
|--------|-----------------|------|-----------------|
| Google Trends (via pytrends or similar) | Search volume trends, related queries, rising topics | Free | Daily |
| Reddit API | Subreddit trending posts, comment velocity, emerging topics | Free (moderate use) | Every 6 hours |
| RSS feeds (curated list) | News articles from culture, politics, entertainment, tech sources | Free | Hourly |
| Wikipedia trending articles | Topics getting unusual attention | Free | Daily |
| Google News (via RSS or scraping) | Breaking news and cultural stories | Free | Hourly |
| TikTok Creative Center | Trending hashtags, sounds, creators | Free (limited) | Daily |

### 8.2 Manual Input Sources

| Source | Method | Integration |
|--------|--------|-------------|
| LeBrain Chrome Extension | User clips an article/URL and tags it to a trend | ✅ Built — "Assign to Trend" dropdown added to extension |
| iOS Shortcut | Quick-capture from mobile with trend tagging | ✅ Guide written — see scripts/IOS_SHORTCUT.md |
| Notion manual entry | User creates a new entry directly in the Evidence Log database | Native Notion |

### 8.3 Future Data Sources (Post-MVP)

- Exploding Topics API ($39/mo) — pre-processed trend data with momentum scoring
- Agency social listening tools (Brandwatch, Sprinklr, etc.) — if accessible
- Twitter/X API — if cost-effective access becomes available
- Bluesky firehose — emerging alternative social data

### 8.4 The LLM Layer

Claude API calls serve as the analytical brain:
- **Daily synthesis** — processes all collected signals and generates the briefing
- **Trend evaluation** — scores new signals against the tension framework
- **Forecast generation** — projects trend trajectories based on historical patterns and cultural context
- **Opportunity generation** — connects trends to specific client briefs

**Estimated API cost:** $5-15/month at MVP scale (10-25 tracked trends, daily briefings, moderate evidence volume). Uses Claude Sonnet for routine analysis, Claude Sonnet 4.5 fallback for briefings when Opus is overloaded.

---

## 9. Notion Architecture

### 9.1 Databases

**Trends Database**
- Name (title)
- Type (select: Macro Trend / Micro Trend / Emerging Signal / Scheduled Event / Predicted Moment)
- Status (select: Exploding / Rising / Peaked / Stable / Emerging / Archived)
- Cultural Potency Score (number, 0-100)
- Momentum Score (number — velocity of change)
- Pinned (checkbox — user's actively tracked trends)
- Summary (rich text — AI-generated or manually written)
- Linked Tensions (relation → Cultural Tensions DB)
- Linked Evidence (relation → Evidence Log DB)
- Linked Clients (relation → existing LeBrain client/project databases)
- First Detected (date)
- Last Updated (date)
- Forecast (rich text — AI-generated projection)

**Cultural Tensions Database**
- Name (title) — e.g., "Wealth inequality vs. conspicuous consumption"
- Weight (number, 1-10) — user-adjustable priority/boost
- Status (select: Active / Dormant / Rising / New)
- Description (rich text)
- Linked Trends (relation → Trends DB)
- Last Evaluated (date)

**Cultural Calendar Database**
- Event Name (title)
- Date (date)
- Type (select: Known Event / Predicted Moment)
- Category (multi-select: Politics / Entertainment / Sports / Tech / Business / Culture / Holiday)
- Cultural Potency Score (number)
- Linked Trends (relation → Trends DB)
- Linked Tensions (relation → Cultural Tensions DB)
- Notes (rich text)

**Evidence Log Database**
- Title (title)
- Source URL (URL)
- Source Platform (select: Reddit / TikTok / Twitter/X / News / Blog / Google Trends / Wikipedia / Manual / Other)
- Date Captured (date)
- Linked Trends (relation → Trends DB)
- Summary (rich text — AI-generated or manually written)
- Sentiment (select: Positive / Negative / Neutral / Mixed)
- Raw Content (rich text — excerpt or description)

**Briefing Archive Database**
- Date (title/date)
- Briefing Content (rich text)
- Flashpoint Count (number)
- Key Highlights (rich text — top 3 items for quick scanning)

### 9.2 Connections to Existing LeBrain Databases

- Trends DB → LeBrain main database (via relation) for cross-referencing saved knowledge
- Trends DB → Project/Client folders (via relation) for client-specific filtering
- Evidence Log → LeBrain main database (items captured via extension can live in both)

### 9.3 Dashboard Page

A Notion page that serves as the "homepage" using embedded database views:

- **Section 1 (Tier 1):** Filtered view of Trends DB showing only items with CPS ≥ 60 OR Pinned = true with recent changes, sorted by CPS descending. Gallery or board view.
- **Section 2 (Tier 2):** Full Trends DB in table view, filterable by type/status/tension. Cultural Tensions DB embedded as a side panel or linked view.
- **Section 3:** Cultural Calendar DB in timeline view, filtered to next 90 days.
- **Section 4:** Latest briefing from Briefing Archive, embedded.

**Note:** Notion's native visualization is limited. For the full dashboard experience described in Section 5 (sparklines, cluster maps, heatmaps), a lightweight custom web interface will be needed. The Notion architecture serves as the data backbone and a functional-but-basic interface. The web dashboard is a presentation layer that reads from the same data.

---

## 10. Web Dashboard (Lightweight Interface)

### 10.1 Purpose

A simple web application that provides the richer visualization layer that Notion can't deliver natively. This is NOT a replacement for Notion — it reads from the Notion databases and presents the data in a more visual, interactive format.

### 10.2 Tech Stack (Built)

- **Frontend:** Next.js 16 (App Router, TypeScript)
- **Data layer:** Notion API via raw REST fetch (bypassed @notionhq/client — see DECISIONS.md)
- **Styling:** Tailwind CSS
- **Markdown rendering:** react-markdown v9 (ESM, wrapped in "use client" component)
- **Hosting:** Runs locally; deployable to Vercel (free tier)

### 10.3 Pages (All Built)

1. **`/`** — Dashboard Home: top flashpoints, all trends sorted by CPS, status badges
2. **`/trends/[id]`** — Trend Detail: evidence timeline, AI summary, linked tensions
3. **`/briefings`** — Latest and archived briefings, rendered markdown
4. **`/api/trends`** — JSON endpoint: returns active trends (used by Chrome Extension)
5. **`/api/capture`** — POST endpoint: writes evidence to Notion (used by Extension + iOS Shortcut)

---

## 11. Automation & Data Pipeline

### 11.1 Scheduled Jobs

| Job | Frequency | What It Does |
|-----|-----------|-------------|
| Signal Collection | Every 6 hours | Pulls new data from Reddit + RSS feeds, writes raw signals to Evidence Log |
| Signal Processing | Daily (after collection) | Claude API call to evaluate new signals: classify, score against tensions, link to existing trends, flag new potential trends |
| Briefing Generation | Daily (7:00 AM ET) | Claude API call to synthesize all data into the daily briefing. Writes to Briefing Archive |
| Calendar Update | Weekly | Refreshes known events from public calendar sources |
| Trend Decay Check | Weekly | Reviews all tracked trends for staleness |

### 11.2 Infrastructure

- **Scheduler:** Manual for now; cron job setup instructions in README
- **Data collection scripts:** Python, in `/scripts/collectors/`
- **Processing scripts:** Python, in `/scripts/processors/`
- **Notion API:** Raw REST calls using `requests` (Python) and `fetch` (TypeScript)
- **Claude API:** `anthropic` Python SDK with retry logic

### 11.3 Manual Input Workflow

**Via LeBrain Chrome Extension:**
1. User clicks extension on any webpage
2. "Assign to Forecaster Trend" dropdown appears — populated live from `/api/trends`
3. Select a trend (optional) and save as normal
4. Extension POSTs to `/api/capture` → written to Evidence Log with trend relation

**Via iOS Shortcut:**
1. Share any URL to the shortcut
2. Shortcut fetches current trends from `/api/trends`, presents a pick list
3. Writes to Evidence Log via `/api/capture`
4. Full build guide: `scripts/IOS_SHORTCUT.md`

**Via Notion Direct Entry:**
1. Open Evidence Log database, add a row manually

---

## 12. Forecasting Engine

### 12.1 Approach

The forecasting engine uses four complementary methods, all orchestrated through Claude API calls:

**1. Pattern Matching**
Claude is provided with historical examples of cultural moments and the signal patterns that preceded them. When evaluating current data, it looks for similar convergences.

**2. Velocity Tracking**
Automated tracking of the *rate of change* in conversation volume for each trend. Stored as Momentum Score.

**3. Tension Mapping**
CPS formula:
```
CPS = Σ(tension_weight × intersection_strength) × velocity_multiplier × platform_diversity_multiplier
```

**4. LLM-Powered Synthesis**
Daily briefing prompt sends all trends, tensions, calendar events, and recent evidence to Claude for holistic synthesis and opportunity generation.

### 12.2 Forecast Output

For each predicted moment or high-CPS trend:
- **What:** Description of the predicted moment
- **When:** Estimated timeframe
- **Why it matters:** Which tensions it intersects
- **Confidence level:** High / Medium / Low
- **Watch signals:** What to monitor that would confirm or disconfirm

---

## 13. MVP Scope & Build Phases

### Phase 1: Foundation ✅ Complete
- [x] Set up Notion databases (all 5 databases with proper relations)
- [x] Create data collection scripts (Reddit API, RSS feeds, Google Trends)
- [x] Set up Notion API integration for reading/writing
- [x] Create initial Cultural Tensions list in the database (14 tensions)
- [x] Populate Cultural Calendar with known events for the next 12 months
- [x] Test manual input flow via Notion direct entry

### Phase 2: Intelligence Layer ✅ Complete
- [x] Build Claude API integration for signal processing
- [x] Implement CPS scoring logic (tension × velocity × platform diversity)
- [x] Build daily briefing generation pipeline
- [x] Set up pipeline runner (`scripts/run_pipeline.py`)
- [x] Create briefing template and test generation quality
- [x] Tune Claude prompts for tension mapping and forecasting

### Phase 3: Dashboard & Interface ✅ Complete
- [x] Build lightweight web dashboard (Next.js)
- [x] Implement Tier 1 (Radar) view with CPS-sorted cards
- [x] Implement Tier 2 (Analysis) view with filterable trend list
- [x] Implement Trend Detail pages with evidence
- [x] Connect web dashboard to Notion API for live data
- [x] Briefings page with full markdown rendering

### Phase 4: Input Integration ✅ Complete
- [x] Add "Assign to Trend" dropdown to LeBrain Chrome Extension
- [x] Built `/api/trends` and `/api/capture` API routes as secure intermediary
- [x] Rewrote extension popup.html, popup.js, background.js (v7)
- [x] iOS Shortcut step-by-step guide written
- [x] End-to-end test: capture → evidence log → processing cycle → updated scores ✅

### Phase 5: Refinement (Active)
- [ ] Set up cron job for fully automated daily pipeline
- [ ] Deploy dashboard to Vercel (access from anywhere, not just local)
- [ ] Tune forecasting prompts based on real-world accuracy
- [ ] Add CPS score history / trend velocity charts
- [ ] Add tensions map visualization
- [ ] Client-specific filtering in dashboard
- [ ] Alert system: notify when trend crosses CPS threshold
- [ ] Opportunity Brief generator (full brief, not just one-liner)
- [ ] Email or Slack digest of daily briefing
- [ ] Evaluate paid data sources (Exploding Topics, etc.)

---

## 14. Build Log — What Actually Happened

### Timeline
The entire MVP was built in **2-3 Claude Code sessions** over 2 days — vs. the 4-5 weeks estimated for human development pace.

### Current System State (as of Feb 25, 2026)
- **90 trends** tracked in Notion (75 seeded + 15 newly created from first live processing run)
- **50 high-CPS signals** identified from first batch
- **158 signals** processed in first live run
- **1 briefing** generated and live in dashboard
- **Pipeline** running end-to-end manually; cron automation pending

### Top Flashpoints Identified (First Live Run)
| Trend | CPS |
|-------|-----|
| Broadcast Truth Suppression | 89 |
| Military AI Coercion | 86 |
| Financial Expertise Automation | 81 |
| AI Infrastructure Externalities | 79 |
| Premium Category Collapse | 77 |
| Ideological Safety Infrastructure | 76 |
| Ambient Resignation Culture | 72 |
| Accusation Reversal Content | 72 |

### Key Technical Pivots
1. **Bypassed @notionhq/client** — Notion's official JS library doesn't fully support v3 API. Switched to raw `fetch()` REST calls throughout the dashboard.
2. **Date-only Notion filters** — Notion rejects datetime strings in date filters. All pipeline date queries use `date.today().isoformat()`.
3. **`load_dotenv(override=True)` required** — Shell environment variables were shadowing `.env` values. Added `override=True` throughout all Python scripts.
4. **Two-tier model strategy** — Claude Opus used for briefings; falls back to Sonnet 4.5 after 3 retries if Opus is overloaded (529 errors). Sonnet used for all signal processing.
5. **Notion 2000-byte rich_text limit** — Briefing content exceeds the per-block limit. Fixed with byte-aware chunking (1900 bytes/block, UTF-8 aware to handle emoji).
6. **Next.js fetch cache** — Stale cached responses were showing empty briefings even after generation. Fixed with `cache: 'no-store'` on the briefings query.
7. **react-markdown ESM** — react-markdown v9 is ESM-only; can't import in Next.js server components directly. Wrapped in a `"use client"` component.
8. **Extension → Forecaster → Notion** — Rather than giving the extension direct Notion access (would expose the key), built `/api/trends` and `/api/capture` as a secure intermediary on the dashboard server.

### Roadblocks
- **Anthropic API billing split**: Claude.ai subscription (used by Claude Code) and direct API credits (used by Python scripts) are separate billing pools. The forecaster's original API key had zero direct API credits, causing 400 errors on signal processing. Resolved by adding credits to the API account.

---

## 15. Estimated Costs (Monthly — Actuals)

| Item | Estimated | Actual |
|------|-----------|--------|
| Claude API (signal processing + briefings) | $5-15 | ~$1-3/month at current volume |
| VPS for scheduled jobs | $4-6 | $0 (running locally via cron for now) |
| Web hosting | $0 | $0 (local; Vercel deploy pending) |
| Notion | $0 | $0 (existing subscription) |
| Data sources | $0 | $0 |
| **Total** | **$9-21/month** | **~$1-3/month** |

> Note: The two Anthropic billing pools (Claude.ai subscription vs. direct API credits) are separate. Claude Code sessions bill against your Claude.ai subscription; the forecaster's Python pipeline bills against direct API credits. Both are needed.

---

## 16. Key Prompts (Reference)

### Signal Processing Prompt
```
You are a cultural intelligence analyst. You have received the following new signals
from the past 24 hours:

[INSERT RAW SIGNALS]

And here are the currently active cultural tensions, with their user-assigned weights:

[INSERT TENSIONS LIST WITH WEIGHTS]

For each signal:
1. Classify it: Macro Trend / Micro Trend / Emerging Signal / Scheduled Event / Predicted Moment
2. Determine which existing tracked trends it relates to (if any): [INSERT CURRENT TRENDS LIST]
3. If it doesn't relate to an existing trend, recommend whether it should start a new one
4. Score its Cultural Potency (0-100) based on which tensions it intersects, its velocity,
   and its multi-platform presence
5. Write a 1-2 sentence summary

Respond in structured JSON format.
```

### Daily Briefing Prompt
```
You are a cultural strategist at a top advertising agency. Your job is to write a daily
cultural briefing for a Creative Director who needs to spot cultural moments before they
peak.

Here is today's data:

TRACKED TRENDS (with current scores and momentum):
[INSERT TRENDS DATA]

NEW SIGNALS FROM LAST 24 HOURS:
[INSERT PROCESSED SIGNALS]

CULTURAL TENSIONS (with weights):
[INSERT TENSIONS]

UPCOMING CALENDAR EVENTS (next 30 days):
[INSERT CALENDAR]

CLIENT LIST (for opportunity starters):
A&W, VLEX, Four Roses, LegoLand, Cup Noodles, Busch Light, Natural Light

Write the briefing in this format:
- 🔴 Flashpoints (CPS 80+): [highest priority items with brief analysis]
- 📈 Momentum Shifts: [pinned trends that moved significantly]
- 🗓️ Upcoming Calendar (Next 14 Days): [events with cultural potential]
- 🌊 New Signals: [fresh emerging signals worth watching]
- 💡 Opportunity Starters: [one-line briefs connecting top trends to specific clients]

Be concise, opinionated, and actionable. Think like someone who gets paid to see around
corners. Don't hedge — make calls.
```

---

## 17. Success Criteria

The tool is successful if, within 3 months of operation:

1. **It surfaces at least one cultural moment 2+ weeks before it peaks** that the user can act on
2. **The daily briefing is genuinely useful** — the user checks it most days and finds it informative
3. **The tension framework proves valuable** — trends scored high on CPS actually become culturally significant more often than those scored low
4. **It saves time** — the user spends less time manually scanning Twitter, Reddit, and news for cultural signals
5. **It generates at least one actionable client opportunity** that gets presented to a team

---

## 18. Daily Operation Guide

### Start the Dashboard
```bash
cd /Users/jonathon/Desktop/Projects/forecaster/dashboard
npm run dev
# Open http://localhost:3000
```

### Run the Pipeline (Manual)
```bash
cd /Users/jonathon/Desktop/Projects/forecaster
source venv/bin/activate

python3 scripts/run_pipeline.py          # Full pipeline (collect + process + brief)

# Or step by step:
python3 scripts/collectors/run_collectors.py     # Collect new signals
python3 scripts/processors/signal_processor.py   # Process + score signals
python3 scripts/processors/briefing_generator.py # Generate briefing
```

### Automate the Pipeline (Cron)
```bash
crontab -e
# Add this line to run daily at 7 AM:
0 7 * * * cd /Users/jonathon/Desktop/Projects/forecaster && source venv/bin/activate && python3 scripts/run_pipeline.py >> logs/pipeline.log 2>&1
```

### Capture via Chrome Extension
- Click LeBrain extension on any page
- Use the "Assign to Forecaster Trend" dropdown
- Save as normal — it feeds the Evidence Log automatically

### Capture via iOS Shortcut
- See `scripts/IOS_SHORTCUT.md` for setup guide (~10 min)
- Share any URL to the shortcut from Safari/any app

---

## 19. Open Questions / Future Decisions

1. **Cron automation** — Set up so pipeline runs without any manual step. GitHub Actions is a good free option.
2. **Vercel deployment** — Deploy the dashboard so it's accessible from phone/office/client meetings, not just localhost.
3. **Trend archiving policy** — When does a trend get archived? After 14 days of no new evidence? After CPS drops below 20? User-controlled?
4. **Tension weight tuning** — Currently done directly in Notion. A simple UI slider in the dashboard would be faster.
5. **Historical training data** — Seed the system with documented past cultural flashpoints (with their leading signals) to improve Claude's pattern recognition.
6. **Reddit OAuth** — Currently using public Reddit API (no auth). Adding OAuth would unlock higher rate limits and more data.

---

*Built by Claude Code in 2-3 sessions, February 2026. System is live and processing.*
