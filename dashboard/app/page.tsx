import Link from "next/link";
import {
  getTrends, getTensions, getUpcomingEvents,
  getLatestBriefings, getResearchInsights,
  getActiveMoments,
  Trend,
} from "@/lib/notion";
import TrendCard from "@/components/TrendCard";
import TensionBadge from "@/components/TensionBadge";
import MomentsWidget from "@/components/MomentsWidget";
import Chatbot from "@/components/Chatbot";
import DashboardHome from "@/components/DashboardHome";
import { cpsTextColor, cpsBarColor } from "@/components/CpsBar";

export const revalidate = 300;

function categorizeTrends(trends: Trend[]) {
  const micro = trends.filter((t) =>
    ["Micro Trend", "Emerging Signal", "Predicted Moment"].includes(t.type)
  );
  const macro = trends.filter((t) => t.type === "Macro Trend");
  const historical = trends.filter(
    (t) =>
      (t.status === "Peaked" || t.status === "Stable") &&
      !micro.find((m) => m.id === t.id) &&
      !macro.find((m) => m.id === t.id)
  );
  const historicalIds = new Set(historical.map((t) => t.id));
  if (historical.length < 3) {
    const backfill = macro
      .filter((t) => !historicalIds.has(t.id))
      .sort((a, b) => a.cps - b.cps)
      .slice(0, 4 - historical.length);
    historical.push(...backfill);
  }
  return { micro, macro, historical };
}

