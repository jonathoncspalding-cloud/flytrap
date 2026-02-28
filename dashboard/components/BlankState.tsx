"use client";

import { useSyncState } from "@/components/SyncProvider";
import SyncVideoOverlay from "@/components/SyncVideoOverlay";

export default function BlankState() {
  const { isRunning, startSync, isDisabled } = useSyncState();

  if (isRunning) {
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 200,
        right: 0,
        bottom: 0,
        zIndex: 10,
        overflow: "hidden",
      }}>
        <SyncVideoOverlay />
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "calc(100vh - 28px)",
      gap: 20,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: "linear-gradient(135deg, #4ade80, #22c55e)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, fontWeight: 800, color: "#0a0a0a",
      }}>
        F
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Flytrap
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          Collect signals, detect trends, predict moments
        </div>
      </div>
      <button
        onClick={startSync}
        disabled={isDisabled}
        title={isDisabled ? "Pipeline requires local dev server" : "Start your first sync"}
        style={{
          padding: "10px 28px",
          borderRadius: 8,
          border: "1px solid rgba(74,222,128,0.3)",
          background: "rgba(74,222,128,0.08)",
          color: "#4ade80",
          fontSize: 14,
          fontWeight: 700,
          cursor: isDisabled ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "all 0.15s",
          opacity: isDisabled ? 0.5 : 1,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        Sync
      </button>
    </div>
  );
}
