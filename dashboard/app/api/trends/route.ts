/**
 * GET /api/trends
 * Returns a lightweight list of active trends for the LeBrain Chrome Extension dropdown.
 * Used to populate the "Assign to Trend" field in the extension popup.
 *
 * Response: { trends: [{ id, name, status, cps }] }
 */

import { NextRequest, NextResponse } from "next/server";

const NOTION_VERSION = "2022-06-28";
const NOTION_BASE = "https://api.notion.com/v1";
const TRENDS_DB = process.env.NOTION_TRENDS_DB!;

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

export async function GET(req: NextRequest) {
  // Optional: check for a shared secret in Authorization header
  // This lets the extension authenticate without exposing the full Notion key
  const authHeader = req.headers.get("Authorization");
  const expectedSecret = process.env.FORECASTER_API_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const body: Record<string, any> = {
        page_size: 100,
        filter: {
          property: "Status",
          select: { does_not_equal: "Archived" },
        },
        sorts: [{ property: "Cultural Potency Score", direction: "descending" }],
      };
      if (cursor) body.start_cursor = cursor;

      const res = await fetch(`${NOTION_BASE}/databases/${TRENDS_DB}/query`, {
        method: "POST",
        headers: notionHeaders(),
        body: JSON.stringify(body),
        // Short cache — extension users need fresh trend list
        next: { revalidate: 60 },
      });

      if (!res.ok) {
        throw new Error(`Notion query failed: ${res.status}`);
      }

      const data = await res.json();
      results.push(...data.results);
      hasMore = data.has_more ?? false;
      cursor = data.next_cursor ?? undefined;
    }

    const trends = results.map((p: any) => {
      const props = p.properties;
      // Find title property
      let name = "";
      for (const key of Object.keys(props)) {
        if (props[key]?.type === "title") {
          name = props[key]?.title?.[0]?.plain_text ?? "";
          break;
        }
      }
      const cps = props["Cultural Potency Score"]?.number ?? 0;
      const status = props.Status?.select?.name ?? "";
      const type = props.Type?.select?.name ?? "";

      return { id: p.id, name, status, type, cps };
    });

    return NextResponse.json(
      { trends },
      {
        headers: {
          // Allow the extension (chrome-extension://*) to call this endpoint
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}
