"""
rss_collector.py
----------------
Fetches and parses RSS feeds from curated culture/news sources.
Returns signal dicts for the Evidence Log.
"""

import time
import logging
from datetime import datetime, timezone, timedelta
import feedparser
from email.utils import parsedate_to_datetime

logger = logging.getLogger(__name__)

# Curated RSS feeds — culture, entertainment, food, fashion, sports, tech, advertising
# Last audited: 2026-03-01. Review quarterly.
RSS_FEEDS = [
    # ── US National News (breaking news backbone) ────────────────────────────
    {"url": "https://feeds.npr.org/1001/rss.xml", "label": "NPR News", "category": "News"},
    # CNN RSS is dead (SSL errors + stale content) — NPR + NYT + BBC cover breaking news
    {"url": "http://feeds.nytimes.com/nyt/rss/HomePage", "label": "NYT Homepage", "category": "News"},
    {"url": "https://www.espn.com/espn/rss/news", "label": "ESPN", "category": "Sports"},
    {"url": "https://www.billboard.com/feed/", "label": "Billboard", "category": "Music"},
    # ── Business & finance ──────────────────────────────────────────────────
    {"url": "https://www.cnbc.com/id/100003114/device/rss/rss.html", "label": "CNBC", "category": "Business"},
    {"url": "https://feeds.marketwatch.com/marketwatch/topstories/", "label": "MarketWatch", "category": "Business"},
    # ── Global (for Global Breakthrough Gate) ───────────────────────────────
    {"url": "https://feeds.bbci.co.uk/news/world/rss.xml", "label": "BBC World", "category": "News"},
    {"url": "https://www.theguardian.com/world/rss", "label": "Guardian World", "category": "News"},
    # ── Culture & society ────────────────────────────────────────────────────
    {"url": "https://www.theatlantic.com/feed/all/", "label": "The Atlantic", "category": "Culture"},
    {"url": "https://www.vox.com/rss/index.xml", "label": "Vox", "category": "Culture"},
    {"url": "https://feeds.feedburner.com/vulture/rss/all", "label": "Vulture", "category": "Entertainment"},
    {"url": "https://nymag.com/feed/all", "label": "New York Mag", "category": "Culture"},
    {"url": "https://www.axios.com/feeds/feed.rss", "label": "Axios", "category": "Culture"},
    {"url": "https://thecut.com/feed/rss.xml", "label": "The Cut", "category": "Culture"},
    # BuzzFeed News — shut down April 2023, removed 2026-03-01
    # ── Entertainment ────────────────────────────────────────────────────────
    {"url": "https://www.hollywoodreporter.com/feed/", "label": "Hollywood Reporter", "category": "Entertainment"},
    {"url": "https://pitchfork.com/rss/news/feed.xml", "label": "Pitchfork", "category": "Music"},
    {"url": "https://variety.com/feed/", "label": "Variety", "category": "Entertainment"},
    {"url": "https://www.rollingstone.com/feed/", "label": "Rolling Stone", "category": "Music"},
    {"url": "https://consequence.net/feed/", "label": "Consequence of Sound", "category": "Music"},
    # ── Fashion, streetwear & lifestyle ──────────────────────────────────────
    {"url": "https://www.gq.com/feed/rss", "label": "GQ", "category": "Fashion"},
    {"url": "https://www.vogue.com/feed/rss", "label": "Vogue", "category": "Fashion"},
    {"url": "https://hypebeast.com/feed", "label": "Hypebeast", "category": "Fashion"},
    {"url": "https://www.highsnobiety.com/feed/", "label": "Highsnobiety", "category": "Fashion"},
    {"url": "https://www.complex.com/rss", "label": "Complex", "category": "Culture"},
    {"url": "https://www.dazeddigital.com/rss", "label": "Dazed", "category": "Culture"},
    # ── Design & aesthetics (predicts consumer culture 12-18mo out) ──────────
    {"url": "https://www.dezeen.com/feed/", "label": "Dezeen", "category": "Design"},
    {"url": "https://www.itsnicethat.com/rss", "label": "It's Nice That", "category": "Design"},
    # ── Food & drink ─────────────────────────────────────────────────────────
    {"url": "https://www.eater.com/rss/index.xml", "label": "Eater", "category": "Food"},
    {"url": "https://www.bonappetit.com/feed/rss", "label": "Bon Appétit", "category": "Food"},
    # ── QSR & restaurant industry (added 2026-03-05, post-mortem) ──────────
    {"url": "https://www.qsrmagazine.com/rss.xml", "label": "QSR Magazine", "category": "Food"},
    {"url": "https://www.nrn.com/rss.xml", "label": "Nation's Restaurant News", "category": "Food"},
    {"url": "https://www.restaurantbusinessonline.com/rss.xml", "label": "Restaurant Business", "category": "Food"},
    # ── Tech ─────────────────────────────────────────────────────────────────
    {"url": "https://www.theverge.com/rss/index.xml", "label": "The Verge", "category": "Tech"},
    {"url": "https://feeds.wired.com/wired/index", "label": "Wired", "category": "Tech"},
    {"url": "https://techcrunch.com/feed/", "label": "TechCrunch", "category": "Tech"},
    # ── Business & trends ────────────────────────────────────────────────────
    {"url": "https://www.fastcompany.com/latest/rss", "label": "Fast Company", "category": "Business"},
    {"url": "https://hbr.org/feed", "label": "HBR", "category": "Business"},
    # ── Advertising & marketing ───────────────────────────────────────────────
    {"url": "https://adage.com/rss.xml", "label": "Ad Age", "category": "Advertising"},
    {"url": "https://www.adweek.com/feed/", "label": "Adweek", "category": "Advertising"},
    {"url": "https://www.marketingweek.com/feed/", "label": "Marketing Week", "category": "Advertising"},
    {"url": "https://www.thedrum.com/rss.xml", "label": "The Drum", "category": "Advertising"},
    # ── News & long-reads ─────────────────────────────────────────────────────
    {"url": "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml", "label": "NYT Arts", "category": "Culture"},
    {"url": "https://rss.nytimes.com/services/xml/rss/nyt/FashionandStyle.xml", "label": "NYT Style", "category": "Fashion"},
    {"url": "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", "label": "NYT Tech", "category": "Tech"},
    {"url": "https://feeds.thedailybeast.com/rss/articles/culture", "label": "Daily Beast Culture", "category": "Culture"},
    {"url": "https://www.theguardian.com/culture/rss", "label": "Guardian Culture", "category": "Culture"},
    {"url": "https://www.vanityfair.com/feed/rss", "label": "Vanity Fair", "category": "Culture"},
    {"url": "https://www.esquire.com/rss/all.xml/", "label": "Esquire", "category": "Culture"},
    {"url": "https://www.people.com/feeds/latest/", "label": "People", "category": "Celebrity"},
    {"url": "https://www.bbc.co.uk/culture/feed.rss", "label": "BBC Culture", "category": "Culture"},
    # ── Research & data insights (tagged as Research platform) ───────────────
    # These appear in the Insights widget, not the Headlines feed.
    {"url": "https://www.pewresearch.org/feed/", "label": "Pew Research", "category": "Research", "platform": "Research"},
    {"url": "https://www.thinkwithgoogle.com/rss/", "label": "Think With Google", "category": "Research", "platform": "Research"},
    {"url": "https://today.yougov.com/feed.rss", "label": "YouGov", "category": "Research", "platform": "Research"},
    {"url": "https://morningconsult.com/feed/", "label": "Morning Consult", "category": "Research", "platform": "Research"},
    {"url": "https://sloanreview.mit.edu/feed/", "label": "MIT Sloan Review", "category": "Research", "platform": "Research"},
    {"url": "https://www.nielsen.com/insights/feed/", "label": "Nielsen Insights", "category": "Research", "platform": "Research"},
    {"url": "https://www.kantar.com/inspiration/rss", "label": "Kantar Inspiration", "category": "Research", "platform": "Research"},
    # HBR Research — duplicate of HBR Business (same feed URL), removed 2026-03-01
    # ── Culture newsletters & Substacks ──────────────────────────────────────
    # These are strategist-grade voices — early to trends, opinionated, non-corporate.
    {"url": "https://annehelen.substack.com/feed", "label": "Culture Study", "category": "Culture"},
    {"url": "https://www.garbageday.email/feed", "label": "Garbage Day", "category": "Culture"},
    {"url": "https://blackbirdspyplane.substack.com/feed", "label": "Blackbird Spyplane", "category": "Fashion"},
    {"url": "https://www.densediscovery.com/feed.xml", "label": "Dense Discovery", "category": "Design"},
    {"url": "https://themorningbrew.com/daily/rss/", "label": "Morning Brew", "category": "Business"},
    {"url": "https://marketingbrew.com/morning-brew/rss/", "label": "Marketing Brew", "category": "Advertising"},
    {"url": "https://www.businessoffashion.com/rss/news.rss", "label": "Business of Fashion", "category": "Fashion"},
    {"url": "https://nymag.com/intelligencer/feed/rss.xml", "label": "Intelligencer", "category": "Culture"},
    {"url": "https://www.theatlantic.com/feed/channel/entertainment/", "label": "Atlantic Entertainment", "category": "Entertainment"},
    {"url": "https://www.grunge.com/feed/", "label": "Grunge", "category": "Culture"},
    # GEN (Medium) — defunct, removed 2026-03-01
    # OneZero (Medium) — defunct, removed 2026-03-01
    # ── Sports & gaming (cultural velocity indicators) ────────────────────────
    # SI Culture — unreliable after ownership changes, removed 2026-03-01
    {"url": "https://kotaku.com/rss", "label": "Kotaku", "category": "Gaming"},
    {"url": "https://www.polygon.com/rss/index.xml", "label": "Polygon", "category": "Gaming"},
    # ── International signals ─────────────────────────────────────────────────
    {"url": "https://www.theguardian.com/us/rss", "label": "Guardian US", "category": "Culture"},
    {"url": "https://www.bbc.co.uk/news/entertainment_and_arts/rss.xml", "label": "BBC Arts", "category": "Entertainment"},
]

