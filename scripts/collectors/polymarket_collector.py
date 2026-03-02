"""
polymarket_collector.py
-----------------------
Collects prediction market signals from Polymarket's public Gamma API.
No authentication required. Free, public, read-only.

Two signal types (per sources.md §F):
  1. Attention Anchors — high-volume events with upcoming resolution dates
     (scheduled moments that will concentrate public attention)
  2. Volatility Radar — markets with large recent price moves
     (early warning that "something is brewing")

Polymarket Gamma API: https://gamma-api.polymarket.com
Docs: https://docs.polymarket.com/

Filters out crypto price prediction, esports, and sports betting noise
to focus on culturally-relevant markets (politics, geopolitics, economy,
legal, awards, social issues).
"""

from __future__ import annotations

import time
import logging
import requests
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

GAMMA_API = "https://gamma-api.polymarket.com"

# ── Thresholds ────────────────────────────────────────────────────────────────

# Minimum 24h volume (USD) for a market to qualify as an attention anchor
MIN_VOLUME_24H = 50_000

# Minimum absolute price change (0-1 scale) to qualify as a volatility signal
# 0.05 = 5 percentage point move in a day — meaningful shift in probability
MIN_PRICE_CHANGE = 0.05

# Maximum events to fetch per API call
MAX_EVENTS = 100

# Maximum signals to return (prevent flooding the pipeline)
MAX_SIGNALS = 30

# How far out to look for resolution dates (attention anchors)
MAX_LOOKAHEAD_DAYS = 90

# ── Noise filters ─────────────────────────────────────────────────────────────
# These patterns produce high volume on Polymarket but are noise for cultural
# forecasting. Crypto price bets and esports have no cultural signal value.

NOISE_PATTERNS = [
    # Crypto price speculation
    "bitcoin", "ethereum", "solana", "dogecoin", "crypto", "memecoin",
    "price will", "price hit", "btc", "eth ",
    # Esports / sports betting minutiae
    "bo3", "counter-strike", "goalscorer", "kills over", "total kills",
    "map winner", "round handicap",
    # Mainstream sports betting (high volume, low cultural signal)
    " nba ", " nfl ", " mlb ", " nhl ", "premier league", "champions league",
    "world cup", "super bowl winner", " mvp ", "championship",
    "world series", "stanley cup", "ballon d'or", "grand slam",
    # Weather / natural disaster gambling
    "category 5", "hurricane", "earthquake magnitude",
    # Tweet counting (no cultural value)
    "# tweets", "number of tweets",
    # Meta-market noise
    "jesus christ return",
]


def _is_noise(title: str) -> bool:
    """Return True if this event title matches a noise pattern."""
    t = title.lower()
    return any(pattern in t for pattern in NOISE_PATTERNS)


def _format_probability(prices_str: str) -> str:
    """Convert outcomePrices JSON string to readable probability."""
    try:
        import json
        prices = json.loads(prices_str)
        if len(prices) >= 1:
            prob = float(prices[0])
            return f"{prob:.0%}"
    except Exception:
        pass
    return "?"


def _get_top_mover(markets: list) -> dict | None:
    """Find the market with the largest absolute 1-day price change."""
    best = None
    best_change = 0
    for m in markets:
        change = abs(float(m.get("oneDayPriceChange", 0) or 0))
        if change > best_change:
            best_change = change
            best = m
    return best


