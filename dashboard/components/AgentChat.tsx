"use client";

import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

const AGENT_META: Record<string, { emoji: string; label: string; color: string }> = {
  sentinel: { emoji: "👁️", label: "Sentinel", color: "#f87171" },
  scout: { emoji: "🔭", label: "Scout", color: "#4ade80" },
  oracle: { emoji: "🧠", label: "Oracle", color: "#818cf8" },
  architect: { emoji: "🎨", label: "Architect", color: "#f472b6" },
  optimize: { emoji: "⚡", label: "Optimize", color: "#fbbf24" },
  strategist: { emoji: "📝", label: "Strategist", color: "#a78bfa" },
};

export default function AgentChat({
  agent,
  onClose,
}: {
  agent: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const meta = AGENT_META[agent] ?? { emoji: "?", label: agent, color: "#6b7280" };

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  // Reset messages when agent changes
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [agent]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, agent }),
      });

      if (!res.ok) {
        const err = await res.text();
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: `Error: ${err}` };
          return copy;
        });
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: last.content + parsed.text,
                };
                return copy;
              });
            }
            if (parsed.error) {
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: `Error: ${parsed.error}` };
                return copy;
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: `Connection error: ${err.message}` };
        return copy;
      });
    }

    setStreaming(false);
  }

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      display: "flex",
      flexDirection: "column",
      height: 400,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 7,
            background: `${meta.color}15`, border: `1px solid ${meta.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14,
          }}>
            {meta.emoji}
          </span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {meta.label}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginLeft: 6 }}>
              Agent Chat
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-tertiary)", fontSize: 16, padding: "2px 6px",
          }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: "auto", padding: 14,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: "center", padding: "40px 20px",
            color: "var(--text-tertiary)", fontSize: 12,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{meta.emoji}</div>
            <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text-secondary)" }}>
              Talk to {meta.label}
            </p>
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              Ask about their domain, request analysis, or get recommendations.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div style={{
              maxWidth: "85%",
              padding: "8px 12px",
              borderRadius: msg.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
              background: msg.role === "user"
                ? "rgba(255,255,255,0.08)"
                : `${meta.color}10`,
              border: `1px solid ${msg.role === "user" ? "rgba(255,255,255,0.06)" : meta.color + "20"}`,
              fontSize: 12,
              lineHeight: 1.6,
              color: "var(--text-primary)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {msg.content}
              {streaming && i === messages.length - 1 && msg.role === "assistant" && (
                <span style={{
                  display: "inline-block",
                  width: 6, height: 14,
                  background: meta.color,
                  marginLeft: 2,
                  animation: "blink 0.8s step-end infinite",
                  verticalAlign: "text-bottom",
                }} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: "10px 14px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        gap: 8,
        flexShrink: 0,
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={`Ask ${meta.label}...`}
          disabled={streaming}
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--text-primary)",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || streaming}
          style={{
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            border: "none",
            cursor: !input.trim() || streaming ? "not-allowed" : "pointer",
            background: input.trim() && !streaming ? meta.color : "var(--border)",
            color: input.trim() && !streaming ? "#fff" : "var(--text-tertiary)",
            transition: "all 0.15s ease",
          }}
        >
          {streaming ? "..." : "Send"}
        </button>
      </div>

      {/* Blink animation */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
