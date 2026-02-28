import Link from "next/link";
import { notFound } from "next/navigation";
import { getTension, getTrendsForTension, getEvidenceForTension } from "@/lib/notion";
import TrendCard from "@/components/TrendCard";
import { cpsTextColor, cpsLabel } from "@/components/CpsBar";

export const revalidate = 300;

function weightLabel(w: number): string {
  if (w >= 9) return "Critical — dominant force right now";
  if (w >= 7) return "High — actively shaping culture";
  if (w >= 5) return "Moderate — present and relevant";
  return "Low — background context";
}

function weightColor(w: number): string {
  if (w >= 9) return "#ef4444";
  if (w >= 7) return "#f97316";
  if (w >= 5) return "#eab308";
  return "rgba(255,255,255,0.4)";
}

const PLATFORM_ICON: Record<string, string> = {
  Reddit: "🤝",
  RSS: "📰",
  News: "📰",
  Blog: "✍️",
  "Google Trends": "📈",
  Wikipedia: "📚",
  Social: "📱",
  Manual: "✋",
  Other: "🔗",
};

const SENTIMENT_COLOR: Record<string, string> = {
  Positive: "#4ade80",
  Negative: "#f87171",
  Neutral: "rgba(255,255,255,0.4)",
  Mixed: "#fbbf24",
};

export default async function TensionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tension, linkedTrends, evidence] = await Promise.all([
    getTension(id),
    getTrendsForTension(id),
    getEvidenceForTension(id),
  ]);

  if (!tension) notFound();

  const color = weightColor(tension.weight);
  const flashpoints = linkedTrends.filter(t => t.cps >= 80);
  const risingHeat = linkedTrends.filter(t => t.cps >= 60 && t.cps < 80);

  return (
    <div>

      {/* Back nav */}
      <Link href="/" style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 24 }}>
        ← Back to Radar
      </Link>

      {/* Header */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 28,
        marginBottom: 28,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6, letterSpacing: "0.06em" }}>
              CULTURAL TENSION
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0, lineHeight: 1.3 }}>
              {tension.name}
            </h1>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{tension.weight}<span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-tertiary)" }}>/10</span></div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>tension weight</div>
          </div>
        </div>

        {/* Weight bar */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${tension.weight * 10}%`, height: "100%", background: color, borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{weightLabel(tension.weight)}</div>
        </div>

        {/* Description */}
        {tension.description && (
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>
            {tension.description}
          </p>
        )}

        {/* Stats */}
        <div style={{ display: "flex", gap: 24, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{linkedTrends.length}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>linked trends</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>{flashpoints.length}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>flashpoints</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f97316" }}>{risingHeat.length}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>rising heat</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{evidence.length}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>evidence pieces</div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* Linked Trends */}
        <section>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 14px" }}>
            Trends driving this tension
          </h2>
          {linkedTrends.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {linkedTrends.map(trend => (
                <TrendCard key={trend.id} trend={trend} compact />
              ))}
            </div>
          ) : (
            <div style={{
              background: "var(--surface)", border: "1px dashed var(--border)",
              borderRadius: 10, padding: 32, textAlign: "center",
            }}>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13, margin: 0 }}>
                No linked trends yet. Run the pipeline to process signals.
              </p>
            </div>
          )}
        </section>

        {/* Evidence */}
        <section>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 14px" }}>
            Evidence & sources
          </h2>
          {evidence.length > 0 ? (
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 10, overflow: "hidden",
            }}>
              {evidence.map((e, i) => (
                <div key={e.id} style={{
                  padding: "12px 16px",
                  borderBottom: i < evidence.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  {/* Title + platform */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {e.url ? (
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-hover"
                          style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}
                        >
                          {e.title}
                        </a>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{e.title}</span>
                      )}
                    </div>
                    {e.sentiment && (
                      <span style={{
                        fontSize: 11, flexShrink: 0,
                        color: SENTIMENT_COLOR[e.sentiment] ?? "var(--text-tertiary)",
                      }}>
                        {e.sentiment}
                      </span>
                    )}
                  </div>
                  {/* Platform + date */}
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: e.summary ? 6 : 0 }}>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {PLATFORM_ICON[e.platform] ?? "🔗"} {e.platform}
                    </span>
                    {e.dateCaptured && (
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        {new Date(e.dateCaptured).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {e.url && (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-link"
                        style={{ marginLeft: "auto" }}
                      >
                        ↗ view source
                      </a>
                    )}
                  </div>
                  {/* Summary */}
                  {e.summary && (
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                      {e.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              background: "var(--surface)", border: "1px dashed var(--border)",
              borderRadius: 10, padding: 32, textAlign: "center",
            }}>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13, margin: 0 }}>
                No evidence captured yet.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
