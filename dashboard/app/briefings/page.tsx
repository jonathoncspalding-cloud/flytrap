import { getLatestBriefings, getTrends } from "@/lib/notion";
import BriefingViewer from "@/components/BriefingViewer";

export const revalidate = 0; // always fresh

export default async function BriefingsPage() {
  const [briefings, trends] = await Promise.all([
    getLatestBriefings(10),
    getTrends(),
  ]);

  // Build TrendRef list for BriefingViewer click matching
  const trendRefs = trends.map((t) => ({
    id: t.id,
    name: t.name,
    cps: t.cps,
    type: t.type,
    summary: t.summary,
  }));

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
          Cultural Briefings
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
          Daily AI-synthesized cultural intelligence — {briefings.length} in archive
        </p>
      </div>

      {briefings.length === 0 ? (
        <div style={{
          background: "var(--surface)", border: "1px dashed var(--border)",
          borderRadius: 12, padding: 64, textAlign: "center",
        }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 16, margin: "0 0 8px" }}>No briefings yet.</p>
          <p style={{ color: "var(--text-tertiary)", fontSize: 13, margin: "0 0 16px" }}>
            Run the briefing generator to create your first cultural briefing.
          </p>
          <code style={{
            background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)",
            padding: "8px 16px", borderRadius: 8, fontSize: 13, display: "inline-block",
          }}>
            python scripts/processors/briefing_generator.py
          </code>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {briefings.map((briefing, i) => (
            <div
              key={briefing.id}
              style={{
                background: "var(--surface)",
                border: i === 0 ? "1px solid rgba(74,222,128,0.2)" : "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div style={{
                padding: "16px 24px",
                borderBottom: "1px solid var(--border)",
                background: i === 0 ? "rgba(74,222,128,0.03)" : "transparent",
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                      {briefing.date} Briefing
                    </h2>
                    {i === 0 && (
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        background: "rgba(74,222,128,0.12)", color: "#4ade80",
                        padding: "2px 8px", borderRadius: 99,
                      }}>
                        Latest
                      </span>
                    )}
                  </div>
                  {briefing.highlights && (
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>
                      {briefing.highlights.replace(/\*\*/g, "")}
                    </p>
                  )}
                </div>
                {briefing.flashpointCount > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    background: "rgba(74,222,128,0.1)", color: "#4ade80",
                    padding: "3px 10px", borderRadius: 99, flexShrink: 0,
                  }}>
                    ⚡ {briefing.flashpointCount} flashpoint{briefing.flashpointCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Content — BriefingViewer (interactive) for latest, simple for archive */}
              <div style={{ padding: "20px 24px" }}>
                {briefing.content ? (
                  i === 0 ? (
                    <BriefingViewer
                      content={briefing.content}
                      trends={trendRefs}
                      briefingDate={briefing.date}
                      flashpointCount={briefing.flashpointCount}
                    />
                  ) : (
                    // Archive briefings: simple prose, no interactive elements
                    <ArchiveBriefingContent content={briefing.content} />
                  )
                ) : (
                  <p style={{ color: "var(--text-tertiary)", fontSize: 13, fontStyle: "italic" }}>
                    Briefing content not available.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Archive briefing — plain text renderer for older briefings ─────────────────

function ArchiveBriefingContent({ content }: { content: string }) {
  // Strip markdown headings to plain text for compact archive view
  const lines = content
    .split("\n")
    .filter((l) => !l.startsWith("---") && !l.startsWith("*Briefing generated"))
    .map((l) => {
      if (l.startsWith("### ")) return { type: "h3", text: l.replace(/^###\s*/, "") };
      if (l.startsWith("## "))  return { type: "h2", text: l.replace(/^##\s*/, "") };
      if (l.startsWith("- ") || l.startsWith("* ")) return { type: "li", text: l.replace(/^[-*]\s*/, "").replace(/\*\*/g, "") };
      return { type: "p", text: l.replace(/\*\*/g, "") };
    })
    .filter((l) => l.text.trim());

  return (
    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65 }}>
      {lines.map((l, i) => {
        if (l.type === "h3") return (
          <div key={i} style={{
            fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.04em", textTransform: "uppercase",
            margin: "16px 0 6px",
          }}>
            {l.text}
          </div>
        );
        if (l.type === "li") return (
          <div key={i} style={{
            display: "flex", gap: 8, marginBottom: 5,
            color: "rgba(255,255,255,0.55)",
          }}>
            <span style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>—</span>
            <span>{l.text}</span>
          </div>
        );
        return (
          <p key={i} style={{ margin: "0 0 6px", color: "rgba(255,255,255,0.55)" }}>
            {l.text}
          </p>
        );
      })}
    </div>
  );
}
