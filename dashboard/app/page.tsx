import Link from "next/link";
import {
  getTrends, getTensions, getUpcomingEvents,
  getLatestBriefings, getActiveMoments, getSyncRecap,
  getLatestSocialSignals,
  Trend, CulturalMoment, Tension, Evidence,
} from "@/lib/notion";
import DashboardHome from "@/components/DashboardHome";
import { cpsTextColor, cpsBarColor } from "@/components/CpsBar";

export const revalidate = 0; // always fresh — command center must show current state

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

/** Extract key movements from briefing — works with both v2 (Flashpoints) and v3 (What Moved Overnight) formats. */
function extractBriefingPreviews(content: string): { name: string; why: string }[] {
  const lines = content.split("\n");
  let inSection = false;
  const results: { name: string; why: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match v3 "What Moved" or v2 "Flashpoints" section
    if (line.includes("###") && (line.includes("What Moved") || line.includes("Flashpoint"))) {
      inSection = true; continue;
    }
    if (inSection && line.startsWith("###")) break;
    if (inSection && line.trim().startsWith("**")) {
      // Single-line: **Name** — description  or  **Name** (CPS: XX) — description
      const inlineMatch = line.match(/\*\*([^*]+)\*\*\s*(?:\([^)]*\)\s*)?[\u2014\u2013—-]\s*(.*)/);
      if (inlineMatch) {
        const name = inlineMatch[1].replace(/\s*\([^)]*\)/gi, "").replace(/^[📍🔴🔮\s]+/, "").trim();
        const why = inlineMatch[2].split(/\.\s/)[0].replace(/\*\*/g, "").trim();
        results.push({ name, why: why.length > 120 ? why.slice(0, 117) + "\u2026" : why });
      } else {
        // Multi-line: **Name**\ndescription on next line
        const nameMatch = line.match(/\*\*([^*]+)\*\*/);
        if (nameMatch) {
          const name = nameMatch[1].replace(/\s*\([^)]*\)/gi, "").replace(/^[📍🔴🔮\s]+/, "").trim();
          let why = "";
          for (let j = i + 1; j < lines.length && j <= i + 3; j++) {
            const next = lines[j].trim();
            if (next && !next.startsWith("**") && !next.startsWith("###")) {
              why = next.split(/\.\s/)[0].replace(/\*\*/g, "").trim();
              break;
            }
          }
          if (why) {
            results.push({ name, why: why.length > 120 ? why.slice(0, 117) + "\u2026" : why });
          }
        }
      }
    }
    if (results.length >= 5) break;
  }
  return results;
}

/** Extract the opening thesis paragraph from a v3 briefing. */
function extractBriefingThesis(content: string): string {
  const lines = content.split("\n");
  let foundHeader = false;
  const thesis: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ") && line.includes("Cultural Landscape")) {
      foundHeader = true; continue;
    }
    if (foundHeader) {
      if (line.startsWith("###")) break; // hit first section
      const trimmed = line.trim();
      if (trimmed) thesis.push(trimmed);
    }
  }
  const full = thesis.join(" ").replace(/\*\*/g, "");
  return full.length > 300 ? full.slice(0, 297) + "\u2026" : full;
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

function TensionRow({ tension, isActive }: { tension: Tension; isActive?: boolean }) {
  const color = tension.weight >= 9 ? "#E8127A" : tension.weight >= 7 ? "#FF8200" : tension.weight >= 5 ? "rgba(255,130,0,0.6)" : "var(--text-secondary)";
  return (
    <Link href={`/tensions/${tension.id}`} style={{ textDecoration: "none" }}>
      <div className="row-hover" style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        padding: "7px 6px", borderBottom: "1px solid var(--border)", cursor: "pointer",
        borderLeft: isActive ? `2px solid ${color}` : "2px solid transparent",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tension.name}
            </div>
            {isActive && (
              <span style={{ fontSize: 8, fontWeight: 700, color, background: `${color}15`, padding: "0px 4px", borderRadius: 3, flexShrink: 0 }}>IN PLAY</span>
            )}
          </div>
          {tension.description && (
            <div style={{
              fontSize: 10, color: "var(--text-tertiary)", lineHeight: 1.4, marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {tension.description}
            </div>
          )}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color, flexShrink: 0, width: 22, textAlign: "right", marginTop: 1 }}>
          {tension.weight}
        </span>
      </div>
    </Link>
  );
}

