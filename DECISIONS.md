# Architectural Decision Records

Decisions made during the Cultural Forecaster build, and why.

---

## ADR-001: Bypass `@notionhq/client` v3 for all database operations

**Status:** Accepted
**Date:** 2026-02-25

### Context
`notion-client` v3 (Python) and `@notionhq/client` v3 (TypeScript) both made breaking changes to database querying. In Python, `databases.query()` was removed in favor of a new `data_sources` endpoint pattern. In TypeScript, the `request()` method signature changed in a way that broke raw database queries.

### Decision
All database operations use raw HTTP calls:
- **Python:** `requests.post("https://api.notion.com/v1/databases/{id}/query", ...)`
- **TypeScript:** `fetch("https://api.notion.com/v1/databases/{id}/query", ...)` with `next: { revalidate: 300 }` for Next.js ISR

The Notion client libraries are not imported in any data layer code. The Notion API REST spec is stable and versioned (`Notion-Version: 2022-06-28`).

### Consequences
- No dependency on library internals that may change again
- Slightly more verbose code (manually construct headers, handle pagination)
- Full control over request caching behavior in Next.js

---

## ADR-002: Use date-only ISO strings for all Notion date filters

**Status:** Accepted
**Date:** 2026-02-25

### Context
Notion stores date properties as date-only strings (e.g., `"2026-02-25"`) when no time component is provided. Filtering with a datetime (e.g., `datetime.now() - timedelta(hours=24)`) generates a datetime string that does not match date-only records from the same calendar day — they are treated as "before" the cutoff.

### Decision
All Notion date filters use date-only ISO format: `date.today() - timedelta(days=N)` → `.isoformat()`. When the spec says "last 24 hours" but the data is stored as date-only, we use "today and yesterday" as the window.

### Consequences
- Consistent behavior regardless of time zone or time-of-day the pipeline runs
- Signals captured today are always included in today's briefing
- Slight over-inclusion (could pick up signals from up to 48 hours ago) — acceptable for this use case

---

## ADR-003: `load_dotenv(override=True)` in all Python scripts

**Status:** Accepted
**Date:** 2026-02-25

### Context
When running in a terminal session where `ANTHROPIC_API_KEY` was previously set to an empty string (e.g., from a failed shell export), `python-dotenv`'s default behavior (`override=False`) will not overwrite the empty string with the correct value from `.env`. This causes silent auth failures.

### Decision
All Python scripts call `load_dotenv(override=True)` to ensure `.env` values always take precedence over the shell environment.

### Consequences
- Correct behavior in all terminal environments
- If someone intentionally sets a different API key in their shell, `.env` will override it — but the `.env` file is the authoritative credential store for this project, so that's correct.

---

## ADR-004: Two-tier AI model strategy

**Status:** Accepted
**Date:** 2026-02-25

### Context
Signal processing runs on hundreds of signals per day. Briefing generation runs once daily on pre-synthesized data.

### Decision
- **Signal processing:** `claude-sonnet-4-5` — fast, cost-efficient, handles structured JSON scoring
- **Briefing generation:** `claude-opus-4-5` — deeper synthesis, higher quality prose, runs once/day

### Consequences
- ~10-20× cost savings on signal processing vs. using Opus for everything
- Briefings reflect Opus-quality reasoning while keeping pipeline costs manageable

---

## ADR-005: No Reddit API credentials (public JSON endpoint)

**Status:** Accepted
**Date:** 2026-02-25

### Context
Reddit's OAuth API requires app registration. The public JSON endpoint (`reddit.com/r/{sub}/hot.json`) works without credentials and is sufficient for read-only collection.

### Decision
Use the unauthenticated JSON endpoint with a `User-Agent` header. Rate limit: 1 request per 2 seconds per subreddit.

### Consequences
- Simpler setup (no REDDIT_CLIENT_ID/SECRET required)
- Lower rate limits than authenticated API — acceptable given we only collect from 20 subreddits once daily
- Reddit may rate-limit or block unauthenticated access in the future — documented as upgrade path

### Upgrade Path
Add `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` to `.env` and update `reddit_collector.py` to use PRAW with OAuth for higher limits.

---

## ADR-006: Next.js ISR with 5-minute revalidation

**Status:** Accepted
**Date:** 2026-02-25

### Context
The dashboard reads from Notion, which updates on pipeline runs (daily by default). Full SSR on every request would be wasteful; full static generation would never refresh.

### Decision
All data fetches use `next: { revalidate: 300 }` (5 minutes). Pages are server-rendered and cached by Next.js; stale content is served while revalidation happens in the background.

### Consequences
- Dashboard reflects new data within 5 minutes of a pipeline run completing
- Zero Notion API calls for most page loads
- If Notion is down, cached content continues to serve

---

## ADR-007: Notion as single source of truth (no local database)

**Status:** Accepted
**Date:** 2026-02-25

### Context
The spec requires Jonathon to be able to view, edit, and annotate trends directly in Notion. A separate local database would create sync problems.

### Decision
All data lives in Notion. Python scripts write to Notion; the Next.js dashboard reads from Notion. No SQLite, Postgres, or other local DB.

### Consequences
- Jonathon can edit any trend, tension, or evidence directly in Notion and the dashboard reflects changes within 5 minutes
- Pipeline failures don't corrupt a local DB
- Notion API rate limits (3 req/s) constrain pipeline throughput — acceptable for daily batch runs
- No offline capability for the dashboard

---

## ADR-008: Cultural Potency Score (CPS) formula

**Status:** Accepted
**Date:** 2026-02-25

### Context
Need a consistent, reproducible score 0–100 to rank trends. Claude API should score based on cultural resonance, not just volume.

### Decision
Claude scores each signal batch with this formula guidance:
- **Tension intersection:** +0–40 pts based on how many active cultural tensions the signal touches, weighted by tension weight
- **Platform velocity:** +0–30 pts based on spread across signal sources (Reddit, RSS, Wikipedia, Trends = more diverse = higher)
- **Novelty:** +0–20 pts for genuinely new trends vs. re-emergence of known patterns
- **Client relevance:** +0–10 pts for relevance to Cornett clients (A&W, Busch Light, Cup Noodles, etc.)

Labels: 80–100 🔴 Flashpoint, 60–79 🟠 Rising Heat, 40–59 🟡 Simmer, 20–39 🔵 Low Burn, 0–19 ⚪ Background Noise.

### Consequences
- Scores are Claude's interpretation, not a deterministic calculation — consistent within a session, may drift between model versions
- Client-relevance factor ensures the tool serves Cornett's actual business needs
- Future refinement: add Momentum Score decay function (trends that peaked should lose CPS over time)

---

## ADR-009: pytrends rising queries over trending_searches()

**Status:** Accepted
**Date:** 2026-02-25

### Context
`pytrends.trending_searches()` returns HTTP 404 (known issue with Google's endpoint changes). `pytrends.related_queries()` with `rising` key is stable.

### Decision
Google Trends collector uses `related_queries()` on 7 culture-topic seed terms and extracts the `rising` queries. Produces ~20 signals per run.

### Consequences
- Signals are relative ("breakout" = 5000%+ rise) rather than absolute volume
- Covers culture-adjacent Google search behavior, not raw trending topics
- More relevant to creative strategy than raw Google Hot Trends

---
