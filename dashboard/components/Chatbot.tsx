/**
 * Chatbot — floating cultural strategist AI panel.
 * Lives in the bottom-right corner; expands on click.
 * Streams responses from /api/chat using SSE.
 */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "What's the biggest cultural opportunity this week?",
  "Which trend is closest to peaking?",
  "What's an angle for A&W right now?",
  "Explain the top flashpoint to me",
  "What trend collision should I be watching?",
];

// ── Chat message bubble ────────────────────────────────────────────────────────

function MessageBubble({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const isUser = message.role === "user";

  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 12,
    }}>
      {!isUser && (
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: "rgba(74,222,128,0.15)",
          border: "1px solid rgba(74,222,128,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, flexShrink: 0, marginRight: 8, marginTop: 2,
        }}>
          ⚡
        </div>
      )}
      <div style={{
        maxWidth: "82%",
        background: isUser ? "var(--chat-msg-user-bg, rgba(74,222,128,0.12))" : "var(--chat-msg-ai-bg, rgba(255,255,255,0.05))",
        border: `1px solid ${isUser ? "var(--chat-msg-user-border, rgba(74,222,128,0.25))" : "var(--chat-msg-ai-border, rgba(255,255,255,0.08))"}`,
        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        padding: "10px 14px",
      }}>
        <p style={{
          fontSize: 13,
          color: isUser ? "var(--chat-text-primary, rgba(255,255,255,0.88))" : "var(--chat-text-secondary, rgba(255,255,255,0.82))",
          lineHeight: 1.55,
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {message.content}
          {isStreaming && (
            <span style={{
              display: "inline-block",
              width: 7, height: 14,
              background: "#4ade80",
              marginLeft: 2,
              verticalAlign: "middle",
              borderRadius: 1,
              animation: "blink 0.9s step-end infinite",
            }} />
          )}
        </p>
      </div>
    </div>
  );
}

// ── Main chatbot component ─────────────────────────────────────────────────────

interface ChatbotProps {
  embedded?: boolean;
}