/* ── Social Radar ─────────────────────────────────────────────────────── */

const SOCIAL_PLATFORM_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  TikTok:  { label: "TikTok",    color: "#ff0050", icon: "\ud83d\udcf1" },
  Social:  { label: "X",         color: "rgba(242,239,237,0.7)", icon: "\ud83d\udc26" },
  Reddit:  { label: "Reddit",    color: "#ff4500", icon: "\ud83d\udcac" },
  Bluesky: { label: "Bluesky",   color: "#0085ff", icon: "\ud83e\udd8b" },
};

/** Strip platform prefix from signal titles (e.g. "TikTok Trending: #iftar" -> "#iftar") */
function stripPlatformPrefix(title: string): string {
  const patterns = [
    /^TikTok\s+Trending\s*(?:\([^)]*\))?:\s*/i,
    /^X\s+Trending\s*\([^)]*\):\s*/i,
    /^X\s+Trending:\s*/i,
    /^Reddit\s+r\/\S+:\s*/i,
    /^Reddit\s+/i,
    /^Bluesky\s+Trending:\s*/i,
    /^Bluesky\s+/i,
    /^Social:\s*/i,
  ];
  for (const p of patterns) {
    if (p.test(title)) return title.replace(p, "");
  }
  const colonIdx = title.indexOf(": ");
  if (colonIdx > 0 && colonIdx < 30) {
    const prefix = title.slice(0, colonIdx);
    if (Object.keys(SOCIAL_PLATFORM_CONFIG).some((k) => prefix.toLowerCase().includes(k.toLowerCase()))) {
      return title.slice(colonIdx + 2);
    }
  }
  return title;
}

/** Extract a Context snippet from rawContent for enriched X/Trends24 signals. */
function extractContext(rawContent: string | undefined): string | null {
  if (!rawContent) return null;
  const match = rawContent.match(/Context:\s*(.+?)(?:\n|$)/i);
  if (!match) return null;
  const ctx = match[1].trim();
  return ctx.length > 90 ? ctx.slice(0, 87) + "\u2026" : ctx;
}

