import Link from "next/link";
import { getTensions, getTrends } from "@/lib/notion";
import TensionCard from "@/components/TensionCard";

export const revalidate = 300;

export default async function TensionsPage() {
  const [tensions, trends] = await Promise.all([getTensions(), getTrends()]);

  // Count linked flashpoints per tension
  const flashpointsByTension = new Map<string, number>();
  for (const t of trends.filter((tr) => tr.cps >= 80)) {
    for (const tid of t.linkedTensions ?? []) {
      flashpointsByTension.set(tid, (flashpointsByTension.get(tid) ?? 0) + 1);
    }
  }

  // Sort: highest weight first
  const sorted = [...tensions].sort((a, b) => b.weight - a.weight);

  const critical = sorted.filter((t) => t.weight >= 9);
  const high = sorted.filter((t) => t.weight >= 7 && t.weight < 9);
  const moderate = sorted.filter((t) => t.weight >= 5 && t.weight < 7);
  const low = sorted.filter((t) => t.weight < 5);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
            Cultural Tensions
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
            {tensions.length} tensions tracked &middot; The opposing forces that drive cultural behavior
            {" · "}
            <Link href="/info/tensions" style={{ color: "rgba(245,158,11,0.6)", textDecoration: "none", fontSize: 12 }} className="link-hover">
              What are tensions? &rarr;
            </Link>
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
          {[
            { label: "Critical", count: critical.length, color: "#ef4444" },
            { label: "High", count: high.length, color: "#f97316" },
            { label: "Moderate", count: moderate.length, color: "#eab308" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tension groups */}
      {[
        { label: "Critical", items: critical, color: "#ef4444" },
        { label: "High", items: high, color: "#f97316" },
        { label: "Moderate", items: moderate, color: "#eab308" },
        { label: "Background", items: low, color: "var(--text-tertiary)" },
      ]
        .filter((g) => g.items.length > 0)
        .map((group) => (
          <section key={group.label} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: group.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: group.color, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {group.label}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {group.items.length} tension{group.items.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 10,
            }}>
              {group.items.map((t) => (
                <TensionCard key={t.id} tension={t} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
