"""
calendar_collector.py
---------------------
Auto-populates the Cultural Calendar Notion database with upcoming events
by fetching from public RSS feeds and using Claude to extract structured
event data.

Unlike other collectors (which return signal dicts for the Evidence Log),
this collector writes directly to the Calendar DB.

Sources:
  - Entertainment RSS feeds (Deadline, Variety, Hollywood Reporter)
  - Sports schedule feeds (ESPN, BBC Sport)
  - Tech/business event feeds (TechCrunch, The Verge)
  - Culture/politics feeds (NPR, BBC, AP News)
  - Wikipedia current events (via RSS proxy)

Run:  python3 scripts/collectors/calendar_collector.py
"""

import os
import sys
import json
import time
import re
import logging
from datetime import datetime, date, timedelta, timezone
from email.utils import parsedate_to_datetime
from difflib import SequenceMatcher

import feedparser
import requests
from dotenv import load_dotenv

# ── Path setup & imports ──────────────────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(override=True)

from notion_helper import query_database, create_page, get_page_title, rich_text

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
CALENDAR_DB = os.getenv("NOTION_CALENDAR_DB")
CLAUDE_MODEL = "claude-haiku-4-5-20251001"

VALID_CATEGORIES = [
    "Politics", "Entertainment", "Sports", "Tech", "Business",
    "Culture", "Holiday", "Music", "Film", "Fashion", "Gaming",
]

# Look ahead window: events within the next N days
LOOKAHEAD_DAYS = 90

# Max events to create per run (cost/rate-limit guard)
MAX_EVENTS_PER_RUN = 40

# Similarity threshold for deduplication (0-1, higher = stricter)
DEDUP_THRESHOLD = 0.75

# ── RSS Feeds focused on upcoming events / releases / schedules ───────────────
CALENDAR_FEEDS = [
    # ── Entertainment / Film ──────────────────────────────────────────────────
    {
        "url": "https://deadline.com/feed/",
        "label": "Deadline",
        "focus": "entertainment",
        "hint": "Look for movie release dates, TV premiere dates, award show dates, casting announcements with dates",
    },
    {
        "url": "https://variety.com/feed/",
        "label": "Variety",
        "focus": "entertainment",
        "hint": "Look for film release dates, TV show launch dates, award ceremony dates, festival dates",
    },
    {
        "url": "https://www.hollywoodreporter.com/feed/",
        "label": "Hollywood Reporter",
        "focus": "entertainment",
        "hint": "Look for movie premieres, TV debuts, entertainment events, award shows",
    },
    {
        "url": "https://collider.com/feed/",
        "label": "Collider",
        "focus": "entertainment",
        "hint": "Look for movie release dates, streaming launch dates, trailer drop dates",
    },
    # ── Music ─────────────────────────────────────────────────────────────────
    {
        "url": "https://pitchfork.com/rss/news/feed.xml",
        "label": "Pitchfork",
        "focus": "music",
        "hint": "Look for album release dates, tour announcement dates, festival dates, music award dates",
    },
    {
        "url": "https://consequence.net/feed/",
        "label": "Consequence of Sound",
        "focus": "music",
        "hint": "Look for album drops, tour dates, festival lineups, music event dates",
    },
    # ── Sports ────────────────────────────────────────────────────────────────
    {
        "url": "https://www.espn.com/espn/rss/news",
        "label": "ESPN",
        "focus": "sports",
        "hint": "Look for game dates, playoff schedules, championship dates, draft dates, major sporting events",
    },
    {
        "url": "https://feeds.bbci.co.uk/sport/rss.xml",
        "label": "BBC Sport",
        "focus": "sports",
        "hint": "Look for match dates, tournament schedules, championship dates, Olympics, World Cup events",
    },
    # ── Tech ──────────────────────────────────────────────────────────────────
    {
        "url": "https://techcrunch.com/feed/",
        "label": "TechCrunch",
        "focus": "tech",
        "hint": "Look for product launch dates, conference dates, IPO dates, major tech announcements with dates",
    },
    {
        "url": "https://www.theverge.com/rss/index.xml",
        "label": "The Verge",
        "focus": "tech",
        "hint": "Look for product release dates, tech event dates, conference schedules, platform launches",
    },
    # ── Politics / Policy ─────────────────────────────────────────────────────
    {
        "url": "https://feeds.npr.org/1001/rss.xml",
        "label": "NPR",
        "focus": "politics_culture",
        "hint": "Look for election dates, hearing dates, policy deadlines, political events, cultural observances",
    },
    {
        "url": "https://feeds.bbci.co.uk/news/rss.xml",
        "label": "BBC News",
        "focus": "politics_culture",
        "hint": "Look for summit dates, election dates, policy deadlines, international events",
    },
    {
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
        "label": "NYT",
        "focus": "politics_culture",
        "hint": "Look for political events, cultural moments, policy deadlines, election dates",
    },
    # ── Culture / General ─────────────────────────────────────────────────────
    {
        "url": "https://www.theguardian.com/culture/rss",
        "label": "Guardian Culture",
        "focus": "culture",
        "hint": "Look for exhibition openings, festival dates, cultural events, book releases, art events",
    },
    {
        "url": "https://www.axios.com/feeds/feed.rss",
        "label": "Axios",
        "focus": "general",
        "hint": "Look for upcoming dates mentioned: elections, hearings, launches, events, deadlines",
    },
]

