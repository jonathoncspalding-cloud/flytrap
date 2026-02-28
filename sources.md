# US‑First “World Pulse” Sources Stack (Starter Manifest)

This is a **plain‑text implementation brief** for building an hourly dashboard that mirrors what’s **breaking + rising + being talked about in the US**, with only **big global stories** breaking through.

It’s designed to support a **cultural moments predictor**: you’re not just tracking “what’s hot,” you’re building the inputs needed to **anticipate moments before they happen** (planned events + cultural tensions + attention dynamics).

---

## Goal

Create an hourly system that reflects:
- **Social trend seeds** (what’s popping right now)  
- **Breaking news** (what actually happened)  
- **Public conversation** (what people are debating / memeing)  
- **Curiosity/intent** (what people are trying to understand)  
- **Creator/video diffusion** (what’s spreading beyond TikTok)  
- **Futures / prediction markets** (a “schedule + stakes” signal to anticipate where attention will concentrate next)

**US-first by default.** Global items only appear if they pass the **Global Breakthrough Gate** below.

---

## Normalized item shape (minimum)

For all ingested items (RSS/API):
- `title`
- `url`
- `timestamp_utc`
- `source_id`
- `category` (A/B/C/D/E/F)
- `region` (US or GLOBAL)
- `raw_signals` (optional: upvotes, comments, volume, etc.)
- `entities` (optional: extracted people/orgs/places/keywords)

> Note: Social seed panels (Trends24, TikTok Creative Center) are **embed/link-out** and don’t need to be normalized unless you later choose to parse them.

---

## Topic Graph output (what the UI should show)

Cluster items into “topics/stories.” Each topic card should include:
- topic name
- 1‑line auto summary
- confidence score (0–100)
- best link (canonical) + 2–5 supporting links

You already have a **tensions engine**. These sources are meant to improve its inputs and coverage:
- make tensions detection more grounded (more sources, faster refresh)
- connect tensions to **upcoming attention anchors** (calendar-anchored moments)

---

# Sources Manifest (Starter) — US‑First (A–E + F)

## A) Social trend seeds (embed / link‑out only)

Purpose: show native-ish trend lists that refresh throughout the day. Use as **candidate trends** for validation and tension analysis (not as the only truth).

### A1) X Trends (US) — Trends24
- url: https://trends24.in/united-states/
- type: embed / html_page
- cadence: 15–30 min
- note: display as embedded panel or link; **avoid scraping**

### A2) TikTok Creative Center — Trend Discovery (US via UI selector)
Embed/link-out the pages below and set **Region = United States** in the UI:
- overview: https://ads.tiktok.com/business/creativecenter/inspiration/popular/pc/en
- hashtags: https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en
- songs: https://ads.tiktok.com/business/creativecenter/inspiration/popular/music/pc/en
- creators: https://ads.tiktok.com/business/creativecenter/inspiration/popular/creator/pc/en
- videos: https://ads.tiktok.com/business/creativecenter/inspiration/popular/tiktok-video/pc/en
- type: embed / html_page
- cadence: 30–60 min
- note: treat as seed panels, not machine-ingested

---

## B) Breaking news (RSS + optional clustering)

### B1) US National Fast RSS (poll 5–10 min)
Use as “headline firehose,” then cluster/dedupe:
- New York Times: http://feeds.nytimes.com/nyt/rss/HomePage
- NPR News: https://feeds.npr.org/1001/rss.xml
- PBS NewsHour: https://www.pbs.org/newshour/feeds/rss/headlines
- ABC News: https://abcnews.go.com/abcnews/topstories
- CBS News: https://www.cbsnews.com/latest/rss/main
- NBC News (Top): https://feeds.nbcnews.com/nbcnews/public/news
- CNN (Top): https://rss.cnn.com/rss/cnn_topstories.rss
- Axios: https://www.axios.com/feeds/feed.rss
- Reuters/AP: optional (availability varies)

