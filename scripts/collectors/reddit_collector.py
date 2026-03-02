"""
reddit_collector.py
-------------------
Pulls trending/hot posts from a curated list of culturally-relevant subreddits.

Three collection modes (in priority order):
  1. PRAW (authenticated API) — if REDDIT_CLIENT_ID + SECRET are set
  2. RSS feeds — no auth, works on cloud IPs, no upvote counts
  3. Public JSON — last resort, blocked on most cloud IPs since 2024

Reddit API credentials (optional — set in .env for higher rate limits):
    REDDIT_CLIENT_ID
    REDDIT_CLIENT_SECRET
    REDDIT_USER_AGENT  (default: "CulturalForecaster/1.0")
"""

import os
import time
import logging
import requests
import feedparser
from datetime import datetime, timezone
from html import unescape
import re

from dotenv import load_dotenv

load_dotenv(override=True)
logger = logging.getLogger(__name__)

# Subreddits to monitor for cultural signals
# Curated for cultural forecasting — signals about how people think, feel,
# spend, and behave. Not just "what's popular" but "what's shifting."
# Last audited: 2026-03-01. Review quarterly.
SUBREDDITS = [
    # ── Trend surfaces (high-volume, what's breaking now) ─────────────────
    "OutOfTheLoop",         # "Why is everyone talking about X?" = trend detection gold
    "TikTokCringe",         # Viral content that crosses platforms
    "HobbyDrama",           # Deep community conflict = cultural pressure
    # ── Entertainment & culture ───────────────────────────────────────────
    "popculturechat",       # Celebrity/entertainment discourse
    "Fauxmoi",              # Blind items + celebrity insider culture
    "television",           # TV discourse (shared cultural experiences)
    "movies",               # Film discourse + box office culture
    "gaming",               # Massive cultural surface area, 40M+ members
    "books",                # BookTok/literary culture crossover
    # ── Social commentary & shifting norms ────────────────────────────────
    "NoStupidQuestions",    # Genuine confusion = norm shifts in progress
    "unpopularopinion",     # Overton window movement detector
    "changemyview",         # Where people actually engage across divides
    "AskReddit",            # Mass opinion surface
    # ── Race, gender & identity ───────────────────────────────────────────
    "BlackPeopleTwitter",   # Black cultural commentary + viral takes
    "TwoXChromosomes",      # Women's issues — cultural pressure points
    "GenZ",                 # Gen Z self-reported perspectives
    # ── Work & economic anxiety ───────────────────────────────────────────
    "antiwork",             # Labor movement sentiment
    # ── Consumer culture & spending ───────────────────────────────────────
    "BuyItForLife",         # Anti-disposable, quality-seeking consumers
    "mildlyinfuriating",    # Consumer frustration signals (huge sub)
    # ── Tech, AI & the future ─────────────────────────────────────────────
    "technology",           # Tech industry + society intersection
    "ChatGPT",              # AI adoption in daily life
    "Futurology",           # Where society thinks it's headed
    # ── Wellness, health & lifestyle ──────────────────────────────────────
    "relationship_advice",  # Interpersonal dynamics = cultural proxy
    "collapse",             # Doomer sentiment + systemic anxiety
    "MadeMeSmile",          # Viral positivity — counterweight signal
    # ── Advertising & marketing ───────────────────────────────────────────
    "advertising",          # Ad culture + brand discourse
]

MIN_UPVOTES = 500       # Minimum upvotes to include a post (PRAW/JSON only)
POSTS_PER_SUB = 10      # PRAW/JSON mode
POSTS_PER_SUB_RSS = 5   # RSS mode — no engagement filter, so cap volume
MIN_TITLE_LENGTH = 15   # Skip very short titles (likely memes/low-content) in RSS mode

# ── RSS helpers ──────────────────────────────────────────────────────────────

_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    """Strip HTML tags and unescape entities."""
    return unescape(_TAG_RE.sub("", text)).strip()


def _get_posts_rss(subreddit: str, limit: int = 10) -> list:
    """Fetch hot posts via Reddit RSS feed. No auth, no rate limit issues."""
    url = f"https://www.reddit.com/r/{subreddit}/hot/.rss"
    try:
        feed = feedparser.parse(
            url,
            request_headers={
                "User-Agent": os.getenv("REDDIT_USER_AGENT", "CulturalForecaster/1.0")
            },
        )
        if feed.bozo and not feed.entries:
            logger.warning(f"RSS failed for r/{subreddit}: {feed.bozo_exception}")
            return []

        posts = []
        for entry in feed.entries[:limit]:
            title = entry.get("title", "").strip()
            if not title:
                continue

            # Extract text content from the RSS entry
            content_html = ""
            if entry.get("content"):
                content_html = entry.content[0].get("value", "")
            elif entry.get("summary"):
                content_html = entry.summary
            content_text = _strip_html(content_html)[:500]

            link = entry.get("link", "")

            posts.append({
                "title": title,
                "link": link,
                "content": content_text,
            })
        return posts
    except Exception as e:
        logger.warning(f"RSS failed for r/{subreddit}: {e}")
        return []


def _format_post_rss(post: dict, subreddit: str) -> dict:
    """Convert RSS post to signal dict."""
    title = post["title"]
    content = post.get("content", "")
    link = post.get("link", "")

    return {
        "title": f"Reddit r/{subreddit}: {title[:80]}",
        "source_platform": "Reddit",
        "source_url": link,
        "raw_content": (
            f"r/{subreddit} [hot post via RSS] — {title}"
            + (f" — {content[:300]}" if content else "")
        ),
        "summary": f"Hot post in r/{subreddit}: '{title}'",
    }


