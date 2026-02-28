# Cultural Forecaster

A trend monitoring, analysis, and prediction tool for Cornett's Creative Director. Part of the LeBrain James PKM ecosystem.

Monitors cultural signals across Reddit, RSS feeds, Wikipedia, and Google Trends → scores them with Claude AI → surfaces insights in a web dashboard backed by Notion.

---

## Architecture

```
Collectors (Python)        Intelligence Layer          Dashboard (Next.js)
─────────────────────      ──────────────────         ───────────────────
reddit_collector.py    ──► signal_processor.py  ──►   /            (Radar)
rss_collector.py       ──► briefing_generator.py ──►  /trends       (All Trends)
wikipedia_trending.py  ──►                            /trends/[id]  (Trend Detail)
google_trends.py       ──►  Notion Databases          /calendar     (Calendar)
                            ────────────────          /briefings    (Archive)
                            • Trends
                            • Cultural Tensions
                            • Evidence Log
                            • Cultural Calendar
                            • Briefing Archive
```

**Models:** `claude-sonnet-4-5` for signal processing (batch throughput), `claude-opus-4-5` for daily briefings (synthesis quality).

---

## Setup

### Prerequisites
- Python 3.9+
- Node.js 18+
- Notion account with API access
- Anthropic API key

### 1. Clone and create virtualenv

```bash
git clone <repo>
cd forecaster
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
NOTION_API_KEY=ntn_...
NOTION_PARENT_PAGE_ID=   # The Notion page under which databases will be created
NOTION_TRENDS_DB=        # UUID of Trends database
NOTION_TENSIONS_DB=      # UUID of Cultural Tensions database
NOTION_EVIDENCE_DB=      # UUID of Evidence Log database
NOTION_CALENDAR_DB=      # UUID of Cultural Calendar database
NOTION_BRIEFING_DB=      # UUID of Briefing Archive database
```

### 3. Create Notion databases (first time only)

```bash
python scripts/setup/create_notion_databases.py
```

This creates all 5 databases and saves their IDs to `notion_ids.env`. Then patch the schemas:

```bash
python scripts/setup/patch_database_schemas.py
```

### 4. Seed baseline data

```bash
python scripts/setup/seed_tensions.py   # 14 cultural tensions
python scripts/setup/seed_calendar.py   # 57 calendar events for 2026
```

### 5. Run the dashboard

```bash
cd dashboard
npm install
cp ../.env dashboard/.env.local  # copy Notion credentials for Next.js
npm run dev
```

Dashboard: http://localhost:3000

---

## Running the Pipeline

### Full run (collect + process + brief)

```bash
source venv/bin/activate
python scripts/run_pipeline.py
```

### Individual stages

```bash
# Collect signals only
python scripts/run_pipeline.py --collect --no-brief

# Process signals (score + create trends)
python scripts/run_pipeline.py --process --no-brief

# Generate briefing only (uses already-processed data)
python scripts/run_pipeline.py --brief
```

### Individual collectors

```bash
source venv/bin/activate

python scripts/collectors/reddit_collector.py    # ~93 signals
python scripts/collectors/rss_collector.py       # ~100 signals
python scripts/collectors/wikipedia_trending.py  # ~67 signals
python scripts/collectors/google_trends.py       # ~21 signals
```

### Pipeline output

Each collector writes to the Notion Evidence Log. The signal processor reads unprocessed signals, calls Claude to score them (CPS formula), and creates new Trend pages. The briefing generator synthesizes everything into the daily briefing.

---

## Automated Scheduling (GitHub Actions)

The `.github/workflows/pipeline.yml` workflow runs:
- **6:00 AM, 12:00 PM, 6:00 PM ET** — collect only (keeps signals fresh)
- **7:00 AM ET daily** — full run (collect + process + brief)

Required GitHub secrets:
```
ANTHROPIC_API_KEY
NOTION_API_KEY
NOTION_TRENDS_DB
NOTION_TENSIONS_DB
NOTION_EVIDENCE_DB
NOTION_CALENDAR_DB
NOTION_BRIEFING_DB
```

---

## Dashboard Pages

| Page | URL | What it shows |
|------|-----|---------------|
| Radar | `/` | Flashpoints, top trends, tensions, 30-day calendar, latest briefing |
| All Trends | `/trends` | Filterable grid of all tracked trends |
| Trend Detail | `/trends/[id]` | CPS, summary, evidence timeline, channel heatmap, AI forecast |
| Calendar | `/calendar` | Upcoming cultural events with horizon selector |
| Briefings | `/briefings` | Daily briefing archive |

---

## Cultural Potency Score (CPS)

Scores trends 0–100 based on:
- **Tension intersection** (+0–40): How many active cultural tensions does this touch, weighted by tension weight?
- **Platform velocity** (+0–30): Spread across Reddit, RSS, Wikipedia, Google Trends
- **Novelty** (+0–20): Genuinely new vs. re-emergence of known patterns
- **Client relevance** (+0–10): Relevance to Cornett clients (A&W, Busch Light, Cup Noodles, etc.)

