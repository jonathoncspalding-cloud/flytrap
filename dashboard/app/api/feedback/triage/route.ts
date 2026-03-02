/**
 * POST /api/feedback/triage
 * Architect auto-triages new feedback items using Claude.
 * Reads all "new" feedback from Notion, sends to Claude for routing,
 * updates each item with Routed To agent and Status → triaged.
 */

import { NextResponse } from "next/server";

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

const VALID_AGENTS = [
  "sentinel", "scout", "oracle", "architect", "optimize", "strategist", "isabel",
];

interface FeedbackItem {
  id: string;
  message: string;
  category: string;
  page: string;
  priority: string;
}

async function getNewFeedback(): Promise<FeedbackItem[]> {
  const res = await fetch(`${NOTION_BASE}/databases/${FEEDBACK_DB}/query`, {
    method: "POST",
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: { property: "Status", select: { equals: "new" } },
      page_size: 50,
    }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Notion query failed: ${res.status}`);
  const data = await res.json();

  return data.results.map((p: any) => {
    const props = p.properties;
    const titleProp = Object.values(props).find((v: any) => v.type === "title") as any;
    return {
      id: p.id,
      message: titleProp?.title?.[0]?.plain_text ?? "",
      category: props.Category?.select?.name ?? "other",
      page: props.Page?.select?.name ?? "Home",
      priority: props.Priority?.select?.name ?? "medium",
    };
  });
}

async function updateFeedbackItem(
  pageId: string,
  routedTo: string,
  priority: string
) {
  const properties: Record<string, any> = {
    Status: { select: { name: "triaged" } },
  };

  if (VALID_AGENTS.includes(routedTo)) {
    properties["Routed To"] = { select: { name: routedTo } };
  }

  if (["low", "medium", "high", "critical"].includes(priority)) {
    properties.Priority = { select: { name: priority } };
  }

  const res = await fetch(`${NOTION_BASE}/pages/${pageId}`, {
    method: "PATCH",
    headers: notionHeaders(),
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to update ${pageId}: ${err.slice(0, 200)}`);
  }
}

export async function POST() {
  if (!FEEDBACK_DB) {
    return NextResponse.json({ error: "Feedback DB not configured" }, { status: 500 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
  }

  const items = await getNewFeedback();

  if (items.length === 0) {
    return NextResponse.json({ triaged: 0, results: [] });
  }

  // Build prompt for Architect to triage
  const feedbackList = items
    .map(
      (item, i) =>
        `${i + 1}. [${item.category}] [Page: ${item.page}] [Priority: ${item.priority}]\n   "${item.message}"`
    )
    .join("\n\n");

  const systemPrompt = `You are the Architect agent for the Cultural Forecaster dashboard. Your role is UX/UI & Feedback triage.

You are triaging user feedback. For each item, determine:
1. Which agent should handle it (sentinel, scout, oracle, architect, optimize, strategist, isabel)
2. What priority it should have (low, medium, high, critical)

Agent responsibilities:
- sentinel: System integrity, data quality oversight, cross-agent coordination
- scout: Source collection, signal gathering, collector scripts
- oracle: Predictions, CPS scoring, moment forecasting, calibration
- architect: Dashboard UI, components, layout, design, UX issues
- optimize: Performance, cost, pipeline efficiency, GitHub Actions
- strategist: Briefings, cultural analysis, chatbot quality
- isabel: Pixel office visualization, furniture, decor

Respond with ONLY valid JSON — an array of objects:
[{"index": 1, "agent": "architect", "priority": "high", "reason": "brief reason"}]`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Please triage these ${items.length} feedback items:\n\n${feedbackList}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: `Claude API error: ${err.slice(0, 300)}` },
      { status: 500 }
    );
  }

  const claudeData = await res.json();
  const responseText =
    claudeData.content?.[0]?.text ?? "";

  // Parse JSON from response
  let triageResults: { index: number; agent: string; priority: string; reason: string }[];
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found");
    triageResults = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse triage response", raw: responseText.slice(0, 500) },
      { status: 500 }
    );
  }

  // Apply triage results
  const results: { id: string; agent: string; priority: string; reason: string }[] = [];

  for (const result of triageResults) {
    const item = items[result.index - 1];
    if (!item) continue;

    await updateFeedbackItem(item.id, result.agent, result.priority);
    results.push({
      id: item.id,
      agent: result.agent,
      priority: result.priority,
      reason: result.reason,
    });
  }

  return NextResponse.json({ triaged: results.length, results });
}
