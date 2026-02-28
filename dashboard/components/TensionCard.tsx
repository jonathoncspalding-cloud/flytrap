"use client";

import Link from "next/link";
import { Tension } from "@/lib/notion";

function weightStyle(w: number) {
  if (w >= 9) return { border: "rgba(239,68,68,0.3)", bg: "rgba(239,68,68,0.06)", color: "#f87171", bar: "#ef4444", hoverClass: "tension-hover tension-hover-red", vsColor: "rgba(239,68,68,0.35)" };
  if (w >= 7) return { border: "rgba(249,115,22,0.3)", bg: "rgba(249,115,22,0.06)", color: "#fb923c", bar: "#f97316", hoverClass: "tension-hover tension-hover-orange", vsColor: "rgba(249,115,22,0.35)" };
  if (w >= 5) return { border: "rgba(234,179,8,0.3)", bg: "rgba(234,179,8,0.06)", color: "#fbbf24", bar: "#eab308", hoverClass: "tension-hover tension-hover-yellow", vsColor: "rgba(234,179,8,0.35)" };
  return { border: "var(--border)", bg: "var(--surface-raised)", color: "var(--text-secondary)", bar: "var(--border-strong)", hoverClass: "tension-hover tension-hover-gray", vsColor: "var(--text-tertiary)" };
}

/** Split "X vs. Y" names — returns [left, right] or null if no "vs." */
function splitTension(name: string): [string, string] | null {
  const match = name.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (!match) return null;
  return [match[1].trim(), match[2].trim()];
}

export default function TensionCard({ tension }: { tension: Tension }) {
  const s = weightStyle(tension.weight);
  const sides = splitTension(tension.name);

  return (
    <Link href={`/tensions/${tension.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div
        className={s.hoverClass}
        style={{
          border: `1px solid ${s.border}`,
          background: s.bg,
          borderRadius: 10,
          padding: "14px 16px",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${s.bar}, transparent)` }} />

        {/* Weight badge */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: s.color }}>
            {tension.weight}<span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-tertiary)" }}>/10</span>
          </span>
        </div>

        {/* Tension name — split or plain */}
        {sides ? (
          <div style={{ marginBottom: 10 }}>
            {/* Side A */}
            <div style={{
              fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.35,
            }}>
              {sides[0]}
            </div>

            {/* VS divider */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              margin: "6px 0",
            }}>
              <div style={{ flex: 1, height: 1, background: s.vsColor }} />
              <span style={{
                fontSize: 10, fontWeight: 800, color: s.color,
                letterSpacing: "0.1em", textTransform: "uppercase",
                padding: "1px 6px",
                border: `1px solid ${s.vsColor}`,
                borderRadius: 4,
                flexShrink: 0,
              }}>
                vs
              </span>
              <div style={{ flex: 1, height: 1, background: s.vsColor }} />
            </div>

            {/* Side B */}
            <div style={{
              fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.35,
            }}>
              {sides[1]}
            </div>
          </div>
        ) : (
          <div style={{
            fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.35,
            marginBottom: 10,
          }}>
            {tension.name}
          </div>
        )}

        {/* Weight bar */}
        <div style={{ height: 3, background: "var(--border-strong)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ width: `${tension.weight * 10}%`, height: "100%", background: s.bar, borderRadius: 2 }} />
        </div>

        {/* Description */}
        {tension.description && (
          <p style={{
            fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          } as React.CSSProperties}>
            {tension.description}
          </p>
        )}
      </div>
    </Link>
  );
}
