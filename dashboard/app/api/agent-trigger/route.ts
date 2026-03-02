import { NextRequest, NextResponse } from "next/server";

const GITHUB_PAT = process.env.GITHUB_PAT;
const GITHUB_REPO = process.env.GITHUB_REPO || "jonathoncspalding-cloud/flytrap";

const VALID_AGENTS = ["isabel", "scout", "oracle", "optimize", "strategist", "architect"];

export async function POST(req: NextRequest) {
  const { agent } = await req.json();

  if (!agent || !VALID_AGENTS.includes(agent)) {
    return NextResponse.json(
      { error: `Invalid agent. Must be one of: ${VALID_AGENTS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!GITHUB_PAT) {
    return NextResponse.json({ error: "GITHUB_PAT not configured" }, { status: 500 });
  }

  const resp = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/claude-agents-auto.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_PAT}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { agent },
      }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    return NextResponse.json(
      { error: `GitHub API error: ${resp.status} ${text}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, agent, message: `Triggered ${agent} autonomy run` });
}
