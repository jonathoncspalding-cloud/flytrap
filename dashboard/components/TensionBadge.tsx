"use client";

import Link from "next/link";
import { Tension } from "@/lib/notion";

interface Props {
  tension: Tension;
  showDescription?: boolean;
}

function weightStyle(w: number): { border: string; bg: string; color: string; bar: string; hoverClass: string } {
  if (w >= 9) return { border: "rgba(239,68,68,0.3)", bg: "rgba(239,68,68,0.08)", color: "#f87171", bar: "#ef4444", hoverClass: "tension-hover tension-hover-red" };
  if (w >= 7) return { border: "rgba(249,115,22,0.3)", bg: "rgba(249,115,22,0.08)", color: "#fb923c", bar: "#f97316", hoverClass: "tension-hover tension-hover-orange" };
  if (w >= 5) return { border: "rgba(234,179,8,0.3)", bg: "rgba(234,179,8,0.08)", color: "#fbbf24", bar: "#eab308", hoverClass: "tension-hover tension-hover-yellow" };
  return { border: "var(--border)", bg: "var(--surface-raised)", color: "var(--text-secondary)", bar: "var(--border-strong)", hoverClass: "tension-hover tension-hover-gray" };
}

export default function TensionBadge({ tension, showDescription = false }: Props) {
  const s = weightStyle(tension.weight);

  return (
    <Link href={`/tensions/${tension.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div
        className={s.hoverClass}
        style={{
          border: `1px solid ${s.border}`,
          background: s.bg,
          borderRadius: 8,
          padding: "10px 12px",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.3 }}>
            {tension.name}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: s.color, flexShrink: 0, opacity: 0.85 }}>
            {tension.weight}/10
          </span>
        </div>
        <div style={{ height: 3, background: "var(--border-strong)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${tension.weight * 10}%`, height: "100%", background: s.bar, borderRadius: 2 }} />
        </div>
        {showDescription && tension.description && (
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.5, marginBottom: 0 }}>
            {tension.description}
          </p>
        )}
      </div>
    </Link>
  );
}
