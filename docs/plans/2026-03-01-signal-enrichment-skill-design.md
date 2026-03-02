# Signal Enrichment Skill — Design Document

> Scout-native signal enrichment skill with two modes: gap coverage and deep dive. Approved 2026-03-01.

## Problem

Flytrap has 7 active collectors but known gaps: no X/Twitter (API cost), no prediction markets, no TikTok, no entertainment platform signals. Scout also lacks a structured protocol for investigating signals that look significant.

## Approach

Scout-native skill that borrows best concepts from last30days (multi-signal scoring, convergence detection) and Deep-Research (structured research phases) but outputs to Flytrap's existing Evidence Log schema. No external skill dependencies.

## Placement

- **Location:** `.claude/skills/signal-enrichment/SKILL.md`
- **Used by:** Scout only
- **Modes:** Gap coverage (pipeline integration) and deep dive (on-demand investigation)

## Gap Coverage

Four new source categories via web search (no paid APIs):
- **X/Twitter**: Viral tweets, discourse signals, stance distribution, key voices
- **Prediction Markets**: Polymarket/Kalshi/Metaculus odds, price movements, volume
- **TikTok Creative Center**: Trending sounds, aesthetic movements, format innovations
- **Entertainment**: Letterboxd, Goodreads, streaming charts — cultural mood indicators

All output matches existing Evidence Log schema with `source_type: "enrichment"` tag.

## Deep Dive

Three-phase structured investigation for significant signals:
1. **Scope**: Define signal, 3-5 questions, target platforms
2. **Multi-Platform Sweep**: Search, score relevance + engagement, track convergence
3. **Synthesis**: Structured brief with convergence assessment, flags for Oracle and Strategist

Tagged with `deep_dive: true` in Evidence Log. Limited to 2-3 per day for cost control.

## Integration

- Gap coverage runs with regular pipeline cadence
- Deep dive triggered by Scout judgment or cross-agent spawn requests
- Optimize consulted if enrichment adds >20% to daily pipeline cost
- Oracle receives convergence signals for collision detection
- Strategist receives narrative angles for briefings
