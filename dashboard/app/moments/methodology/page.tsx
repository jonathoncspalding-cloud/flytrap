import Link from "next/link";

export const metadata = {
  title: "Methodology — Cultural Moments Forecaster",
};

const PREDICTION_TYPES = [
  {
    icon: "⚡",
    name: "Catalyst",
    color: "#f59e0b",
    description:
      "A known upcoming event intersects with active cultural tensions to produce a specific, predictable outcome. The event is the spark; the tension is the fuel.",
    example:
      "The Oscars + rising AI anxiety = red carpet becomes an AI-detection battleground.",
  },
  {
    icon: "💥",
    name: "Collision",
    color: "#ef4444",
    description:
      "Two or more independently accelerating trends converge on a flashpoint. Neither trend alone would create the moment — it's the intersection that matters.",
    example:
      "AI job displacement fear + gig economy backlash = coordinated anti-automation protests.",
  },
  {
    icon: "🌊",
    name: "Pressure",
    color: "#3b82f6",
    description:
      "Signal velocity for a topic is accelerating beyond its baseline. The discourse is building toward a tipping point where a single trigger could cause a viral breakout.",
    example:
      "Growing frustration with subscription fatigue reaches critical mass, one viral post tips it into mainstream backlash.",
  },
  {
    icon: "🔄",
    name: "Pattern",
    color: "#8b5cf6",
    description:
      "A seasonal or cyclical event collides with current cultural context to produce a novel expression. The calendar provides the when; the cultural mood provides the what.",
    example:
      "St. Patrick's Day + 'little treat economy' trend = brands lean into mini-indulgence positioning.",
  },
  {
    icon: "🕳️",
    name: "Void",
    color: "#6b7280",
    description:
      "A conspicuous absence — something expected doesn't happen, and the absence itself becomes the story. These are the hardest to predict but often the most culturally significant.",
    example:
      "A major brand exits International Women's Day entirely, and the silence generates more coverage than participation would have.",
  },
];

const SCORING = [
  {
    label: "Confidence",
    range: "0–100",
    description:
      "How likely the moment is to actually materialize. Based on the strength and number of converging signals, velocity acceleration patterns, historical precedent, and quality of evidence. A score of 80+ means multiple independent data sources point to the same conclusion.",
    tiers: [
      { range: "75–100", color: "#4ade80", label: "High — strong convergent evidence" },
      { range: "50–74", color: "#fbbf24", label: "Medium — clear signals, some uncertainty" },
      { range: "25–49", color: "#818cf8", label: "Low — early pattern, watch closely" },
      { range: "0–24", color: "rgba(255,255,255,0.3)", label: "Speculative — weak signal" },
    ],
  },
  {
    label: "Magnitude",
    range: "0–100",
    description:
      "How big the cultural impact will be if it happens. Measures expected reach, engagement intensity, duration, and potential to shift brand/consumer behavior. Not about likelihood — about consequence.",
    tiers: [
      { range: "80–100", color: "#f87171", label: "Seismic — dominates cultural conversation" },
      { range: "60–79", color: "#fbbf24", label: "Major — widespread discussion, brand impact" },
      { range: "40–59", color: "#818cf8", label: "Significant — niche-to-mainstream crossover" },
      { range: "20–39", color: "rgba(255,255,255,0.5)", label: "Notable — relevant within its community" },
      { range: "0–19", color: "rgba(255,255,255,0.3)", label: "Minor — limited cultural footprint" },
    ],
  },
];

const HORIZONS = [
  { label: "This Week", color: "#f87171", window: "0–7 days", confidence: "Highest. Very specific predictions." },
  { label: "2–4 Weeks", color: "#fbbf24", window: "8–28 days", confidence: "Medium. Directional, less specific." },
  { label: "1–3 Months", color: "#818cf8", window: "29–90 days", confidence: "Lower. Thematic patterns." },
];

const LIFECYCLE = [
  { label: "Predicted", color: "#818cf8", description: "Forecasted based on signal analysis. Not yet showing real-world confirmation." },
  { label: "Forming", color: "#fbbf24", description: "Early real-world signals are confirming the prediction. Momentum is building." },
  { label: "Happening", color: "#f87171", description: "The moment is actively unfolding in culture. Real-time." },
  { label: "Passed", color: "rgba(255,255,255,0.3)", description: "The moment has concluded. Outcome can be evaluated." },
  { label: "Missed", color: "rgba(255,255,255,0.2)", description: "The prediction window closed without materialization." },
];

