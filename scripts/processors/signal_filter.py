"""
signal_filter.py  (Tier 0)
--------------------------
Embedding-based pre-filter for raw signals. Uses a local sentence-transformer
model (all-MiniLM-L6-v2, ~80MB, CPU-only) to classify signals into three buckets
BEFORE any Claude API call:

  AUTO_LINK  — cosine similarity > 0.6 to an existing trend → skip Claude, auto-link
  DISCARD    — similarity < 0.25 to ALL trends AND tensions → noise, save minimal metadata
  AMBIGUOUS  — similarity 0.25-0.6 → needs Claude evaluation, pass to Tier 1 (Haiku triage)

Cost: $0.00 (runs locally). Runtime: ~2-5 seconds for 300 signals.
"""

import logging
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

logger = logging.getLogger(__name__)

# Lazy-load model to avoid import-time download
_model = None


def _get_model():
    global _model
    if _model is None:
        logger.info("Loading embedding model (all-MiniLM-L6-v2)...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Embedding model loaded.")
    return _model


# ── Thresholds (tune after observing results) ──────────────────────────────
AUTO_LINK_THRESHOLD = 0.60   # Above this → auto-link to best-matching trend
DISCARD_THRESHOLD   = 0.25   # Below this for ALL references → noise


def _signal_text(signal: dict) -> str:
    """Build a representative text string for embedding a signal."""
    title = signal.get("title", "")
    raw = signal.get("raw", "")
    return f"{title} {raw[:300]}".strip()


def _trend_text(trend: dict) -> str:
    """Build a representative text string for embedding a trend."""
    name = trend.get("name", "")
    summary = trend.get("summary", "")
    return f"{name}: {summary[:200]}".strip()


def _tension_text(tension: dict) -> str:
    """Build a representative text string for embedding a tension."""
    name = tension.get("name", "")
    desc = tension.get("description", "")
    return f"{name}: {desc[:200]}".strip()


def classify_signals(signals: list, trends: list, tensions: list) -> dict:
    """
    Classify raw signals into auto_link / discard / ambiguous buckets
    using embedding cosine similarity.

    Args:
        signals: list of signal dicts with 'id', 'title', 'raw', 'platform'
        trends: list of trend dicts with 'id', 'name', 'summary', 'cps'
        tensions: list of tension dicts with 'id', 'name', 'description'

    Returns:
        {
            "auto_link": [(signal, trend_name, trend_id, similarity_score), ...],
            "discard":   [signal, ...],
            "ambiguous":  [signal, ...],
        }
    """
    if not signals:
        return {"auto_link": [], "discard": [], "ambiguous": []}

    model = _get_model()

    # Build reference texts: trends + tensions
    trend_texts = [_trend_text(t) for t in trends]
    tension_texts = [_tension_text(t) for t in tensions]
    ref_texts = trend_texts + tension_texts

    if not ref_texts:
        # No reference data — everything is ambiguous (let Claude decide)
        logger.warning("Tier 0: No trends or tensions to compare against. All signals → ambiguous.")
        return {"auto_link": [], "discard": [], "ambiguous": list(signals)}

    # Embed signals and references
    signal_texts = [_signal_text(s) for s in signals]
    signal_embeddings = model.encode(signal_texts, show_progress_bar=False, batch_size=64)
    ref_embeddings = model.encode(ref_texts, show_progress_bar=False, batch_size=64)

    # Split reference embeddings back into trend vs tension
    n_trends = len(trend_texts)

    # Compute cosine similarity: signals × references
    sim_matrix = cosine_similarity(signal_embeddings, ref_embeddings)

    auto_link = []
    discard = []
    ambiguous = []

    for i, signal in enumerate(signals):
        sims = sim_matrix[i]

        # Best match across all references
        best_ref_idx = int(np.argmax(sims))
        best_score = float(sims[best_ref_idx])

        # Best match among trends only (for auto-linking)
        trend_sims = sims[:n_trends]
        best_trend_idx = int(np.argmax(trend_sims)) if n_trends > 0 else -1
        best_trend_score = float(trend_sims[best_trend_idx]) if n_trends > 0 else 0.0

        if best_trend_score >= AUTO_LINK_THRESHOLD:
            # High confidence match to an existing trend
            matched_trend = trends[best_trend_idx]
            auto_link.append((
                signal,
                matched_trend["name"],
                matched_trend["id"],
                best_trend_score,
            ))
        elif best_score < DISCARD_THRESHOLD:
            # No meaningful similarity to anything we track
            discard.append(signal)
        else:
            # In the gray zone — needs Claude to evaluate
            ambiguous.append(signal)

    logger.info(
        f"Tier 0 classification: {len(auto_link)} auto-linked, "
        f"{len(discard)} discarded, {len(ambiguous)} ambiguous → Tier 1"
    )

    return {"auto_link": auto_link, "discard": discard, "ambiguous": ambiguous}
