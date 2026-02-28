import { getUpcomingEvents } from "@/lib/notion";
import CalendarEventRow from "@/components/CalendarEventRow";
import { cpsEmoji } from "@/components/CpsBar";

export const revalidate = 3600; // Calendar changes slowly

const CATEGORY_OPTIONS = ["All", "Politics", "Entertainment", "Sports", "Tech", "Business", "Culture", "Holiday", "Music", "Film"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; horizon?: string }>;
}) {
  const params = await searchParams;
  const horizon = parseInt(params.horizon ?? "90");
  const filterCat = params.category ?? "All";

  const events = await getUpcomingEvents(horizon);

  const filtered = filterCat === "All"
    ? events
    : events.filter((e) => e.categories.includes(filterCat));

  // Group events by month
  const byMonth: Record<string, typeof events> = {};
  filtered.forEach((e) => {
    const month = e.date.slice(0, 7); // YYYY-MM
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(e);
  });

  const topEvents = [...filtered].sort((a, b) => b.cps - a.cps).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🗓 Cultural Calendar</h1>
        <p className="text-sm text-gray-500 mt-1">
          {filtered.length} events in the next {horizon} days
        </p>
      </div>

      {/* Horizon selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Horizon</span>
          <div className="flex gap-1">
            {[14, 30, 60, 90, 180, 365].map((d) => (
              <a
                key={d}
                href={`/calendar?category=${filterCat}&horizon=${d}`}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  horizon === d
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-gray-200 text-gray-600 hover:border-indigo-300"
                }`}
              >
                {d}d
              </a>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Category</span>
          <div className="flex flex-wrap gap-1">
            {CATEGORY_OPTIONS.map((c) => (
              <a
                key={c}
                href={`/calendar?category=${c}&horizon=${horizon}`}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filterCat === c
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-gray-200 text-gray-600 hover:border-indigo-300"
                }`}
              >
                {c}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main calendar */}
        <div className="lg:col-span-2 space-y-6">
          {Object.keys(byMonth).length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-400">No events match these filters.</p>
            </div>
          ) : (
            Object.entries(byMonth).map(([month, monthEvents]) => {
              const label = new Date(month + "-01T00:00:00").toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              });
              return (
                <div key={month} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="font-bold text-gray-800">{label}</h3>
                    <p className="text-xs text-gray-400">{monthEvents.length} event{monthEvents.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="px-4 py-2">
                    {monthEvents.map((e) => (
                      <CalendarEventRow key={e.id} event={e} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar: Highest CPS events */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-bold text-gray-800 mb-3 text-sm">🔥 Highest Cultural Potential</h3>
            <div className="space-y-3">
              {topEvents.map((e) => (
                <div key={e.id} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span>{cpsEmoji(e.cps)}</span>
                    <span className="font-medium text-sm text-gray-900">{e.name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{e.date}</span>
                    <span className="font-semibold text-gray-700">CPS {e.cps}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-bold text-gray-800 mb-3 text-sm">📊 Calendar Stats</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: "🔴 Flashpoints (80+)", count: filtered.filter(e => e.cps >= 80).length },
                { label: "🟠 Rising Heat (60+)", count: filtered.filter(e => e.cps >= 60 && e.cps < 80).length },
                { label: "🟡 Simmer (40+)", count: filtered.filter(e => e.cps >= 40 && e.cps < 60).length },
                { label: "🔵 Low Burn (<40)", count: filtered.filter(e => e.cps < 40).length },
                { label: "🎯 Predicted Moments", count: filtered.filter(e => e.type === "Predicted Moment").length },
              ].map(({ label, count }) => (
                <div key={label} className="flex justify-between text-gray-600">
                  <span>{label}</span>
                  <span className="font-semibold text-gray-800">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