### B2) US Business / Tech / Media RSS (poll ~10 min)
- CNBC Top News: https://www.cnbc.com/id/100003114/device/rss/rss.html
- MarketWatch Top Stories: https://feeds.marketwatch.com/marketwatch/topstories/
- The Verge: https://www.theverge.com/rss/index.xml
- TechCrunch: https://techcrunch.com/feed/
- Wired: https://www.wired.com/feed/rss
- Ars Technica: https://feeds.arstechnica.com/arstechnica/index
- Ad Age: https://adage.com/rss.xml
- Adweek: https://www.adweek.com/feed/

### B3) US Sports / Entertainment RSS (poll ~10–15 min)
- ESPN: https://www.espn.com/espn/rss/news
- Variety: https://variety.com/feed/
- Hollywood Reporter: https://www.hollywoodreporter.com/feed/
- Billboard: https://www.billboard.com/feed/
- TMZ: http://www.tmz.com/rss.xml

### B4) “Big global that breaks through” RSS (poll ~10–15 min, then gate)
These are global; only surface items that pass the **Global Breakthrough Gate**:
- BBC World: https://feeds.bbci.co.uk/news/world/rss.xml
- Guardian World: https://www.theguardian.com/world/rss

### B5) clustering layer (API) 
For MVP you can cluster using title similarity; later add a clustering API:
- GDELT 2.1 docs: https://blog.gdeltproject.org/gdelt-2-0-our-global-world-in-realtime/

---

## C) Public conversation (Reddit RSS + Hacker News)

### C1) Reddit RSS packs (poll 5–15 min)
Reddit RSS patterns:
- `https://www.reddit.com/r/{sub}/hot/.rss`
- `https://www.reddit.com/r/{sub}/new/.rss`
- `https://www.reddit.com/r/{sub}/rising/.rss` (may vary; drop if unsupported)

Start packs (US-weighted):
- r/news hot: https://www.reddit.com/r/news/hot/.rss
- r/politics hot: https://www.reddit.com/r/politics/hot/.rss
- r/worldnews hot (global; gate later): https://www.reddit.com/r/worldnews/hot/.rss
- r/technology hot: https://www.reddit.com/r/technology/hot/.rss
- r/entertainment hot: https://www.reddit.com/r/entertainment/hot/.rss
- r/popculturechat hot: https://www.reddit.com/r/popculturechat/hot/.rss
- r/nfl hot: https://www.reddit.com/r/nfl/hot/.rss
- r/nba hot: https://www.reddit.com/r/nba/hot/.rss
- r/cfb hot: https://www.reddit.com/r/cfb/hot/.rss
- r/OutOfTheLoop hot: https://www.reddit.com/r/OutOfTheLoop/hot/.rss

Optional broad pulse:
- r/all hot: https://www.reddit.com/r/all/hot/.rss

Keyword/search RSS (use sparingly; can be noisy):
- pattern: `https://www.reddit.com/search.rss?q={urlencoded_query}&sort=hot&t=day`
- example: https://www.reddit.com/search.rss?q=egg%20prices&sort=hot&t=day

Ranking for “Conversations” should emphasize:
- comment velocity (comments/hour)
- depth (reply chains)
- cross-posting across multiple subs
- recency decay (last 1–3 hours matter most)

### C2) Hacker News (API) (poll 10–15 min)
Use Algolia endpoints (simple):
- front page: https://hn.algolia.com/api/v1/search?tags=front_page
- new stories: https://hn.algolia.com/api/v1/search_by_date?tags=story
- high points (past day): https://hn.algolia.com/api/v1/search?tags=story&numericFilters=points%3E100

---

## D) Curiosity + intent (Wikipedia; Google Trends optional)

### D1) Wikipedia “Most Read” (daily + hourly check)
Wikimedia “Top” (daily, by project):
- `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/{YYYY}/{MM}/{DD}`

Use as daily baseline and detect surprise entrants.

### D2) Wikipedia pageview tracking for candidate entities (hourly)
For each candidate entity/topic (from A/B/C/E), fetch hourly pageviews:
- `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/{TITLE}/hourly/{START}/{END}`

