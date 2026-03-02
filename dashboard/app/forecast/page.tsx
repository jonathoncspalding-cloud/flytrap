import Link from "next/link";
import { getAllMoments, CulturalMoment } from "@/lib/notion";

export const revalidate = 300;

/* ── Config maps ──────────────────────────────────────────────────────── */

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  Catalyst:  { icon: "\u26a1", color: "#FF8200", bg: "rgba(255,130,0,0.1)" },
  Collision: { icon: "\ud83d\udca5", color: "#E8127A", bg: "rgba(232,18,122,0.1)" },
  Pressure:  { icon: "\ud83c\udf0a", color: "#2a8c4a", bg: "rgba(0,79,34,0.1)" },
  Pattern:   { icon: "\ud83d\udd04", color: "rgba(232,18,122,0.7)", bg: "rgba(232,18,122,0.1)" },
  Void:      { icon: "\ud83d\udd73\ufe0f", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; pulse?: boolean }> = {
  Predicted:  { label: "Predicted", color: "rgba(232,18,122,0.7)", bg: "rgba(232,18,122,0.12)" },
  Forming:    { label: "Forming", color: "#FF8200", bg: "rgba(255,130,0,0.12)", pulse: true },
  Happening:  { label: "Happening", color: "#E8127A", bg: "rgba(232,18,122,0.15)", pulse: true },
  Passed:     { label: "Passed", color: "#2a8c4a", bg: "rgba(0,79,34,0.12)" },
  Missed:     { label: "Missed", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

const HORIZON_ORDER = ["This Week", "2-4 Weeks", "1-3 Months"] as const;

const HORIZON_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  "This Week":  { label: "This Week",  color: "#E8127A",              icon: "\ud83d\udea8" },
  "2-4 Weeks":  { label: "2-4 Weeks",  color: "#FF8200",              icon: "\ud83d\udd2d" },
  "1-3 Months": { label: "1-3 Months", color: "rgba(232,18,122,0.7)", icon: "\ud83c\udf10" },
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

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

/** Is this a "featured" card that should get extra visual weight? */
function isFeatured(m: CulturalMoment): boolean {
  return (m.confidence >= 70 && m.magnitude >= 60) ||
         m.status === "Happening" ||
         m.status === "Forming";
}

/** Is this a low-signal card that should be visually dimmed? */
function isDimmed(m: CulturalMoment): boolean {
  return m.confidence < 30 && m.status === "Predicted";
}

const STATUS_RANK: Record<string, number> = { Happening: 0, Forming: 1, Predicted: 2, Passed: 3, Missed: 4 };

function sortByStatusConfidence(moments: CulturalMoment[]): CulturalMoment[] {
  return [...moments].sort((a, b) => {
    const sd = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    if (sd !== 0) return sd;
    return b.confidence - a.confidence;
  });
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default async function ForecastPage() {
  const moments = await getAllMoments();

  const active = moments.filter((m) => m.status !== "Passed" && m.status !== "Missed");
  const past = moments.filter((m) => m.status === "Passed" || m.status === "Missed");
  const forming = moments.filter((m) => m.status === "Forming" || m.status === "Happening");

  // Group active by horizon
  const byHorizon: Record<string, CulturalMoment[]> = {};
  for (const h of HORIZON_ORDER) {
    byHorizon[h] = sortByStatusConfidence(active.filter((m) => m.horizon === h));
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
            Cultural Forecast
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
            {active.length} active prediction{active.length !== 1 ? "s" : ""}
            {" \u00b7 "}
            <Link href="/moments/methodology" style={{ color: "rgba(255,130,0,0.6)", textDecoration: "none", fontSize: 12 }} className="link-hover">
              How we predict &rarr;
            </Link>
          </p>
        </div>
        {forming.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(232,18,122,0.08)", border: "1px solid rgba(232,18,122,0.2)", borderRadius: 8, padding: "5px 10px", flexShrink: 0 }}>
            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8127A", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#E8127A" }}>{forming.length} forming</span>
          </div>
        )}
      </div>

      {/* ── Timeline summary bar ────────────────────────────────────── */}
      <div style={{
        display: "flex",
        gap: 2,
        marginBottom: 28,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 3,
        overflow: "hidden",
      }}>
        {HORIZON_ORDER.map((h, i) => {
          const conf = HORIZON_CONFIG[h];
          const count = byHorizon[h]?.length || 0;
          const isFirst = i === 0;
          const isLast = i === HORIZON_ORDER.length - 1;
          return (
            <div key={h} style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 12px",
              background: count > 0 ? `${conf.color}08` : "transparent",
              borderRadius: `${isFirst ? 8 : 4}px ${isLast ? 8 : 4}px ${isLast ? 8 : 4}px ${isFirst ? 8 : 4}px`,
              transition: "background 0.15s",
            }}>
              <span style={{ fontSize: 13 }}>{conf.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: count > 0 ? conf.color : "var(--text-tertiary)" }}>
                {conf.label}
              </span>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: count > 0 ? conf.color : "var(--text-tertiary)",
                background: count > 0 ? `${conf.color}18` : "var(--border)",
                padding: "1px 7px",
                borderRadius: 10,
                minWidth: 22,
                textAlign: "center",
              }}>
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Horizon sections ────────────────────────────────────────── */}
      {HORIZON_ORDER.map((h) => {
        const items = byHorizon[h];
        if (!items || items.length === 0) return null;
        const conf = HORIZON_CONFIG[h];

        return (
          <section key={h} style={{ marginBottom: 32 }}>
            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: conf.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: conf.color, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {conf.label}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {items.length} prediction{items.length !== 1 ? "s" : ""}
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--border)", marginLeft: 4 }} />
            </div>

            {/* Cards grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 12,
            }}>
              {items.map((m) => (
                <MomentCard key={m.id} moment={m} />
              ))}
            </div>
          </section>
        );
      })}

      {/* ── Past predictions (compact rows) ─────────────────────────── */}
      {past.length > 0 && (
        <section style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 3, height: 18, borderRadius: 2, background: "var(--text-tertiary)", flexShrink: 0, opacity: 0.5 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Past Predictions
            </span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{past.length}</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)", marginLeft: 4 }} />
          </div>

          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
          }}>
            {sortByStatusConfidence(past).map((m, i) => (
              <PastRow key={m.id} moment={m} isLast={i === past.length - 1} />
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {moments.length === 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>{"\ud83d\udd2e"}</div>
          <p style={{ color: "var(--text-tertiary)", fontSize: 13, margin: "0 0 6px" }}>No moment predictions yet.</p>
          <code style={{ fontSize: 11, color: "var(--text-tertiary)", background: "var(--surface-raised)", padding: "3px 8px", borderRadius: 4 }}>
            python3 scripts/run_pipeline.py --moments
          </code>
        </div>
      )}
    </div>
  );
}

/* ── MomentCard (with visual weight) ───────────────────────────────── */

function MomentCard({ moment: m }: { moment: CulturalMoment }) {
  const typeConf = TYPE_CONFIG[m.type] || TYPE_CONFIG.Catalyst;
  const statusConf = STATUS_CONFIG[m.status] || STATUS_CONFIG.Predicted;
  const featured = isFeatured(m);
  const dimmed = isDimmed(m);

  return (
    <Link href={`/moments/${m.id}`} style={{ textDecoration: "none" }}>
      <div className="card-hover" style={{
        background: featured ? "var(--surface-raised)" : "var(--surface)",
        border: `1px solid ${typeConf.color}${featured ? "33" : "18"}`,
        borderLeft: featured ? `3px solid ${typeConf.color}` : `1px solid ${typeConf.color}18`,
        borderRadius: 10,
        padding: featured ? "18px 18px 16px" : "14px 16px 12px",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        opacity: dimmed ? 0.55 : 1,
        transition: "opacity 0.15s, border-color 0.15s, background 0.15s",
      }}>
        {/* Top row: status + type */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          {/* Status badge (primary) */}
          <span style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 4,
            background: statusConf.bg,
            color: statusConf.color,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}>
            {statusConf.pulse && (
              <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: statusConf.color, display: "inline-block" }} />
            )}
            {statusConf.label}
          </span>

          {/* Type (secondary, right-aligned) */}
          <span style={{ fontSize: 11, color: typeConf.color, fontWeight: 500, opacity: 0.8 }}>
            {typeConf.icon} {m.type}
          </span>
        </div>

        {/* Title */}
        <h3 style={{
          fontSize: featured ? 15 : 14,
          fontWeight: 600,
          color: "var(--text-primary)",
          lineHeight: 1.35,
          margin: "0 0 6px",
        }}>
          {m.name}
        </h3>

        {/* Narrative */}
        <p style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          lineHeight: 1.55,
          margin: "0 0 12px",
          display: "-webkit-box",
          WebkitLineClamp: featured ? 3 : 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        } as React.CSSProperties}>
          {m.narrative}
        </p>

        {/* Footer metrics */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* Confidence */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>Confidence</span>
            <div style={{ height: 3, flex: 1, maxWidth: 60, background: "var(--border-strong)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${m.confidence}%`, height: "100%", background: confidenceColor(m.confidence), borderRadius: 2, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: confidenceColor(m.confidence) }}>{m.confidence}</span>
          </div>

          {/* Magnitude */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{magnitudeLabel(m.magnitude)}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>M{m.magnitude}</span>
          </div>
        </div>

        {/* Window */}
        {m.windowStart && (
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 6 }}>
            Window: {new Date(m.windowStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            {m.windowEnd && <> &rarr; {new Date(m.windowEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>}
          </div>
        )}
      </div>
    </Link>
  );
}

/* ── PastRow (compact past prediction) ─────────────────────────────── */

function PastRow({ moment: m, isLast }: { moment: CulturalMoment; isLast: boolean }) {
  const typeConf = TYPE_CONFIG[m.type] || TYPE_CONFIG.Catalyst;
  const statusConf = STATUS_CONFIG[m.status] || STATUS_CONFIG.Passed;

  return (
    <Link href={`/moments/${m.id}`} style={{ textDecoration: "none" }}>
      <div className="row-hover" style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        cursor: "pointer",
        opacity: 0.7,
        transition: "opacity 0.12s",
      }}>
        {/* Type icon */}
        <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: "center" }}>
          {typeConf.icon}
        </span>

        {/* Name */}
        <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {m.name}
        </span>

        {/* Confidence */}
        <span style={{ fontSize: 11, fontWeight: 600, color: confidenceColor(m.confidence), flexShrink: 0 }}>
          {m.confidence}%
        </span>

        {/* Status badge */}
        <span style={{
          fontSize: 10,
          padding: "2px 7px",
          borderRadius: 4,
          background: statusConf.bg,
          color: statusConf.color,
          fontWeight: 600,
          flexShrink: 0,
        }}>
          {statusConf.label}
        </span>
      </div>
    </Link>
  );
}
