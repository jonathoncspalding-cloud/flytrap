/**
 * BriefingViewer — Interactive briefing renderer.
 *
 * Parses markdown briefing content and makes bold trend names clickable.
 * When clicked, a side drawer slides in showing:
 *   - Trend CPS, type, and summary
 *   - The actual evidence items (signals) that informed the analysis
 *   - Clickable source links
 *
 * Uses react-markdown with a custom `strong` renderer that intercepts
 * bold text matching a known trend name.
 */
"use client";

import { useState, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { cpsLabel, cpsTextColor, cpsBarColor } from "./CpsBar";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TrendRef {
  id: string;
  name: string;
  cps: number;
  type: string;
  summary: string;
}

interface EvidenceItem {
  id: string;
  title: string;
  url: string | null;
  platform: string;
  dateCaptured: string | null;
  summary: string;
  sentiment: string;
}

interface DrawerData {
  trend: TrendRef & { forecast?: string; firstDetected?: string; lastUpdated?: string };
  evidence: EvidenceItem[];
}

interface BriefingViewerProps {
  content: string;
  /** Map of lowercase trend name → TrendRef for click matching */
  trends: TrendRef[];
  briefingDate: string;
  flashpointCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const PLATFORM_EMOJI: Record<string, string> = {
  Reddit: "🟠",
  RSS: "📰",
  News: "📰",
  Research: "🔬",
  Social: "💬",
  Wikipedia: "📖",
  YouTube: "▶️",
  Bluesky: "🦋",
};

function platformEmoji(p: string) {
  return PLATFORM_EMOJI[p] ?? "🔗";
}

function sentimentColor(s: string): string {
  if (s === "Positive") return "#2a8c4a";
  if (s === "Negative") return "#E8127A";
  if (s === "Mixed") return "#FF8200";
  return "rgba(255,255,255,0.35)";
}

function formatDate(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

// ── Evidence Drawer ────────────────────────────────────────────────────────────

function EvidenceDrawer({
  trendRef,
  onClose,
}: {
  trendRef: TrendRef;
  onClose: () => void;
}) {
  const [data, setData] = useState<DrawerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setError(null);

    fetch(`/api/trend-detail/${trendRef.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [trendRef.id]);

  const textColor = cpsTextColor(trendRef.cps);
  const barColor = cpsBarColor(trendRef.cps);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 420, maxWidth: "92vw",
        background: "#1a1a1a",
        borderLeft: "1px solid rgba(255,255,255,0.1)",
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 48px rgba(0,0,0,0.5)",
        animation: "slideInRight 0.2s ease-out",
      }}>
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: "18px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Type badge */}
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
                color: "rgba(255,255,255,0.4)", textTransform: "uppercase",
                display: "block", marginBottom: 6,
              }}>
                {trendRef.type || "Trend"}
              </span>
              <h2 style={{
                fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.92)",
                margin: "0 0 10px", lineHeight: 1.3,
              }}>
                {trendRef.name}
              </h2>

              {/* CPS + label */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: textColor, lineHeight: 1 }}>
                  {trendRef.cps}
                </span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: textColor }}>{cpsLabel(trendRef.cps)}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Cultural Potency Score</div>
                </div>
              </div>

              {/* CPS bar */}
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 10 }}>
                <div style={{ width: `${trendRef.cps}%`, height: "100%", background: barColor, borderRadius: 2 }} />
              </div>

              {trendRef.summary && (
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.55, margin: 0 }}>
                  {trendRef.summary}
                </p>
              )}
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, width: 30, height: 30,
                color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 16,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          {/* View full trend link */}
          <Link href={`/trends/${trendRef.id}`} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 12, color: textColor, textDecoration: "none",
            marginTop: 12, opacity: 0.85,
          }}>
            View full trend page →
          </Link>
        </div>

        {/* Evidence */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
            marginBottom: 12,
          }}>
            Supporting Signals ({loading ? "…" : (data?.evidence.length ?? 0)})
          </div>

          {loading && (
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
              Loading evidence…
            </div>
          )}

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#fca5a5",
            }}>
              {error}
            </div>
          )}

          {data?.evidence.length === 0 && !loading && (
            <div style={{
              color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", padding: "32px 0",
              lineHeight: 1.6,
            }}>
              No evidence items linked yet.
              <br/>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
                Signals will appear after the next pipeline run.
              </span>
            </div>
          )}

          {data?.evidence.map((ev) => (
            <div key={ev.id} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8, padding: "12px 14px",
              marginBottom: 10,
            }}>
              {/* Platform + date + sentiment */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 12 }}>{platformEmoji(ev.platform)}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
                  {ev.platform}
                </span>
                {ev.dateCaptured && (
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                    · {formatDate(ev.dateCaptured)}
                  </span>
                )}
                {ev.sentiment && ev.sentiment !== "Neutral" && (
                  <span style={{
                    marginLeft: "auto", fontSize: 10, fontWeight: 600,
                    color: sentimentColor(ev.sentiment),
                  }}>
                    {ev.sentiment}
                  </span>
                )}
              </div>

              {/* Title */}
              <p style={{
                fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.78)",
                margin: "0 0 5px", lineHeight: 1.4,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {ev.title}
              </p>

              {/* Summary */}
              {ev.summary && (
                <p style={{
                  fontSize: 12, color: "rgba(255,255,255,0.42)", lineHeight: 1.5,
                  margin: "0 0 8px",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {ev.summary}
                </p>
              )}

              {/* Source link */}
              {ev.url && (
                <a
                  href={ev.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 11, color: "rgba(255,255,255,0.3)",
                    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3,
                  }}
                  className="source-link"
                >
                  ↗ view source
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Markdown section renderer ─────────────────────────────────────────────────

function BriefingSection({
  heading,
  content,
  trendsByName,
  onTrendClick,
}: {
  heading: string;
  content: string;
  trendsByName: Map<string, TrendRef>;
  onTrendClick: (t: TrendRef) => void;
}) {
  // Emoji → section color mapping
  const sectionColor = heading.includes("🔴") || heading.includes("Flashpoint") ? "#2a8c4a"
    : heading.includes("📈") || heading.includes("Momentum") ? "#3da65a"
    : heading.includes("⚡") || heading.includes("Collision") ? "#FF8200"
    : heading.includes("🌊") || heading.includes("Signal") ? "rgba(232,18,122,0.7)"
    : heading.includes("💡") || heading.includes("Opportunity") ? "#FF8200"
    : heading.includes("🗓️") || heading.includes("Calendar") ? "#67e8f9"
    : "rgba(255,255,255,0.5)";

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: 12,
    }}>
      {/* Section heading */}
      <div style={{
        padding: "12px 18px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.01)",
      }}>
        <h3 style={{
          fontSize: 13, fontWeight: 700, color: sectionColor,
          margin: 0, letterSpacing: "0.03em",
        }}>
          {heading}
        </h3>
      </div>

      {/* Section body — react-markdown with clickable trends */}
      <div style={{ padding: "14px 18px" }} className="briefing-prose">
        <ReactMarkdown
          components={{
            // Bold text: check if it's a trend name, make clickable
            strong({ children }) {
              const text = String(children ?? "").trim();
              // Strip CPS annotations the briefing generator embeds:
              // "**Trend Name (CPS: 88)**" → "Trend Name"
              const cleanText = text.replace(/\s*\(CPS:?\s*\d+\)\s*$/i, "").trim();
              const key = cleanText.toLowerCase();
              const trend = trendsByName.get(key);

              if (trend) {
                return (
                  <button
                    onClick={() => onTrendClick(trend)}
                    style={{
                      background: "rgba(0,79,34,0.08)",
                      border: "1px solid rgba(0,79,34,0.2)",
                      borderRadius: 4,
                      padding: "1px 6px",
                      cursor: "pointer",
                      color: "#3da65a",
                      fontWeight: 700,
                      fontSize: "inherit",
                      fontFamily: "inherit",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      transition: "all 0.15s",
                    }}
                    title={`Click to see evidence for: ${cleanText}`}
                  >
                    {cleanText}
                    <span style={{ fontSize: 10, color: "rgba(0,79,34,0.6)", fontWeight: 400 }}>
                      {trend.cps}
                    </span>
                  </button>
                );
              }
              return <strong style={{ color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>{children}</strong>;
            },
            // Paragraphs
            p({ children }) {
              return (
                <p style={{
                  fontSize: 13, lineHeight: 1.65,
                  color: "rgba(255,255,255,0.65)",
                  margin: "0 0 10px",
                }}>
                  {children}
                </p>
              );
            },
            // List items
            li({ children }) {
              return (
                <li style={{
                  fontSize: 13, lineHeight: 1.65,
                  color: "rgba(255,255,255,0.65)",
                  marginBottom: 6,
                  paddingLeft: 4,
                }}>
                  {children}
                </li>
              );
            },
            ul({ children }) {
              return (
                <ul style={{
                  paddingLeft: 18, margin: "0 0 8px",
                  listStyleType: "none",
                }}>
                  {children}
                </ul>
              );
            },
            // Italic
            em({ children }) {
              return <em style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>{children}</em>;
            },
            // Links
            a({ href, children }) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#3da65a", textDecoration: "underline" }}>
                  {children}
                </a>
              );
            },
            // Inline code
            code({ children }) {
              return (
                <code style={{
                  background: "rgba(255,255,255,0.08)", borderRadius: 3,
                  padding: "1px 5px", fontSize: 12, color: "rgba(255,255,255,0.7)",
                }}>
                  {children}
                </code>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BriefingViewer({
  content,
  trends,
  briefingDate,
  flashpointCount,
}: BriefingViewerProps) {
  const [selectedTrend, setSelectedTrend] = useState<TrendRef | null>(null);

  // Build lookup map: lowercase name → TrendRef
  const trendsByName = new Map<string, TrendRef>(
    trends.map((t) => [t.name.toLowerCase(), t])
  );

  const handleTrendClick = useCallback((t: TrendRef) => {
    setSelectedTrend(t);
  }, []);

  // Parse briefing markdown into sections
  const sections = parseSections(content);

  return (
    <>
      {/* Hint text */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 16, padding: "8px 12px",
        background: "rgba(0,79,34,0.05)",
        border: "1px solid rgba(0,79,34,0.12)",
        borderRadius: 8,
      }}>
        <span style={{ fontSize: 13 }}>💡</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
          Click any <strong style={{ color: "#3da65a", fontWeight: 600 }}>highlighted trend</strong> to see the supporting signals and sources behind it.
        </span>
      </div>

      {/* Sections */}
      <div>
        {sections.map((section, i) => (
          <BriefingSection
            key={i}
            heading={section.heading}
            content={section.content}
            trendsByName={trendsByName}
            onTrendClick={handleTrendClick}
          />
        ))}
      </div>

      {/* Evidence drawer */}
      {selectedTrend && (
        <EvidenceDrawer
          trendRef={selectedTrend}
          onClose={() => setSelectedTrend(null)}
        />
      )}
    </>
  );
}

// ── Section parser ─────────────────────────────────────────────────────────────

interface BriefingSection {
  heading: string;
  content: string;
}

function parseSections(markdown: string): BriefingSection[] {
  const lines = markdown.split("\n");
  const sections: BriefingSection[] = [];
  let currentHeading = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    // Match ### headings (section breaks)
    if (line.startsWith("### ")) {
      if (currentHeading && currentLines.some((l) => l.trim())) {
        sections.push({
          heading: currentHeading,
          content: currentLines.join("\n").trim(),
        });
      }
      currentHeading = line.replace(/^###\s*/, "").trim();
      currentLines = [];
    } else if (line.startsWith("## ")) {
      // Top-level heading — skip (it's the briefing title/date)
      continue;
    } else if (line.startsWith("---")) {
      // Footer separator — skip
      continue;
    } else if (line.startsWith("*Briefing generated")) {
      // Footer line — skip
      continue;
    } else {
      currentLines.push(line);
    }
  }

  // Don't forget last section
  if (currentHeading && currentLines.some((l) => l.trim())) {
    sections.push({
      heading: currentHeading,
      content: currentLines.join("\n").trim(),
    });
  }

  return sections;
}
