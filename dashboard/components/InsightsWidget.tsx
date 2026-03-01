/**
 * InsightsWidget — Research & data-driven cultural insights panel.
 *
 * Shows studies, surveys, reports, and stat-driven findings that have
 * outsized relevance to culture, consumer behaviour, or brand strategy.
 * Populated from Evidence DB where Source Platform = "Research".
 */

import type { Evidence } from "@/lib/notion";

// ── Helpers ────────────────────────────────────────────────────────────────────

function sentimentDot(s: string) {
  if (s === "Positive") return { color: "#2a8c4a", label: "↑" };
  if (s === "Negative") return { color: "#E8127A", label: "↓" };
  if (s === "Mixed")    return { color: "#FF8200", label: "~" };
  return null;
}

function formatDate(d: string | null): string {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── InsightCard ────────────────────────────────────────────────────────────────

function InsightCard({ item, isLast }: { item: Evidence; isLast: boolean }) {
  const dot = sentimentDot(item.sentiment);

  return (
    <div style={{
      padding: "13px 16px",
      borderBottom: isLast ? "none" : "1px solid var(--border)",
    }}>
      {/* Meta row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        marginBottom: 5,
      }}>
        <span style={{ fontSize: 11 }}>🔬</span>
        {item.platform && item.platform !== "Research" && (
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>
            {item.platform}
          </span>
        )}
        {item.dateCaptured && (
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {item.platform && item.platform !== "Research" ? "· " : ""}{formatDate(item.dateCaptured)}
          </span>
        )}
        {dot && (
          <span style={{
            marginLeft: "auto",
            fontSize: 11, fontWeight: 700,
            color: dot.color,
          }}>
            {dot.label}
          </span>
        )}
      </div>

      {/* Title */}
      <p style={{
        fontSize: 13, fontWeight: 500,
        color: "var(--text-primary)",
        margin: "0 0 5px", lineHeight: 1.4,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      } as React.CSSProperties}>
        {item.title}
      </p>

      {/* Summary */}
      {item.summary && (
        <p style={{
          fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55,
          margin: "0 0 7px",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        } as React.CSSProperties}>
          {item.summary}
        </p>
      )}

      {/* Source link */}
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11, color: "rgba(0,79,34,0.6)",
            textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 3,
          }}
          className="source-link"
        >
          ↗ Read study
        </a>
      )}
    </div>
  );
}

// ── InsightsWidget ─────────────────────────────────────────────────────────────

export default function InsightsWidget({ insights }: { insights: Evidence[] }) {
  if (insights.length === 0) {
    return (
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "24px 16px", textAlign: "center",
      }}>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "0 0 6px" }}>
          No research insights yet.
        </p>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0, lineHeight: 1.5 }}>
          Add research RSS feeds and run the pipeline.<br />
          Studies/surveys auto-tag as <code style={{ background: "var(--surface-raised)", padding: "1px 5px", borderRadius: 3 }}>Research</code> platform.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 10, overflow: "hidden",
    }}>
      {insights.map((item, i) => (
        <InsightCard key={item.id} item={item} isLast={i === insights.length - 1} />
      ))}
    </div>
  );
}
