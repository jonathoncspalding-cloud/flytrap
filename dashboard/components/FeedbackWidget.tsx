"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import AgentAvatar from "@/components/AgentAvatar";
import { useFloatingPanel } from "@/components/FloatingPanels";

const PAGE_MAP: Record<string, string> = {
  "/": "Home",
  "/trends": "Trends",
  "/tensions": "Tensions",
  "/calendar": "Calendar",
  "/briefings": "Briefings",
  "/moments": "Moments",
  "/forecast": "Forecast",
  "/research": "Research",
  "/agents": "Agents",
};

const CATEGORIES = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature Request" },
  { value: "data_quality", label: "Data Quality" },
  { value: "design", label: "Design" },
  { value: "prediction", label: "Prediction" },
  { value: "source", label: "Source" },
  { value: "performance", label: "Performance" },
  { value: "other", label: "Other" },
];

function detectPage(pathname: string): string {
  if (PAGE_MAP[pathname]) return PAGE_MAP[pathname];
  for (const [prefix, page] of Object.entries(PAGE_MAP)) {
    if (prefix !== "/" && pathname.startsWith(prefix)) return page;
  }
  return "Home";
}

export default function FeedbackWidget() {
  const { activePanel, openPanel, closePanel } = useFloatingPanel();
  const open = activePanel === "feedback";
  const [category, setCategory] = useState("other");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closePanel();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleSubmit() {
    if (!message.trim()) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          page: detectPage(pathname),
          category,
        }),
      });

      if (!res.ok) throw new Error("Failed");
      setStatus("sent");
      setMessage("");
      setCategory("other");
      setTimeout(() => {
        setStatus("idle");
        closePanel();
      }, 1500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  // Hide entirely when another panel (chat) is active
  if (activePanel !== null && activePanel !== "feedback") return null;

  return (
    <div style={{ position: "fixed", bottom: 20, right: 76, zIndex: 9999 }} ref={panelRef}>
      {/* Panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: 56,
            right: 0,
            width: 300,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              Send Feedback
            </span>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4 }}>
              {detectPage(pathname)}
            </span>
          </div>

          {/* Body */}
          <div style={{ padding: 14 }}>
            {/* Category */}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: "100%",
                padding: "7px 10px",
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text-primary)",
                marginBottom: 10,
                outline: "none",
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none",
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            {/* Message */}
            <textarea
              placeholder="What's on your mind?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text-primary)",
                resize: "vertical",
                outline: "none",
                lineHeight: 1.5,
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!message.trim() || status === "sending"}
              style={{
                width: "100%",
                marginTop: 10,
                padding: "8px 0",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: "none",
                cursor: !message.trim() || status === "sending" ? "not-allowed" : "pointer",
                background:
                  status === "sent" ? "#2a8c4a" :
                  status === "error" ? "#E8127A" :
                  !message.trim() ? "var(--border)" :
                  "linear-gradient(135deg, #3da65a, #2a8c4a)",
                color:
                  status === "sent" || status === "error" || message.trim()
                    ? "#fff"
                    : "var(--text-tertiary)",
                transition: "all 0.15s ease",
              }}
            >
              {status === "sending" ? "Sending..." :
               status === "sent" ? "Sent!" :
               status === "error" ? "Failed — try again" :
               "Submit"}
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <div className="fab-agent-btn">
        <button
          onClick={() => open ? closePanel() : openPanel("feedback")}
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            border: open ? "1px solid rgba(232,18,122,0.3)" : "1px solid var(--border)",
            background: open ? "rgba(232,18,122,0.12)" : "var(--surface)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            transition: "all 0.2s",
            padding: 0,
            overflow: "hidden",
          }}
          className="card-hover"
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <AgentAvatar agent="sentinel" size={34} />
          )}
        </button>
        {!open && <div className="fab-tooltip">Feedback? Tell the Sentinel</div>}
      </div>
    </div>
  );
}
