"use client";

import BlankState from "@/components/BlankState";

interface Props {
  hasTrends: boolean;
  children: React.ReactNode;
}

export default function DashboardHome({ hasTrends, children }: Props) {
  // Only show blank state for first-time users with no data
  if (!hasTrends) {
    return <BlankState hasExistingData={false} />;
  }

  // If trends exist, always show the dashboard content
  // Sync status is shown in the SyncFooter in the sidebar
  return <>{children}</>;
}
