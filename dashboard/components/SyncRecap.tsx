/**
 * SyncRecap — Compact recap of what changed during the last pipeline sync.
 * Shows signal counts by source, trend updates, and new moment predictions.
 * Displayed as a thin horizontal bar on the home dashboard.
 */

import type { SyncRecap } from "@/lib/notion";

// Platform → icon mapping
const PLATFORM_ICONS: Record<string, string> = {
  Reddit: "r/",
  RSS: "rss",
  Bluesky: "bsky",
  "Hacker News": "hn",
  YouTube: "yt",
  Wikipedia: "wiki",
  "Google Trends": "gt",
  Polymarket: "pm",
  Trends24: "t24",
  Research: "res",
};

function PlatformPill({ platform, count }: { platform: string; count: number }) {
  const abbr = PLATFORM_ICONS[platform] || platform.slice(0, 3).toLowerCase();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 10,
        padding: "2px 6px",
        borderRadius: 3,
        background: "rgba(242,239,237,0.04)",
        border: "1px solid var(--border)",
        color: "var(--text-secondary)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontWeight: 700, color: "var(--text-tertiary)", fontFamily: "monospace", fontSize: 9 }}>
        {abbr}
      </span>
      <span style={{ fontWeight: 600 }}>{count}</span>
    </span>
  );
}

export default function SyncRecapWidget({ recap }: { recap: SyncRecap }) {
  if (recap.totalSignals === 0 && recap.updatedTrends.length === 0 && recap.recentMoments.length === 0) {
    return null; // Nothing to show
  }

  // Sort platforms by count descending
  const platforms = Object.entries(recap.signalsByPlatform)
    .sort((a, b) => b[1] - a[1]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  return (
    <div
      style={{
        gridColumn: "1 / -1",
        background: "linear-gradient(90deg, rgba(0,79,34,0.06), rgba(242,239,237,0.02))",
        border: "1px solid rgba(0,79,34,0.12)",
        borderRadius: 8,
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--moss-bright)", display: "inline-block" }} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--moss-bright)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Last Sync
        </span>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
          {formatTime(recap.timestamp)}
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 16, background: "var(--border)" }} />

      {/* Signals collected */}
      {recap.totalSignals > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 500 }}>
            {recap.totalSignals} signals
          </span>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {platforms.map(([platform, count]) => (
              <PlatformPill key={platform} platform={platform} count={count} />
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {recap.totalSignals > 0 && recap.updatedTrends.length > 0 && (
        <div style={{ width: 1, height: 16, background: "var(--border)" }} />
      )}

      {/* Trends updated */}
      {recap.updatedTrends.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 500 }}>
            {recap.updatedTrends.length} trends updated
          </span>
          {recap.topTrend && (
            <span
              style={{
                fontSize: 10,
                padding: "1px 5px",
                borderRadius: 3,
                background: "rgba(232,18,122,0.08)",
                color: "var(--rose)",
                fontWeight: 600,
              }}
            >
              Top: {recap.topTrend.name.length > 25 ? recap.topTrend.name.slice(0, 25) + "\u2026" : recap.topTrend.name} ({recap.topTrend.cps})
            </span>
          )}
        </div>
      )}

      {/* Divider */}
      {recap.recentMoments.length > 0 && (
        <div style={{ width: 1, height: 16, background: "var(--border)" }} />
      )}

      {/* Moments */}
      {recap.recentMoments.length > 0 && (
        <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 500 }}>
          {recap.recentMoments.length} moments forecasted
        </span>
      )}
    </div>
  );
}
