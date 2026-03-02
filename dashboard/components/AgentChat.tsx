"use client";

import { useState, useRef, useEffect } from "react";
import { renderDesign, DesignSpec } from "@/lib/isabel-canvas";
import { renderMarkdown } from "@/lib/markdown";

type Message = { role: "user" | "assistant"; content: string };

type Attachment = {
  id: string;
  file: File;
  type: "image" | "text";
  preview: string;
  base64?: string;
  textContent?: string;
  mediaType?: string;
};

type ApiContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

const AGENT_META: Record<string, { emoji: string; label: string; color: string }> = {
  sentinel: { emoji: "👁️", label: "Sentinel", color: "#E8127A" },
  scout: { emoji: "🔭", label: "Scout", color: "#2a8c4a" },
  oracle: { emoji: "🧠", label: "Oracle", color: "rgba(232,18,122,0.7)" },
  architect: { emoji: "🎨", label: "Architect", color: "#f472b6" },
  optimize: { emoji: "⚡", label: "Optimize", color: "#FF8200" },
  strategist: { emoji: "📝", label: "Strategist", color: "#a78bfa" },
  isabel: { emoji: "🎨", label: "Isabel", color: "#2dd4bf" },
};

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const ACCEPTED_TEXT_EXTS = [".txt", ".csv", ".json", ".md"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_TEXT_SIZE = 100 * 1024;
const MAX_ATTACHMENTS = 3;

function resizeImage(file: File, maxDim = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL(file.type);
      URL.revokeObjectURL(img.src);
      resolve(dataUrl.split(",")[1]);
    };
    img.src = URL.createObjectURL(file);
  });
}

