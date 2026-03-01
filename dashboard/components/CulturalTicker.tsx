/**
 * CulturalTicker — fixed bottom-of-window scrolling cultural pulse strip.
 * Fetches real-time trending data from Google Trends + Wikipedia.
 * Feels like a stock ticker, but for what culture is talking about right now.
 */
"use client";

import { useEffect, useState } from "react";

interface PulseItem {
  id: string;
  title: string;
  source: "reddit" | "wikipedia" | "news";
  subreddit?: string;
  score?: number;
  url?: string;
}

const SOURCE_CONFIG = {
  reddit: {
    label: "REDDIT",
    color: "#FF8200",
  },
  wikipedia: {
    label: "READING",
    color: "rgba(232,18,122,0.7)",
  },
  news: {
    label: "NEWS",
    color: "#2a8c4a",
  },
};

export default function CulturalTicker() {
  const [items, setItems] = useState<PulseItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/cultural-pulse")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setItems(data);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Always render the bar once mounted — never hide it
  if (!loaded) return null;

  const duration = Math.max(40, items.length * 5);
  const doubled = [...items, ...items];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: 40,
        background: "linear-gradient(135deg, #0d0820 0%, #100c24 50%, #0d0820 100%)",
        borderTop: "1px solid rgba(232,18,122,0.25)",
        display: "flex",
        alignItems: "center",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
      }}
    >
      {/* Fixed label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "0 14px",
          flexShrink: 0,
          borderRight: "1px solid rgba(232,18,122,0.2)",
          height: "100%",
        }}
      >
        <span
          className="pulse-dot"
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "rgba(232,18,122,0.7)",
            display: "inline-block",
          }}
        />
        <a
          href="/info/ticker"
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: "rgba(232,18,122,0.7)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
          title="What is this?"
        >
          Culture Pulse ↗
        </a>
      </div>

      {/* Scrolling strip */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          height: "100%",
          position: "relative",
        }}
      >
        {/* Fade edges */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 48,
            background: "linear-gradient(90deg, #0d0820, transparent)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 48,
            background: "linear-gradient(270deg, #0d0820, transparent)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
          {items.length === 0 ? (
            <span style={{ fontSize: 11, color: "rgba(232,18,122,0.4)", paddingLeft: 16 }}>
              Fetching live signals…
            </span>
          ) : (
          <div
            className="ticker-track"
            style={{ animationDuration: `${duration}s` }}
          >
            {doubled.map((item, i) => {
              const conf = SOURCE_CONFIG[item.source];
              return (
                <span
                  key={`${item.id}-${i}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    whiteSpace: "nowrap",
                    paddingRight: 28,
                    gap: 6,
                  }}
                >
                  {/* Source badge */}
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      color: conf.color,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      opacity: 0.85,
                      flexShrink: 0,
                    }}
                  >
                    {conf.label}
                  </span>

                  {/* Title */}
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "rgba(220,215,255,0.82)",
                        textDecoration: "none",
                        transition: "color 0.12s",
                      }}
                      className="link-hover"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "rgba(220,215,255,0.82)",
                      }}
                    >
                      {item.title}
                    </span>
                  )}

                  {/* Subreddit label for Reddit items */}
                  {item.source === "reddit" && item.subreddit && (
                    <span style={{ fontSize: 9, color: conf.color, opacity: 0.65, fontWeight: 600 }}>
                      r/{item.subreddit}
                    </span>
                  )}

                  {/* Separator */}
                  <span
                    style={{
                      fontSize: 10,
                      color: "rgba(232,18,122,0.2)",
                      marginLeft: 4,
                    }}
                  >
                    ◆
                  </span>
                </span>
              );
            })}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