| Score | Label | Emoji |
|-------|-------|-------|
| 80–100 | Flashpoint | 🔴 |
| 60–79 | Rising Heat | 🟠 |
| 40–59 | Simmer | 🟡 |
| 20–39 | Low Burn | 🔵 |
| 0–19 | Background Noise | ⚪ |

---

## Project Structure

```
forecaster/
├── .env                          # Credentials (gitignored)
├── .env.example                  # Template
├── .github/workflows/
│   └── pipeline.yml              # Scheduled automation
├── requirements.txt              # Python dependencies
├── scripts/
│   ├── notion_helper.py          # Shared Notion REST API wrapper
│   ├── run_pipeline.py           # Main orchestrator
│   ├── setup/
│   │   ├── create_notion_databases.py
│   │   ├── patch_database_schemas.py
│   │   ├── seed_tensions.py
│   │   └── seed_calendar.py
│   ├── collectors/
│   │   ├── google_trends.py
│   │   ├── reddit_collector.py
│   │   ├── rss_collector.py
│   │   └── wikipedia_trending.py
│   └── processors/
│       ├── signal_writer.py
│       ├── signal_processor.py
│       └── briefing_generator.py
└── dashboard/                    # Next.js app
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx              # Radar
    │   ├── trends/
    │   │   ├── page.tsx          # All Trends
    │   │   └── [id]/page.tsx     # Trend Detail
    │   ├── calendar/page.tsx
    │   └── briefings/page.tsx
    ├── components/
    │   ├── CpsBar.tsx
    │   ├── TrendCard.tsx
    │   ├── CalendarEventRow.tsx
    │   └── TensionBadge.tsx
    └── lib/
        └── notion.ts             # Notion data layer
```

---

## Notion Database Schemas

### Trends
| Property | Type | Description |
|----------|------|-------------|
| Title | title | Trend name |
| Type | select | Macro Trend / Micro Trend / Emerging Signal / Scheduled Event / Predicted Moment |
| Status | select | Emerging / Rising / Exploding / Peaked / Stable / Archived |
| Cultural Potency Score | number | 0–100 |
| Momentum Score | number | 0–100, rate of change |
| Summary | rich_text | 1-2 sentence description |
| Forecast | rich_text | AI-generated trajectory prediction |
| First Detected | date | When first spotted |
| Last Updated | date | Last signal added |
| Pinned | checkbox | Featured on Radar dashboard |
| Linked Tensions | relation → Cultural Tensions | Which tensions this intersects |

### Cultural Tensions
| Property | Type | Description |
|----------|------|-------------|
| Tension Name | title | The tension |
| Weight | number | 1–10 importance weight |
| Status | select | Active / Rising / Dormant |
| Description | rich_text | Full description |

### Evidence Log
| Property | Type | Description |
|----------|------|-------------|
| Title | title | Signal title |
| Source URL | url | Original link |
| Source Platform | select | Reddit / RSS / Wikipedia / Google Trends |
| Date Captured | date | Collection date |
| Summary | rich_text | Brief description |
| Sentiment | select | Positive / Negative / Neutral / Mixed |
| Linked Trends | relation → Trends | Which trend(s) this supports |

### Cultural Calendar
| Property | Type | Description |
|----------|------|-------------|
| Event Name | title | Event name |
| Date | date | When it occurs |
| Type | select | Award Show / Sports / Music / Film / Holiday / Cultural Moment / Political |
| Category | multi_select | Relevant categories |
| Cultural Potency Score | number | Expected cultural impact |
| Notes | rich_text | Context and angles |

### Briefing Archive
| Property | Type | Description |
|----------|------|-------------|
| Date | title | Briefing date (YYYY-MM-DD) |
| Briefing Content | rich_text | Full briefing text |
| Flashpoint Count | number | Number of active flashpoints |
| Key Highlights | rich_text | Top 3 highlights |

---

## Key Decisions

See [DECISIONS.md](./DECISIONS.md) for full ADRs. Summary:
- **Bypass `@notionhq/client` v3** — use raw REST API calls in both Python and TypeScript (library's DB query API changed)
- **Date-only Notion filters** — Notion stores dates without time; use `date.today()` not `datetime.now()`
- **`load_dotenv(override=True)`** — required to override empty shell env vars
- **Two-tier model strategy** — Sonnet for batched signal processing, Opus for daily briefings
- **No Reddit OAuth** — public JSON endpoint sufficient for daily collection
- **Next.js ISR at 5 min** — balances freshness vs. Notion API costs

---

## Extending the System

### Add a new collector

1. Create `scripts/collectors/your_collector.py`
2. Collect signals as `[{"title": ..., "url": ..., "summary": ..., "platform": ..., "sentiment": ...}]`
3. Call `signal_writer.write_signals(signals)` from `scripts/processors/signal_writer.py`
4. Add to `scripts/run_pipeline.py` collection stage

### Add a new client relevance factor

Edit `SIGNAL_PROCESSING_PROMPT` in `scripts/processors/signal_processor.py` to include the new client context.

### Adjust tension weights

Edit tensions directly in Notion — the next pipeline run will pick up new weights automatically.

### Deploy dashboard

The dashboard is a standard Next.js app deployable to Vercel or Netlify. Set environment variables in the platform dashboard matching `.env.local`.

---

*Built for Cornett / LeBrain James ecosystem. February 2026.*
