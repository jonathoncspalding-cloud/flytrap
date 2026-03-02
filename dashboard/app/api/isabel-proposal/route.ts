import { NextRequest, NextResponse } from "next/server";

const GITHUB_PAT = process.env.GITHUB_PAT;
const GITHUB_REPO = process.env.GITHUB_REPO || "jonathoncspalding-cloud/flytrap";

export async function POST(req: NextRequest) {
  const { selection, proposal } = await req.json();

  if (typeof selection !== "number" || selection < 0 || selection > 3) {
    return NextResponse.json(
      { error: "Invalid selection. Must be 0-3." },
      { status: 400 }
    );
  }

  if (!GITHUB_PAT) {
    return NextResponse.json({ error: "GITHUB_PAT not configured" }, { status: 500 });
  }

  // If a chat-generated proposal is provided, save it to the repo first
  if (proposal) {
    const content = Buffer.from(JSON.stringify(proposal, null, 2)).toString("base64");
    const filePath = "dashboard/public/proposals/isabel.json";

    // Get current file SHA (needed for updates)
    let sha: string | undefined;
    try {
      const getResp = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
        {
          headers: {
            Authorization: `Bearer ${GITHUB_PAT}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );
      if (getResp.ok) {
        const data = await getResp.json();
        sha = data.sha;
      }
    } catch { /* file may not exist yet */ }

    // Create or update the proposal file
    const saveResp = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${GITHUB_PAT}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "feat: Isabel chat-refined proposal",
          content,
          ...(sha ? { sha } : {}),
        }),
      }
    );

    if (!saveResp.ok) {
      const text = await saveResp.text();
      return NextResponse.json(
        { error: `Failed to save proposal: ${text}` },
        { status: 502 }
      );
    }
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
