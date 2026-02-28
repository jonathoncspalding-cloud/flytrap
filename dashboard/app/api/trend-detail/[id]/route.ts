/**
 * /api/trend-detail/[id]
 * Returns a trend's full detail + its linked evidence items.
 * Used by the BriefingViewer side drawer when a trend name is clicked.
 */

import { getTrend, getEvidenceForTrend } from "@/lib/notion";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [trend, evidence] = await Promise.all([
      getTrend(id),
      getEvidenceForTrend(id),
    ]);

    if (!trend) {
      return Response.json({ error: "Trend not found" }, { status: 404 });
    }

    return Response.json(
      { trend, evidence: evidence.slice(0, 10) },
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