MAX_ITEMS_PER_FEED = 15


# ── Feed parsing ──────────────────────────────────────────────────────────────

def _parse_published(entry) -> datetime:
    """Parse published date from a feed entry."""
    for attr in ("published", "updated"):
        val = getattr(entry, attr, None)
        if val:
            try:
                return parsedate_to_datetime(val).replace(tzinfo=timezone.utc)
            except Exception:
                try:
                    t = getattr(entry, f"{attr}_parsed", None)
                    if t:
                        return datetime(*t[:6], tzinfo=timezone.utc)
                except Exception:
                    pass
    return datetime.now(timezone.utc)


def _clean_html(text: str, max_len: int = 600) -> str:
    """Strip HTML tags and truncate."""
    clean = re.sub(r"<[^>]+>", " ", text or "")
    clean = " ".join(clean.split())
    return clean[:max_len]


def fetch_feed_content() -> list[dict]:
    """
    Fetch all RSS feeds and return raw content chunks for Claude to process.
    Each chunk contains aggregated entries from one feed.
    """
    chunks = []

    for feed_info in CALENDAR_FEEDS:
        url = feed_info["url"]
        label = feed_info["label"]
        focus = feed_info["focus"]
        hint = feed_info["hint"]

        try:
            feed = feedparser.parse(url)
            entries_text = []

            for entry in feed.entries[:MAX_ITEMS_PER_FEED]:
                title = _clean_html(entry.get("title", ""), 200)
                summary = _clean_html(
                    entry.get("summary", entry.get("description", "")), 400
                )
                link = entry.get("link", "")
                pub_date = _parse_published(entry).strftime("%Y-%m-%d")

                if not title:
                    continue

                entries_text.append(
                    f"- [{pub_date}] {title}: {summary} ({link})"
                )

            if entries_text:
                chunks.append({
                    "label": label,
                    "focus": focus,
                    "hint": hint,
                    "content": "\n".join(entries_text),
                    "entry_count": len(entries_text),
                })
                logger.debug(f"  {label}: {len(entries_text)} entries fetched")

            time.sleep(0.5)

        except Exception as e:
            logger.warning(f"Failed to fetch {label} ({url}): {e}")

    return chunks


# ── Claude extraction ─────────────────────────────────────────────────────────

