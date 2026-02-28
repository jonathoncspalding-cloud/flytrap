import { getTrends, getEvidenceCounts } from "@/lib/notion";
import TrendCard from "@/components/TrendCard";

export const revalidate = 300;

const TYPE_OPTIONS = ["All", "Macro Trend", "Micro Trend", "Emerging Signal", "Scheduled Event", "Predicted Moment"];
const STATUS_OPTIONS = ["All", "Exploding", "Rising", "Peaked", "Stable", "Emerging"];

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; view?: string }>;
}) {
  const params = await searchParams;
  const [trends, evidenceCounts] = await Promise.all([
    getTrends(),
    getEvidenceCounts(),
  ]);

  // Merge evidence counts into trends
  const trendsWithCounts = trends.map((t) => {
    const ec = evidenceCounts.get(t.id);
    return ec ? { ...t, evidenceCount: ec.count, platformCount: ec.platformCount } : t;
  });

  const filterType = params.type ?? "All";
  const filterStatus = params.status ?? "All";
  const view = params.view ?? "grid";

  const filtered = trendsWithCounts.filter((t) => {
    if (filterType !== "All" && t.type !== filterType) return false;
    if (filterStatus !== "All" && t.status !== filterStatus) return false;
    return true;
  });

  const flashpoints = filtered.filter((t) => t.cps >= 80).length;
  const risingHeat = filtered.filter((t) => t.cps >= 60 && t.cps < 80).length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
          All Trends
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
          {filtered.length} trend{filtered.length !== 1 ? "s" : ""} · {flashpoints} flashpoints · {risingHeat} rising heat
        </p>
      </div>

      {/* Filters */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "12px 16px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>

          {/* Type */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.06em" }}>TYPE</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {TYPE_OPTIONS.map((t) => (
                <a
                  key={t}
                  href={`/trends?type=${t}&status=${filterStatus}&view=${view}`}
                  style={{
                    fontSize: 12, padding: "3px 10px", borderRadius: 99, textDecoration: "none",
                    border: filterType === t ? "1px solid rgba(255,255,255,0.3)" : "1px solid var(--border)",
                    background: filterType === t ? "rgba(255,255,255,0.1)" : "transparent",
                    color: filterType === t ? "var(--text-primary)" : "var(--text-secondary)",
                    transition: "all 0.15s",
                  }}
                >
                  {t === "Emerging Signal" ? "Signal" : t === "Scheduled Event" ? "Event" : t === "Predicted Moment" ? "Predicted" : t}
                </a>
              ))}
            </div>
          </div>

          {/* Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.06em" }}>STATUS</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {STATUS_OPTIONS.map((s) => (
                <a
                  key={s}
                  href={`/trends?type=${filterType}&status=${s}&view=${view}`}
                  style={{
                    fontSize: 12, padding: "3px 10px", borderRadius: 99, textDecoration: "none",
                    border: filterStatus === s ? "1px solid rgba(255,255,255,0.3)" : "1px solid var(--border)",
                    background: filterStatus === s ? "rgba(255,255,255,0.1)" : "transparent",
                    color: filterStatus === s ? "var(--text-primary)" : "var(--text-secondary)",
                    transition: "all 0.15s",
                  }}
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {/* View toggle */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 7, padding: 3 }}>
            {["grid", "list"].map((v) => (
              <a
                key={v}
                href={`/trends?type=${filterType}&status=${filterStatus}&view=${v}`}
                style={{
                  fontSize: 12, padding: "3px 10px", borderRadius: 5, textDecoration: "none",
                  background: view === v ? "rgba(255,255,255,0.1)" : "transparent",
                  color: view === v ? "var(--text-primary)" : "var(--text-tertiary)",
                  fontWeight: view === v ? 500 : 400,
                  textTransform: "capitalize",
                }}
              >
                {v}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div style={{
          background: "var(--surface)", border: "1px dashed var(--border)",
          borderRadius: 10, padding: 64, textAlign: "center",
        }}>
          <p style={{ color: "var(--text-secondary)", margin: "0 0 8px" }}>No trends match these filters.</p>
          <a href="/trends" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
            Clear filters →
          </a>
        </div>
      ) : view === "list" ? (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, overflow: "hidden",
        }}>
          {filtered.map((t) => (
            <TrendCard key={t.id} trend={t} compact />
          ))}
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 12,
        }}>
          {filtered.map((t) => (
            <TrendCard key={t.id} trend={t} />
          ))}
        </div>
      )}
    </div>
  );
}
