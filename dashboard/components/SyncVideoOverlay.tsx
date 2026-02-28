"use client";

import { useSyncState } from "@/components/SyncProvider";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SyncVideoOverlay() {
  const { stageLabel, progress, elapsed } = useSyncState();
  const label = stageLabel ?? "Starting\u2026";

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
          opacity: 0.8,
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
        gap: 14,
      }}>
        {/* Rose spinner */}
        <div className="sync-spinner-large" />

        {/* Stage label */}
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--birch, #F2EFED)",
        }}>
          {label}
        </div>

        {/* Gradient progress bar */}
        <div style={{
          width: 200,
          height: 3,
          background: "rgba(242,239,237,0.08)",
          borderRadius: 2,
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${Math.max(2, progress)}%`,
            background: "linear-gradient(90deg, var(--moss-bright, #2a8c4a), var(--rose, #E8127A))",
            borderRadius: 2,
            transition: "width 1s ease-out",
          }} />
        </div>

        {/* Elapsed */}
        <div style={{
          fontSize: 12,
          color: "rgba(242,239,237,0.4)",
          fontVariantNumeric: "tabular-nums",
        }}>
          {formatElapsed(elapsed)}
        </div>
      </div>
    </div>
  );
}
