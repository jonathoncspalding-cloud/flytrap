import { getAgentActivity, getTrends, getAllMoments, AgentActivity, AgentName } from "@/lib/notion";

export const revalidate = 0; // Always fresh

const AGENTS: { name: AgentName; emoji: string; label: string; role: string; color: string }[] = [
  { name: "sentinel", emoji: "\ud83d\udc41\ufe0f", label: "Sentinel", role: "Manager & QA", color: "#f87171" },
  { name: "scout", emoji: "\ud83d\udd2d", label: "Scout", role: "Source Intelligence", color: "#4ade80" },
  { name: "oracle", emoji: "\ud83e\udde0", label: "Oracle", role: "Prediction Engine", color: "#818cf8" },
  { name: "architect", emoji: "\ud83c\udfa8", label: "Architect", role: "UX/UI & Feedback", color: "#f472b6" },
  { name: "optimize", emoji: "\u26a1", label: "Optimize", role: "Efficiency & Ops", color: "#fbbf24" },
  { name: "strategist", emoji: "\ud83d\udcdd", label: "Strategist", role: "Cultural Intelligence", color: "#a78bfa" },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#fbbf24",
  low: "#6b7280",
};

const TYPE_LABELS: Record<string, string> = {
  health_check: "Health Check",
  scorecard: "Scorecard",
  operations: "Operations",
  integrity: "Integrity",
  self_eval: "Self-Eval",
  synthesis: "Synthesis",
  proposal: "Proposal",
  task: "Task",
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr + "T00:00:00Z").getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default async function AgentsPage() {
  const [activity, trends, moments] = await Promise.all([
    getAgentActivity(50),
    getTrends(),
    getAllMoments(),
  ]);

  // Latest report per agent
  const latestByAgent = new Map<AgentName, AgentActivity>();
  for (const a of activity) {
    if (!latestByAgent.has(a.agent)) {
      latestByAgent.set(a.agent, a);
    }
  }

  // System health stats
  const activeTrends = trends.filter((t) => t.status !== "Archived");
  const activeMoments = moments.filter((m) => m.status !== "Passed" && m.status !== "Missed");
  const forming = moments.filter((m) => m.status === "Forming" || m.status === "Happening");

  // Priority breakdown
  const priorityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const a of activity) {
    if (a.priority in priorityCounts) {
      priorityCounts[a.priority as keyof typeof priorityCounts]++;
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
            Command Center
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
            {activity.length} agent activities logged &middot; {AGENTS.length} agents configured
          </p>
        </div>
      </div>

      {/* System Health Bar */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10,
        marginBottom: 24,
      }}>
        <StatCard label="Trends" value={activeTrends.length} color="#4ade80" />
        <StatCard label="Predictions" value={activeMoments.length} sublabel={forming.length > 0 ? `${forming.length} forming` : undefined} color="#818cf8" />
        <StatCard label="Agent Reports" value={activity.length} color="#fbbf24" />
        <StatCard
          label="Alerts"
          value={priorityCounts.critical + priorityCounts.high}
          sublabel={priorityCounts.critical > 0 ? `${priorityCounts.critical} critical` : undefined}
          color={priorityCounts.critical > 0 ? "#ef4444" : priorityCounts.high > 0 ? "#f97316" : "#4ade80"}
        />
      </div>

      {/* Agent Cards */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: "var(--text-tertiary)", flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Agent Status
        </span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 12,
        marginBottom: 32,
      }}>
        {AGENTS.map((agent) => {
          const latest = latestByAgent.get(agent.name);
          return (
            <AgentCard key={agent.name} agent={agent} latest={latest ?? null} />
          );
        })}
      </div>

      {/* Recent Activity Feed */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: "var(--text-tertiary)", flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Recent Activity
        </span>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{activity.length}</span>
      </div>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}>
        {activity.slice(0, 20).map((a, i) => {
          const agentConf = AGENTS.find((ag) => ag.name === a.agent);
          const priorityColor = PRIORITY_COLORS[a.priority] || "#6b7280";

          return (
            <div
              key={a.id}
              style={{
                padding: "12px 16px",
                borderBottom: i < Math.min(activity.length, 20) - 1 ? "1px solid var(--border)" : "none",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              {/* Agent avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${agentConf?.color ?? "#6b7280"}15`,
                border: `1px solid ${agentConf?.color ?? "#6b7280"}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0,
              }}>
                {agentConf?.emoji ?? "?"}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                    {a.title}
                  </span>
                  <span style={{
                    fontSize: 9, padding: "1px 5px", borderRadius: 3,
                    background: `${priorityColor}18`,
                    color: priorityColor,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}>
                    {a.priority}
                  </span>
                </div>
                <p style={{
                  fontSize: 11, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {a.summary}
                </p>
              </div>

              {/* Meta */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                <span style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 3,
                  background: "rgba(255,255,255,0.04)", color: "var(--text-tertiary)",
                  fontWeight: 500,
                }}>
                  {TYPE_LABELS[a.type] || a.type}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                  {timeAgo(a.date)}
                </span>
              </div>
            </div>
          );
        })}

        {activity.length === 0 && (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <p style={{ color: "var(--text-tertiary)", fontSize: 13, margin: "0 0 6px" }}>
              No agent activity yet. Run the agent scripts to get started.
            </p>
            <code style={{ fontSize: 11, color: "var(--text-tertiary)", background: "var(--surface-raised)", padding: "3px 8px", borderRadius: 4 }}>
              python3 scripts/agents/data_integrity_check.py
            </code>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sublabel, color }: { label: string; value: number; sublabel?: string; color: string }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "14px 16px",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}33)` }} />
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
        {value}
      </div>
      {sublabel && (
        <div style={{ fontSize: 10, color, fontWeight: 500, marginTop: 3 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, latest }: {
  agent: { name: AgentName; emoji: string; label: string; role: string; color: string };
  latest: AgentActivity | null;
}) {
  const isActive = latest && latest.date === new Date().toISOString().split("T")[0];

  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${agent.color}22`,
      borderRadius: 10,
      padding: 16,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Top accent */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${agent.color}, ${agent.color}33)` }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${agent.color}15`,
          border: `1px solid ${agent.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>
          {agent.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              {agent.label}
            </span>
            {isActive && (
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#4ade80",
                display: "inline-block",
              }} className="pulse-dot" />
            )}
          </div>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {agent.role}
          </span>
        </div>
      </div>

      {/* Latest activity */}
      {latest ? (
        <div>
          <div style={{
            fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          } as React.CSSProperties}>
            {latest.summary}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <span style={{
              fontSize: 10, padding: "2px 6px", borderRadius: 4,
              background: "rgba(255,255,255,0.04)", color: "var(--text-tertiary)",
              fontWeight: 500,
            }}>
              {TYPE_LABELS[latest.type] || latest.type}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              {timeAgo(latest.date)}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic" }}>
          No activity yet
        </div>
      )}
    </div>
  );
}
