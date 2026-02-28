"use client";

import { useSyncState, STAGE_LABELS } from "@/components/SyncProvider";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SyncVideoOverlay() {
  const { stage, elapsed } = useSyncState();
  const label = stage ? STAGE_LABELS[stage] ?? stage : "Starting…";

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      zIndex: 10,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderRadius: 0,
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
          opacity: 0.4,
        }}
      >
        <source src="/background_video.mp4" type="video/mp4" />
      </video>

      {/* Overlay content */}
      <div style={{
        position: "relative",
        zIndex: 2,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}>
        {/* Spinner */}
        <div className="sync-spinner-large" />

        {/* Stage label */}
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          {label}
        </div>

        {/* Elapsed */}
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
          {formatElapsed(elapsed)}
        </div>
      </div>
    </div>
  );
}