function cleanHighlight(h: string): string {
  return h.replace(/\*\*/g, "").replace(/\(CPS:?\s*\d+\)/gi, "").replace(/^[-\u2022\u00b7\u2014\u25cf\s]+/, "").trim();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CardHeader({ title, linkHref, linkLabel, accent }: {
  title: string; linkHref?: string; linkLabel?: string; accent?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {accent && <div style={{ width: 3, height: 14, borderRadius: 2, background: accent, flexShrink: 0 }} />}
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {title}
        </span>
      </div>
      {linkHref && (
        <Link href={linkHref} style={{ fontSize: 10, color: "var(--text-tertiary)", textDecoration: "none" }} className="link-hover">
          {linkLabel ?? "View all \u2192"}
        </Link>
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 40 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [trends, tensions, events, briefings, researchInsights, moments] = await Promise.all([
    getTrends(),
    getTensions(),
    getUpcomingEvents(30),
    getLatestBriefings(1),
    getResearchInsights(6),
    getActiveMoments(),
  ]);

  const flashpoints = trends.filter((t) => t.cps >= 80);
  const { micro, macro } = categorizeTrends(trends);
  const upcomingEvents = events.slice(0, 3);
  const latestBriefing = briefings[0] ?? null;

  const highlightItems = latestBriefing?.highlights
    ? latestBriefing.highlights.split(/\s*[\u00b7|]\s*/).map(cleanHighlight).filter(Boolean).slice(0, 4)
    : [];

  // Row positions shift if flashpoints exist
  const r2 = flashpoints.length > 0 ? "3" : "2";

  return (
    <DashboardHome hasTrends={trends.length > 0}>
    <div className="dashboard-grid">

      {/* ════ ROW 1 ════ Briefing | Moments | Stats ════════════════════════ */}

      {/* Briefing Card */}
      <div className="dash-card" style={{ gridColumn: "1 / 3", gridRow: "1" }}>
        <CardHeader title="Today's Briefing" linkHref="/briefings" linkLabel="Full briefing \u2192" accent="#4ade80" />
        {latestBriefing ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{latestBriefing.date}</span>
              {latestBriefing.flashpointCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 5, padding: "2px 7px" }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} className="pulse-dot" />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80" }}>{latestBriefing.flashpointCount} active</span>
                </div>
              )}
            </div>
            {highlightItems.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                {highlightItems.map((h, i) => (
                  <span key={i} style={{ fontSize: 10, color: "var(--text-secondary)", background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 3, padding: "1px 6px" }}>
                    {h}
                  </span>
                ))}
              </div>
            )}
            <p style={{
              fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.55, margin: 0,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            } as React.CSSProperties}>
              {latestBriefing.content.replace(/#{1,3}\s*/g, "").replace(/\*\*/g, "").replace(/---/g, "").replace(/\(CPS:?\s*\d+\)/gi, "").trim().slice(0, 280)}\u2026
            </p>
          </>
        ) : (
          <p style={{ color: "var(--text-tertiary)", fontSize: 11, margin: 0 }}>No briefing yet.</p>
        )}
      </div>

      {/* Predicted Moments (compact) */}
      <div className="dash-card" style={{ gridColumn: "3 / 5", gridRow: "1" }}>
        <CardHeader title="Predicted Moments" linkHref="/moments/methodology" linkLabel="Methodology \u2192" accent="#f59e0b" />
        <MomentsWidget moments={moments} compact />
      </div>

      {/* Radar Stats */}
      <div className="dash-card" style={{ gridColumn: "5", gridRow: "1", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
        <CardHeader title="Radar" accent="#6366f1" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <StatPill label="Trends" value={trends.length} color="var(--text-primary)" />
          <StatPill label="Flashpoints" value={flashpoints.length} color="#4ade80" />
          <StatPill label="Tensions" value={tensions.length} color="var(--text-primary)" />
          <StatPill label="Events" value={events.length} color="var(--text-secondary)" />
        </div>
      </div>

      {/* ════ ROW 2 ════ Flashpoints (horizontal scroll, single line) ══════ */}
      {flashpoints.length > 0 && (
        <div style={{
          gridColumn: "1 / -1", gridRow: "2",
          background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.15)",
          borderRadius: 8, padding: "5px 10px",
          display: "flex", alignItems: "center", gap: 8,
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} className="pulse-dot" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", letterSpacing: "0.08em", textTransform: "uppercase" }}>Flashpoints</span>
            <span style={{ background: "#4ade80", color: "#0a0a0a", fontSize: 9, fontWeight: 800, padding: "0px 4px", borderRadius: 99 }}>{flashpoints.length}</span>
          </div>
          <div style={{ display: "flex", gap: 4, overflow: "auto", flexShrink: 1, scrollbarWidth: "none" }} className="hide-scrollbar">
            {flashpoints.slice(0, 12).map((t) => (
              <Link key={t.id} href={`/trends/${t.id}`} style={{ textDecoration: "none", flexShrink: 0 }}>
                <span className="tension-hover-green" style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.18)",
                  borderRadius: 99, padding: "2px 7px 2px 5px", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.82)",
                  whiteSpace: "nowrap",
                }}>
                  {t.name}
                  <span style={{ fontSize: 9, fontWeight: 800, color: "#4ade80", background: "rgba(74,222,128,0.12)", padding: "0px 3px", borderRadius: 3 }}>{t.cps}</span>
                </span>
              </Link>
            ))}
            {flashpoints.length > 12 && (
              <Link href="/trends" style={{ textDecoration: "none", flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: "#4ade80", padding: "2px 6px", whiteSpace: "nowrap" }}>
                  +{flashpoints.length - 12} more \u2192
                </span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ════ ROW 3 ════ Micro | Macro | Calendar + Tensions ═══════════════ */}

      {/* Micro Trends */}
      <div className="dash-card" style={{ gridColumn: "1 / 3", gridRow: r2 }}>
        <CardHeader title="Micro Trends" linkHref="/trends" linkLabel="All trends \u2192" accent="#4ade80" />
        <div style={{ display: "flex", flexDirection: "column", gap: 0, borderRadius: 7, overflow: "hidden", border: "1px solid var(--border)" }}>
          {micro.length > 0 ? micro.slice(0, 4).map((t) => (
            <TrendCard key={t.id} trend={t} compact />
          )) : <EmptyCol message="No micro trends" />}
        </div>
        {micro.length > 4 && (
          <Link href="/trends" style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block", textAlign: "center", marginTop: 4, textDecoration: "none" }}>
            +{micro.length - 4} more
          </Link>
        )}
      </div>

      {/* Macro Trends */}
      <div className="dash-card" style={{ gridColumn: "3 / 5", gridRow: r2 }}>
        <CardHeader title="Macro Trends" linkHref="/trends" linkLabel="All trends \u2192" accent="#fbbf24" />
        <div style={{ display: "flex", flexDirection: "column", gap: 0, borderRadius: 7, overflow: "hidden", border: "1px solid var(--border)" }}>
          {macro.length > 0 ? macro.slice(0, 4).map((t) => (
            <TrendCard key={t.id} trend={t} compact />
          )) : <EmptyCol message="No macro trends" />}
        </div>
        {macro.length > 4 && (
          <Link href="/trends" style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block", textAlign: "center", marginTop: 4, textDecoration: "none" }}>
            +{macro.length - 4} more
          </Link>
        )}
      </div>

      {/* Right column: Calendar + Tensions stacked */}
      <div style={{ gridColumn: "5", gridRow: r2, display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Calendar mini */}
        <div className="dash-card" style={{ flex: "0 0 auto" }}>
          <CardHeader title="Upcoming" linkHref="/calendar" accent="#a78bfa" />
          {upcomingEvents.length > 0 ? upcomingEvents.map((e, i) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: i < upcomingEvents.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.3 }}>{e.name}</div>
                <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>
                  {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
              {e.cps > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: cpsTextColor(e.cps), background: `${cpsBarColor(e.cps)}18`, padding: "1px 4px", borderRadius: 3, flexShrink: 0 }}>
                  {e.cps}
                </span>
              )}
            </div>
          )) : (
            <p style={{ color: "var(--text-tertiary)", fontSize: 10, margin: 0 }}>No upcoming events</p>
          )}
        </div>

        {/* Tensions mini */}
        <div className="dash-card" style={{ flex: 1, overflow: "hidden" }}>
          <CardHeader title="Tensions" accent="#f59e0b" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {tensions.slice(0, 4).map((t) => (
              <TensionBadge key={t.id} tension={t} />
            ))}
            {tensions.length > 4 && (
              <span style={{ fontSize: 9, color: "var(--text-tertiary)", padding: "3px 4px" }}>
                +{tensions.length - 4}
              </span>
            )}
          </div>
        </div>
      </div>

      <Chatbot />
    </div>
    </DashboardHome>
  );
}

function EmptyCol({ message }: { message: string }) {
  return (
    <div style={{ padding: "12px 10px", textAlign: "center" }}>
      <p style={{ color: "var(--text-tertiary)", fontSize: 11, margin: 0 }}>{message}</p>
    </div>
  );
}
