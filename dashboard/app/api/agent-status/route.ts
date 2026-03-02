import { NextResponse } from "next/server";
import { getAgentActivity, getLatestAgentReport, type AgentName } from "@/lib/notion";

export const revalidate = 0;

const AGENTS: AgentName[] = [
  "sentinel", "scout", "oracle", "architect", "optimize", "strategist", "isabel"
];

const SCHEDULES: Record<AgentName, string> = {
  sentinel: "Daily 8AM ET",
  scout: "Weekly Wed 10AM ET",
  oracle: "Bi-monthly 1st/15th 10AM ET",
  architect: "Monthly 1st 11AM ET",
  optimize: "Weekly Fri 10AM ET",
  strategist: "Weekly Thu 10AM ET",
  isabel: "Weekly Mon 10AM ET",
};

export async function GET() {
  const [activity, ...latestReports] = await Promise.all([
    getAgentActivity(50),
    ...AGENTS.map((a) => getLatestAgentReport(a)),
  ]);

  // Find the latest Sentinel digest (type === "synthesis")
  const digest = activity.find(
    (a) => a.agent === "sentinel" && a.type === "synthesis"
  );

  // Build per-agent status
  const agentStatuses = AGENTS.map((name, i) => {
    const latest = latestReports[i];
    const isActive = latest?.date === new Date().toISOString().split("T")[0];
    return {
      name,
      schedule: SCHEDULES[name],
      lastRun: latest?.date ?? null,
      status: isActive ? "active" : latest ? "idle" : "never_run",
      latestReport: latest
        ? {
            title: latest.title,
            summary: latest.summary,
            priority: latest.priority,
            type: latest.type,
          }
        : null,
    };
  });

  return NextResponse.json({
    agents: agentStatuses,
    digest: digest
      ? {
          title: digest.title,
          summary: digest.summary,
          details: digest.details,
          date: digest.date,
          priority: digest.priority,
        }
      : null,
    recentActivity: activity.slice(0, 20),
  });
}
