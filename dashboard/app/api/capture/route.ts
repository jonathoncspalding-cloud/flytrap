/**
 * POST /api/capture
 * Accepts evidence submissions from the LeBrain Chrome Extension or iOS Shortcut
 * and writes them directly to the Forecaster Evidence Log in Notion.
 *
 * Request body:
 * {
 *   title: string;          // Page title or custom title
 *   url?: string;           // Source URL
 *   summary?: string;       // User notes / auto-extracted summary
 *   platform?: string;      // "Reddit" | "RSS" | "TikTok" | "Instagram" | "Twitter/X" | "Web" | etc.
 *   sentiment?: string;     // "Positive" | "Negative" | "Neutral" | "Mixed"
 *   trendId?: string;       // Notion page ID of the linked trend (optional)
 * }
 *
 * Response:
 * { success: true, evidenceId: string }
 */

import { NextRequest, NextResponse } from "next/server";

const NOTION_VERSION = "2022-06-28";
const NOTION_BASE = "https://api.notion.com/v1";
const EVIDENCE_DB = process.env.NOTION_EVIDENCE_DB!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

// Map extension platform names to the Evidence Log select options
const PLATFORM_MAP: Record<string, string> = {
  YouTube: "RSS",
  Instagram: "Social",
  TikTok: "Social",
  "Twitter/X": "Social",
  LinkedIn: "Social",
  Reddit: "Reddit",
  Web: "RSS",
  Vimeo: "RSS",
  Behance: "RSS",
  Dribbble: "RSS",
  Pinterest: "Social",
};

function normalizePlatform(platform?: string): string {
  if (!platform) return "RSS";
  return PLATFORM_MAP[platform] ?? platform;
}

export async function POST(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get("Authorization");
  const expectedSecret = process.env.FORECASTER_API_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { title, url, summary, platform, sentiment, trendId } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const normalizedPlatform = normalizePlatform(platform);

  // Build Notion page properties
  const properties: Record<string, any> = {
    Title: {
      title: [{ text: { content: title.slice(0, 2000) } }],
    },
    "Date Captured": {
      date: { start: today },
    },
    "Source Platform": {
      select: { name: normalizedPlatform },
    },
  };

  if (url) {
    properties["Source URL"] = { url };
  }

  if (summary) {
    properties["Summary"] = {
      rich_text: [{ text: { content: summary.slice(0, 1999) } }],
    };
  }

  if (sentiment && ["Positive", "Negative", "Neutral", "Mixed"].includes(sentiment)) {
    properties["Sentiment"] = { select: { name: sentiment } };
  }

  if (trendId) {
    properties["Linked Trends"] = {
      relation: [{ id: trendId }],
    };
  }

  try {
    const res = await fetch(`${NOTION_BASE}/pages`, {
      method: "POST",
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: EVIDENCE_DB },
        properties,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion page creation failed (${res.status}): ${err.slice(0, 300)}`);
    }

    const data = await res.json();
    return NextResponse.json(
      { success: true, evidenceId: data.id },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
