import Link from "next/link";
import { getResearchInsights, Evidence } from "@/lib/notion";

export const revalidate = 300;

function sentimentDot(s: string) {
  if (s === "Positive") return { color: "#2a8c4a", label: "\u2191 Positive" };
  if (s === "Negative") return { color: "#E8127A", label: "\u2193 Negative" };
  if (s === "Mixed")    return { color: "#FF8200", label: "~ Mixed" };
  return null;
}

function formatDate(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function ResearchPage() {
  const insights = await getResearchInsights(50);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
          Research & Insights
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
          {insights.length} studies & reports &middot; Data that changes how you see things
          {" · "}
          <Link href="/info/insights" style={{ color: "rgba(56,189,248,0.6)", textDecoration: "none", fontSize: 12 }} className="link-hover">
            About insights &rarr;
          </Link>
        </p>
      </div>

      {insights.length > 0 ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 12,
        }}>
          {insights.map((item) => (
            <InsightCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>\ud83d\udd2c</div>
          <p style={{ color: "var(--text-tertiary)", fontSize: 13, margin: "0 0 6px" }}>
            No research insights yet.
          </p>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0, lineHeight: 1.5 }}>
            Add research RSS feeds and run the pipeline.
          </p>
        </div>
      )}
    </div>
  );
}

function InsightCard({ item }: { item: Evidence }) {
  const dot = sentimentDot(item.sentiment);

  return (
    <div className="card-hover" style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: 16,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Top accent */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #38bdf8, rgba(56,189,248,0.1))" }} />

      {/* Meta row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12 }}>\ud83d\udd2c</span>
          {item.dateCaptured && (
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{formatDate(item.dateCaptured)}</span>
          )}
        </div>
        {dot && (
          <span style={{ fontSize: 10, fontWeight: 600, color: dot.color, background: `${dot.color}15`, padding: "1px 6px", borderRadius: 3 }}>
            {dot.label}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4,
        margin: "0 0 6px",
      }}>
        {item.title}
      </h3>

      {/* Summary */}
      {item.summary && (
        <p style={{
          fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, margin: "0 0 10px",
          display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden",
        } as React.CSSProperties}>
          {item.summary}
        </p>
      )}

      {/* Source link */}
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="source-link" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 3 }}>
          \u2197 Read study
        </a>
      )}
    </div>
  );
}
