"use client";

import BlankState from "@/components/BlankState";
import SyncVideoOverlay from "@/components/SyncVideoOverlay";
import { useSyncState } from "@/components/SyncProvider";

interface Props {
  hasTrends: boolean;
  children: React.ReactNode;
}

export default function DashboardHome({ hasTrends, children }: Props) {
  const { isRunning } = useSyncState();

  // First-time user with no data
  if (!hasTrends) {
    return <BlankState hasExistingData={false} />;
  }

  // Sync is actively running — show full-screen sync overlay
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

  // Dashboard with ambient video background
  return (
    <div className="dashboard-video-bg">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="dashboard-bg-video"
      >
        <source src="/background_video.mp4" type="video/mp4" />
      </video>
      <div className="dashboard-bg-overlay" />
      <div style={{ position: "relative", zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
}
