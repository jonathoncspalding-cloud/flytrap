/**
 * CpsBar — Cultural Potency Score display component.
 * Cornett brand palette: Rose (hot) → Sunset (warm) → Moss (cool)
 */

interface CpsBarProps {
  score: number;
  showLabel?: boolean;
  compact?: boolean;
}

export function cpsLabel(score: number): string {
  if (score >= 80) return "Flashpoint";
  if (score >= 60) return "Rising Heat";
  if (score >= 40) return "Simmer";
  if (score >= 20) return "Low Burn";
  return "Background Noise";
}

export function cpsFullLabel(score: number): string {
  if (score >= 80) return "Cultural Flashpoint — likely to peak soon";
  if (score >= 60) return "Rising Heat — building momentum";
  if (score >= 40) return "Simmer — notable but not yet urgent";
  if (score >= 20) return "Low Burn — early stage, worth tracking";
  return "Background Noise — logged but low priority";
}

// Cornett palette: Rose → Sunset → Moss scale
export function cpsBarColor(score: number): string {
  if (score >= 80) return "#E8127A";             // Rose — Flashpoint
  if (score >= 60) return "#FF8200";             // Sunset — Rising Heat
  if (score >= 40) return "rgba(255,130,0,0.6)"; // Sunset muted — Simmer
  if (score >= 20) return "rgba(42,140,74,0.5)"; // Moss muted — Low Burn
  return "rgba(242,239,237,0.15)";               // Birch dim — Noise
}

export function cpsTextColor(score: number): string {
  if (score >= 80) return "#E8127A";
  if (score >= 60) return "#FF8200";
  if (score >= 40) return "rgba(255,130,0,0.7)";
  if (score >= 20) return "#2a8c4a";
  return "rgba(242,239,237,0.3)";
}

export function cpsDotColor(score: number): string {
  return cpsTextColor(score);
}

export function cpsEmoji(score: number): string {
  if (score >= 80) return "\uD83D\uDD34"; // red circle — flashpoint urgency
  if (score >= 60) return "\uD83D\uDFE0"; // orange circle
  if (score >= 40) return "\uD83D\uDFE1"; // yellow circle
  if (score >= 20) return "\uD83D\uDFE2"; // green circle
  return "\u26AA";                          // white circle
}

export default function CpsBar({ score, showLabel = false, compact = false }: CpsBarProps) {
  const pct      = Math.min(100, Math.max(0, score));
  const color     = cpsBarColor(score);
  const textColor = cpsTextColor(score);
  const label     = cpsLabel(score);

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          height: 4, flex: 1,
          background: "rgba(242,239,237,0.06)",
          borderRadius: 2, overflow: "hidden",
        }}>
          <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: textColor, whiteSpace: "nowrap" }}>
          {score}{showLabel && <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}> — {label}</span>}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {showLabel ? label : "Cultural Potency"}
        </span>
        <span style={{
          fontFamily: "var(--font-fraunces, 'Fraunces', serif)",
          fontSize: 14, fontWeight: 600, color: textColor,
        }}>{score}</span>
      </div>
      <div style={{
        height: 4, background: "rgba(242,239,237,0.06)",
        borderRadius: 2, overflow: "hidden",
      }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}
