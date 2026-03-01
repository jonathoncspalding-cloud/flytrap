/**
 * MomentsWidget — The flagship cultural moments forecaster widget.
 * Shows predicted cultural moments organized by time horizon.
 * Designed to sit at the very top of the dashboard.
 */
"use client";

import Link from "next/link";
import { CulturalMoment } from "@/lib/notion";

// ── Visual constants ─────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  Catalyst:  { icon: "⚡", color: "#FF8200", bg: "rgba(255,130,0,0.1)" },
  Collision: { icon: "💥", color: "#E8127A", bg: "rgba(232,18,122,0.1)" },
  Pressure:  { icon: "🌊", color: "#2a8c4a", bg: "rgba(0,79,34,0.1)" },
  Pattern:   { icon: "🔄", color: "rgba(232,18,122,0.7)", bg: "rgba(232,18,122,0.1)" },
  Void:      { icon: "🕳️", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; pulse?: boolean }> = {
  Predicted:  { label: "Predicted", color: "rgba(232,18,122,0.7)", bg: "rgba(232,18,122,0.12)" },
  Forming:    { label: "Forming", color: "#FF8200", bg: "rgba(255,130,0,0.12)", pulse: true },
  Happening:  { label: "Happening", color: "#E8127A", bg: "rgba(232,18,122,0.15)", pulse: true },
};

const HORIZON_CONFIG: Record<string, { label: string; color: string; accent: string }> = {
  "This Week":  { label: "This Week", color: "#E8127A", accent: "rgba(232,18,122,0.3)" },
  "2-4 Weeks":  { label: "2-4 Weeks", color: "#FF8200", accent: "rgba(255,130,0,0.3)" },
  "1-3 Months": { label: "1-3 Months", color: "rgba(232,18,122,0.7)", accent: "rgba(232,18,122,0.3)" },
};

function confidenceColor(c: number): string {
  if (c >= 75) return "#2a8c4a";
  if (c >= 50) return "#FF8200";
  if (c >= 25) return "rgba(232,18,122,0.7)";
  return "rgba(255,255,255,0.3)";
}

