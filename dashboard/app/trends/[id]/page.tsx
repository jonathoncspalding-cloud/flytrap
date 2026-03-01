import { notFound } from "next/navigation";
import Link from "next/link";
import { getTrend, getEvidenceForTrend } from "@/lib/notion";
import CpsBar, { cpsEmoji, cpsLabel, cpsTextColor } from "@/components/CpsBar";
import SparkLine from "@/components/SparkLine";

export const revalidate = 300;

const TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  "Macro Trend":      { bg: "rgba(139,92,246,0.15)", color: "#a78bfa" },
  "Micro Trend":      { bg: "rgba(232,18,122,0.15)", color: "rgba(232,18,122,0.7)" },
  "Emerging Signal":  { bg: "rgba(255,130,0,0.12)",  color: "#FF8200" },
  "Scheduled Event":  { bg: "rgba(0,79,34,0.12)",  color: "#2a8c4a" },
  "Predicted Moment": { bg: "rgba(232,18,122,0.12)",  color: "#E8127A" },
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Exploding: { bg: "rgba(232,18,122,0.15)",   color: "#E8127A" },
  Rising:    { bg: "rgba(255,130,0,0.15)",   color: "#FF8200" },
  Peaked:    { bg: "rgba(255,130,0,0.15)",    color: "#FF8200" },
  Stable:    { bg: "rgba(0,79,34,0.12)",    color: "#2a8c4a" },
  Emerging:  { bg: "rgba(232,18,122,0.15)",   color: "rgba(232,18,122,0.7)" },
  Archived:  { bg: "rgba(255,255,255,0.06)",  color: "rgba(255,255,255,0.3)" },
};

const PLATFORM_ICONS: Record<string, string> = {
  Reddit: "🟠", "Twitter/X": "𝕏", TikTok: "🎵",
  YouTube: "▶️", Bluesky: "🦋", "Hacker News": "🔸",
  News: "📰", Blog: "✍️", "Google Trends": "📈",
  Wikipedia: "📚", RSS: "📡", Research: "🔬",
  Manual: "✋", Other: "🔗",
};

