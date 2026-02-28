"use client";

import BlankState from "@/components/BlankState";

interface Props {
  hasTrends: boolean;
  children: React.ReactNode;
}

export default function DashboardHome({ hasTrends, children }: Props) {
  if (!hasTrends) {
    return <BlankState />;
  }
  return <>{children}</>;
}