function magnitudeLabel(m: number): string {
  if (m >= 80) return "Seismic";
  if (m >= 60) return "Major";
  if (m >= 40) return "Significant";
  if (m >= 20) return "Notable";
  return "Minor";
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MomentCard({ moment }: { moment: CulturalMoment }) {
  const typeConf = TYPE_CONFIG[moment.type] || TYPE_CONFIG.Catalyst;
  const statusConf = STATUS_CONFIG[moment.status] || STATUS_CONFIG.Predicted;
  const horizonConf = HORIZON_CONFIG[moment.horizon] || HORIZON_CONFIG["2-4 Weeks"];

  return (
    <Link href={`/moments/${moment.id}`} style={{ textDecoration: "none" }}>
      <div
        className="card-hover"
        style={{
          background: "var(--surface)",
          border: `1px solid ${typeConf.color}22`,
          borderRadius: 10,
          padding: 16,
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: `linear-gradient(90deg, ${typeConf.color}, ${typeConf.color}33)`,
          }}
        />

        {/* Header: badges */}
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 10,
            alignItems: "center",
          }}
        >
          {/* Type badge */}
          <span
            style={{
              fontSize: 11,
              padding: "2px 7px",
              borderRadius: 4,
              background: typeConf.bg,
              color: typeConf.color,
              fontWeight: 500,
            }}
          >
            {typeConf.icon} {moment.type}
          </span>
          {/* Status badge */}
          <span
            style={{
              fontSize: 11,
              padding: "2px 7px",
              borderRadius: 4,
              background: statusConf.bg,
              color: statusConf.color,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {statusConf.pulse && (
              <span
                className="pulse-dot"
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: statusConf.color,
                  display: "inline-block",
                }}
              />
            )}
            {statusConf.label}
          </span>
          {/* Horizon badge */}
          <span
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(255,255,255,0.04)",
              color: horizonConf.color,
              fontWeight: 500,
            }}
          >
            {horizonConf.label}
          </span>
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-primary)",
            lineHeight: 1.35,
            margin: "0 0 6px",
          }}
        >
          {moment.name}
        </h3>

        {/* Narrative */}
        <p
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.55,
            margin: "0 0 10px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          } as React.CSSProperties}
        >
          {moment.narrative}
        </p>

        {/* Footer: confidence + magnitude */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {/* Confidence bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <span
              style={{
                fontSize: 10,
                color: "var(--text-tertiary)",
                whiteSpace: "nowrap",
              }}
            >
              Confidence
            </span>
            <div
              style={{
                height: 3,
                flex: 1,
                maxWidth: 60,
                background: "var(--border-strong)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${moment.confidence}%`,
                  height: "100%",
                  background: confidenceColor(moment.confidence),
                  borderRadius: 2,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: confidenceColor(moment.confidence),
              }}
            >
              {moment.confidence}
            </span>
          </div>

          {/* Magnitude */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              {magnitudeLabel(moment.magnitude)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
              M{moment.magnitude}
            </span>
          </div>
        </div>

        {/* Window dates */}
        {moment.windowStart && (
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 6 }}>
            Window:{" "}
            {new Date(moment.windowStart + "T00:00:00").toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" }
            )}
            {moment.windowEnd && (
              <>
                {" "}
                &rarr;{" "}
                {new Date(moment.windowEnd + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric" }
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Sort helpers ─────────────────────────────────────────────────────────────

const STATUS_RANK: Record<string, number> = { Happening: 0, Forming: 1, Predicted: 2 };
const HORIZON_RANK: Record<string, number> = { "This Week": 0, "2-4 Weeks": 1, "1-3 Months": 2 };

function sortMoments(moments: CulturalMoment[]): CulturalMoment[] {
  return [...moments].sort((a, b) => {
    const statusDiff = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    const horizonDiff = (HORIZON_RANK[a.horizon] ?? 9) - (HORIZON_RANK[b.horizon] ?? 9);
    if (horizonDiff !== 0) return horizonDiff;
    return b.confidence - a.confidence;
  });
}

// ── Main Widget ──────────────────────────────────────────────────────────────

interface MomentsWidgetProps {
  moments: CulturalMoment[];
  compact?: boolean;
}

export default function MomentsWidget({ moments, compact = false }: MomentsWidgetProps) {
  if (!moments || moments.length === 0) {
    return (
      <section style={{ marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 3,
              height: 18,
              borderRadius: 2,
              background: "#FF8200",
              flexShrink: 0,
            }}
          />
          <h2
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-secondary)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Predicted Moments
          </h2>
        </div>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "32px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 10 }}>🔮</div>
          <p
            style={{
              color: "var(--text-tertiary)",
              fontSize: 13,
              margin: "0 0 6px",
            }}
          >
            No moment predictions yet.
          </p>
          <code
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.04)",
              padding: "3px 8px",
              borderRadius: 4,
            }}
          >
            python3 scripts/run_pipeline.py --moments
          </code>
        </div>
      </section>
    );
  }

  const sorted = sortMoments(moments);

  // Count active
  const formingOrHappening = moments.filter(
    (m) => m.status === "Forming" || m.status === "Happening"
  );

  // Horizon summary counts
  const horizonCounts = {
    "This Week": moments.filter((m) => m.horizon === "This Week").length,
    "2-4 Weeks": moments.filter((m) => m.horizon === "2-4 Weeks").length,
    "1-3 Months": moments.filter((m) => m.horizon === "1-3 Months").length,
  };

  /* ── Compact mode: condensed list for sidebar/dashboard cards ────────── */
  if (compact) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {sorted.slice(0, 3).map((m) => {
          const typeConf = TYPE_CONFIG[m.type] || TYPE_CONFIG.Catalyst;
          const statusConf = STATUS_CONFIG[m.status] || STATUS_CONFIG.Predicted;
          return (
            <Link key={m.id} href={`/moments/${m.id}`} style={{ textDecoration: "none" }}>
              <div
                className="row-hover"
                style={{
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 12 }}>{typeConf.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
                    {m.name}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 22 }}>
                  <span style={{
                    fontSize: 10, padding: "1px 5px", borderRadius: 3,
                    background: statusConf.bg, color: statusConf.color, fontWeight: 600,
                  }}>
                    {statusConf.label}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                    {m.horizon}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: confidenceColor(m.confidence) }}>
                    {m.confidence}%
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
        {sorted.length > 3 && (
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", textAlign: "center", padding: "4px 0" }}>
            +{sorted.length - 3} more predictions
          </div>
        )}
      </div>
    );
  }

  return (
    <section style={{ marginBottom: 28 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 3,
              height: 18,
              borderRadius: 2,
              background: "#FF8200",
              flexShrink: 0,
            }}
          />
          <div>
            <h2
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-secondary)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              Predicted Moments
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-tertiary)",
                margin: "2px 0 0",
              }}
            >
              Cultural moments forecasted before they happen
              {" · "}
              <Link
                href="/moments/methodology"
                style={{
                  color: "rgba(255,130,0,0.6)",
                  textDecoration: "none",
                  fontSize: 11,
                }}
                className="link-hover"
              >
                How we predict →
              </Link>
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {formingOrHappening.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(232,18,122,0.08)",
                border: "1px solid rgba(232,18,122,0.2)",
                borderRadius: 8,
                padding: "4px 9px",
              }}
            >
              <span
                className="pulse-dot"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#E8127A",
                  display: "inline-block",
                }}
              />
              <span
                style={{ fontSize: 11, fontWeight: 700, color: "#E8127A" }}
              >
                {formingOrHappening.length} forming
              </span>
            </div>
          )}
          {/* Horizon summary pills */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {(Object.entries(horizonCounts) as [string, number][])
              .filter(([, count]) => count > 0)
              .map(([horizon, count]) => {
                const conf = HORIZON_CONFIG[horizon];
                return (
                  <span
                    key={horizon}
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: `${conf.color}12`,
                      color: conf.color,
                      fontWeight: 600,
                    }}
                  >
                    {count} {conf.label}
                  </span>
                );
              })}
          </div>
        </div>
      </div>

      {/* 2-column sorted grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: sorted.length === 1 ? "1fr" : "1fr 1fr",
          gap: 12,
        }}
      >
        {sorted.map((m) => (
          <MomentCard key={m.id} moment={m} />
        ))}
      </div>
    </section>
  );
}
