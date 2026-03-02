/**
 * /api/agent-chat — Agent-specific chat endpoint.
 * Each agent has its own personality and domain knowledge.
 * Streams Claude responses with cultural context + agent system prompt.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getTrends, getTensions, getLatestBriefings, getUserFeedback } from "@/lib/notion";
import { AGENT_PROMPTS, AgentId } from "@/lib/agent-prompts";
import { ISABEL_FILE_CONTEXT } from "@/lib/isabel-file-context";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_AGENTS = new Set<AgentId>(["sentinel", "scout", "oracle", "architect", "optimize", "strategist", "isabel"]);

async function buildContext(): Promise<string> {
  const [trends, tensions, briefings] = await Promise.all([
    getTrends(),
    getTensions(),
    getLatestBriefings(1),
  ]);

  const trendsText = trends
    .slice(0, 15)
    .map((t) => `- ${t.name} [${t.type}] CPS:${t.cps} (${t.status})`)
    .join("\n") || "(no trends)";

  const tensionsText = tensions
    .slice(0, 10)
    .map((t) => `- ${t.name} (weight: ${t.weight}/10)`)
    .join("\n") || "(no tensions)";

  const briefingSnippet = briefings[0]
    ? `Latest briefing (${briefings[0].date}): ${briefings[0].content.slice(0, 400)}…`
    : "(no briefing yet)";

  return `\n\nCURRENT SYSTEM STATE:\n\nTrends (top 15 by CPS):\n${trendsText}\n\nTensions:\n${tensionsText}\n\n${briefingSnippet}`;
}

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, agent } = body;

  // Guard against oversized payloads (base64 images)
  const payloadSize = JSON.stringify(messages).length;
  if (payloadSize > 10 * 1024 * 1024) {
    return new Response("Payload too large", { status: 413 });
  }

  if (!messages || !Array.isArray(messages)) {
    return new Response("Invalid request: messages required", { status: 400 });
  }

  if (!agent || !VALID_AGENTS.has(agent as AgentId)) {
    return new Response(`Invalid agent: ${agent}`, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("ANTHROPIC_API_KEY not configured", { status: 500 });
  }

  const [agentPrompt, context] = await Promise.all([
    Promise.resolve(AGENT_PROMPTS[agent as AgentId]),
    buildContext(),
  ]);

  let systemPrompt = agentPrompt + context;

  // Isabel gets her pixel-office domain files and design capability
  if (agent === "isabel") {
    systemPrompt += ISABEL_FILE_CONTEXT;
    systemPrompt += `\n\nDESIGN CAPABILITY:
You can create pixel art furniture designs that render as live previews in the chat. Include a hidden JSON block in your response using this format:

<!-- ISABEL_DESIGNS
{...}
-->

You have TWO design modes:

MODE 1 — TEMPLATE (color palette on predefined shapes):
Use for quick color explorations. Categories: Paintings, Plants, Rug, Bookcases, Loveseats, Coffee Table.
{
  "mode": "template",
  "category": "Plants",
  "footprint": { "w": 16, "h": 32 },
  "options": [
    { "label": "Name", "description": "Short desc", "colors": [[r,g,b], [r,g,b], [r,g,b], [r,g,b], [r,g,b]] }
  ]
}
Template rules:
- Each option needs exactly 5 colors as [r,g,b] arrays (0-255)
- Colors by index: [0]=primary, [1]=secondary, [2]=accent, [3]=detail, [4]=base/pot/frame

MODE 2 — PIXEL (full pixel-level control):
Use for custom shapes, detailed designs, or when templates don't capture what you envision.
{
  "mode": "pixel",
  "category": "Plants",
  "footprint": { "w": 16, "h": 32 },
  "options": [
    {
      "label": "Name",
      "description": "Short desc",
      "palette": [[r,g,b], [r,g,b], ...],
      "rows": [
        "......1122......",
        ".....112233.....",
        "....11223344...."
      ]
    }
  ]
}
Pixel rules:
- "palette": up to 16 colors as [r,g,b] arrays (0-255)
- "rows": array of strings, one per row (top to bottom)
- Each row must be exactly footprint.w characters long
- Must have exactly footprint.h rows
- Characters: "." = transparent, "0"-"f" = hex index into palette
- Common footprints: 16×32 (plants, loveseats), 32×32 (paintings, bookcases, coffee table), 32×16 (rug), 48×32 (desks)
- Think in 16px tiles — each tile is one grid cell

SHARED RULES (both modes):
- Always include exactly 4 options
- Category must match a replaceable furniture category
- Footprint must match the category's expected size (see your file context)
- Write your dramatic Isabel commentary BEFORE the hidden block
- The user's browser renders these as pixel art previews automatically
- After showing designs, ask if they want to iterate further or select one
- PREFER pixel mode for custom designs — it gives you full creative control`;
  }

  // If any agent is asked about feedback, inject current feedback data.
  // This lets any agent see what users reported — including which page it came from.
  {
    const lastMsg = messages[messages.length - 1]?.content ?? "";
    const feedbackQuery = typeof lastMsg === "string" && /feedback|triage|user report|issue|bug|complaint/i.test(lastMsg);
    if (feedbackQuery) {
      try {
        const feedbackItems = await getUserFeedback();
        if (feedbackItems.length > 0) {
          // Filter to items routed to this agent (or show all for sentinel/architect)
          const showAll = agent === "sentinel" || agent === "architect";
          const relevant = showAll
            ? feedbackItems
            : feedbackItems.filter((f) => f.routedTo === agent || f.status === "new");
          const feedbackText = relevant
            .slice(0, 20)
            .map((f, i) => `${i + 1}. [${f.status}] [${f.category}] [Page: ${f.page}] [Priority: ${f.priority}]${f.routedTo ? ` [→ ${f.routedTo}]` : ""}\n   "${f.message}"`)
            .join("\n");
          const statusCounts = { new: 0, triaged: 0, in_progress: 0 };
          for (const f of relevant) {
            if (f.status in statusCounts) statusCounts[f.status as keyof typeof statusCounts]++;
          }
          systemPrompt += `\n\nFEEDBACK QUEUE (${relevant.length} items — ${statusCounts.new} new, ${statusCounts.triaged} triaged, ${statusCounts.in_progress} in progress):\n${feedbackText}\n\nIMPORTANT: The "Page" field shows which dashboard page the user was on when they submitted the feedback. Use this to understand context — e.g. a "prediction" complaint from the Forecast page is more specific than one from Home.\n\nWhen presenting feedback, format it as a clear status report with counts, categories, page context, and recommendations. If asked to triage, suggest which agent should handle each "new" item and what priority it should have.`;
        } else {
          systemPrompt += "\n\nFEEDBACK QUEUE: Empty — no active feedback items.";
        }
      } catch {
        // Don't block chat if feedback fetch fails
      }
    }
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-sonnet-4-5",
          max_tokens: agent === "isabel" ? 2048 : 1024,
          system: systemPrompt,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: messages.map((m: any) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })) as Anthropic.MessageParam[],
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const data = JSON.stringify({ text: event.delta.text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