Compute spike score vs trailing baseline (7-day hourly baseline preferred; 48h OK for MVP).

### D3) Google Trends (optional)
If official access later, add US trends feed. For MVP you can skip—Wikipedia + YouTube + news velocity covers a lot.

---

## E) Creator / video diffusion (YouTube US)

### E1) YouTube “Most Popular” (US) (poll 30–60 min)
YouTube Data API v3 endpoint (requires API key):
- `GET https://www.googleapis.com/youtube/v3/videos`
Params:
- `part=snippet,contentDetails,statistics`
- `chart=mostPopular`
- `regionCode=US`
- `maxResults=50`

Optional category segmentation:
- `videoCategoryId=10` (Music)
- `videoCategoryId=24` (Entertainment)
- `videoCategoryId=25` (News & Politics)

Extract entities/keywords from titles + channel names and feed into Topic Graph as “Video Heat.”

---

# F) Futures layer (prediction markets → calendar + early warning)

You already have a **calendar** and a **tensions identifier**. Prediction markets should **not** be a gate that filters trends out. Instead, use them to add two capabilities:

1) **Futures Calendar (Upcoming Attention Anchors)**  
   A rolling list of *date‑bounded, high‑stakes moments* likely to concentrate attention in the US (elections, Fed days, major verdicts, shutdown deadlines, awards, etc.).  
   **Goal:** make it easier to plan activations ahead of time by pairing:
   - planned/resolvable events (from markets)
   - tensions already detected in your system
   - social/news signals that show priming

2) **Volatility Radar (Something is brewing)**  
   A list of markets with the biggest probability/price moves in the last 1–6 hours.  
   **Goal:** act as an early warning sensor that triggers deeper pulls from your existing sources (news clusters, Reddit searches, YouTube, Wikipedia).

### F1) Prediction market sources (read-only)
Include 2–3 providers:
- Polymarket — docs: https://docs.polymarket.com/
- Kalshi market data — docs: https://docs.kalshi.com/getting_started/quick_start_market_data
- Manifold — docs: https://docs.manifold.markets/api

### F2) How to integrate into your existing calendar
Create calendar entries that are actionable (no jargon):
- **Title:** the market question in plain English
- **Date/Time:** the market’s resolution date (or best-guess resolution window)
- **Category:** politics / macro / legal / awards / other
- **Optional context:** current implied probability + recent change
- **Auto-linked monitor pack:** generated queries for your other sources (below)

### F3) Auto-generated “Monitor Pack” for each calendar anchor
When an anchor is added (or changes materially), generate a bundle your system can use:
- **Reddit keyword RSS searches** (2–6 queries)
- **News keyword filters** (terms/phrases for your RSS/clustering)
- **Wikipedia entity watchlist** (likely page titles)
- **YouTube keyword queries** (title keywords/channels if relevant)

This strengthens your tension engine by attaching tensions to upcoming moments and ensuring better sourcing.

### F4) Recommended polling cadence for futures layer
- Discovery (new markets / upcoming deadlines): 60–180 min
- Tracking (top N upcoming anchors): 30–60 min
- Volatility radar (biggest movers): 30–60 min

### F5) Key rule
- **No market match = no penalty.** Many cultural moments will never have a market.

---

## US-first filtering + “Global Breakthrough Gate”

Everything is US-weighted by default. Items from global feeds (BBC/Guardian, r/worldnews) stay hidden unless they pass the gate.

A GLOBAL topic is allowed into the US dashboard only if it triggers at least TWO of:
- picked up by ≥2 US national news sources (B1/B2/B3) within last 1–6 hours
- appears in US conversation signals (r/news, r/politics, HN) within last 6 hours
- appears in US video diffusion (YouTube mostPopular US) within last 24 hours
- Wikipedia pageviews spike above threshold (hourly)

> Prediction markets can be used as an **additional boost** for prioritization, but not as a requirement.

---

