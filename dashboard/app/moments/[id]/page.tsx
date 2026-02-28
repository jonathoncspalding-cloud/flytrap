import { notFound } from "next/navigation";
import Link from "next/link";
import { getMoment, getTrend, getTension, getUpcomingEvents, Trend, Tension, CalendarEvent } from "@/lib/notion";

export const revalidate = 300;

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; description: string }> = {
  Catalyst:  { icon: "⚡", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", description: "A known event collides with active cultural tensions to produce a predictable cultural outcome." },
  Collision: { icon: "💥", color: "#ef4444", bg: "rgba(239,68,68,0.1)", description: "Two or more converging trends are building toward an inevitable flashpoint." },
  Pressure:  { icon: "🌊", color: "#3b82f6", bg: "rgba(59,130,246,0.1)", description: "Signal velocity is accelerating toward a tipping point or breakout moment." },
  Pattern:   { icon: "🔄", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)", description: "A seasonal or cyclical pattern meeting novel cultural context." },
  Void:      { icon: "🕳️", color: "#6b7280", bg: "rgba(107,114,128,0.1)", description: "Something conspicuously absent from discourse — the absence itself may become the story." },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Predicted:  { label: "Predicted", color: "#818cf8", bg: "rgba(129,140,248,0.12)" },
  Forming:    { label: "Forming", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  Happening:  { label: "Happening Now", color: "#f87171", bg: "rgba(248,113,113,0.15)" },
  Passed:     { label: "Passed", color: "#4ade80", bg: "rgba(74,222,128,0.12)" },
  Missed:     { label: "Missed", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

const HORIZON_CONFIG: Record<string, { color: string }> = {
  "This Week":  { color: "#f87171" },
  "2-4 Weeks":  { color: "#fbbf24" },
  "1-3 Months": { color: "#818cf8" },
};

function confidenceColor(c: number): string {
  if (c >= 75) return "#4ade80";
  if (c >= 50) return "#fbbf24";
  if (c >= 25) return "#818cf8";
  return "rgba(255,255,255,0.3)";
}

function confidenceLabel(c: number): string {
  if (c >= 80) return "Very High";
  if (c >= 60) return "High";
  if (c >= 40) return "Moderate";
  if (c >= 20) return "Low";
  return "Speculative";
}

function magnitudeLabel(m: number): string {
  if (m >= 80) return "Seismic";
  if (m >= 60) return "Major";
  if (m >= 40) return "Significant";
  if (m >= 20) return "Notable";
  return "Minor";
}

export default async function MomentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const moment = await getMoment(id);
  if (!moment) notFound();

  const typeConf = TYPE_CONFIG[moment.type] || TYPE_CONFIG.Catalyst;
  const statusConf = STATUS_CONFIG[moment.status] || STATUS_CONFIG.Predicted;
  const horizonConf = HORIZON_CONFIG[moment.horizon] || HORIZON_CONFIG["2-4 Weeks"];

  // Load linked data in parallel
  const [linkedTrends, linkedTensions, allEvents] = await Promise.all([
    Promise.all(moment.linkedTrendIds.slice(0, 8).map((tid) => getTrend(tid))),
    Promise.all(moment.linkedTensionIds.slice(0, 8).map((tid) => getTension(tid))),
    moment.linkedEventIds.length > 0 ? getUpcomingEvents(90) : Promise.resolve([]),
  ]);

  const trends = linkedTrends.filter((t): t is Trend => t !== null);
  const tensions = linkedTensions.filter((t): t is Tension => t !== null);
  const events = allEvents.filter((e: CalendarEvent) => moment.linkedEventIds.includes(e.id));

  // Parse watch-for items
  const watchItems = moment.watchFor
    ? moment.watchFor.split(";").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Back link */}
      <Link
        href="/"
        style={{
          fontSize: 12,
          color: "var(--text-tertiary)",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          marginBottom: 20,
        }}
        className="link-hover"
      >
        &larr; Back to dashboard
      </Link>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--surface)",
          border: `1px solid ${typeConf.color}33`,
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        {/* Top accent */}
        <div
          style={{
            height: 3,
            background: `linear-gradient(90deg, ${typeConf.color}, ${typeConf.color}22)`,
          }}
        />

        <div style={{ padding: "24px 28px" }}>
          {/* Badges row */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 14,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 12,
                padding: "3px 10px",
                borderRadius: 6,
                background: typeConf.bg,
                color: typeConf.color,
                fontWeight: 600,
              }}
            >
              {typeConf.icon} {moment.type}
            </span>
            <span
              style={{
                fontSize: 12,
                padding: "3px 10px",
                borderRadius: 6,
                background: statusConf.bg,
                color: statusConf.color,
                fontWeight: 600,
              }}
            >
              {statusConf.label}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.04)",
                color: horizonConf.color,
                fontWeight: 500,
              }}
            >
              {moment.horizon}
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.25,
              margin: "0 0 12px",
              letterSpacing: "-0.01em",
            }}
          >
            {moment.name}
          </h1>

          {/* Narrative */}
          <p
            style={{
              fontSize: 15,
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.7,
              margin: "0 0 20px",
              maxWidth: 720,
            }}
          >
            {moment.narrative}
          </p>

          {/* Scores row */}
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {/* Confidence */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.3)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Confidence
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: confidenceColor(moment.confidence),
                    lineHeight: 1,
                  }}
                >
                  {moment.confidence}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: confidenceColor(moment.confidence),
                    opacity: 0.7,
                  }}
                >
                  {confidenceLabel(moment.confidence)}
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  width: 120,
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 2,
                  overflow: "hidden",
                  marginTop: 6,
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
            </div>

            {/* Magnitude */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.3)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Magnitude
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    lineHeight: 1,
                  }}
                >
                  {moment.magnitude}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  {magnitudeLabel(moment.magnitude)}
                </span>
              </div>
            </div>

            {/* Prediction Window */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.3)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Prediction Window
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-secondary)" }}>
                {moment.windowStart
                  ? new Date(moment.windowStart + "T00:00:00").toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                    })
                  : "TBD"}
                {moment.windowEnd && (
                  <>
                    {" "}&rarr;{" "}
                    {new Date(moment.windowEnd + "T00:00:00").toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column content ───────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 24 }}>

        {/* Left column */}
        <div>
          {/* Watch For */}
          {watchItems.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  margin: "0 0 12px",
                }}
              >
                Watch For
              </h2>
              <div
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${typeConf.color}22`,
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                {watchItems.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "12px 16px",
                      borderBottom: i < watchItems.length - 1 ? "1px solid var(--border)" : "none",
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        color: typeConf.color,
                        fontSize: 8,
                        marginTop: 5,
                        flexShrink: 0,
                      }}
                    >
                      ▶
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.7)",
                        lineHeight: 1.5,
                      }}
                    >
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Reasoning Chain */}
          {moment.reasoning && (
            <section style={{ marginBottom: 24 }}>
              <h2
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  margin: "0 0 12px",
                }}
              >
                Reasoning
              </h2>
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.6)",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {moment.reasoning}
                </p>
              </div>
            </section>
          )}

          {/* Type explanation */}
          <section style={{ marginBottom: 24 }}>
            <div
              style={{
                background: typeConf.bg,
                border: `1px solid ${typeConf.color}22`,
                borderRadius: 10,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: typeConf.color, marginBottom: 6 }}>
                {typeConf.icon} {moment.type} Moment
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.5)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {typeConf.description}
              </p>
            </div>
          </section>

          {/* Outcome Notes (for passed/missed moments) */}
          {moment.outcomeNotes && (
            <section style={{ marginBottom: 24 }}>
              <h2
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  margin: "0 0 12px",
                }}
              >
                Outcome
              </h2>
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.6)",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {moment.outcomeNotes}
                </p>
              </div>
            </section>
          )}
        </div>

        {/* Right column — linked data */}
        <div>
          {/* Linked Trends */}
          {trends.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  margin: "0 0 12px",
                }}
              >
                Supporting Trends
              </h2>
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                {trends.map((t, i) => (
                  <Link
                    key={t.id}
                    href={`/trends/${t.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      className="row-hover"
                      style={{
                        padding: "10px 14px",
                        borderBottom: i < trends.length - 1 ? "1px solid var(--border)" : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "var(--text-primary)",
                          }}
                        >
                          {t.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                            marginTop: 2,
                          }}
                        >
                          {t.type} &middot; {t.status}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color:
                            t.cps >= 80
                              ? "#4ade80"
                              : t.cps >= 60
                              ? "#86efac"
                              : t.cps >= 40
                              ? "#fbbf24"
                              : "rgba(255,255,255,0.4)",
                        }}
                      >
                        {t.cps}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Linked Tensions */}
          {tensions.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  margin: "0 0 12px",
                }}
              >
                Driving Tensions
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {tensions.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tensions/${t.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      className="tension-hover"
                      style={{
                        background:
                          t.weight >= 8
                            ? "rgba(239,68,68,0.1)"
                            : t.weight >= 6
                            ? "rgba(245,158,11,0.1)"
                            : "rgba(255,255,255,0.04)",
                        border: `1px solid ${
                          t.weight >= 8
                            ? "rgba(239,68,68,0.25)"
                            : t.weight >= 6
                            ? "rgba(245,158,11,0.25)"
                            : "rgba(255,255,255,0.1)"
                        }`,
                        borderRadius: 99,
                        padding: "4px 10px",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color:
                            t.weight >= 8
                              ? "#f87171"
                              : t.weight >= 6
                              ? "#fbbf24"
                              : "rgba(255,255,255,0.6)",
                        }}
                      >
                        {t.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "rgba(255,255,255,0.3)",
                          marginLeft: 6,
                        }}
                      >
                        {t.weight}/10
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Linked Calendar Events */}
          {events.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  margin: "0 0 12px",
                }}
              >
                Catalyst Events
              </h2>
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                {events.map((e: CalendarEvent, i: number) => (
                  <div
                    key={e.id}
                    style={{
                      padding: "10px 14px",
                      borderBottom: i < events.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                      }}
                    >
                      {e.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        marginTop: 2,
                      }}
                    >
                      {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Metadata */}
          <section>
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.25)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Metadata
              </div>
              {[
                {
                  label: "Created",
                  value: moment.createdDate
                    ? new Date(moment.createdDate + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Unknown",
                },
                {
                  label: "Last Updated",
                  value: moment.lastUpdated
                    ? new Date(moment.lastUpdated + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Unknown",
                },
                { label: "Moment ID", value: moment.id.slice(0, 8) + "..." },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "4px 0",
                  }}
                >
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
