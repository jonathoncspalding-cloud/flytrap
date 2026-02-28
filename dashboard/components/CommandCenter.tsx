"use client";

import { useState } from "react";
import PixelOffice from "./pixel-office/PixelOffice";
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
  const selected = agents.find((a) => a.id === selectedAgent);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 3,
            height: 14,
            borderRadius: 2,
            background: "var(--text-tertiary)",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-tertiary)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Agent Office
        </span>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
          click an agent to chat
        </span>
      </div>

      {/* Side-by-side: Office (left) + Terminal (right) */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
          background: "#0c0f1a",
        }}
      >
        {/* Pixel Office canvas */}
        <div style={{ flex: "1 1 400px", minWidth: 0 }}>
          <PixelOffice
            agents={agents}
            selectedAgent={selectedAgent}
            onSelectAgent={(id) =>
              setSelectedAgent(selectedAgent === id ? null : id)
            }
          />
        </div>

        {/* Terminal / Chat panel */}
        <div
          style={{
            flex: "0 0 320px",
            maxWidth: 380,
            borderLeft: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {selectedAgent ? (
            <AgentChat
              agent={selectedAgent}
              onClose={() => setSelectedAgent(null)}
            />
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: 16,
                fontFamily: "monospace",
                background: "#0d1117",
                color: "#8b949e",
              }}
            >
              {/* Terminal header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: "1px solid #21262d",
                }}
              >
                <span style={{ fontSize: 18 }}>🤖</span>
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#e6edf3",
                    }}
                  >
                    Flytrap Agent Terminal
                  </div>
                  <div style={{ fontSize: 10, color: "#8b949e" }}>
                    6 agents online
                  </div>
                </div>
              </div>

              {/* Idle state */}
              <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                <div style={{ color: "#7ee787" }}>
                  {">"} Select an agent to start chatting
                </div>
                <div style={{ marginTop: 12 }}>
                  Available agents:
                </div>
                {agents.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAgent(a.id)}
                    style={{
                      cursor: "pointer",
                      padding: "2px 0",
                      color: a.isActive ? "#e6edf3" : "#8b949e",
                    }}
                    onMouseEnter={(e) =>
                      ((e.target as HTMLElement).style.color = a.color)
                    }
                    onMouseLeave={(e) =>
                      ((e.target as HTMLElement).style.color = a.isActive
                        ? "#e6edf3"
                        : "#8b949e")
                    }
                  >
                    {a.emoji} {a.label}{" "}
                    {a.isActive && (
                      <span style={{ color: "#4ade80", fontSize: 10 }}>
                        ● active
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: "auto",
                  paddingTop: 12,
                  borderTop: "1px solid #21262d",
                  fontSize: 10,
                  color: "#484f58",
                }}
              >
                Click an agent in the office or list above
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