# ── PRAW (authenticated API) ────────────────────────────────────────────────

_praw_instance = None


def _get_praw():
    """Get or create a reusable PRAW Reddit instance."""
    global _praw_instance
    if _praw_instance is None:
        import praw
        _praw_instance = praw.Reddit(
            client_id=os.getenv("REDDIT_CLIENT_ID"),
            client_secret=os.getenv("REDDIT_CLIENT_SECRET"),
            user_agent=os.getenv("REDDIT_USER_AGENT", "CulturalForecaster/1.0"),
        )
    return _praw_instance


def _get_posts_praw(subreddit: str, limit: int = 10) -> list:
    """Fetch posts via PRAW (requires API credentials)."""
    try:
        reddit = _get_praw()
        posts = []
        for submission in reddit.subreddit(subreddit).hot(limit=limit):
            posts.append({
                "title": submission.title,
                "score": submission.score,
                "num_comments": submission.num_comments,
                "url": f"https://reddit.com{submission.permalink}",
                "selftext": submission.selftext[:500] if submission.selftext else "",
                "created_utc": submission.created_utc,
            })
        return posts
    except Exception as e:
        logger.warning(f"PRAW failed for r/{subreddit}: {e}")
        return []


# ── Public JSON (legacy fallback) ───────────────────────────────────────────

def _get_posts_public(subreddit: str, limit: int = 10, sort: str = "hot") -> list:
    """Fetch posts via Reddit's public JSON endpoint (no auth required)."""
    url = f"https://www.reddit.com/r/{subreddit}/{sort}.json"
    headers = {"User-Agent": os.getenv("REDDIT_USER_AGENT", "CulturalForecaster/1.0")}
    try:
        resp = requests.get(url, headers=headers, params={"limit": limit}, timeout=10)
        if resp.status_code == 429:
            logger.warning(f"Reddit rate limit hit for r/{subreddit}, retrying in 5s")
            time.sleep(5)
            resp = requests.get(url, headers=headers, params={"limit": limit}, timeout=10)
            if resp.status_code == 429:
                return []
        resp.raise_for_status()
        data = resp.json()
        return data["data"]["children"]
    except Exception as e:
        logger.warning(f"JSON failed for r/{subreddit}: {e}")
        return []


def _format_post_public(post_data: dict, subreddit: str) -> dict:
    """Convert Reddit public JSON post to signal dict."""
    d = post_data.get("data", {})
    return {
        "title": f"Reddit r/{subreddit}: {d.get('title', '')[:80]}",
        "source_platform": "Reddit",
        "source_url": f"https://reddit.com{d.get('permalink', '')}",
        "raw_content": (
            f"r/{subreddit} [{d.get('score', 0):,} upvotes, "
            f"{d.get('num_comments', 0):,} comments] — "
            f"{d.get('title', '')} — {d.get('selftext', '')[:300]}"
        ),
        "summary": (
            f"Hot post in r/{subreddit} with {d.get('score', 0):,} upvotes: "
            f"'{d.get('title', '')}'"
        ),
        "_score": d.get("score", 0),
    }


# ── Main collector ───────────────────────────────────────────────────────────

def collect() -> list:
    """
    Collect Reddit signals from monitored subreddits.

    Priority: PRAW > RSS > public JSON.
    PRAW gives upvote counts for filtering. RSS works everywhere but has no
    engagement metrics. Public JSON is blocked on most cloud IPs.
    """
    logger.info("Collecting Reddit signals...")
    use_praw = bool(os.getenv("REDDIT_CLIENT_ID") and os.getenv("REDDIT_CLIENT_SECRET"))

    if use_praw:
        logger.info("Reddit: using PRAW (authenticated API)")
    else:
        logger.info("Reddit: using RSS feeds (no API credentials)")

    signals = []
    rss_failures = 0

    for i, subreddit in enumerate(SUBREDDITS):
        if use_praw:
            # ── PRAW path: full metadata, upvote filtering ──────────────
            posts = _get_posts_praw(subreddit, limit=POSTS_PER_SUB)
            for p in posts:
                if p.get("score", 0) >= MIN_UPVOTES:
                    signals.append({
                        "title": f"Reddit r/{subreddit}: {p['title'][:80]}",
                        "source_platform": "Reddit",
                        "source_url": p.get("url", ""),
                        "raw_content": (
                            f"r/{subreddit} [{p['score']:,} upvotes, "
                            f"{p['num_comments']:,} comments] — {p['title']}"
                        ),
                        "summary": (
                            f"Hot post in r/{subreddit} with {p['score']:,} upvotes: "
                            f"'{p['title']}'"
                        ),
                    })
        else:
            # ── RSS path: no upvotes, but works on cloud IPs ────────────
            posts = _get_posts_rss(subreddit, limit=POSTS_PER_SUB_RSS)
            if posts:
                for post in posts:
                    # Skip very short titles (likely memes/low-content)
                    if len(post.get("title", "")) < MIN_TITLE_LENGTH:
                        continue
                    signals.append(_format_post_rss(post, subreddit))
            else:
                rss_failures += 1

            # Gentle rate limiting: ~2 req/s for RSS
            if i < len(SUBREDDITS) - 1:
                time.sleep(0.5)

    if rss_failures > 0:
        logger.warning(f"Reddit RSS: {rss_failures}/{len(SUBREDDITS)} subreddits failed")

    logger.info(f"Reddit: collected {len(signals)} signals")
    return signals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = collect()
    print(f"\nCollected {len(results)} signals")
    for s in results[:10]:
        print(f"  - {s['title'][:80]}")
        print(f"    {s['summary'][:100]}")