def _call_claude(messages: list, max_tokens: int = 4096) -> str:
    """Call Claude API directly via requests."""
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": CLAUDE_MODEL,
            "max_tokens": max_tokens,
            "messages": messages,
        },
        timeout=60,
    )
    if not resp.ok:
        raise RuntimeError(f"Claude API error {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    return data["content"][0]["text"]


def extract_events_from_feeds(chunks: list[dict]) -> list[dict]:
    """
    Send batched feed content to Claude and extract structured calendar events.
    Returns list of event dicts with: name, date, categories, notes, potency.
    """
    if not chunks:
        return []

    today = date.today()
    end_date = today + timedelta(days=LOOKAHEAD_DAYS)

    # Build the feed content for the prompt, batching feeds together
    # to reduce API calls. Split into batches of ~5 feeds each.
    all_events = []
    batch_size = 5

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        feed_block = ""
        for chunk in batch:
            feed_block += (
                f"\n### {chunk['label']} ({chunk['focus']})\n"
                f"Focus: {chunk['hint']}\n"
                f"{chunk['content']}\n"
            )

        prompt = f"""You are a cultural calendar analyst. Extract UPCOMING EVENTS from the RSS feed content below.

Today's date: {today.isoformat()}
Window: {today.isoformat()} to {end_date.isoformat()}

RULES:
1. Only extract events with a SPECIFIC FUTURE DATE (between {today.isoformat()} and {end_date.isoformat()})
2. Events must be concrete and scheduled (not rumors or speculation)
3. Include: movie releases, album drops, TV premieres, award shows, sporting events, conferences, elections, hearings, festivals, product launches, cultural observances
4. Do NOT include: past events, vague "coming soon" without dates, daily news stories without a future event
5. Estimate Cultural Potency Score (20-80) based on likely mainstream cultural impact:
   - 20-35: Niche interest (small conference, indie release)
   - 36-50: Moderate interest (mid-tier movie, regional event)
   - 51-65: Significant cultural moment (major album, playoff game, big conference)
   - 66-80: Major cultural flashpoint (blockbuster premiere, championship, election)
6. Categories must be from: {', '.join(VALID_CATEGORIES)}
7. Each event needs a brief note (1-2 sentences) on cultural significance

Return ONLY a JSON array of objects. No other text. Each object:
{{
  "name": "Event Name",
  "date": "YYYY-MM-DD",
  "categories": ["Category1", "Category2"],
  "potency": 45,
  "notes": "Brief cultural significance note."
}}

If no events found, return: []

--- FEED CONTENT ---
{feed_block}
--- END ---"""

        try:
            response_text = _call_claude(
                [{"role": "user", "content": prompt}],
                max_tokens=4096,
            )

            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r"\[.*\]", response_text, re.DOTALL)
            if json_match:
                events = json.loads(json_match.group())
                # Validate and clean each event
                for event in events:
                    if _validate_event(event, today, end_date):
                        all_events.append(event)
            else:
                logger.warning(f"No JSON array found in Claude response for batch {i // batch_size + 1}")

        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error for batch {i // batch_size + 1}: {e}")
        except Exception as e:
            logger.warning(f"Claude extraction failed for batch {i // batch_size + 1}: {e}")

        # Rate limit between batches
        if i + batch_size < len(chunks):
            time.sleep(1)

    logger.info(f"Extracted {len(all_events)} events from {len(chunks)} feeds")
    return all_events


def _validate_event(event: dict, today: date, end_date: date) -> bool:
    """Validate that an extracted event has all required fields and valid date."""
    required = ["name", "date", "categories", "potency", "notes"]
    if not all(k in event for k in required):
        return False

    # Validate date
    try:
        event_date = date.fromisoformat(event["date"])
        if event_date < today or event_date > end_date:
            return False
    except (ValueError, TypeError):
        return False

    # Validate categories
    event["categories"] = [
        c for c in event.get("categories", []) if c in VALID_CATEGORIES
    ]
    if not event["categories"]:
        event["categories"] = ["Culture"]  # fallback

    # Clamp potency
    event["potency"] = max(20, min(80, int(event.get("potency", 40))))

    # Ensure name is reasonable
    if not event.get("name") or len(event["name"]) < 3:
        return False

    return True


# ── Deduplication ─────────────────────────────────────────────────────────────

def get_existing_events() -> list[dict]:
    """Fetch existing calendar events with names and dates."""
    pages = query_database(CALENDAR_DB)
    events = []
    for page in pages:
        name = get_page_title(page)
        props = page.get("properties", {})
        date_prop = props.get("Date", {}).get("date")
        event_date = date_prop.get("start") if date_prop else None
        events.append({"name": name, "date": event_date, "id": page["id"]})
    return events


def _is_duplicate(new_name: str, new_date: str, existing: list[dict]) -> bool:
    """
    Check if an event is a duplicate of an existing calendar entry.
    Uses name similarity + date proximity.
    """
    new_name_lower = new_name.lower().strip()

    for ex in existing:
        ex_name_lower = (ex.get("name") or "").lower().strip()

        # Exact name match
        if new_name_lower == ex_name_lower:
            return True

        # Fuzzy name match
        similarity = SequenceMatcher(None, new_name_lower, ex_name_lower).ratio()
        if similarity >= DEDUP_THRESHOLD:
            # If names are similar, also check if dates are close
            if ex.get("date") and new_date:
                try:
                    d1 = date.fromisoformat(new_date)
                    d2 = date.fromisoformat(ex["date"][:10])
                    if abs((d1 - d2).days) <= 7:
                        return True
                except (ValueError, TypeError):
                    # If dates can't be parsed, rely on name similarity alone
                    return True

    return False


# ── Self-deduplication for extracted events ───────────────────────────────────

def _deduplicate_extracted(events: list[dict]) -> list[dict]:
    """Remove duplicates within the extracted batch itself."""
    unique = []
    for event in events:
        is_dup = False
        for existing in unique:
            sim = SequenceMatcher(
                None,
                event["name"].lower().strip(),
                existing["name"].lower().strip(),
            ).ratio()
            if sim >= DEDUP_THRESHOLD:
                try:
                    d1 = date.fromisoformat(event["date"])
                    d2 = date.fromisoformat(existing["date"])
                    if abs((d1 - d2).days) <= 3:
                        # Keep the one with higher potency
                        if event["potency"] > existing["potency"]:
                            unique.remove(existing)
                            unique.append(event)
                        is_dup = True
                        break
                except (ValueError, TypeError):
                    is_dup = True
                    break
        if not is_dup:
            unique.append(event)
    return unique


# ── Write to Notion ───────────────────────────────────────────────────────────

def write_events_to_calendar(events: list[dict], existing: list[dict]) -> int:
    """
    Write new events to the Cultural Calendar Notion database.
    Returns count of events added.
    """
    added = 0

    for event in events:
        if added >= MAX_EVENTS_PER_RUN:
            logger.info(f"Hit max events per run ({MAX_EVENTS_PER_RUN}), stopping")
            break

        name = event["name"]
        event_date = event["date"]

        if _is_duplicate(name, event_date, existing):
            logger.debug(f"  Skip (dup): {name}")
            continue

        try:
            create_page(CALENDAR_DB, {
                "Event Name": {"title": [{"text": {"content": name[:200]}}]},
                "Date": {"date": {"start": event_date}},
                "Type": {"select": {"name": "Known Event"}},
                "Category": {
                    "multi_select": [{"name": c} for c in event["categories"]]
                },
                "Cultural Potency Score": {"number": event["potency"]},
                "Notes": {"rich_text": rich_text(event.get("notes", ""))},
            })

            # Add to existing list so subsequent events in this batch can dedup
            existing.append({"name": name, "date": event_date, "id": None})
            added += 1
            logger.info(f"  + {name} ({event_date}) [CPS: {event['potency']}]")

            time.sleep(0.35)  # Notion rate limit

        except Exception as e:
            logger.warning(f"  Failed to create '{name}': {e}")

    return added


# ── Main collector entry point ────────────────────────────────────────────────

def collect() -> dict:
    """
    Main entry point. Fetches feeds, extracts events via Claude,
    deduplicates, and writes to the Calendar DB.

    Returns summary dict with counts.
    """
    if not CALENDAR_DB:
        raise RuntimeError("NOTION_CALENDAR_DB not set in environment")
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set in environment")

    logger.info("=== Calendar Collector: starting ===")

    # 1. Fetch RSS feed content
    logger.info("Step 1: Fetching RSS feeds...")
    chunks = fetch_feed_content()
    logger.info(f"  Fetched {len(chunks)} feeds with content")

    if not chunks:
        logger.warning("No feed content fetched. Exiting.")
        return {"feeds_fetched": 0, "events_extracted": 0, "events_added": 0}

    # 2. Extract structured events via Claude
    logger.info("Step 2: Extracting events via Claude...")
    raw_events = extract_events_from_feeds(chunks)
    logger.info(f"  Extracted {len(raw_events)} raw events")

    # 3. Self-deduplicate the extracted batch
    events = _deduplicate_extracted(raw_events)
    logger.info(f"  After self-dedup: {len(events)} events")

    if not events:
        logger.info("No events to add.")
        return {
            "feeds_fetched": len(chunks),
            "events_extracted": 0,
            "events_added": 0,
        }

    # 4. Fetch existing calendar entries for dedup
    logger.info("Step 3: Fetching existing calendar entries...")
    existing = get_existing_events()
    logger.info(f"  Found {len(existing)} existing entries")

    # 5. Write new events
    logger.info("Step 4: Writing new events to Notion...")
    added = write_events_to_calendar(events, existing)

    summary = {
        "feeds_fetched": len(chunks),
        "events_extracted": len(events),
        "events_added": added,
        "events_skipped_dup": len(events) - added,
    }

    logger.info(
        f"=== Calendar Collector: done === "
        f"{added} added, {len(events) - added} skipped (dup), "
        f"from {len(chunks)} feeds"
    )

    return summary


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    result = collect()
    print(f"\nSummary: {json.dumps(result, indent=2)}")
