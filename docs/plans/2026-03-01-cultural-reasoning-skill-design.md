# Cultural Reasoning Skill — Design Document

> Shared skill for Oracle and Strategist that teaches structured cultural analysis methodology. Approved 2026-03-01.

## Problem

Flytrap collects signals from 9 sources and scores them with CPS, but the interpretation layer is implicit — it lives in prompt templates rather than a structured reasoning framework. Oracle and Strategist need a shared cultural education that makes their analysis deeper and more systematic.

## Approach

**Approach A: Reasoning Framework** — teach the agents HOW to think about culture rather than adding more data sources. Signal enrichment stays in Scout's domain.

## Placement

- **Location:** `.claude/skills/cultural-reasoning/SKILL.md`
- **Used by:** Oracle (signal interpretation, CPS scoring, moment classification) and Strategist (briefing depth, cultural context, pattern recognition)
- **Trigger:** Activates during CPS scoring, moment classification, tension evaluation, briefing writing, and cross-trend pattern analysis

## Five Reasoning Lenses

### 1. Semiotic Reading
Decode what things mean, not just that they're trending. Four questions: What is the sign? What is the signified? What codes is it operating in? Is meaning stable or drifting?

### 2. Cultural Lifecycle Model
7-stage model: Undercurrent → Emergence → Acceleration → Peak → Saturation → Backlash → Residue. Lifecycle position directly affects CPS scoring and prediction confidence.

### 3. Tension Dialectics
Dialectical pairs (Authenticity/Performance, Nostalgia/Progress, Individual/Collective, etc.) that upgrade the existing single-tension model. Moments are most likely when balance shifts.

### 4. Cross-Domain Pattern Recognition
Convergence test: 3+ domains, same tension, same codes, similar lifecycle stage, similar time window, no obvious causal link → single cultural moment, high-confidence prediction.

### 5. Historical Pattern Templates
Recurring patterns (Moral Panic, Nostalgia Wave, Vibe Shift, Backlash Spiral, etc.) with known shapes. Pattern match increases prediction confidence.

## Agent Integration

**Oracle:** Lifecycle stage and semiotic depth become CPS scoring factors. Historical pattern matching improves moment type accuracy. Convergence test upgrades collision detection.

**Strategist:** Semiotic reading gives vocabulary for briefings. Historical templates provide precedent references. Lifecycle stage informs actionability timing.

**Shared vocabulary:** Both agents use identical terminology so Oracle's classifications flow cleanly into Strategist's briefings.
