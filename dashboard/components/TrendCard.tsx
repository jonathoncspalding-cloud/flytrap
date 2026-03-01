/**
 * TrendCard — Card component for a single trend.
 * Shows CPS sparkline when history data is available.
 */
"use client";

import Link from "next/link";
import { Trend } from "@/lib/notion";
import CpsBar, { cpsEmoji, cpsTextColor, cpsLabel } from "./CpsBar";
import SparkLine from "./SparkLine";

interface TrendCardProps {
  trend: Trend;
  compact?: boolean;
}

function cpsTierClass(cps: number): string {
  if (cps >= 80) return "row-hover trend-row-flashpoint";
  if (cps >= 60) return "row-hover trend-row-rising";
  if (cps >= 40) return "row-hover trend-row-simmer";
  if (cps >= 20) return "row-hover trend-row-low";
  return "row-hover trend-row-noise";
}

const TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  "Macro Trend":      { bg: "rgba(255,130,0,0.12)",  color: "#FF8200" },
  "Micro Trend":      { bg: "rgba(0,79,34,0.15)",    color: "#2a8c4a" },
  "Emerging Signal":  { bg: "rgba(232,18,122,0.10)", color: "#E8127A" },
  "Scheduled Event":  { bg: "rgba(0,79,34,0.10)",    color: "#2a8c4a" },
  "Predicted Moment": { bg: "rgba(232,18,122,0.12)", color: "#E8127A" },
};

const TYPE_PLAIN: Record<string, string> = {
  "Macro Trend":      "Long-term shift",
  "Micro Trend":      "Cultural behavior",
  "Emerging Signal":  "Early signal",
  "Scheduled Event":  "Known event",
  "Predicted Moment": "Predicted event",
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Exploding: { bg: "rgba(232,18,122,0.12)",   color: "#E8127A" },
  Rising:    { bg: "rgba(255,130,0,0.12)",     color: "#FF8200" },
  Peaked:    { bg: "rgba(255,130,0,0.10)",     color: "rgba(255,130,0,0.7)" },
  Stable:    { bg: "rgba(0,79,34,0.10)",       color: "#2a8c4a" },
  Emerging:  { bg: "rgba(232,18,122,0.08)",    color: "rgba(232,18,122,0.7)" },
  Archived:  { bg: "var(--surface-raised)",    color: "var(--text-tertiary)" },
};

function cpsDelta(sparkline: number[]): { value: number; label: string; color: string } | null {
  if (!sparkline || sparkline.length < 2) return null;
  const delta = sparkline[sparkline.length - 1] - sparkline[sparkline.length - 2];
  if (delta === 0) return { value: 0, label: "\u2192", color: "var(--text-tertiary)" };
  const label = delta > 0 ? `+${delta}` : `${delta}`;
  const color = delta > 0 ? "#2a8c4a" : "#E8127A";
  return { value: delta, label, color };
}

export default function TrendCard({ trend, compact = false }: TrendCardProps) {
  const typeStyle   = TYPE_STYLES[trend.type] ?? { bg: "var(--surface-raised)", color: "var(--text-secondary)" };
  const statusStyle = STATUS_STYLES[trend.status] ?? { bg: "var(--surface-raised)", color: "var(--text-secondary)" };
  const textColor   = cpsTextColor(trend.cps);
  const sparkline   = trend.sparkline ?? [];
  const delta       = cpsDelta(sparkline);

  if (compact) {
    return (
      <Link href={`/trends/${trend.id}`} style={{ textDecoration: "none" }}>
        <div className={cpsTierClass(trend.cps)} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px 10px 13px",
          borderBottom: "1px solid var(--border)",
          cursor: "pointer",
        }}>
          <span style={{ fontSize: 16 }}>{cpsEmoji(trend.cps)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {trend.name}
              {trend.pinned && <span style={{ marginLeft: 6, fontSize: 11 }}>📌</span>}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, background: typeStyle.bg, color: typeStyle.color }}>
                {TYPE_PLAIN[trend.type] ?? trend.type}
              </span>
              {trend.evidenceCount !== undefined && trend.evidenceCount > 0 && (
                <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, background: "var(--surface-raised)", color: "var(--text-tertiary)" }}
                  title={`${trend.evidenceCount} signals across ${trend.platformCount ?? 1} platform${(trend.platformCount ?? 1) !== 1 ? "s" : ""}`}>
                  {trend.evidenceCount}s · {trend.platformCount ?? 1}p
                </span>
              )}
            </div>
          </div>
          {/* Sparkline in compact mode */}
          {sparkline.length >= 2 && (
            <div style={{ flexShrink: 0 }}>
              <SparkLine data={sparkline} width={48} height={20} />
            </div>
          )}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: textColor }}>{trend.cps}</div>
            {delta && (
              <div style={{ fontSize: 10, color: delta.color, fontWeight: 600 }}>{delta.label}</div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/trends/${trend.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div className="card-hover" style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 20,
        cursor: "pointer",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badges */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 4,
                background: typeStyle.bg, color: typeStyle.color, fontWeight: 500,
              }}>
                {TYPE_PLAIN[trend.type] ?? trend.type}
              </span>
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 4,
                background: statusStyle.bg, color: statusStyle.color, fontWeight: 500,
              }}>
                {trend.status}
              </span>
              {trend.pinned && <span style={{ fontSize: 11 }}>📌</span>}
            </div>
            {/* Name */}
            <h3 style={{
              fontSize: 15, fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.3, margin: 0,
            }}>
              {trend.name}
            </h3>
          </div>

          {/* CPS + sparkline */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end" }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: textColor, lineHeight: 1 }}>{trend.cps}</div>
              {delta && (
                <div style={{ fontSize: 12, fontWeight: 600, color: delta.color }}>{delta.label}</div>
              )}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
              {cpsLabel(trend.cps)}
            </div>
            {/* Sparkline */}
            {sparkline.length >= 2 && (
              <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
                <SparkLine data={sparkline} width={64} height={22} />
              </div>
            )}
          </div>
        </div>

        {/* CPS bar */}
        <div style={{ marginBottom: 12 }}>
          <CpsBar score={trend.cps} />
        </div>

        {/* Summary */}
        {trend.summary && (
          <p style={{
            fontSize: 13, color: "var(--text-secondary)",
            lineHeight: 1.6, margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {trend.summary}
          </p>
        )}

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 14, paddingTop: 12,
          borderTop: "1px solid var(--border)",
        }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {trend.lastUpdated
              ? `Updated ${new Date(trend.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : "No date"}
          </span>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {trend.evidenceCount !== undefined && trend.evidenceCount > 0 && (
              <span
                style={{ fontSize: 11, color: trend.evidenceCount >= 10 ? "#2a8c4a" : trend.evidenceCount >= 5 ? "#FF8200" : "var(--text-tertiary)" }}
                title={`${trend.evidenceCount} signals across ${trend.platformCount ?? 1} platform${(trend.platformCount ?? 1) !== 1 ? "s" : ""}`}
              >
                {trend.evidenceCount} signal{trend.evidenceCount !== 1 ? "s" : ""} · {trend.platformCount ?? 1} platform{(trend.platformCount ?? 1) !== 1 ? "s" : ""}
              </span>
            )}
            {sparkline.length >= 2 && (
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {sparkline.length}d history
              </span>
            )}
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              M<span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{trend.momentum}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