## Suggested polling cadence (MVP)
- B RSS: 5–10 min
- Reddit RSS: 5–15 min
- HN: 10–15 min
- Wikipedia top: daily; pageviews: 60 min
- YouTube mostPopular US: 30–60 min
- Futures discovery: 60–180 min; tracked anchors: 30–60 min; volatility radar: 30–60 min
- A embed panels: refresh UI 15–60 min

---

## Next add-ons (optional)
- NOAA/NWS alerts, USGS earthquakes, FAA/airport feeds (for “reality sensors”)
- More local RSS by market (NYC/LA/DC/TX/FL) for early break detection


---

## Futures → Predicted Moments integration (Forecast module)

**Purpose:** Futures (prediction markets) should make Predicted Moments more *anticipatory* by surfacing **upcoming attention anchors** (date-bounded, high-stakes events) and by signaling when an anchor is entering a “moment window.” Futures should **never** suppress a Predicted Moment; it only **adds inputs** that (a) sharpen timing, (b) increase sourcing strength, and (c) strengthen the “why this will pop” logic.

### 1) Use Futures to generate “Attention Anchors” (calendar-native)
- Convert relevant prediction-market questions into **calendar anchors** that live inside the existing calendar (no separate calendar UI needed).
- Each anchor should minimally include:
  - **Anchor title** (plain English question / event)
  - **Anchor window** (expected attention window: typically `resolution date ± 2–5 days`, adjustable by category)
  - **Category** (politics / macro / legal / awards / other)
- These anchors act as **scheduled gravity wells** for attention and conversation, and they should automatically appear as potential inputs to Predicted Moments.

### 2) Allow anchors to spawn Predicted Moments (but only when “primed”)
- Predicted Moments should be created when an anchor intersects with your existing signals/tensions, e.g.:
  - an anchor’s entities show up in **US news clusters + Reddit + YouTube/Wiki** within a recent window, OR
  - the system’s **tension engine** flags a compatible tension that is already rising (inequality, authenticity backlash, AI anxiety, etc.)
- Anchors are **candidates**, not automatic moments.

### 3) Futures improves “Timing” (Window selection) for Predicted Moments
- When a Predicted Moment is linked to an anchor, its **Window** should be derived from the anchor window, then refined by live signals:
  - If conversation velocity is rising early → shift the window earlier
  - If mainstream coverage lags but curiosity rises → keep window tight around the anchor date
  - If the outcome is uncertain/contested → widen the window (debate lasts longer)

### 4) Futures improves “Sourcing” automatically (Monitor Pack injection)
For each Predicted Moment linked to an anchor, generate and attach a **Monitor Pack** (automated sourcing bundle):
- 2–6 **Reddit search RSS** queries (entity + tension keywords)
- **News keyword filters** for RSS/clustering
- **Wikipedia watchlist titles** (entities)
- **YouTube keyword queries** (entity + explainer terms)

### 5) Futures improves “Confidence” (without being a gate)
Futures should adjust confidence only as a **positive signal**, never a negative:
- If an anchor is present and **attention is priming** (cross-source pickup), boost confidence.
- If no relevant anchor exists, do nothing (no penalty).
- If an anchor is moving dramatically, treat it as “something is brewing” and trigger deeper sourcing pulls—but don’t auto-raise confidence unless other sources confirm.

### 6) Futures enables “Scenario branching” for moment crafting
If a prediction is tied to a resolvable anchor (verdict / election / Fed decision), store two lightweight scenario notes:
- **If outcome A → likely tension expression / backlash shape**
- **If outcome B → likely tension expression / backlash shape**

### 7) UI/UX (minimal)
In the Predicted Moments module, Futures should be visible only as:
- a linked **Anchor Date/Window** (e.g., “Anchored to: Oscars (Mar 1) — Window Feb 28–Mar 3”)
- optional “Why now” sourcing links (from Monitor Pack)
Avoid market jargon; the value is: **this moment is predictable because it’s anchored to a scheduled attention event and the tension is already primed.**
