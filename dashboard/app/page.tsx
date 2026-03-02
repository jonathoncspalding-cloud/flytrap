import Link from "next/link";
import {
  getTrends, getTensions, getUpcomingEvents,
  getLatestBriefings, getActiveMoments, getSyncRecap,
  Trend, CulturalMoment, Tension,
} from "@/lib/notion";
import DashboardHome from "@/components/DashboardHome";
import { cpsTextColor, cpsBarColor } from "@/components/CpsBar";

export const revalidate = 300;

/* ── Helpers ───────────────────────────────────────────────────────────── */

function cleanHighlight(h: string): string {
  return h.replace(/\*\*/g, "").replace(/\(CPS:?\s*\d+\)/gi, "").replace(/^[-\u2022\u00b7\u2014\u25cf\s]+/, "").trim();
}

function confidenceColor(c: number): string {
  if (c >= 75) return "#2a8c4a";
  if (c >= 50) return "#FF8200";
  if (c >= 25) return "rgba(232,18,122,0.7)";
  return "rgba(255,255,255,0.3)";
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function daysLabel(dateStr: string | null): string {
  const d = daysUntil(dateStr);
  if (d === null) return "";
  if (d < 0) return "active";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return `${d}d`;
}

/** Extract top flashpoints with their first-sentence "why now" from briefing */
function extractFlashpointPreviews(content: string): { name: string; why: string }[] {
  const lines = content.split("\n");
  let inFlashpoints = false;
  const results: { name: string; why: string }[] = [];

  for (const line of lines) {
    if (line.includes("Flashpoints") && line.includes("###")) { inFlashpoints = true; continue; }
    if (inFlashpoints && line.startsWith("###")) break;
    if (inFlashpoints && line.trim().startsWith("**")) {
      const match = line.match(/\*\*([^*]+)\*\*\s*[\u2014—-]\s*(.*)/);
      if (match) {
        const name = match[1].replace(/\s*\(CPS:?\s*\d+\)/gi, "").trim();
        // Take first sentence only
        const why = match[2].split(/\.\s/)[0].replace(/\*\*/g, "").trim();
        results.push({ name, why: why.length > 120 ? why.slice(0, 117) + "\u2026" : why });
      }
    }
    if (results.length >= 3) break;
  }
  return results;
}

/** Get top movers — trends with biggest CPS sparkline delta */
function getTopMovers(trends: Trend[], limit = 5): (Trend & { delta: number })[] {
  return trends
    .map((t) => {
      const s = t.sparkline ?? [];
      const delta = s.length >= 2 ? s[s.length - 1] - s[s.length - 2] : 0;
      return { ...t, delta };
    })
    .filter((t) => t.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit);
}

const STATUS_RANK: Record<string, number> = { Happening: 0, Forming: 1, Predicted: 2 };
const HORIZON_ORDER = ["This Week", "2-4 Weeks", "1-3 Months"] as const;

const HORIZON_CONFIG: Record<string, { color: string; icon: string }> = {
  "This Week":  { color: "#E8127A", icon: "\ud83d\udea8" },
  "2-4 Weeks":  { color: "#FF8200", icon: "\ud83d\udd2d" },
  "1-3 Months": { color: "rgba(232,18,122,0.7)", icon: "\ud83c\udf10" },
};

const TYPE_ICONS: Record<string, string> = {
  Catalyst: "\u26a1", Collision: "\ud83d\udca5", Pressure: "\ud83c\udf0a",
  Pattern: "\ud83d\udd04", Void: "\ud83d\udd73\ufe0f",
};

const STATUS_COLORS: Record<string, { color: string; bg: string; pulse?: boolean }> = {
  Predicted: { color: "rgba(232,18,122,0.7)", bg: "rgba(232,18,122,0.12)" },
  Forming:   { color: "#FF8200", bg: "rgba(255,130,0,0.12)", pulse: true },
  Happening: { color: "#E8127A", bg: "rgba(232,18,122,0.15)", pulse: true },
};

/* ── Sub-components ────────────────────────────────────────────────────── */

function SectionHeader({ title, accent, linkHref, linkLabel }: {
  title: string; accent: string; linkHref?: string; linkLabel?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
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

function PlatformBar({ platform, count, maxCount }: { platform: string; count: number; maxCount: number }) {
  const abbr: Record<string, string> = {
    Reddit: "r/", RSS: "rss", Bluesky: "bsky", "Hacker News": "hn",
    YouTube: "yt", Wikipedia: "wiki", "Google Trends": "gt",
  };
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const isDown = count === 0;
  const barColor = isDown ? "rgba(232,18,122,0.3)" : "rgba(42,140,74,0.5)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 700, color: "var(--text-tertiary)", width: 28, textAlign: "right", flexShrink: 0 }}>
        {abbr[platform] ?? platform.slice(0, 3).toLowerCase()}
      </span>
      <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(pct, 2)}%`, height: "100%", background: barColor, borderRadius: 2, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: isDown ? "var(--rose)" : "var(--text-secondary)", width: 22, textAlign: "right", flexShrink: 0 }}>
        {count}
      </span>
      {isDown && <span style={{ fontSize: 8, color: "var(--rose)" }}>{"\u26a0\ufe0f"}</span>}
    </div>
  );
}

function MomentRow({ moment }: { moment: CulturalMoment }) {
  const sConf = STATUS_COLORS[moment.status] ?? STATUS_COLORS.Predicted;
  const icon = TYPE_ICONS[moment.type] ?? "\u26a1";
  const featured = moment.status === "Forming" || moment.status === "Happening";
  const dl = daysLabel(moment.windowStart);

  return (
    <Link href={`/moments/${moment.id}`} style={{ textDecoration: "none" }}>
      <div className="row-hover" style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: featured ? "8px 6px" : "6px 6px",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        borderLeft: featured ? `2px solid ${sConf.color}` : "2px solid transparent",
      }}>
        <span style={{ fontSize: featured ? 14 : 12, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: featured ? 12 : 11,
            fontWeight: featured ? 600 : 500,
            color: "var(--text-primary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {moment.name}
          </div>
        </div>
        {/* Status */}
        <span style={{
          fontSize: 9, padding: "1px 5px", borderRadius: 3,
          background: sConf.bg, color: sConf.color, fontWeight: 600, flexShrink: 0,
          display: "flex", alignItems: "center", gap: 3,
        }}>
          {sConf.pulse && <span className="pulse-dot" style={{ width: 4, height: 4, borderRadius: "50%", background: sConf.color, display: "inline-block" }} />}
          {moment.status}
        </span>
        {/* Confidence */}
        <span style={{ fontSize: 10, fontWeight: 700, color: confidenceColor(moment.confidence), flexShrink: 0, width: 28, textAlign: "right" }}>
          {moment.confidence}%
        </span>
        {/* Days-to-window */}
        {dl && (
          <span style={{ fontSize: 9, color: "var(--text-tertiary)", flexShrink: 0, width: 32, textAlign: "right" }}>{dl}</span>
        )}
      </div>
    </Link>
  );
}

function TensionRow({ tension }: { tension: Tension }) {
  const color = tension.weight >= 9 ? "#E8127A" : tension.weight >= 7 ? "#FF8200" : tension.weight >= 5 ? "rgba(255,130,0,0.6)" : "var(--text-secondary)";
  return (
    <Link href={`/tensions/${tension.id}`} style={{ textDecoration: "none" }}>
      <div className="row-hover" style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 6px", borderBottom: "1px solid var(--border)", cursor: "pointer",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {tension.name}
          </div>
        </div>
        <div style={{ width: 40, height: 3, background: "var(--border-strong)", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
          <div style={{ width: `${tension.weight * 10}%`, height: "100%", background: color, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color, flexShrink: 0, width: 28, textAlign: "right" }}>
          {tension.weight}
        </span>
      </div>
    </Link>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default async function DashboardPage() {
  const [trends, tensions, events, briefings, moments, syncRecap] = await Promise.all([
    getTrends(),
    getTensions(),
    getUpcomingEvents(30),
    getLatestBriefings(1),
    getActiveMoments(),
    getSyncRecap(),
  ]);

  const flashpoints = trends.filter((t) => t.cps >= 80);
  const latestBriefing = briefings[0] ?? null;
  const topMovers = getTopMovers(trends);
  const upcomingEvents = events.slice(0, 5);

  // Briefing flashpoint previews
  const flashpointPreviews = latestBriefing ? extractFlashpointPreviews(latestBriefing.content) : [];

  // Signal pulse data
  const platforms = Object.entries(syncRecap.signalsByPlatform).sort((a, b) => b[1] - a[1]);
  const maxSignals = platforms.length > 0 ? platforms[0][1] : 0;

  // Moments grouped by horizon
  const momentsByHorizon: Record<string, CulturalMoment[]> = {};
  for (const h of HORIZON_ORDER) {
    momentsByHorizon[h] = moments
      .filter((m) => m.horizon === h)
      .sort((a, b) => {
        const sd = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
        if (sd !== 0) return sd;
        return b.confidence - a.confidence;
      });
  }

  // Row 2 shifts if flashpoints exist
  const r2 = flashpoints.length > 0 ? "3" : "2";
  const r3 = flashpoints.length > 0 ? "4" : "3";

  return (
    <DashboardHome hasTrends={trends.length > 0}>
    <div className="dashboard-grid">

      {/* ════ ROW 1 ════ Briefing Command Panel | Signal Pulse ════════════ */}

      {/* Briefing Command Panel — 3 columns */}
      <div className="dash-card dash-card-briefing" style={{ gridColumn: "1 / 4", gridRow: "1" }}>
        <SectionHeader title="Today's Briefing" accent="var(--moss-bright)" linkHref="/briefings" linkLabel="Full briefing \u2192" />

        {latestBriefing ? (
          <div>
            {/* Date + flashpoint count */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: "var(--font-fraunces, 'Fraunces', serif)", fontSize: 15, fontWeight: 400, color: "var(--text-primary)" }}>
                {latestBriefing.date}
              </span>
              {latestBriefing.flashpointCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(232,18,122,0.08)", border: "1px solid rgba(232,18,122,0.2)", borderRadius: 5, padding: "2px 7px" }}>
                  <span className="pulse-dot" style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--rose)", display: "inline-block" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--rose)" }}>{latestBriefing.flashpointCount} flashpoint{latestBriefing.flashpointCount !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>

            {/* Flashpoint previews */}
            {flashpointPreviews.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "var(--rose)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                  {"\ud83d\udd34"} Flashpoints
                </div>
                {flashpointPreviews.slice(0, 2).map((fp, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{fp.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 6 }}>{"\u2014"} {fp.why}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Active tension surfacing */}
            {tensions.length > 0 && (
              <div style={{
                background: "rgba(255,130,0,0.04)", border: "1px solid rgba(255,130,0,0.12)",
                borderRadius: 6, padding: "8px 10px", marginBottom: 0,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#FF8200", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                  {"\ud83c\udf0a"} Top Tension Surfacing
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Link href={`/tensions/${tensions[0].id}`} style={{ textDecoration: "none" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{tensions[0].name}</span>
                  </Link>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#FF8200" }}>{tensions[0].weight}/10</span>
                </div>
                {tensions[0].description && (
                  <p style={{
                    fontSize: 10, color: "var(--text-tertiary)", margin: "4px 0 0", lineHeight: 1.45,
                    display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden",
                  } as React.CSSProperties}>
                    {tensions[0].description}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: "var(--text-tertiary)", fontSize: 11, margin: 0 }}>No briefing yet. Run the pipeline to generate one.</p>
        )}
      </div>

      {/* Signal Pulse — 2 columns */}
      <div className="dash-card" style={{ gridColumn: "4 / 6", gridRow: "1" }}>
        <SectionHeader title="Signal Pulse" accent="var(--moss-bright)" />

        {/* Total count */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
          <span style={{ fontFamily: "var(--font-fraunces, 'Fraunces', serif)", fontSize: 24, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1 }}>
            {syncRecap.totalSignals}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>signals today</span>
          <span style={{ fontSize: 9, color: "var(--text-tertiary)", marginLeft: "auto" }}>
            {platforms.length} source{platforms.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Platform bars */}
        <div style={{ marginBottom: 10 }}>
          {platforms.slice(0, 7).map(([platform, count]) => (
            <PlatformBar key={platform} platform={platform} count={count} maxCount={maxSignals} />
          ))}
          {platforms.length === 0 && (
            <p style={{ fontSize: 10, color: "var(--text-tertiary)", margin: 0 }}>No signals collected yet today.</p>
          )}
        </div>

        {/* Last sync */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, opacity: 0.7 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--moss-bright)", display: "inline-block" }} />
          <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>
            Last sync: {new Date(syncRecap.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
          </span>
        </div>
      </div>

      {/* ════ ROW 2 ════ Flashpoints bar ═════════════════════════════════ */}
      {flashpoints.length > 0 && (
        <div style={{
          gridColumn: "1 / -1", gridRow: "2",
          background: "linear-gradient(90deg, rgba(232,18,122,0.06), rgba(0,79,34,0.04))",
          border: "1px solid rgba(232,18,122,0.15)",
          borderRadius: 8, padding: "5px 10px",
          display: "flex", alignItems: "center", gap: 8, overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--rose)", display: "inline-block" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--rose)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Flashpoints</span>
            <span style={{ background: "var(--rose)", color: "#fff", fontSize: 9, fontWeight: 800, padding: "0px 5px", borderRadius: 99 }}>{flashpoints.length}</span>
          </div>
          <div style={{ display: "flex", gap: 4, overflow: "auto", flexShrink: 1, scrollbarWidth: "none" }} className="hide-scrollbar">
            {flashpoints.slice(0, 12).map((t) => (
              <Link key={t.id} href={`/trends/${t.id}`} style={{ textDecoration: "none", flexShrink: 0 }}>
                <span className="tension-hover-red" style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "rgba(232,18,122,0.07)", border: "1px solid rgba(232,18,122,0.18)",
                  borderRadius: 99, padding: "2px 8px 2px 6px", fontSize: 10, fontWeight: 600, color: "rgba(242,239,237,0.82)", whiteSpace: "nowrap",
                }}>
                  {t.name}
                  <span style={{ fontSize: 9, fontWeight: 800, color: "var(--rose)", background: "rgba(232,18,122,0.12)", padding: "0px 3px", borderRadius: 3 }}>{t.cps}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ════ ROW 3 ════ Moments (horizon-stacked) | Calendar + Tensions ═ */}

      {/* Predicted Moments — 3 columns, horizon-stacked */}
      <div className="dash-card" style={{ gridColumn: "1 / 4", gridRow: r2 }}>
        <SectionHeader title="Predicted Moments" accent="var(--sunset)" linkHref="/forecast" linkLabel="All predictions \u2192" />

        {moments.length > 0 ? (
          <div>
            {HORIZON_ORDER.map((h) => {
              const items = momentsByHorizon[h];
              if (!items || items.length === 0) return null;
              const conf = HORIZON_CONFIG[h];
              return (
                <div key={h} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10 }}>{conf.icon}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: conf.color, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {h}
                    </span>
                    <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{items.length}</span>
                    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                  </div>
                  {items.slice(0, 3).map((m) => (
                    <MomentRow key={m.id} moment={m} />
                  ))}
                  {items.length > 3 && (
                    <div style={{ fontSize: 9, color: "var(--text-tertiary)", textAlign: "center", padding: "3px 0" }}>
                      +{items.length - 3} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{"\ud83d\udd2e"}</div>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>No predictions yet.</p>
          </div>
        )}
      </div>

      {/* Right column: Calendar + Tensions stacked */}
      <div style={{ gridColumn: "4 / 6", gridRow: r2, display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Calendar */}
        <div className="dash-card" style={{ flex: "0 0 auto" }}>
          <SectionHeader title="On Deck" accent="rgba(242,239,237,0.3)" linkHref="/calendar" />
          {upcomingEvents.length > 0 ? upcomingEvents.map((e, i) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < upcomingEvents.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>
                  {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {e.type && <span style={{ marginLeft: 4, opacity: 0.6 }}>{"\u00b7"} {e.type}</span>}
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

        {/* Tensions */}
        <div className="dash-card" style={{ flex: 1, overflow: "hidden" }}>
          <SectionHeader title="Active Tensions" accent="var(--sunset)" linkHref="/tensions" />
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {tensions.slice(0, 5).map((t) => (
              <TensionRow key={t.id} tension={t} />
            ))}
            {tensions.length > 5 && (
              <Link href="/tensions" style={{ textDecoration: "none" }}>
                <div style={{ fontSize: 9, color: "var(--text-tertiary)", textAlign: "center", padding: "4px 0" }}>
                  +{tensions.length - 5} more
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ════ ROW 4 ════ What's Moving (full width) ══════════════════════ */}
      {topMovers.length > 0 && (
        <div className="dash-card" style={{ gridColumn: "1 / -1", gridRow: r3 }}>
          <SectionHeader title="What's Moving" accent="var(--moss-bright)" linkHref="/trends" linkLabel="All trends \u2192" />
          <div style={{
            display: "flex", gap: 8, overflow: "auto", scrollbarWidth: "none",
            padding: "2px 0",
          }} className="hide-scrollbar">
            {topMovers.map((t) => (
              <Link key={t.id} href={`/trends/${t.id}`} style={{ textDecoration: "none", flexShrink: 0 }}>
                <div className="card-hover" style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  minWidth: 200,
                  maxWidth: 260,
                  cursor: "pointer",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {t.name}
                    </span>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: cpsTextColor(t.cps) }}>{t.cps}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, marginLeft: 4,
                        color: t.delta > 0 ? "#2a8c4a" : "#E8127A",
                      }}>
                        {t.delta > 0 ? "+" : ""}{t.delta}
                      </span>
                    </div>
                  </div>
                  {t.summary && (
                    <p style={{
                      fontSize: 10, color: "var(--text-tertiary)", lineHeight: 1.4, margin: 0,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    } as React.CSSProperties}>
                      {t.summary}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
    </DashboardHome>
  );
}
