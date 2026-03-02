import { NextRequest, NextResponse } from "next/server";

const GITHUB_PAT = process.env.GITHUB_PAT;
const GITHUB_REPO = process.env.GITHUB_REPO || "jonathoncspalding-cloud/flytrap";

export async function POST(req: NextRequest) {
  const { selection } = await req.json();

  if (typeof selection !== "number" || selection < 0 || selection > 3) {
    return NextResponse.json(
      { error: "Invalid selection. Must be 0-3." },
      { status: 400 }
    );
  }

  if (!GITHUB_PAT) {
    return NextResponse.json({ error: "GITHUB_PAT not configured" }, { status: 500 });
  }

  // Trigger Isabel's implementation run via GitHub Actions
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
        inputs: {
          agent: "isabel",
          mode: "implement",
          selection: String(selection),
        },
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

  return NextResponse.json({
    success: true,
    message: `Isabel is implementing option ${selection}. The office will update in a few minutes.`,
  });
}
