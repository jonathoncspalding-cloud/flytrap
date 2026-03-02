"""
signal_triage.py  (Tier 1)
--------------------------
Haiku-based batch triage for ambiguous signals that the embedding filter
(Tier 0) couldn't confidently classify. Sends 30-40 signals per call to
Claude Haiku with a minimal prompt to score cultural relevance.

Signals scoring relevance >= 5 get promoted to Tier 2 (full Sonnet processing).
Signals scoring < 5 are triaged out — saved with minimal metadata, done.

Cost: ~$0.005-0.01 per call (Haiku pricing: $1/MTok input, $5/MTok output).
Typical run: 2-3 calls = ~$0.01-0.02/day.
"""

import os
import json
import logging

import anthropic

logger = logging.getLogger(__name__)

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

TRIAGE_BATCH_SIZE = 35  # 30-40 signals per Haiku call
RELEVANCE_THRESHOLD = 5  # Signals scoring >= 5 get promoted to Sonnet

TRIAGE_PROMPT = """You are a cultural signal filter. Rate each signal's cultural relevance on a 1-10 scale and suggest which existing trend it belongs to (or "new" if genuinely novel, or null if noise).

EXISTING TRENDS:
{trend_names}

SIGNALS:
{signals}

Respond with ONLY a JSON array, no other text:
[{{"idx": 0, "relevance": N, "trend": "trend name or null", "reason": "1 sentence"}}]

Scoring guide:
- 8-10: Directly intersects known cultural tensions, high urgency
- 5-7: Culturally relevant, worth deeper analysis
- 3-4: Marginal — touching culture but not strongly
- 1-2: Noise — sports scores, celebrity gossip, pure information"""


def triage_signals(signals: list, trends: list) -> tuple:
    """
    Triage ambiguous signals using Claude Haiku in batches.

    Args:
        signals: list of signal dicts (from Tier 0 ambiguous bucket)
        trends: list of trend dicts with 'name'

    Returns:
        (promoted, triaged) where:
            promoted: list of signal dicts that scored >= RELEVANCE_THRESHOLD
            triaged: list of (signal, triage_result) for signals scored < threshold
    """
    if not signals:
        return [], []

    trend_names = "\n".join(f"- {t['name']}" for t in trends)

    promoted = []
    triaged = []

    for batch_start in range(0, len(signals), TRIAGE_BATCH_SIZE):
        batch = signals[batch_start:batch_start + TRIAGE_BATCH_SIZE]

        signals_text = "\n".join(
            f"{i}. [{s.get('platform', '?')}] {s.get('title', '')[:100]}: {s.get('raw', '')[:150]}"
            for i, s in enumerate(batch)
        )

        prompt = TRIAGE_PROMPT.format(
            trend_names=trend_names,
            signals=signals_text,
        )

        try:
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )

            # Token usage logging
            usage = message.usage
            cost = usage.input_tokens * 1 / 1_000_000 + usage.output_tokens * 5 / 1_000_000
            logger.info(
                f"  [TOKENS] signal_triage batch: "
                f"input={usage.input_tokens} output={usage.output_tokens} "
                f"total={usage.input_tokens + usage.output_tokens} "
                f"cost=${cost:.4f}"
            )

            raw = message.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]

            results = json.loads(raw)
            if not isinstance(results, list):
                logger.warning("Haiku triage returned non-list — promoting all to Sonnet")
                promoted.extend(batch)
                continue

            for result in results:
                idx = result.get("idx", -1)
                if idx < 0 or idx >= len(batch):
                    continue

                signal = batch[idx]
                relevance = result.get("relevance", 0)

                if relevance >= RELEVANCE_THRESHOLD:
                    # Promote to Tier 2 (Sonnet)
                    promoted.append(signal)
                else:
                    # Triaged out — save with minimal metadata
                    triage_result = {
                        "summary": result.get("reason", "Low cultural relevance (triaged)"),
                        "sentiment": "Neutral",
                        "cps": 0,
                        "_triage_relevance": relevance,
                        "_triage_trend": result.get("trend"),
                    }
                    triaged.append((signal, triage_result))

        except json.JSONDecodeError as e:
            logger.warning(f"Haiku triage batch JSON error: {e} — promoting all to Sonnet")
            promoted.extend(batch)
        except Exception as e:
            logger.error(f"Haiku triage batch failed: {e} — promoting all to Sonnet")
            promoted.extend(batch)

    logger.info(
        f"Tier 1 triage: {len(promoted)} promoted to Sonnet, "
        f"{len(triaged)} triaged out"
    )

    return promoted, triaged
