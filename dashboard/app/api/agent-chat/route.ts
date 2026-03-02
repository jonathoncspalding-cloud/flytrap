/**
 * /api/agent-chat — Agent-specific chat endpoint.
 * Each agent has its own personality and domain knowledge.
 * Streams Claude responses with cultural context + agent system prompt.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getTrends, getTensions, getLatestBriefings } from "@/lib/notion";
import { AGENT_PROMPTS, AgentId } from "@/lib/agent-prompts";

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

  // If Isabel is in design-feedback mode, add structured output instructions
  if (agent === "isabel" && messages[0]?.content?.includes?.("PROPOSAL_CONTEXT")) {
    systemPrompt += `\n\nDESIGN FEEDBACK MODE:
You are reviewing your furniture proposal with the user. When the user gives feedback and you want to show new designs, include a hidden JSON block in your response using this EXACT format:

<!-- ISABEL_DESIGNS
{
  "category": "Plants",
  "footprint": { "w": 16, "h": 32 },
  "options": [
    { "label": "Name", "description": "Short desc", "colors": [[r,g,b], [r,g,b], [r,g,b], [r,g,b], [r,g,b]] }
  ]
}
-->

Rules for the design spec:
- Always include exactly 4 options in "options"
- Each option MUST have exactly 5 colors as [r,g,b] arrays (values 0-255)
- Colors meaning by index: [0]=primary, [1]=secondary, [2]=accent, [3]=detail, [4]=base/pot/frame
- The category and footprint must match the current proposal
- Write your dramatic Isabel commentary BEFORE the hidden block
- The user's browser will render these as pixel art previews automatically
- After showing designs, ask if they want to iterate further or select one`;
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-sonnet-4-5",
          max_tokens: agent === "isabel" && messages[0]?.content?.includes?.("PROPOSAL_CONTEXT") ? 2048 : 1024,
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
