/**
 * CpsBar — Cultural Potency Score display component.
 * Color scale: green (high) → amber → slate → dim
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

// Green-dominant scale — high CPS = bright green
export function cpsBarColor(score: number): string {
  if (score >= 80) return "#4ade80";   // bright green  — Flashpoint
  if (score >= 60) return "#86efac";   // medium green  — Rising Heat
  if (score >= 40) return "#fbbf24";   // amber         — Simmer
  if (score >= 20) return "#6366f1";   // indigo        — Low Burn
  return "rgba(255,255,255,0.2)";      // dim           — Noise
}

export function cpsTextColor(score: number): string {
  if (score >= 80) return "#4ade80";
  if (score >= 60) return "#86efac";
  if (score >= 40) return "#fbbf24";
  if (score >= 20) return "#818cf8";
  return "rgba(255,255,255,0.3)";
}

export function cpsDotColor(score: number): string {
  return cpsTextColor(score);
}

export function cpsEmoji(score: number): string {
  if (score >= 80) return "🟢";
  if (score >= 60) return "🟩";
  if (score >= 40) return "🟡";
  if (score >= 20) return "🔵";
  return "⚪";
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
          background: "rgba(255,255,255,0.08)",
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
        <span style={{ fontSize: 13, fontWeight: 700, color: textColor }}>{score}</span>
      </div>
      <div style={{
        height: 4, background: "rgba(255,255,255,0.08)",
        borderRadius: 2, overflow: "hidden",
      }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}