function SocialRadarWidget({
  signals,
  signalsByPlatform,
  totalSignals,
  syncTimestamp,
}: {
  signals: Evidence[];
  signalsByPlatform: Record<string, number>;
  totalSignals: number;
  syncTimestamp: string;
}) {
  // Show top 12 ranked signals (already sorted by score from getLatestSocialSignals)
  const rankedSignals = signals.slice(0, 12);
  const hasSignals = rankedSignals.length > 0;
  const topScore = rankedSignals[0]?._score ?? 0;
  const platforms = Object.entries(signalsByPlatform).sort((a, b) => b[1] - a[1]);
  const maxSignals = platforms.length > 0 ? platforms[0][1] : 0;

  return (
    <>
      <SectionHeader title="Social Radar" accent="#ff0050" />

      {hasSignals ? (
        <div style={{ marginBottom: 8 }}>
          {rankedSignals.map((s, idx) => {
            const cleanTitle = stripPlatformPrefix(s.title);
            const conf = SOCIAL_PLATFORM_CONFIG[s.platform];
            const isTop = idx === 0 && topScore > 30;

            // For display text: prefer summary if it exists, else try context from rawContent
            const contextSnippet = extractContext(s.rawContent);
            const displaySub = s.summary && s.summary.length > 10
              ? (s.summary.length > 90 ? s.summary.slice(0, 87) + "\u2026" : s.summary)
              : contextSnippet;

            const row = (
              <div className="row-hover" style={{
                display: "flex", alignItems: "flex-start", gap: 6,
                padding: isTop ? "6px 6px 6px 4px" : "4px 6px",
                borderBottom: "1px solid var(--border)",
                borderLeft: isTop ? "2px solid #ff0050" : "2px solid transparent",
                cursor: s.url ? "pointer" : "default",
              }}>
                {/* Platform badge */}
                <span style={{
                  fontSize: 8, fontWeight: 700,
                  color: conf?.color ?? "var(--text-tertiary)",
                  background: `${conf?.color ?? "var(--text-tertiary)"}15`,
                  padding: "1px 4px", borderRadius: 3,
                  flexShrink: 0, marginTop: 2,
                  letterSpacing: "0.03em",
                }}>
                  {conf?.label ?? s.platform}
                </span>

                {/* Title + subtitle */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11, fontWeight: isTop ? 600 : 500,
                    color: "var(--text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    lineHeight: 1.4,
                  }}>
                    {cleanTitle}
                  </div>
                  {displaySub && (
                    <div style={{
                      fontSize: 10, color: "var(--text-tertiary)", lineHeight: 1.35,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      marginTop: 1,
                    }}>
                      {displaySub}
                    </div>
                  )}
                </div>

                {/* Engagement badge */}
                {s._engagementLabel && (
                  <span style={{
                    fontSize: 8, fontWeight: 700,
                    color: "#ff0050", background: "rgba(255,0,80,0.08)",
                    padding: "1px 5px", borderRadius: 3,
                    flexShrink: 0, marginTop: 2,
                    whiteSpace: "nowrap",
                  }}>
                    {s._engagementLabel}
                  </span>
                )}

                {/* Linked indicator */}
                {s.linkedTrendIds && s.linkedTrendIds.length > 0 && !s._engagementLabel && (
                  <span style={{
                    fontSize: 8, fontWeight: 600,
                    color: "var(--moss-bright)", background: "rgba(42,140,74,0.08)",
                    padding: "1px 4px", borderRadius: 3,
                    flexShrink: 0, marginTop: 2,
                  }}>
                    linked
                  </span>
                )}
              </div>
            );

            if (s.url) {
              return (
                <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
                  {row}
                </a>
              );
            }
            return <div key={s.id}>{row}</div>;
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ fontSize: 16, marginBottom: 4, opacity: 0.5 }}>{"\ud83d\udce1"}</div>
          <p style={{ fontSize: 10, color: "var(--text-tertiary)", margin: 0, lineHeight: 1.5 }}>
            No social signals collected yet.
          </p>
        </div>
      )}

      {/* Compact Signal Pulse footer */}
      <div style={{
        borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 2,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 6,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            All Sources
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)" }}>
            {totalSignals} <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>today</span>
          </span>
        </div>
        {platforms.slice(0, 7).map(([platform, count]) => (
          <PlatformBar key={platform} platform={platform} count={count} maxCount={maxSignals} />
        ))}
        {platforms.length === 0 && (
          <p style={{ fontSize: 9, color: "var(--text-tertiary)", margin: 0 }}>No signals collected yet today.</p>
        )}

        {/* Last sync indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, opacity: 0.7, marginTop: 4 }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--moss-bright)", display: "inline-block" }} />
          <span style={{ fontSize: 8, color: "var(--text-tertiary)" }}>
            Last sync: {new Date(syncTimestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
          </span>
        </div>
      </div>
    </>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default async function DashboardPage() {
  const [trends, tensions, events, briefings, moments, syncRecap, socialSignals] = await Promise.all([
    getTrends(),
    getTensions(),
    getUpcomingEvents(30),
    getLatestBriefings(1),
    getActiveMoments(),
    getSyncRecap(),
    getLatestSocialSignals(20),
  ]);

  const flashpoints = trends.filter((t) => t.cps >= 80);
  const latestBriefing = briefings[0] ?? null;
  const topMovers = getTopMovers(trends);
  const upcomingEvents = events.slice(0, 5);

  // Briefing previews (thesis + key movements)
  const briefingPreviews = latestBriefing ? extractBriefingPreviews(latestBriefing.content) : [];
  const briefingThesis = latestBriefing ? extractBriefingThesis(latestBriefing.content) : "";

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

  // Tensions in Play — filter ambient, prioritize those linked to active trends
  const AMBIENT_THRESHOLD = 0.5;
  const activeTensionIds = new Set<string>();
  // Collect tension IDs linked to flashpoints + top movers (the "in play" signal)
  for (const t of [...flashpoints, ...topMovers]) {
    for (const tid of t.linkedTensions) activeTensionIds.add(tid);
  }
  const tensionsInPlay = tensions
    .map((t) => {
      // Prevalence: what fraction of active trends link to this tension?
      const linkedCount = trends.filter((tr) => tr.linkedTensions.includes(t.id)).length;
      const prevalence = trends.length > 0 ? linkedCount / trends.length : 0;
      const isAmbient = prevalence >= AMBIENT_THRESHOLD;
      const isActive = activeTensionIds.has(t.id); // linked to a flashpoint or mover
      return { ...t, prevalence, linkedCount, isAmbient, isActive };
    })
    .filter((t) => !t.isAmbient) // drop ambient
    .sort((a, b) => {
      // Active tensions first, then by weight
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.weight - a.weight;
    })
    .slice(0, 5);

  return (
    <DashboardHome hasTrends={trends.length > 0}>
    <div className="dashboard-grid">

      {/* ════ ROW 1 ════ Social Radar (primary) | Briefing (compact) ══════ */}

      {/* Social Radar — 3 columns (primary widget) */}
      <div className="dash-card" style={{ gridColumn: "1 / 4", gridRow: "1" }}>
        <SocialRadarWidget
          signals={socialSignals}
          signalsByPlatform={syncRecap.signalsByPlatform}
          totalSignals={syncRecap.totalSignals}
          syncTimestamp={syncRecap.timestamp}
        />
      </div>

      {/* Briefing Command Panel — 2 columns (compact) */}
      <div className="dash-card dash-card-briefing" style={{ gridColumn: "4 / 6", gridRow: "1" }}>
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

            {/* Briefing thesis */}
            {briefingThesis && (
              <p style={{
                fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55,
                margin: "0 0 10px", fontStyle: "italic",
              }}>
                {briefingThesis}
              </p>
            )}

            {/* Key movements */}
            {briefingPreviews.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "var(--moss-bright)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                  What Moved
                </div>
                {briefingPreviews.slice(0, 2).map((fp, i) => (
                  <div key={i} style={{ marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{fp.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 6 }}>{"\u2014"} {fp.why}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Top tension in play (non-ambient) */}
            {tensionsInPlay.length > 0 && (
              <div style={{
                background: "rgba(255,130,0,0.04)", border: "1px solid rgba(255,130,0,0.12)",
                borderRadius: 6, padding: "8px 10px", marginBottom: 0,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#FF8200", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                  {"\ud83c\udf0a"} Tension in Play
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Link href={`/tensions/${tensionsInPlay[0].id}`} style={{ textDecoration: "none" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{tensionsInPlay[0].name}</span>
                  </Link>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#FF8200" }}>{tensionsInPlay[0].weight}/10</span>
                </div>
                {tensionsInPlay[0].description && (
                  <p style={{
                    fontSize: 10, color: "var(--text-tertiary)", margin: "4px 0 0", lineHeight: 1.45,
                    display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden",
                  } as React.CSSProperties}>
                    {tensionsInPlay[0].description}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: "var(--text-tertiary)", fontSize: 11, margin: 0 }}>No briefing yet. Run the pipeline to generate one.</p>
        )}
      </div>

      {/* ════ ROW 2 ════ Moments (compact) | Calendar + Tensions ═════════ */}

      {/* Predicted Moments — 3 columns, compact */}
      <div className="dash-card" style={{ gridColumn: "1 / 4", gridRow: "2" }}>
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
                  {items.slice(0, 2).map((m) => (
                    <MomentRow key={m.id} moment={m} />
                  ))}
                  {items.length > 2 && (
                    <div style={{ fontSize: 9, color: "var(--text-tertiary)", textAlign: "center", padding: "3px 0" }}>
                      +{items.length - 2} more
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
      <div style={{ gridColumn: "4 / 6", gridRow: "2", display: "flex", flexDirection: "column", gap: 10 }}>

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

        {/* Tensions in Play */}
        <div className="dash-card" style={{ flex: 1, overflow: "hidden" }}>
          <SectionHeader title="Tensions in Play" accent="var(--sunset)" linkHref="/tensions" />
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {tensionsInPlay.length > 0 ? tensionsInPlay.map((t) => (
              <TensionRow key={t.id} tension={t} isActive={t.isActive} />
            )) : (
              <p style={{ fontSize: 10, color: "var(--text-tertiary)", margin: 0, padding: "6px 0" }}>No specific tensions active right now.</p>
            )}
            {tensions.length > 5 && (
              <Link href="/tensions" style={{ textDecoration: "none" }}>
                <div style={{ fontSize: 9, color: "var(--text-tertiary)", textAlign: "center", padding: "4px 0" }}>
                  All {tensions.length} tensions →
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ════ ROW 4 ════ What's Moving (full width) ══════════════════════ */}
      {topMovers.length > 0 && (
        <div className="dash-card" style={{ gridColumn: "1 / -1", gridRow: "3" }}>
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