export default function AgentChat({
  agent,
  onClose,
  initialPrompt,
}: {
  agent: string;
  onClose: () => void;
  initialPrompt?: string;
}) {
  const storageKey = `agent-chat-${agent}`;
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [messageAttachments, setMessageAttachments] = useState<Map<number, Attachment[]>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const meta = AGENT_META[agent] ?? { emoji: "?", label: agent, color: "#6b7280" };

  // Persist messages to localStorage
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      }
    } catch { /* storage full or unavailable */ }
  }, [messages, storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const pendingPromptRef = useRef<string | null>(null);

  // Load saved messages when switching agents
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`agent-chat-${agent}`);
      setMessages(saved ? JSON.parse(saved) : []);
    } catch { setMessages([]); }
    setInput("");
    setAttachments([]);
    setMessageAttachments(new Map());

    // If there's an initial prompt (e.g. from feedback queue), clear history
    // and stash it for auto-send on next render.
    if (initialPrompt) {
      setMessages([]);
      pendingPromptRef.current = initialPrompt;
    }
  }, [agent, initialPrompt]);

  // Auto-send the pending prompt once messages are cleared
  useEffect(() => {
    if (pendingPromptRef.current && messages.length === 0 && !streaming) {
      const prompt = pendingPromptRef.current;
      pendingPromptRef.current = null;
      // Delay to let state settle, then call send with override text
      setTimeout(() => send(prompt), 50);
    }
  }, [messages, streaming]);

  function parseDesignSpecs(text: string): { cleanText: string; designs: DesignSpec | null } {
    const match = text.match(/<!-- ISABEL_DESIGNS\n([\s\S]*?)\n-->/);
    if (!match) return { cleanText: text, designs: null };
    try {
      const designs = JSON.parse(match[1]) as DesignSpec;
      const cleanText = text.replace(/<!-- ISABEL_DESIGNS\n[\s\S]*?\n-->/, "").trim();
      return { cleanText, designs };
    } catch {
      return { cleanText: text, designs: null };
    }
  }

  async function handleDesignSelect(designs: DesignSpec, index: number) {
    const selected = designs.options[index];
    renderDesign(designs.category, designs.footprint.w, designs.footprint.h, selected.colors || [], selected);

    // Fetch current proposal to get targets
    let targets: { uid: string; type: string; col: number; row: number }[] = [];
    try {
      const resp = await fetch("/proposals/isabel.json");
      if (resp.ok) {
        const proposal = await resp.json();
        targets = proposal.targets || [];
      }
    } catch { /* no targets available */ }

    // Build and save proposal, then trigger implement
    const newProposal = {
      id: new Date().toISOString().split("T")[0],
      category: designs.category,
      description: "User-refined design via chat feedback",
      createdAt: new Date().toISOString(),
      footprint: designs.footprint,
      wallMounted: designs.category === "Paintings",
      mustMatch: false,
      options: designs.options.map((opt) => ({
        ...opt,
        preview: renderDesign(designs.category, designs.footprint.w, designs.footprint.h, opt.colors || [], opt),
      })),
      targets,
    };

    // Live-update the pixel office immediately (before backend deploy)
    const selectedPreview = renderDesign(
      designs.category, designs.footprint.w, designs.footprint.h,
      selected.colors || [], selected
    );
    if (targets.length > 0) {
      window.dispatchEvent(new CustomEvent("update-furniture", {
        detail: {
          imageDataUri: selectedPreview,
          targetTypes: targets.map((t) => t.type),
          width: designs.footprint.w,
          height: designs.footprint.h,
        },
      }));
    }

    // Save proposal and trigger implement (makes it permanent after deploy)
    try {
      const resp = await fetch("/api/isabel-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection: index, proposal: newProposal }),
      });

      if (resp.ok) {
        setMessages((prev) => [...prev, {
          role: "assistant" as const,
          content: `Magnifique! "${selected.label}" is live in the office! The permanent deploy is running in the background, darling. ✨`,
        }]);
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant" as const,
        content: "Oh non! Something went wrong saving the design. Try again, mon chou.",
      }]);
    }
  }

  async function handleFiles(files: FileList) {
    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      if (attachments.length + newAttachments.length >= MAX_ATTACHMENTS) break;

      const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
      const isText = ACCEPTED_TEXT_EXTS.some((ext) => file.name.toLowerCase().endsWith(ext));
      if (!isImage && !isText) continue;
      if (isImage && file.size > MAX_IMAGE_SIZE) continue;
      if (isText && file.size > MAX_TEXT_SIZE) continue;

      const att: Attachment = {
        id: crypto.randomUUID(),
        file,
        type: isImage ? "image" : "text",
        preview: "",
      };

      if (isImage) {
        const base64 = await resizeImage(file);
        att.base64 = base64;
        att.mediaType = file.type;
        att.preview = `data:${file.type};base64,${base64}`;
      } else {
        const text = await file.text();
        att.textContent = text;
        att.preview = text.slice(0, 200);
      }

      newAttachments.push(att);
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if ((!text && attachments.length === 0) || streaming) return;

    // Build API content blocks for this message
    const contentBlocks: ApiContentBlock[] = [];

    for (const att of attachments) {
      if (att.type === "image" && att.base64 && att.mediaType) {
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: att.mediaType, data: att.base64 },
        });
      }
    }

    for (const att of attachments) {
      if (att.type === "text" && att.textContent) {
        contentBlocks.push({
          type: "text",
          text: `[File: ${att.file.name}]\n${att.textContent}`,
        });
      }
    }

    if (text) {
      contentBlocks.push({ type: "text", text });
    }

    // Display content
    const displayContent = [
      ...attachments.map((a) =>
        a.type === "image" ? `[Image: ${a.file.name}]` : `[File: ${a.file.name}]`
      ),
      text,
    ]
      .filter(Boolean)
      .join("\n");

    const currentAttachments = [...attachments];
    const userMsg: Message = { role: "user", content: displayContent };
    const newMessages = [...messages, userMsg];
    const msgIndex = newMessages.length - 1;

    setMessageAttachments((prev) => {
      const next = new Map(prev);
      if (currentAttachments.length > 0) next.set(msgIndex, currentAttachments);
      return next;
    });

    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setAttachments([]);
    setStreaming(true);

    // Build API messages: prior messages as plain strings, latest with content blocks
    const apiMessages = newMessages.map((m, i) => {
      if (i === newMessages.length - 1 && m.role === "user" && contentBlocks.length > 0) {
        return { role: m.role, content: contentBlocks };
      }
      return { role: m.role, content: m.content };
    });

    try {
      const res = await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, agent }),
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

  const canSend = (input.trim() || attachments.length > 0) && !streaming;

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
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                try { localStorage.removeItem(storageKey); } catch {}
              }}
              style={{
                background: "none", border: "1px solid var(--border)", cursor: "pointer",
                color: "var(--text-tertiary)", fontSize: 10, padding: "2px 8px",
                borderRadius: 4,
              }}
            >
              Clear
            </button>
          )}
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
              <br />
              You can attach images or files with 📎
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
              {/* Inline image thumbnails for sent user messages */}
              {msg.role === "user" && messageAttachments.get(i)?.some((a) => a.type === "image") && (
                <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
                  {messageAttachments.get(i)?.filter((a) => a.type === "image").map((a) => (
                    <img
                      key={a.id}
                      src={a.preview}
                      alt={a.file.name}
                      style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 4 }}
                    />
                  ))}
                </div>
              )}
              {(() => {
                if (msg.role === "assistant" && msg.content) {
                  const { cleanText, designs } = parseDesignSpecs(msg.content);
                  return (
                    <>
                      {renderMarkdown(cleanText)}
                      {designs && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 10 }}>
                          {designs.options.map((opt, oi) => {
                            const preview = renderDesign(designs.category, designs.footprint.w, designs.footprint.h, opt.colors || [], opt);
                            return (
                              <div key={oi} style={{
                                background: "var(--bg)",
                                border: "1px solid var(--border)",
                                borderRadius: 6,
                                padding: 8,
                                textAlign: "center",
                              }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={preview}
                                  alt={opt.label}
                                  width={designs.footprint.w * 4}
                                  height={designs.footprint.h * 4}
                                  style={{ imageRendering: "pixelated", display: "block", margin: "0 auto 6px" }}
                                />
                                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                                  {opt.label}
                                </div>
                                <div style={{ fontSize: 8, color: "var(--text-tertiary)", marginBottom: 6, lineHeight: 1.4 }}>
                                  {opt.description}
                                </div>
                                <button
                                  onClick={() => handleDesignSelect(designs, oi)}
                                  style={{
                                    fontSize: 9,
                                    padding: "3px 10px",
                                    borderRadius: 4,
                                    border: "1px solid #2dd4bf44",
                                    background: "transparent",
                                    color: "#2dd4bf",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                  }}
                                >
                                  Select
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                }
                return msg.role === "user" ? msg.content : renderMarkdown(msg.content);
              })()}
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/gif,image/webp,.txt,.csv,.json,.md"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        style={{ display: "none" }}
      />

      {/* Attachment preview strip */}
      {attachments.length > 0 && (
        <div style={{
          padding: "6px 14px",
          display: "flex",
          gap: 6,
          overflowX: "auto",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          {attachments.map((att) => (
            <div key={att.id} style={{
              position: "relative",
              width: 48, height: 48,
              borderRadius: 6,
              border: "1px solid var(--border)",
              overflow: "hidden",
              flexShrink: 0,
              background: "var(--bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {att.type === "image" ? (
                <img src={att.preview} alt={att.file.name} style={{
                  width: "100%", height: "100%", objectFit: "cover",
                }} />
              ) : (
                <span style={{ fontSize: 9, color: "var(--text-tertiary)", padding: 2, textAlign: "center" }}>
                  {att.file.name.split(".").pop()?.toUpperCase()}
                </span>
              )}
              <button
                onClick={() => removeAttachment(att.id)}
                style={{
                  position: "absolute", top: -2, right: -2,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#E8127A", border: "none", color: "#fff",
                  fontSize: 10, cursor: "pointer", lineHeight: "16px",
                  padding: 0, display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: "10px 14px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        gap: 8,
        flexShrink: 0,
      }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={streaming || attachments.length >= MAX_ATTACHMENTS}
          title={attachments.length >= MAX_ATTACHMENTS ? `Max ${MAX_ATTACHMENTS} attachments` : "Attach file"}
          style={{
            padding: "8px",
            fontSize: 16,
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 6,
            cursor: streaming || attachments.length >= MAX_ATTACHMENTS ? "not-allowed" : "pointer",
            color: attachments.length > 0 ? meta.color : "var(--text-tertiary)",
            transition: "color 0.15s ease",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36, height: 36,
          }}
        >
          📎
        </button>
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
          onClick={() => send()}
          disabled={!canSend}
          style={{
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            border: "none",
            cursor: canSend ? "pointer" : "not-allowed",
            background: canSend ? meta.color : "var(--border)",
            color: canSend ? "#fff" : "var(--text-tertiary)",
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
