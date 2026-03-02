import Link from "next/link";
import { getTensions, getTrends, Tension } from "@/lib/notion";
import TensionCard from "@/components/TensionCard";

export const revalidate = 300;

/** Tensions linked to >= this fraction of active trends are "ambient" */
const AMBIENT_THRESHOLD = 0.5;

interface TensionEnriched extends Tension {
  prevalence: number;
  linkedCount: number;
  isAmbient: boolean;
}

function AmbientTensionChip({ tension }: { tension: TensionEnriched }) {
  const pct = Math.round(tension.prevalence * 100);
  return (
    <Link href={`/tensions/${tension.id}`} style={{ textDecoration: "none" }}>
      <div
        className="tension-hover tension-hover-gray"
        style={{
          background: "rgba(255,130,0,0.04)",
          border: "1px solid rgba(255,130,0,0.12)",
          borderRadius: 8,
          padding: "10px 14px",
          minWidth: 160,
          maxWidth: 220,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--text-secondary)",
            lineHeight: 1.3,
            marginBottom: 8,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}
        >
          {tension.name}
        </div>
        {/* Prevalence bar */}
        <div
          style={{
            height: 3,
            background: "var(--border)",
            borderRadius: 2,
            overflow: "hidden",
            marginBottom: 4,
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "rgba(255,130,0,0.35)",
              borderRadius: 2,
            }}
          />
        </div>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
          {pct}% of trends
        </div>
      </div>
    </Link>
  );
}

export default async function TensionsPage() {
  const [tensions, trends] = await Promise.all([getTensions(), getTrends()]);

  // Count how many trends link to each tension (computed from the Trends side,
  // since Notion reverse relations aren't populated in query results)
  const trendCountByTension = new Map<string, number>();
  const flashpointsByTension = new Map<string, number>();
  for (const tr of trends) {
    for (const tid of tr.linkedTensions ?? []) {
      trendCountByTension.set(tid, (trendCountByTension.get(tid) ?? 0) + 1);
      if (tr.cps >= 80) {
        flashpointsByTension.set(tid, (flashpointsByTension.get(tid) ?? 0) + 1);
      }
    }
  }

  // Compute prevalence and classify ambient vs. specific
  const activeTrendCount = trends.length;

  const tensionsEnriched: TensionEnriched[] = tensions.map((t) => {
    const linkedCount = trendCountByTension.get(t.id) ?? 0;
    const prevalence =
      activeTrendCount > 0 ? linkedCount / activeTrendCount : 0;
    return {
      ...t,
      prevalence,
      linkedCount,
      isAmbient: prevalence >= AMBIENT_THRESHOLD,
    };
  });

  const ambient = tensionsEnriched
    .filter((t) => t.isAmbient)
    .sort((a, b) => b.prevalence - a.prevalence);

  const specific = tensionsEnriched
    .filter((t) => !t.isAmbient)
    .sort((a, b) => b.weight - a.weight);

  // Weight-based groups for specific tensions only
  const critical = specific.filter((t) => t.weight >= 9);
  const high = specific.filter((t) => t.weight >= 7 && t.weight < 9);
  const moderate = specific.filter((t) => t.weight >= 5 && t.weight < 7);
  const low = specific.filter((t) => t.weight < 5);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: "0 0 4px",
            }}
          >
            Cultural Tensions
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
            {specific.length} specific tensions &middot; {ambient.length}{" "}
            ambient force{ambient.length !== 1 ? "s" : ""} &middot; The opposing
            forces that drive cultural behavior
            {" \u00B7 "}
            <Link
              href="/info/tensions"
              style={{
                color: "rgba(255,130,0,0.6)",
                textDecoration: "none",
                fontSize: 12,
              }}
              className="link-hover"
            >
              What are tensions? &rarr;
            </Link>
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
          {[
            { label: "Critical", count: critical.length, color: "#E8127A" },
            { label: "High", count: high.length, color: "#FF8200" },
            {
              label: "Moderate",
              count: moderate.length,
              color: "rgba(255,130,0,0.6)",
            },
            {
              label: "Ambient",
              count: ambient.length,
              color: "var(--text-tertiary)",
            },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>
                {s.count}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cultural Atmosphere — ambient tensions */}
      {ambient.length > 0 && (
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 28,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle radial glow */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(255,130,0,0.04), transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              position: "relative",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-tertiary)",
                }}
              >
                Cultural Atmosphere
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  marginLeft: 8,
                }}
              >
                Forces present in &gt;50% of active trends
              </span>
            </div>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {ambient.length} background force
              {ambient.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              position: "relative",
            }}
          >
            {ambient.map((t) => (
              <AmbientTensionChip key={t.id} tension={t} />
            ))}
          </div>
        </section>
      )}

      {/* Specific tension groups */}
      {[
        { label: "Critical", items: critical, color: "#E8127A" },
        { label: "High", items: high, color: "#FF8200" },
        { label: "Moderate", items: moderate, color: "rgba(255,130,0,0.6)" },
        { label: "Background", items: low, color: "var(--text-tertiary)" },
      ]
        .filter((g) => g.items.length > 0)
        .map((group) => (
          <section key={group.label} style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 3,
                  height: 14,
                  borderRadius: 2,
                  background: group.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: group.color,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {group.label}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {group.items.length} tension
                {group.items.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 10,
              }}
            >
              {group.items.map((t) => (
                <TensionCard key={t.id} tension={t} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
