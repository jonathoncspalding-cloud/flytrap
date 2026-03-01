import { getUpcomingEvents } from "@/lib/notion";
import CalendarEventRow from "@/components/CalendarEventRow";
import { cpsEmoji, cpsTextColor, cpsBarColor } from "@/components/CpsBar";

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
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
          Cultural Calendar
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
          {filtered.length} events in the next {horizon} days
        </p>
      </div>

      {/* Horizon selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Horizon</span>
          <div style={{ display: "flex", gap: 4 }}>
            {[14, 30, 60, 90, 180, 365].map((d) => (
              <a
                key={d}
                href={`/calendar?category=${filterCat}&horizon=${d}`}
                style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 99,
                  border: `1px solid ${horizon === d ? "rgba(0,79,34,0.4)" : "var(--border)"}`,
                  background: horizon === d ? "rgba(0,79,34,0.15)" : "transparent",
                  color: horizon === d ? "var(--moss-bright, #2a8c4a)" : "var(--text-secondary)",
                  textDecoration: "none",
                  fontWeight: horizon === d ? 700 : 400,
                  transition: "all 0.15s",
                }}
              >
                {d}d
              </a>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Category</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {CATEGORY_OPTIONS.map((c) => (
              <a
                key={c}
                href={`/calendar?category=${c}&horizon=${horizon}`}
                style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 99,
                  border: `1px solid ${filterCat === c ? "rgba(0,79,34,0.4)" : "var(--border)"}`,
                  background: filterCat === c ? "rgba(0,79,34,0.15)" : "transparent",
                  color: filterCat === c ? "var(--moss-bright, #2a8c4a)" : "var(--text-secondary)",
                  textDecoration: "none",
                  fontWeight: filterCat === c ? 700 : 400,
                  transition: "all 0.15s",
                }}
              >
                {c}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

        {/* Main calendar */}
        <div style={{ gridColumn: "1 / 3", display: "flex", flexDirection: "column", gap: 16 }}>
          {Object.keys(byMonth).length === 0 ? (
            <div style={{
              background: "var(--surface)",
              border: "1px dashed var(--border)",
              borderRadius: 10,
              padding: 48,
              textAlign: "center",
            }}>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13, margin: 0 }}>No events match these filters.</p>
            </div>
          ) : (
            Object.entries(byMonth).map(([month, monthEvents]) => {
              const label = new Date(month + "-01T00:00:00").toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              });
              return (
                <div key={month} style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}>
                  <div style={{
                    padding: "10px 16px",
                    background: "var(--surface-raised)",
                    borderBottom: "1px solid var(--border)",
                  }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{label}</h3>
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>
                      {monthEvents.length} event{monthEvents.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div style={{ padding: "4px 16px" }}>
                    {monthEvents.map((e) => (
                      <CalendarEventRow key={e.id} event={e} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar: Highest CPS events + Stats */}
        <div style={{ gridColumn: "3", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: "var(--rose, #E8127A)", flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Highest Cultural Potential
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {topEvents.map((e, i) => (
                <div key={e.id} style={{
                  padding: "8px 0",
                  borderBottom: i < topEvents.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{cpsEmoji(e.cps)}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{e.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3 }}>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{e.date}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cpsTextColor(e.cps) }}>CPS {e.cps}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: "var(--sunset, #FF8200)", flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Calendar Stats
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Flashpoints (80+)", count: filtered.filter(e => e.cps >= 80).length, color: "#E8127A" },
                { label: "Rising Heat (60+)", count: filtered.filter(e => e.cps >= 60 && e.cps < 80).length, color: "#FF8200" },
                { label: "Simmer (40+)", count: filtered.filter(e => e.cps >= 40 && e.cps < 60).length, color: "rgba(255,130,0,0.6)" },
                { label: "Low Burn (<40)", count: filtered.filter(e => e.cps < 40).length, color: "var(--text-tertiary)" },
                { label: "Predicted Moments", count: filtered.filter(e => e.type === "Predicted Moment").length, color: "#E8127A" },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