def collect() -> list:
    """
    Collect Polymarket signals: attention anchors + volatility radar.
    Returns list of signal dicts.
    """
    logger.info("Collecting Polymarket signals...")
    signals = []
    seen_slugs = set()

    now = datetime.now(timezone.utc)
    lookahead_cutoff = now + timedelta(days=MAX_LOOKAHEAD_DAYS)

    # ── Fetch active events (grouped markets) ─────────────────────────────
    try:
        resp = requests.get(
            f"{GAMMA_API}/events",
            params={
                "active": "true",
                "closed": "false",
                "limit": MAX_EVENTS,
                "order": "volume",
                "ascending": "false",
            },
            timeout=15,
        )
        resp.raise_for_status()
        events = resp.json()
    except Exception as e:
        logger.warning(f"Polymarket API failed: {e}")
        return []

    logger.debug(f"Polymarket: fetched {len(events)} events")

    for event in events:
        title = event.get("title", "").strip()
        slug = event.get("slug", "")
        end_date_str = event.get("endDate", "")
        markets = event.get("markets", [])

        if not title or not markets:
            continue

        # Skip noise
        if _is_noise(title):
            continue

        # Skip if already seen
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)

        # Compute aggregate 24h volume across all markets in this event
        total_vol_24h = sum(float(m.get("volume24hr", 0) or 0) for m in markets)

        # Find the top mover (biggest 1-day price change)
        top_mover = _get_top_mover(markets)
        top_change = abs(float(top_mover.get("oneDayPriceChange", 0) or 0)) if top_mover else 0

        # Parse end date for attention anchor classification
        end_date = None
        if end_date_str:
            try:
                end_date = datetime.fromisoformat(end_date_str.replace("Z", "+00:00"))
            except Exception:
                pass

        # Determine signal type
        is_anchor = (
            total_vol_24h >= MIN_VOLUME_24H
            and end_date is not None
            and end_date <= lookahead_cutoff
        )
        is_volatile = top_change >= MIN_PRICE_CHANGE

        if not is_anchor and not is_volatile:
            continue

        # Build the signal
        event_url = f"https://polymarket.com/event/{slug}"
        n_markets = len(markets)

        # Determine the lead market (highest volume) for probability display
        lead_market = max(markets, key=lambda m: float(m.get("volume24hr", 0) or 0))
        lead_prob = _format_probability(lead_market.get("outcomePrices", "[]"))
        lead_question = lead_market.get("question", title)

        # Build descriptive content
        parts = [f"[Polymarket] {title}"]

        if is_anchor and is_volatile:
            signal_type = "Attention Anchor + Volatility"
        elif is_anchor:
            signal_type = "Attention Anchor"
        else:
            signal_type = "Volatility Radar"

        parts.append(f"Signal: {signal_type}")
        parts.append(f"24h volume: ${total_vol_24h:,.0f}")

        if end_date:
            days_until = (end_date - now).days
            if days_until >= 0:
                parts.append(f"Resolves in {days_until} days ({end_date.strftime('%b %d')})")
            else:
                parts.append(f"Resolution date passed ({end_date.strftime('%b %d')})")

        if top_mover and top_change >= 0.01:
            mover_name = top_mover.get("groupItemTitle") or top_mover.get("question", "")[:40]
            direction = "↑" if float(top_mover.get("oneDayPriceChange", 0) or 0) > 0 else "↓"
            parts.append(f"Biggest move: {mover_name} {direction}{top_change:.1%}")

        parts.append(f"Lead market: {lead_question[:80]} — {lead_prob}")
        parts.append(f"{n_markets} markets in this event")

        raw_content = " — ".join(parts)

        # Title prefix based on signal type
        if is_volatile and top_change >= 0.10:
            prefix = "⚡ Polymarket"
        elif is_anchor:
            prefix = "Polymarket"
        else:
            prefix = "Polymarket"

        signals.append({
            "title": f"{prefix}: {title}",
            "source_platform": "Prediction Market",
            "source_url": event_url,
            "raw_content": raw_content,
            "summary": (
                f"{title} — ${total_vol_24h:,.0f} 24h vol"
                + (f", {top_change:+.0%} move" if top_change >= MIN_PRICE_CHANGE else "")
                + (f", resolves {end_date.strftime('%b %d')}" if end_date else "")
            ),
            "_category": "Prediction Market",
        })

    # Sort by 24h volume (implicit in raw_content) — highest signal first
    # Truncate to prevent flooding
    signals = signals[:MAX_SIGNALS]

    logger.info(f"Polymarket: {len(signals)} signals ({len(events)} events scanned)")
    return signals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = collect()
    print(f"\nCollected {len(results)} Polymarket signals")
    for s in results:
        print(f"  {s['title'][:90]}")
        print(f"    {s['summary'][:100]}")
        print()
