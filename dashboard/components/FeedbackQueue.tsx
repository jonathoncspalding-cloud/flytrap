"use client";

import { useState } from "react";
import type { UserFeedback, FeedbackStatus } from "@/lib/notion";

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  new: "#f59e0b",
  triaged: "#3b82f6",
  in_progress: "#8b5cf6",
  resolved: "#2a8c4a",
  wont_fix: "#6b7280",
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  feature: "Feature",
  data_quality: "Data Quality",
  design: "Design",
  prediction: "Prediction",
  source: "Source",
  performance: "Performance",
  other: "Other",
};

const AGENT_LABELS: Record<string, string> = {
  sentinel: "Sentinel",
  scout: "Scout",
  oracle: "Oracle",
  architect: "Architect",
  optimize: "Optimize",
  strategist: "Strategist",
  isabel: "Isabel",
};

const AGENT_COLORS: Record<string, string> = {
  sentinel: "#E8127A",
  scout: "#2a8c4a",
  oracle: "rgba(232,18,122,0.7)",
  architect: "#f472b6",
  optimize: "#FF8200",
  strategist: "#a78bfa",
  isabel: "#2dd4bf",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#E8127A",
  high: "#FF8200",
  medium: "#f59e0b",
  low: "#6b7280",
};

export default function FeedbackQueue({
  feedback,
}: {
  feedback: UserFeedback[];
}) {
  const [triaging, setTriaging] = useState(false);
  const [triageResult, setTriageResult] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearing, setClearing] = useState<string | null>(null);
  const [cleared, setCleared] = useState<Set<string>>(new Set());

  const newCount = feedback.filter((f) => f.status === "new").length;
  const triagedCount = feedback.filter((f) => f.status === "triaged").length;
  const inProgressCount = feedback.filter(
    (f) => f.status === "in_progress"
  ).length;

  async function handleTriage() {
    setTriaging(true);
    setTriageResult(null);
    try {
      const res = await fetch("/api/feedback/triage", { method: "POST" });
      if (!res.ok) throw new Error("Triage failed");
      const data = await res.json();
      setTriageResult(
        `Triaged ${data.triaged} item${data.triaged === 1 ? "" : "s"}`
      );
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setTriageResult("Triage failed — check API keys");
    } finally {
      setTriaging(false);
    }
  }

  async function handleClear(item: UserFeedback, newStatus: "resolved" | "wont_fix") {
    setClearing(item.id);
    try {
      const res = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      setCleared((prev) => new Set(prev).add(item.id));
      setExpandedId(null);
    } catch {
      // Silently fail — user can retry
    } finally {
      setClearing(null);
    }
  }

  function handleAddress(item: UserFeedback) {
    const feedbackSnippet = item.message.length > 80
      ? item.message.slice(0, 77) + "..."
      : item.message;
    const prompt = `Address this user feedback:\n\n> "${feedbackSnippet}"\n\n📍 Page: ${item.page} · Category: ${item.category} · Priority: ${item.priority}${item.routedTo ? ` · Routed to: ${item.routedTo}` : ""}\n\nFull feedback: "${item.message}"\n\nWhat agents should be involved, what's the scope, and what are the steps to resolve this?`;
    window.dispatchEvent(
      new CustomEvent("open-agent-chat", {
        detail: { agent: "sentinel", prompt },
      })
    );
  }

  const visibleFeedback = feedback.filter((f) => !cleared.has(f.id));

  if (visibleFeedback.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 3,
              height: 14,
              borderRadius: 2,
              background: "#f472b6",
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
            Feedback Queue
          </span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {visibleFeedback.length}
          </span>
        </div>

        {/* Triage button */}
        {newCount > 0 && (
          <button
            onClick={handleTriage}
            disabled={triaging}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid #f472b630",
              background: triaging
                ? "var(--surface)"
                : "linear-gradient(135deg, #f472b620, #f472b610)",
              color: "#f472b6",
              cursor: triaging ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {triaging
              ? "Triaging..."
              : triageResult
                ? triageResult
                : `Triage ${newCount} New`}
          </button>
        )}
      </div>

      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {newCount > 0 && (
          <StatusPill label="New" count={newCount} color={STATUS_COLORS.new} />
        )}
        {triagedCount > 0 && (
          <StatusPill
            label="Triaged"
            count={triagedCount}
            color={STATUS_COLORS.triaged}
          />
        )}
        {inProgressCount > 0 && (
          <StatusPill
            label="In Progress"
            count={inProgressCount}
            color={STATUS_COLORS.in_progress}
          />
        )}
      </div>

      {/* Feedback cards */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {visibleFeedback.slice(0, 20).map((item, i) => {
          const isExpanded = expandedId === item.id;
          const isClearing = clearing === item.id;
          return (
            <div
              key={item.id}
              style={{
                borderBottom:
                  i < Math.min(visibleFeedback.length, 20) - 1
                    ? "1px solid var(--border)"
                    : "none",
              }}
            >
              {/* Collapsed row — clickable */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  cursor: "pointer",
                  transition: "background 0.1s",
                  background: isExpanded ? "rgba(255,255,255,0.02)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.015)";
                }}
                onMouseLeave={(e) => {
                  if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {/* Status indicator */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: STATUS_COLORS[item.status] ?? "#6b7280",
                    marginTop: 5,
                    flexShrink: 0,
                  }}
                />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--text-primary)",
                      margin: "0 0 6px",
                      lineHeight: 1.5,
                      ...(isExpanded
                        ? {}
                        : {
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }),
                    } as React.CSSProperties}
                  >
                    {item.message}
                  </p>

                  {/* Pills */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Pill
                      label={CATEGORY_LABELS[item.category] || item.category}
                      color="var(--text-tertiary)"
                    />
                    <Pill label={item.page} color="var(--text-tertiary)" />
                    <Pill
                      label={item.priority}
                      color={PRIORITY_COLORS[item.priority] || "#6b7280"}
                    />
                    <Pill
                      label={item.status.replace("_", " ")}
                      color={STATUS_COLORS[item.status] ?? "#6b7280"}
                    />
                    {item.routedTo && (
                      <Pill
                        label={AGENT_LABELS[item.routedTo] || item.routedTo}
                        color={AGENT_COLORS[item.routedTo] || "#6b7280"}
                      />
                    )}
                  </div>
                </div>

                {/* Date + chevron */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                    {item.submitted ?? ""}
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-tertiary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transition: "transform 0.15s ease",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div
                  style={{
                    padding: "0 16px 14px 36px",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  {/* Full message */}
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      lineHeight: 1.6,
                      padding: "10px 14px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      marginBottom: 10,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {item.message}
                  </div>

                  {/* Response from agent (if any) */}
                  {item.response && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                        padding: "8px 12px",
                        background: "rgba(232,18,122,0.04)",
                        border: "1px solid rgba(232,18,122,0.12)",
                        borderRadius: 6,
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: "#E8127A",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          marginRight: 6,
                        }}
                      >
                        Response:
                      </span>
                      {item.response}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {/* Address button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddress(item);
                      }}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: "1px solid #E8127A30",
                        background: "linear-gradient(135deg, #E8127A18, #E8127A08)",
                        color: "#E8127A",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #E8127A28, #E8127A14)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #E8127A18, #E8127A08)";
                      }}
                    >
                      <span style={{ fontSize: 13 }}>👁️</span>
                      Address with Sentinel
                    </button>

                    {/* Resolve button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClear(item, "resolved");
                      }}
                      disabled={isClearing}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: "1px solid #2a8c4a30",
                        background: "linear-gradient(135deg, #2a8c4a18, #2a8c4a08)",
                        color: "#2a8c4a",
                        cursor: isClearing ? "not-allowed" : "pointer",
                        transition: "all 0.15s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        opacity: isClearing ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isClearing) (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #2a8c4a28, #2a8c4a14)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isClearing) (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #2a8c4a18, #2a8c4a08)";
                      }}
                    >
                      {isClearing ? "..." : "✓"}
                      {isClearing ? "Resolving" : "Resolve"}
                    </button>

                    {/* Dismiss button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClear(item, "wont_fix");
                      }}
                      disabled={isClearing}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "transparent",
                        color: "var(--text-tertiary)",
                        cursor: isClearing ? "not-allowed" : "pointer",
                        transition: "all 0.15s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        opacity: isClearing ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isClearing) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isClearing) (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        color,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          background: `${color}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        {count}
      </span>
      {label}
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        padding: "1px 6px",
        borderRadius: 3,
        background: `${color}12`,
        color,
        fontWeight: 500,
        textTransform: "capitalize",
      }}
    >
      {label}
    </span>
  );
}