export default function MethodologyPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 80 }}>
      {/* Back link */}
      <Link
        href="/"
        style={{
          fontSize: 12,
          color: "var(--text-tertiary)",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: 24,
        }}
        className="link-hover"
      >
        &larr; Back to dashboard
      </Link>

      {/* Title */}
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "var(--text-primary)",
          margin: "0 0 8px",
          letterSpacing: "-0.02em",
        }}
      >
        How We Predict Cultural Moments
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-secondary)",
          lineHeight: 1.65,
          margin: "0 0 40px",
          maxWidth: 600,
        }}
      >
        The Cultural Moments Forecaster analyzes the intersection of cultural tensions,
        trend velocity, upcoming catalysts, and collision dynamics to predict moments
        before they happen.
      </p>

      {/* ── DATA SOURCES ─────────────────────────────────────────────── */}
      <Section title="Data Sources">
        <p style={proseStyle}>
          Predictions are grounded in real, continuously updated data — not speculation.
          Every day, the system collects signals from Reddit, Bluesky, Hacker News,
          YouTube, Google Trends, RSS feeds, and Wikipedia. These signals are processed
          into trends, tensions, and velocity patterns that form the evidence base
          for predictions.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 16,
          }}
        >
          {[
            { label: "Signal Velocity", desc: "Per-trend signal counts tracked daily — acceleration patterns reveal moments forming" },
            { label: "Cultural Tensions", desc: "Opposing forces in society (e.g., privacy vs. convenience) that fuel cultural flashpoints" },
            { label: "Trend Collisions", desc: "When independently accelerating trends share tensions, collision risk increases" },
            { label: "Cultural Calendar", desc: "Auto-collected upcoming events from 15+ RSS feeds — the catalysts that trigger moments" },
          ].map((d) => (
            <div
              key={d.label}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: 4,
                }}
              >
                {d.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                {d.desc}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── PREDICTION TYPES ─────────────────────────────────────────── */}
      <Section title="Prediction Types">
        <p style={proseStyle}>
          Every prediction is classified by how it forms. This determines what evidence
          is required and how the prediction should be evaluated.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {PREDICTION_TYPES.map((t) => (
            <div
              key={t.name}
              style={{
                background: "var(--surface)",
                border: `1px solid ${t.color}22`,
                borderRadius: 8,
                padding: "14px 16px",
                borderLeft: `3px solid ${t.color}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.color }}>{t.name}</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 8px" }}>
                {t.description}
              </p>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-tertiary)",
                  fontStyle: "italic",
                  paddingLeft: 12,
                  borderLeft: "2px solid rgba(255,255,255,0.06)",
                }}
              >
                e.g. {t.example}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── SCORING SYSTEM ─────────────────────────────────────────── */}
      <Section title="Scoring System">
        <p style={proseStyle}>
          Each prediction carries two independent scores. A moment can be high-confidence
          but low-magnitude (very likely, small impact) or low-confidence but high-magnitude
          (uncertain, but huge if it happens).
        </p>
        {SCORING.map((s) => (
          <div key={s.label} style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px" }}>
              {s.label} <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}>({s.range})</span>
            </h4>
            <p style={{ ...proseStyle, marginBottom: 10 }}>{s.description}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {s.tiers.map((tier) => (
                <div key={tier.range} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: tier.color,
                      width: 52,
                      flexShrink: 0,
                    }}
                  >
                    {tier.range}
                  </span>
                  <div
                    style={{
                      height: 3,
                      width: 40,
                      background: "rgba(255,255,255,0.08)",
                      borderRadius: 2,
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${parseInt(tier.range.split("–")[1]) || 100}%`,
                        background: tier.color,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{tier.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* ── TIME HORIZONS ─────────────────────────────────────────── */}
      <Section title="Time Horizons">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {HORIZONS.map((h) => (
            <div
              key={h.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: h.color,
                  width: 80,
                  flexShrink: 0,
                }}
              >
                {h.label}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", width: 70, flexShrink: 0 }}>
                {h.window}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{h.confidence}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── LIFECYCLE ─────────────────────────────────────────── */}
      <Section title="Moment Lifecycle">
        <p style={proseStyle}>
          Every prediction moves through a lifecycle as it either materializes or doesn't.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            margin: "16px 0",
          }}
        >
          {LIFECYCLE.map((l, i) => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: l.color,
                  background: `${l.color}15`,
                  padding: "3px 8px",
                  borderRadius: 4,
                }}
              >
                {l.label}
              </span>
              {i < LIFECYCLE.length - 1 && (
                <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>&rarr;</span>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {LIFECYCLE.map((l) => (
            <div key={l.label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: l.color, width: 72, flexShrink: 0 }}>
                {l.label}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                {l.description}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── LIMITATIONS ─────────────────────────────────────────── */}
      <Section title="Limitations">
        <p style={proseStyle}>
          This system predicts moments based on observable patterns in online discourse.
          It cannot predict truly random events (natural disasters, celebrity deaths, etc.).
          It works best when cultural energy is building visibly across multiple platforms —
          the moments where "everyone saw it coming, but only in hindsight."
          Confidence scores reflect honest uncertainty. A score of 60 means the system
          believes there's roughly a 60% chance of materialization, not that it's 60% sure
          of its analysis.
        </p>
      </Section>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const proseStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-secondary)",
  lineHeight: 1.65,
  margin: 0,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h3
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-tertiary)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          margin: "0 0 12px",
          paddingBottom: 8,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}