MAX_AGE_HOURS = 48  # Only include items published in last 48 hours
MAX_ITEMS_PER_FEED = 10


def _parse_published(entry) -> datetime:
    """Parse the published/updated date from a feed entry."""
    for attr in ("published", "updated"):
        val = getattr(entry, attr, None)
        if val:
            try:
                return parsedate_to_datetime(val).replace(tzinfo=timezone.utc)
            except Exception:
                try:
                    # Try parsing as struct_time
                    t = getattr(entry, f"{attr}_parsed", None)
                    if t:
                        return datetime(*t[:6], tzinfo=timezone.utc)
                except Exception:
                    pass
    return datetime.now(timezone.utc)


def _clean_text(text: str, max_len: int = 500) -> str:
    """Remove HTML tags and truncate."""
    import re
    clean = re.sub(r"<[^>]+>", " ", text or "")
    clean = " ".join(clean.split())
    return clean[:max_len]


def collect(max_age_hours: int = MAX_AGE_HOURS) -> list:
    """
    Collect RSS signals.
    Returns list of signal dicts.
    """
    logger.info("Collecting RSS signals...")
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    signals = []

    for feed_info in RSS_FEEDS:
        url = feed_info["url"]
        label = feed_info["label"]
        category = feed_info["category"]
        # Allow per-feed platform override (e.g. "Research" for studies/surveys)
        platform = feed_info.get("platform", "RSS")

        try:
            feed = feedparser.parse(url)
            count = 0
            for entry in feed.entries[:MAX_ITEMS_PER_FEED]:
                published = _parse_published(entry)
                if published < cutoff:
                    continue

                title = _clean_text(entry.get("title", ""), 200)
                summary_raw = entry.get("summary", entry.get("description", ""))
                summary_clean = _clean_text(summary_raw, 500)
                link = entry.get("link", "")

                if not title:
                    continue

                signals.append({
                    "title": f"{label}: {title}",
                    "source_platform": platform,
                    "source_url": link,
                    "raw_content": f"[{label} / {category}] {title} — {summary_clean}",
                    "summary": f"{title} (via {label})",
                    "_category": category,
                })
                count += 1

            logger.debug(f"{label}: {count} items in last {max_age_hours}h")
            time.sleep(0.5)

        except Exception as e:
            logger.warning(f"Failed to parse {label} ({url}): {e}")

    logger.info(f"RSS: collected {len(signals)} signals")
    return signals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = collect()
    print(f"\nCollected {len(results)} signals")
    for s in results[:8]:
        print(f"  [{s.get('_category', '?')}] {s['title'][:80]}")
