"use client";

import { useSyncState } from "@/components/SyncProvider";
import SyncVideoOverlay from "@/components/SyncVideoOverlay";

interface Props {
  hasExistingData?: boolean;
}

export default function BlankState({ hasExistingData = false }: Props) {
  const { isRunning, startSync, isDisabled } = useSyncState();

  // Only show the full-screen sync overlay for first-time users with no data.
  // Users with existing data see sync progress in the SyncFooter instead.
  if (isRunning && !hasExistingData) {
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

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={{
      position: "relative",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "calc(100vh - 28px)",
      gap: 20,
      overflow: "hidden",
    }}>
      {/* Background video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.8,
          zIndex: 0,
        }}
      >
        <source src="/background_video.mp4" type="video/mp4" />
      </video>

      {/* Content */}
      <div style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        textAlign: "center",
      }}>
        {/* Cornett wordmark + Flytrap */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            fontFamily: "var(--font-fraunces, 'Fraunces', serif)",
            fontSize: 28,
            fontWeight: 300,
            color: "var(--birch, #F2EFED)",
            letterSpacing: "-0.02em",
          }}>
            Cornett
          </div>
          <div style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase" as const,
            color: "var(--moss-bright, #2a8c4a)",
          }}>
            Flytrap
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 40, height: 1, background: "rgba(242,239,237,0.12)" }} />

        {/* Contextual messaging */}
        {hasExistingData ? (
          <>
            <div style={{ fontSize: 13, color: "rgba(242,239,237,0.6)", fontWeight: 500 }}>
              {today}
            </div>
            <div style={{ fontSize: 13, color: "rgba(242,239,237,0.4)", maxWidth: 300, lineHeight: 1.5 }}>
              Sync today&rsquo;s signals to refresh your dashboard with the latest cultural intelligence.
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: "rgba(242,239,237,0.5)", maxWidth: 300, lineHeight: 1.5 }}>
            Collect signals, detect trends, predict cultural moments before they happen.
          </div>
        )}

        {/* Sync button */}
        <button
          onClick={startSync}
          disabled={isDisabled}
          title={isDisabled ? "Pipeline requires GitHub PAT configuration" : hasExistingData ? "Sync today's signals" : "Start your first sync"}
          style={{
            padding: "12px 32px",
            borderRadius: 8,
            border: "1px solid rgba(232,18,122,0.3)",
            background: "rgba(232,18,122,0.08)",
            color: "var(--birch, #F2EFED)",
            fontSize: 14,
            fontWeight: 700,
            cursor: isDisabled ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.2s",
            opacity: isDisabled ? 0.5 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {hasExistingData ? "Daily Sync" : "First Sync"}
        </button>
      </div>
    </div>
  );
}
