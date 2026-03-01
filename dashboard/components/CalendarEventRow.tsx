import { CalendarEvent } from "@/lib/notion";
import { cpsEmoji, cpsTextColor } from "./CpsBar";

interface Props {
  event: CalendarEvent;
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Politics:      { bg: "rgba(232,18,122,0.10)", color: "#E8127A" },
  Entertainment: { bg: "rgba(232,18,122,0.08)", color: "rgba(232,18,122,0.7)" },
  Sports:        { bg: "rgba(0,79,34,0.12)",    color: "#2a8c4a" },
  Tech:          { bg: "rgba(255,130,0,0.10)",   color: "#FF8200" },
  Business:      { bg: "var(--surface-raised)",  color: "var(--text-secondary)" },
  Culture:       { bg: "rgba(232,18,122,0.06)", color: "rgba(232,18,122,0.6)" },
  Holiday:       { bg: "rgba(255,130,0,0.08)",   color: "rgba(255,130,0,0.7)" },
  Music:         { bg: "rgba(0,79,34,0.08)",     color: "rgba(42,140,74,0.8)" },
  Film:          { bg: "rgba(232,18,122,0.08)",  color: "rgba(232,18,122,0.7)" },
};

const DEFAULT_CAT = { bg: "var(--surface-raised)", color: "var(--text-tertiary)" };

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function urgencyColor(days: number): string {
  if (days <= 3) return "#E8127A";
  if (days <= 7) return "#FF8200";
  if (days <= 14) return "rgba(255,130,0,0.6)";
  return "var(--text-tertiary)";
}

export default function CalendarEventRow({ event }: Props) {
  const days = daysUntil(event.date);

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 14,
      padding: "10px 0",
      borderBottom: "1px solid var(--border)",
    }}>
      {/* Date column */}
      <div style={{ textAlign: "center", flexShrink: 0, width: 52 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
          {formatDate(event.date)}
        </div>
        <div style={{
          fontSize: 10,
          marginTop: 2,
          fontWeight: days <= 7 ? 700 : 400,
          color: urgencyColor(days),
        }}>
          {days === 0 ? "TODAY" : days === 1 ? "tmrw" : `in ${days}d`}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14 }}>{cpsEmoji(event.cps)}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{event.name}</span>
          {event.type === "Predicted Moment" && (
            <span style={{
              fontSize: 10,
              background: "rgba(232,18,122,0.10)",
              color: "#E8127A",
              padding: "1px 6px",
              borderRadius: 4,
              fontWeight: 600,
            }}>
              Predicted
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {event.categories.map((cat) => {
            const style = CATEGORY_COLORS[cat] ?? DEFAULT_CAT;
            return (
              <span
                key={cat}
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: style.bg,
                  color: style.color,
                }}
              >
                {cat}
              </span>
            );
          })}
        </div>
        {event.notes && (
          <p style={{
            fontSize: 11,
            color: "var(--text-tertiary)",
            lineHeight: 1.4,
            margin: "4px 0 0",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          } as React.CSSProperties}>
            {event.notes}
          </p>
        )}
      </div>

      {/* CPS */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: cpsTextColor(event.cps) }}>{event.cps}</span>
        <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>CPS</div>
      </div>
    </div>
  );
}
