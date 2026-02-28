"use client";

import { useState } from "react";
import PixelOffice from "./PixelOffice";
import AgentChat from "./AgentChat";

type AgentData = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  status: string;
  isActive: boolean;
};

export default function CommandCenter({ agents }: { agents: AgentData[] }) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  return (
    <div>
      {/* Pixel Office */}
      <div style={{ marginBottom: selectedAgent ? 16 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 3, height: 14, borderRadius: 2, background: "var(--text-tertiary)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Agent Office
          </span>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>click an agent to chat</span>
        </div>
        <PixelOffice
          agents={agents}
          selectedAgent={selectedAgent}
          onSelectAgent={(id) => setSelectedAgent(selectedAgent === id ? null : id)}
        />
      </div>

      {/* Chat panel (slides in when agent selected) */}
      {selectedAgent && (
        <div style={{ marginBottom: 24 }}>
          <AgentChat
            agent={selectedAgent}
            onClose={() => setSelectedAgent(null)}
          />
        </div>
      )}
    </div>
  );
}
