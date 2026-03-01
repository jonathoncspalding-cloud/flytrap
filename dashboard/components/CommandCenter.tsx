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

      {/* Office with chat overlay */}
      <div
        style={{
          position: "relative",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
          background: "#0c0f1a",
          height: 400,
        }}
      >
        {/* Pixel Office canvas — scaled to fit container */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PixelOffice
            agents={agents}
            selectedAgent={selectedAgent}
            onSelectAgent={(id) =>
              setSelectedAgent(selectedAgent === id ? null : id)
            }
          />
        </div>

        {/* Chat panel — fills right side */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 300,
            height: "100%",
            borderLeft: "1px solid #21262d",
            background: "rgba(13, 17, 23, 0.95)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
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
                padding: 12,
                fontFamily: "monospace",
                color: "#8b949e",
                overflow: "auto",
              }}
            >
              {/* Terminal header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                  paddingBottom: 8,
                  borderBottom: "1px solid #21262d",
                }}
              >
                <span style={{ fontSize: 14 }}>🤖</span>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#e6edf3",
                    }}
                  >
                    Flytrap Agent Terminal
                  </div>
                  <div style={{ fontSize: 9, color: "#8b949e" }}>
                    {agents.filter((a) => a.isActive).length} agents online
                  </div>
                </div>
              </div>

              {/* Idle state */}
              <div style={{ fontSize: 11, lineHeight: 1.7 }}>
                <div style={{ color: "#2a8c4a", fontSize: 10 }}>
                  {">"} Select an agent to chat
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: "#484f58" }}>
                  Available:
                </div>
                {agents.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAgent(a.id)}
                    style={{
                      cursor: "pointer",
                      padding: "1px 0",
                      fontSize: 11,
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
                      <span style={{ color: "#2a8c4a", fontSize: 9 }}>
                        ●
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: "1px solid #21262d",
                  fontSize: 9,
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
