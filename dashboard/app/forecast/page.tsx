import Link from "next/link";
import { getAllMoments, CulturalMoment } from "@/lib/notion";

export const revalidate = 300;

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

const HORIZON_CONFIG: Record<string, { label: string; color: string }> = {
  "This Week":  { label: "This Week", color: "#E8127A" },
  "2-4 Weeks":  { label: "2-4 Weeks", color: "#FF8200" },
  "1-3 Months": { label: "1-3 Months", color: "rgba(232,18,122,0.7)" },
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

const STATUS_RANK: Record<string, number> = { Happening: 0, Forming: 1, Predicted: 2, Passed: 3, Missed: 4 };
const HORIZON_RANK: Record<string, number> = { "This Week": 0, "2-4 Weeks": 1, "1-3 Months": 2 };

function sortMoments(moments: CulturalMoment[]): CulturalMoment[] {
  return [...moments].sort((a, b) => {
    const sd = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    if (sd !== 0) return sd;
    const hd = (HORIZON_RANK[a.horizon] ?? 9) - (HORIZON_RANK[b.horizon] ?? 9);
    if (hd !== 0) return hd;
    return b.confidence - a.confidence;
  });
}

export default async function ForecastPage() {
  const moments = await getAllMoments();
  const sorted = sortMoments(moments);

  const active = moments.filter((m) => m.status !== "Passed" && m.status !== "Missed");
  const past = moments.filter((m) => m.status === "Passed" || m.status === "Missed");
  const forming = moments.filter((m) => m.status === "Forming" || m.status === "Happening");

  // Horizon counts for active
  const horizonCounts = {
    "This Week": active.filter((m) => m.horizon === "This Week").length,
    "2-4 Weeks": active.filter((m) => m.horizon === "2-4 Weeks").length,
    "1-3 Months": active.filter((m) => m.horizon === "1-3 Months").length,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
            Cultural Forecast
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
            {active.length} active predictions &middot; Moments forecasted before they happen
            {" · "}
            <Link href="/moments/methodology" style={{ color: "rgba(255,130,0,0.6)", textDecoration: "none", fontSize: 12 }} className="link-hover">
              How we predict &rarr;
            </Link>
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
          {forming.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(232,18,122,0.08)", border: "1px solid rgba(232,18,122,0.2)", borderRadius: 8, padding: "5px 10px" }}>
              <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8127A", display: "inline-block" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#E8127A" }}>{forming.length} forming</span>
            </div>
          )}
          {(Object.entries(horizonCounts) as [string, number][]).filter(([, c]) => c > 0).map(([h, c]) => {
            const conf = HORIZON_CONFIG[h];
            return (
              <span key={h} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: `${conf.color}12`, color: conf.color, fontWeight: 600 }}>
                {c} {conf.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Active predictions */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: 12,
        marginBottom: 32,
      }}>
        {sortMoments(active).map((m) => (
          <MomentCard key={m.id} moment={m} />
        ))}
      </div>

      {/* Past predictions */}
      {past.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: "var(--text-tertiary)", flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Past Predictions
            </span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{past.length}</span>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 12,
          }}>
            {sortMoments(past).map((m) => (
              <MomentCard key={m.id} moment={m} />
            ))}
          </div>
        </section>
      )}

      {moments.length === 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>\ud83d\udd2e</div>
          <p style={{ color: "var(--text-tertiary)", fontSize: 13, margin: "0 0 6px" }}>No moment predictions yet.</p>
          <code style={{ fontSize: 11, color: "var(--text-tertiary)", background: "var(--surface-raised)", padding: "3px 8px", borderRadius: 4 }}>
            python3 scripts/run_pipeline.py --moments
          </code>
        </div>
      )}
    </div>
  );
}

function MomentCard({ moment: m }: { moment: CulturalMoment }) {
  const typeConf = TYPE_CONFIG[m.type] || TYPE_CONFIG.Catalyst;
  const statusConf = STATUS_CONFIG[m.status] || STATUS_CONFIG.Predicted;
  const horizonConf = HORIZON_CONFIG[m.horizon] || HORIZON_CONFIG["2-4 Weeks"];

  return (
    <Link href={`/moments/${m.id}`} style={{ textDecoration: "none" }}>
      <div className="card-hover" style={{
        background: "var(--surface)",
        border: `1px solid ${typeConf.color}22`,
        borderRadius: 10,
        padding: 16,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Top accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${typeConf.color}, ${typeConf.color}33)` }} />

        {/* Badges */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: typeConf.bg, color: typeConf.color, fontWeight: 500 }}>
            {typeConf.icon} {m.type}
          </span>
          <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: statusConf.bg, color: statusConf.color, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            {statusConf.pulse && <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: statusConf.color, display: "inline-block" }} />}
            {statusConf.label}
          </span>
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: horizonConf.color, fontWeight: 500 }}>
            {horizonConf.label}
          </span>
        </div>

        {/* Title */}
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.35, margin: "0 0 6px" }}>
          {m.name}
        </h3>

        {/* Narrative */}
        <p style={{
          fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, margin: "0 0 10px",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        } as React.CSSProperties}>
          {m.narrative}
        </p>

        {/* Footer: confidence + magnitude */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>Confidence</span>
            <div style={{ height: 3, flex: 1, maxWidth: 60, background: "var(--border-strong)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${m.confidence}%`, height: "100%", background: confidenceColor(m.confidence), borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: confidenceColor(m.confidence) }}>{m.confidence}</span>
          </div>
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