const SENTIMENT_COLORS: Record<string, { bg: string; color: string }> = {
  Positive: { bg: "rgba(0,79,34,0.12)",   color: "#2a8c4a" },
  Negative: { bg: "rgba(232,18,122,0.12)",   color: "#E8127A" },
  Neutral:  { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" },
  Mixed:    { bg: "rgba(255,130,0,0.12)",   color: "#FF8200" },
};

function confidenceLabel(count: number, platforms: number): { label: string; color: string } {
  if (count === 0)     return { label: "No evidence", color: "rgba(255,255,255,0.25)" };
  if (count >= 15 && platforms >= 4) return { label: "High confidence", color: "#2a8c4a" };
  if (count >= 8  && platforms >= 3) return { label: "Good confidence", color: "#3da65a" };
  if (count >= 4  && platforms >= 2) return { label: "Building",        color: "#FF8200" };
  if (count >= 2)                    return { label: "Early signal",     color: "#FF8200" };
  return { label: "Hypothesis",  color: "#E8127A" };
}

export default async function TrendDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [trend, evidence] = await Promise.all([
    getTrend(id),
    getEvidenceForTrend(id),
  ]);

  if (!trend) notFound();

  // Platform breakdown
  const platformCounts: Record<string, number> = {};
  evidence.forEach((e) => {
    platformCounts[e.platform] = (platformCounts[e.platform] ?? 0) + 1;
  });
  const sortedPlatforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);
  const platformCount = sortedPlatforms.length;
  const confidence = confidenceLabel(evidence.length, platformCount);

  const typeStyle   = TYPE_STYLES[trend.type]   ?? { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" };
  const statusStyle = STATUS_STYLES[trend.status] ?? { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" };
  const textColor   = cpsTextColor(trend.cps);
  const sparkline   = trend.sparkline ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <Link href="/trends" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>
          ← Trends
        </Link>
        <span style={{ color: "var(--border-strong)" }}>/</span>
        <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {trend.name}
        </span>
      </div>

      {/* Hero card */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        {/* Top accent strip — color by status */}
        <div style={{
          height: 3,
          background: statusStyle.color,
          opacity: 0.7,
        }} />

        <div style={{ padding: "24px 24px 20px" }}>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

            {/* Left: badges + name + summary */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500, background: typeStyle.bg, color: typeStyle.color }}>
                  {trend.type}
                </span>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500, background: statusStyle.bg, color: statusStyle.color }}>
                  {trend.status}
                </span>
                {trend.pinned && (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "var(--text-tertiary)" }}>
                    📌 Pinned
                  </span>
                )}
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: confidence.color === "#2a8c4a" ? "rgba(0,79,34,0.12)" : "rgba(255,255,255,0.06)", color: confidence.color, fontWeight: 600 }}>
                  {confidence.label}
                </span>
              </div>

              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px", lineHeight: 1.3 }}>
                {trend.name}
              </h1>

              {trend.summary && (
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
                  {trend.summary}
                </p>
              )}
            </div>

            {/* Right: CPS + sparkline */}
            <div style={{ textAlign: "center", flexShrink: 0, minWidth: 110 }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: textColor, lineHeight: 1 }}>
                {trend.cps}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                CPS
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, fontWeight: 500 }}>
                {cpsEmoji(trend.cps)} {cpsLabel(trend.cps)}
              </div>
              {sparkline.length >= 2 && (
                <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
                  <SparkLine data={sparkline} width={80} height={26} />
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <CpsBar score={trend.cps} />
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 24, marginTop: 20,
            paddingTop: 16, borderTop: "1px solid var(--border)",
          }}>
            {/* Signal count — prominent */}
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: confidence.color }}>{evidence.length}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>Signals</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: platformCount >= 3 ? "#2a8c4a" : platformCount >= 2 ? "#FF8200" : "var(--text-secondary)" }}>
                {platformCount}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>Platforms</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{trend.momentum}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>Momentum</div>
            </div>
            {sparkline.length >= 2 && (
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{sparkline.length}d</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>CPS History</div>
              </div>
            )}
            {trend.firstDetected && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                  {new Date(trend.firstDetected).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>First detected</div>
              </div>
            )}
            {trend.lastUpdated && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                  {new Date(trend.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>Last updated</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "start" }}>

        {/* Left: evidence timeline */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span>Evidence Timeline</span>
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)" }}>({evidence.length})</span>
          </div>

          {evidence.length === 0 ? (
            <div style={{
              background: "var(--surface)", border: "1px dashed var(--border)",
              borderRadius: 10, padding: "48px 24px", textAlign: "center",
            }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>📭</div>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 6px" }}>
                No evidence linked to this trend yet.
              </p>
              <p style={{ color: "var(--text-tertiary)", fontSize: 12, margin: 0 }}>
                Evidence accumulates as signals are processed daily.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {evidence.map((e) => {
                const sentimentStyle = SENTIMENT_COLORS[e.sentiment] ?? { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" };
                return (
                  <div key={e.id} style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "12px 14px",
                    transition: "border-color 0.12s",
                  }}
                    className="card-hover"
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: e.summary ? 8 : 0 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} title={e.platform}>
                          {PLATFORM_ICONS[e.platform] ?? "🔗"}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {e.url ? (
                            <a
                              href={e.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="source-link"
                              style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", textDecoration: "none", display: "block", lineHeight: 1.4 }}
                            >
                              {e.title}
                            </a>
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", display: "block", lineHeight: 1.4 }}>
                              {e.title}
                            </span>
                          )}
                          <div style={{ display: "flex", gap: 10, marginTop: 4, alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{e.platform}</span>
                            {e.dateCaptured && (
                              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                                {new Date(e.dateCaptured).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {e.sentiment && (
                        <span style={{
                          fontSize: 11, padding: "2px 7px", borderRadius: 4, flexShrink: 0,
                          fontWeight: 500, background: sentimentStyle.bg, color: sentimentStyle.color,
                        }}>
                          {e.sentiment}
                        </span>
                      )}
                    </div>
                    {e.summary && (
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, margin: 0, paddingLeft: 25 }}>
                        {e.summary}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Forecast */}
          {trend.forecast && (
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderLeft: "3px solid #E8127A",
              borderRadius: 8,
              padding: "14px 16px",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(232,18,122,0.7)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                🔮 Forecast
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                {trend.forecast}
              </p>
            </div>
          )}

          {/* Channel heatmap */}
          {sortedPlatforms.length > 0 && (
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "14px 16px",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
                📡 Channel Activity
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sortedPlatforms.map(([platform, count]) => {
                  const maxCount = sortedPlatforms[0][1];
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={platform}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                        <span>{PLATFORM_ICONS[platform] ?? "🔗"} {platform}</span>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{count}</span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "var(--blue)", borderRadius: 99, opacity: 0.7 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Signal confidence breakdown */}
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "14px 16px",
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
              🎯 Signal Confidence
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Total signals</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: confidence.color }}>{evidence.length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Platform spread</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: platformCount >= 3 ? "#2a8c4a" : "#FF8200" }}>{platformCount}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Assessment</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: confidence.color }}>{confidence.label}</span>
              </div>
            </div>
            <div style={{
              marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)",
              fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.5
            }}>
              {evidence.length === 0 && "No signals yet. Trend was seeded manually."}
              {evidence.length >= 1 && evidence.length < 3 && "Hypothesis — needs more corroboration before acting."}
              {evidence.length >= 3 && evidence.length < 8 && "Early stage — trend is real but thin. Watch closely."}
              {evidence.length >= 8 && evidence.length < 15 && "Solid — enough evidence to brief a client."}
              {evidence.length >= 15 && "Strong — briefable across multiple platforms and contexts."}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
