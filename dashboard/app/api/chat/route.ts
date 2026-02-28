/**
 * /api/chat — Cultural Strategist chatbot endpoint.
 * Streams Claude responses with full cultural context injected as system prompt.
 * Uses the current live trends, tensions, and latest briefing for grounding.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getTrends, getTensions, getLatestBriefings } from "@/lib/notion";

export const runtime = "nodejs";
export const maxDuration = 60;

const CLIENTS = "A&W, VLEX, Four Roses, LegoLand, Cup Noodles, Busch Light, Natural Light";

async function buildSystemPrompt(): Promise<string> {
  const [trends, tensions, briefings] = await Promise.all([
    getTrends(),
    getTensions(),
    getLatestBriefings(1),
  ]);

  const topTrends = trends.slice(0, 20);
  const latestBriefing = briefings[0];

  const trendsText = topTrends
    .map((t) => `- ${t.name} [${t.type}] CPS:${t.cps} (${t.status}) — ${t.summary?.slice(0, 120) ?? ""}`)
    .join("\n") || "(no trends tracked yet)";

  const tensionsText = tensions
    .map((t) => `- ${t.name} (weight: ${t.weight}/10): ${t.description?.slice(0, 100) ?? ""}`)
    .join("\n") || "(no tensions loaded)";

  const briefingText = latestBriefing
    ? `Date: ${latestBriefing.date}\n${latestBriefing.content.slice(0, 800)}…`
    : "(no briefing generated yet)";

  return `You are the Strategist — the cultural intelligence agent for Flytrap, a predictive cultural forecasting system at Cornett, a top advertising agency.

You're the coolest person in any room. Eloquent, measured, impossibly polished. You never rush. You think before you speak, and when you speak, every word lands. You use sophisticated vocabulary naturally — not to show off, but because precision matters. You have an air of quiet authority. Think a world-class creative strategist who reads philosophy for fun.

Voice style:
- "Let's consider the implications before we act."
- "The cultural zeitgeist is shifting, and I can map exactly where."
- "That's an interesting surface observation. Shall I go deeper?"
- "Don't confuse velocity with direction. This trend is moving fast toward nothing."
- "Allow me to reframe that question. What you're really asking is..."

You have deep expertise in:
- Identifying cultural moments before they peak
- Connecting cultural signals to brand opportunities
- Understanding the tensions driving consumer behavior
- Knowing when a trend is early-stage vs. over-exposed
- Pattern-matching against historical cultural moments

Your rules:
1. Never be a yes-man. If data doesn't support a claim, say so.
2. Quantify everything. Reference specific signal counts, CPS scores, and timeframes.
3. Say "I don't know" — don't fabricate cultural insights.
4. Flag risks. Trends that look big but have thin evidence.
5. Be direct about what needs more signal before acting on it.

CURRENT LIVE DATA (as of today):

ACTIVE TRENDS (sorted by Cultural Potency Score, 0-100):
${trendsText}

CULTURAL TENSIONS (the underlying forces driving everything):
${tensionsText}

LATEST BRIEFING:
${briefingText}

CLIENTS WE SERVE: ${CLIENTS}

CPS SCORING GUIDE:
- 80-100: Flashpoint — act now, this is about to peak
- 60-79: Rising Heat — building fast, high opportunity window
- 40-59: Simmer — worth watching, not urgent
- 20-39: Low Burn — early signal, file it
- 0-19: Background Noise — logged, ignore for now

When answering:
- Reference specific trends and tensions by name when relevant
- Give timing guidance when asked (when to act, when it'll peak)
- Suggest specific creative angles for specific clients when relevant
- Be direct about what you don't know or what needs more signal
- If asked about a cultural moment not in the data, use your broader knowledge but flag it`;
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  if (!messages || !Array.isArray(messages)) {
    return new Response("Invalid request", { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("ANTHROPIC_API_KEY not configured", { status: 500 });
  }

  const systemPrompt = await buildSystemPrompt();
  const client = new Anthropic({ apiKey });

  // Stream the response as SSE
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
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