export default function Chatbot({ embedded = false }: ChatbotProps) {
  const [open, setOpen] = useState(embedded);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened (not in embedded mode — autofocus on page load causes layout jumps)
  useEffect(() => {
    if (open && !embedded) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    setError(null);

    const userMessage: Message = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);

    // Add empty assistant message to stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + parsed.text,
                };
                return updated;
              });
            }
          } catch {
            // ignore parse errors for individual chunks
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      // Remove the empty assistant placeholder
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.role === "assistant" && !updated[updated.length - 1]?.content) {
          updated.pop();
        }
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    setInput("");
  };

  return (
    <>
      {/* Blink animation */}
      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── Floating button (hidden in embedded mode) ────────────────────────── */}
      {!open && !embedded && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "fixed", bottom: 28, right: 28, zIndex: 50,
            width: 52, height: 52, borderRadius: "50%",
            background: "rgba(74,222,128,0.15)",
            border: "1px solid rgba(74,222,128,0.35)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
            transition: "all 0.2s",
          }}
          className="card-hover"
          title="Ask the Cultural Strategist"
        >
          ⚡
        </button>
      )}

      {/* ── Chat panel ───────────────────────────────────────────────────────── */}
      {open && (
        <div style={{
          ...(embedded ? {
            position: "relative" as const,
            width: "100%",
            height: "100%",
            minHeight: 0,
          } : {
            position: "fixed" as const,
            bottom: 24,
            right: 24,
            zIndex: 50,
            width: 400,
            height: 580,
          }),
          background: "var(--chat-bg, #1e1e1e)",
          border: "1px solid var(--chat-border, rgba(74,222,128,0.2))",
          borderRadius: embedded ? 10 : 16,
          boxShadow: embedded ? "none" : "0 8px 48px rgba(0,0,0,0.6)",
          display: "flex", flexDirection: "column",
          animation: embedded ? "none" : "slideUp 0.2s ease-out",
          overflow: "hidden",
        }}>

          {/* Header */}
          <div style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--chat-header-border, rgba(255,255,255,0.07))",
            display: "flex", alignItems: "center", gap: 10,
            flexShrink: 0,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "rgba(74,222,128,0.12)",
              border: "1px solid rgba(74,222,128,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, flexShrink: 0,
            }}>
              ⚡
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--chat-text-primary, rgba(255,255,255,0.9))" }}>
                Cultural Strategist
              </div>
              <div style={{ fontSize: 11, color: "var(--chat-text-dim, rgba(255,255,255,0.35))" }}>
                Powered by live trend data
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.3)", fontSize: 11, padding: "4px 8px",
                    borderRadius: 6,
                  }}
                  title="Clear chat"
                >
                  Clear
                </button>
              )}
              {!embedded && (
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.4)", fontSize: 18, lineHeight: 1,
                    padding: "2px 4px", borderRadius: 4,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto",
            padding: "16px",
          }}>
            {messages.length === 0 && (
              <div>
                {/* Intro */}
                <div style={{
                  textAlign: "center", padding: embedded ? "6px 0 12px" : "8px 0 20px",
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
                  <p style={{ fontSize: 13, color: "var(--chat-text-secondary, rgba(255,255,255,0.6))", margin: "0 0 4px", fontWeight: 500 }}>
                    Ask me anything about culture
                  </p>
                  <p style={{ fontSize: 12, color: "var(--chat-text-dim, rgba(255,255,255,0.3))", margin: 0 }}>
                    I have access to all your live trends, tensions, and briefings
                  </p>
                </div>

                {/* Suggested questions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(embedded ? SUGGESTED_QUESTIONS.slice(0, 2) : SUGGESTED_QUESTIONS).map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      style={{
                        background: "var(--chat-suggestion-bg, rgba(255,255,255,0.04))",
                        border: "1px solid var(--chat-suggestion-border, rgba(255,255,255,0.08))",
                        borderRadius: 8,
                        padding: "9px 12px",
                        textAlign: "left",
                        cursor: "pointer",
                        color: "var(--chat-suggestion-text, rgba(255,255,255,0.65))",
                        fontSize: 12,
                        lineHeight: 1.4,
                        transition: "all 0.15s",
                      }}
                      className="card-hover"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                isStreaming={streaming && i === messages.length - 1 && msg.role === "assistant"}
              />
            ))}

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 8, padding: "8px 12px",
                fontSize: 12, color: "#fca5a5",
                marginBottom: 8,
              }}>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "12px",
            borderTop: "1px solid var(--chat-header-border, rgba(255,255,255,0.07))",
            flexShrink: 0,
          }}>
            <div style={{
              display: "flex", gap: 8, alignItems: "flex-end",
              background: "var(--chat-input-bg, rgba(255,255,255,0.04))",
              border: "1px solid var(--chat-input-border, rgba(255,255,255,0.1))",
              borderRadius: 10,
              padding: "8px 8px 8px 12px",
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about trends, timing, opportunities…"
                rows={1}
                disabled={streaming}
                style={{
                  flex: 1,
                  background: "none", border: "none", outline: "none",
                  resize: "none",
                  color: "var(--chat-text-primary, rgba(255,255,255,0.85))",
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontFamily: "inherit",
                  maxHeight: 100,
                  overflow: "auto",
                  padding: 0,
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || streaming}
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: input.trim() && !streaming ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${input.trim() && !streaming ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.08)"}`,
                  cursor: input.trim() && !streaming ? "pointer" : "default",
                  color: input.trim() && !streaming ? "#4ade80" : "rgba(255,255,255,0.2)",
                  fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}
              >
                {streaming ? "…" : "↑"}
              </button>
            </div>
            <p style={{ fontSize: 10, color: "var(--chat-text-dim, rgba(255,255,255,0.2))", margin: "6px 0 0", textAlign: "center" }}>
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
