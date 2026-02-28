"use client";

import { useSyncState, STAGE_LABELS } from "@/components/SyncProvider";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase();
}

const FRESHNESS_COLORS = {
  fresh: "#2a8c4a",
  stale: "#FF8200",
  never: "var(--text-tertiary)",
};

export default function SyncFooter() {
  const {
    stage, isRunning, elapsed, freshness, lastSynced, error,
    briefingExists, isDisabled, runUrl, startSync, startBriefing,
  } = useSyncState();

  const stageLabel = stage ? STAGE_LABELS[stage] ?? stage : null;

  return (
    <div className="sidebar-footer" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Sync button */}
      <button
        onClick={startSync}
        disabled={isRunning || isDisabled}
        title={isDisabled ? "GitHub not configured" : isRunning ? "Sync in progress" : "Collect signals, process trends, forecast moments"}
        style={{
          width: "100%",
          padding: "7px 10px",
          borderRadius: 7,
          border: `1px solid ${isRunning ? "rgba(232,18,122,0.3)" : "rgba(0,79,34,0.3)"}`,
          background: isRunning ? "rgba(232,18,122,0.06)" : "transparent",
          color: isDisabled ? "var(--text-tertiary)" : "var(--text-primary)",
          fontSize: 12,
          fontWeight: 600,
          cursor: isRunning || isDisabled ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transition: "all 0.15s",
          opacity: isDisabled ? 0.5 : 1,
        }}
      >
        {isRunning ? (
          <>
            <span className="sync-spinner" />
            <span style={{ fontSize: 11 }}>{stageLabel}</span>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginLeft: "auto" }}>
              {formatElapsed(elapsed)}
            </span>
            {runUrl && (
              <a
                href={runUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: 10, color: "var(--text-tertiary)", textDecoration: "none" }}
                title="View run on GitHub"
              >
                ↗
              </a>
            )}
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Sync
          </>
        )}
      </button>

      {/* Briefing button */}
      <button
        onClick={startBriefing}
        disabled={isRunning || isDisabled || briefingExists}
        title={
          isDisabled ? "GitHub not configured"
            : briefingExists ? "Today's briefing already generated"
            : "Generate daily briefing (uses Claude Opus)"
        }
        style={{
          width: "100%",
          padding: "5px 10px",
          borderRadius: 7,
          border: "1px solid var(--border)",
          background: "transparent",
          color: briefingExists ? "var(--text-tertiary)" : "var(--text-secondary)",
          fontSize: 11,
          fontWeight: 500,
          cursor: isRunning || isDisabled || briefingExists ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          transition: "all 0.15s",
          opacity: isDisabled || briefingExists ? 0.5 : 1,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        {briefingExists ? "Briefing sent" : "Generate Briefing"}
      </button>

      {/* Error message */}
      {error && (
        <div style={{ fontSize: 10, color: "#E8127A", lineHeight: 1.3, padding: "0 2px" }}>
          {error}
        </div>
      )}

      {/* Status line + date */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4, borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: FRESHNESS_COLORS[freshness],
            display: "inline-block",
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
            {lastSynced ? `Synced ${formatTime(lastSynced)}` : "Never synced"}
          </span>
        </div>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
          {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>
    </div>
  );
}
