import { CalendarEvent } from "@/lib/notion";
import { cpsEmoji, cpsDotColor } from "./CpsBar";

interface Props {
  event: CalendarEvent;
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics: "bg-red-100 text-red-700",
  Entertainment: "bg-pink-100 text-pink-700",
  Sports: "bg-green-100 text-green-700",
  Tech: "bg-blue-100 text-blue-700",
  Business: "bg-gray-100 text-gray-700",
  Culture: "bg-purple-100 text-purple-700",
  Holiday: "bg-yellow-100 text-yellow-700",
  Music: "bg-orange-100 text-orange-700",
  Film: "bg-indigo-100 text-indigo-700",
};

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

export default function CalendarEventRow({ event }: Props) {
  const days = daysUntil(event.date);
  const urgency =
    days <= 3
      ? "text-red-600 font-bold"
      : days <= 7
      ? "text-orange-500 font-semibold"
      : days <= 14
      ? "text-yellow-600"
      : "text-gray-400";

  return (
    <div className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
      {/* Date column */}
      <div className="text-center shrink-0 w-14">
        <div className="text-sm font-bold text-gray-800">{formatDate(event.date)}</div>
        <div className={`text-xs mt-0.5 ${urgency}`}>
          {days === 0 ? "TODAY" : days === 1 ? "tmrw" : `in ${days}d`}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-base ${cpsDotColor(event.cps)}`}>{cpsEmoji(event.cps)}</span>
          <span className="font-medium text-gray-900 text-sm">{event.name}</span>
          {event.type === "Predicted Moment" && (
            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
              Predicted
            </span>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {event.categories.map((cat) => (
            <span
              key={cat}
              className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-600"}`}
            >
              {cat}
            </span>
          ))}
        </div>
        {event.notes && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{event.notes}</p>
        )}
      </div>

      {/* CPS */}
      <div className="text-right shrink-0">
        <span className="text-sm font-bold text-gray-700">{event.cps}</span>
        <div className="text-xs text-gray-400">CPS</div>
      </div>
    </div>
  );
}
