"""
reddit_collector.py
-------------------
Pulls trending/hot posts from a curated list of culturally-relevant subreddits.
Uses PRAW if Reddit API credentials are present; falls back to public JSON endpoint.

Reddit API credentials (optional — set in .env for higher rate limits):
    REDDIT_CLIENT_ID
    REDDIT_CLIENT_SECRET
    REDDIT_USER_AGENT  (default: "CulturalForecaster/1.0")
"""

import os
import json
import time
import logging
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(override=True)
logger = logging.getLogger(__name__)

# Subreddits to monitor for cultural signals
SUBREDDITS = [
    # ── High-volume culture signals ───────────────────────────────────────────
    "popular",
    "OutOfTheLoop",
    "TikTokCringe",
    "HobbyDrama",
    "InternetIsBeautiful",
    # ── Entertainment & celebrity ─────────────────────────────────────────────
    "entertainment",
    "popculturechat",
    "celebrity",
    "Fauxmoi",              # Blind items + celebrity insider culture
    "moviescirclejerk",     # Film culture commentary
    "television",           # TV discourse
    "Music",                # Music culture broadly
    # ── Social/cultural commentary ────────────────────────────────────────────
    "NoStupidQuestions",
    "AskReddit",
    "unpopularopinion",
    "changemyview",
    "TrueOffMyChest",       # Real feelings about cultural pressures
    # ── Work, money & economy ────────────────────────────────────────────────
    "antiwork",
    "latestagecapitalism",
    "PersonalFinance",      # Financial anxiety signals
    "povertyfinance",       # Lower-income economic realities
    "WorkReform",
    # ── Identity, gender & generational ─────────────────────────────────────
    "GenZ",                 # Gen Z perspectives (self-reported)
    "Millennials",          # Millennial perspectives
    "AskWomenOver30",       # Women's life-stage signals
    "AskMenOver30",         # Men's life-stage signals
    "TwoXChromosomes",      # Women's issues — cultural pressure points
    # ── Fashion & aesthetics ──────────────────────────────────────────────────
    "femalefashionadvice",  # Accessible fashion culture
    "malefashionadvice",    # Men's fashion culture
    "streetwear",           # Hype + streetwear culture
    # ── Tech/future ───────────────────────────────────────────────────────────
    "technology",
    "artificial",
    "ChatGPT",
    "AIArt",                # AI creative culture
    # ── Wellness, food & lifestyle ────────────────────────────────────────────
    "LifeAdvice",
    "relationship_advice",  # Interpersonal dynamics = cultural proxy
    "StopDrinking",         # Sober curious movement
    "CleanEating",
    # ── Advertising adjacent ─────────────────────────────────────────────────
    "advertising",
    "marketing",
    "mildlyinfuriating",    # Consumer frustration signals
    "firstworldproblems",   # Privilege/consumer culture signals
]

MIN_UPVOTES = 500  # Minimum upvotes to include a post
POSTS_PER_SUB = 10


def _get_posts_public(subreddit: str, limit: int = 10, sort: str = "hot") -> list:
    """Fetch posts via Reddit's public JSON endpoint (no auth required)."""
    url = f"https://www.reddit.com/r/{subreddit}/{sort}.json"
    headers = {"User-Agent": os.getenv("REDDIT_USER_AGENT", "CulturalForecaster/1.0")}
    try:
        resp = requests.get(url, headers=headers, params={"limit": limit}, timeout=10)
        if resp.status_code == 429:
            logger.warning(f"Reddit rate limit hit for r/{subreddit}, sleeping 10s")
            time.sleep(10)
            return []
        resp.raise_for_status()
        data = resp.json()
        return data["data"]["children"]
    except Exception as e:
        logger.warning(f"Failed to fetch r/{subreddit}: {e}")
        return []


def _get_posts_praw(subreddit: str, limit: int = 10) -> list:
    """Fetch posts via PRAW (requires API credentials)."""
    try:
        import praw
        reddit = praw.Reddit(
            client_id=os.getenv("REDDIT_CLIENT_ID"),
            client_secret=os.getenv("REDDIT_CLIENT_SECRET"),
            user_agent=os.getenv("REDDIT_USER_AGENT", "CulturalForecaster/1.0"),
        )
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
        logger.warning(f"PRAW failed: {e}")
        return []


def _format_post_public(post_data: dict, subreddit: str) -> dict:
    """Convert Reddit public JSON post to signal dict."""
    d = post_data.get("data", {})
    created = datetime.fromtimestamp(d.get("created_utc", 0), tz=timezone.utc).isoformat()
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


def collect() -> list:
    """
    Collect Reddit signals from monitored subreddits.
    Returns list of signal dicts.
    """
    logger.info("Collecting Reddit signals...")
    use_praw = bool(os.getenv("REDDIT_CLIENT_ID") and os.getenv("REDDIT_CLIENT_SECRET"))
    signals = []

    for i, subreddit in enumerate(SUBREDDITS):
        if use_praw:
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
            raw_posts = _get_posts_public(subreddit, limit=POSTS_PER_SUB)
            for post in raw_posts:
                formatted = _format_post_public(post, subreddit)
                if formatted["_score"] >= MIN_UPVOTES:
                    formatted.pop("_score")
                    signals.append(formatted)
            # Rate limiting for public API: ~1 req/2s
            if i < len(SUBREDDITS) - 1:
                time.sleep(2)

    logger.info(f"Reddit: collected {len(signals)} signals")
    return signals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = collect()
    print(f"\nCollected {len(results)} signals")
    for s in results[:5]:
        print(f"  - {s['title'][:80]}")
        print(f"    {s['summary'][:100]}")
