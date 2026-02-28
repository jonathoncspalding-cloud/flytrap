/**
 * POST /api/feedback
 * Writes user feedback from the dashboard widget to the User Feedback Notion DB.
 *
 * Request body:
 * { message: string; page: string; category: string }
 *
 * Response:
 * { success: true, id: string }
 */

import { NextRequest, NextResponse } from "next/server";

const NOTION_VERSION = "2022-06-28";
const NOTION_BASE = "https://api.notion.com/v1";
const FEEDBACK_DB = process.env.NOTION_FEEDBACK_DB!;

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

const VALID_PAGES = [
  "Home", "Trends", "Tensions", "Calendar",
  "Briefings", "Moments", "Forecast", "Research", "Agents",
];

const VALID_CATEGORIES = [
  "bug", "feature", "data_quality", "design",
  "prediction", "source", "performance", "other",
];

export async function POST(req: NextRequest) {
  if (!FEEDBACK_DB) {
    return NextResponse.json(
      { error: "Feedback DB not configured" },
      { status: 500 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, page, category } = body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const safePage = VALID_PAGES.includes(page) ? page : "Home";
  const safeCategory = VALID_CATEGORIES.includes(category) ? category : "other";
  const today = new Date().toISOString().split("T")[0];

  const properties: Record<string, any> = {
    Name: {
      title: [{ text: { content: message.slice(0, 2000) } }],
    },
    Page: { select: { name: safePage } },
    Category: { select: { name: safeCategory } },
    Priority: { select: { name: "medium" } },
    Status: { select: { name: "new" } },
    Submitted: { date: { start: today } },
  };

  try {
    const res = await fetch(`${NOTION_BASE}/pages`, {
      method: "POST",
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: FEEDBACK_DB },
        properties,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion error (${res.status}): ${err.slice(0, 300)}`);
    }

    const data = await res.json();
    return NextResponse.json({ success: true, id: data.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
