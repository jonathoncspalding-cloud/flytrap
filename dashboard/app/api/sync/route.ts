import { NextRequest, NextResponse } from "next/server";

const GITHUB_PAT = process.env.GITHUB_PAT;
const GITHUB_REPO = process.env.GITHUB_REPO; // "owner/repo"

function ghFetch(path: string, options?: RequestInit) {
  return fetch(`https://api.github.com/repos/${GITHUB_REPO}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...options?.headers,
    },
  });
}

// GET — Poll sync status
// ?run_id=123 → check specific workflow run
// (no params) → check for any active run, or return last completed
export async function GET(req: NextRequest) {
  if (!GITHUB_PAT || !GITHUB_REPO) {
    return NextResponse.json({ status: "disabled", message: "GitHub not configured" }, { status: 503 });
  }

  const runId = req.nextUrl.searchParams.get("run_id");

  if (runId) {
    // Poll specific run
    const res = await ghFetch(`/actions/runs/${runId}`);
    if (!res.ok) {
      return NextResponse.json({ status: "error", error: "Failed to fetch run" }, { status: 502 });
    }
    const run = await res.json();
    const htmlUrl = run.html_url;

    if (run.status === "completed") {
      return NextResponse.json({
        status: run.conclusion === "success" ? "complete" : "error",
        stage: "complete",
        timestamp: run.updated_at,
        error: run.conclusion !== "success" ? `Workflow ${run.conclusion}` : null,
        runUrl: htmlUrl,
      });
    }
    // queued or in_progress
    return NextResponse.json({
      status: "running",
      stage: run.status === "queued" ? "queued" : "syncing",
      timestamp: run.created_at,
      runUrl: htmlUrl,
    });
  }

  // No run_id — check for active runs
  const res = await ghFetch("/actions/runs?per_page=5&event=repository_dispatch");
  if (!res.ok) {
    return NextResponse.json({ status: "error", error: "Failed to list runs" }, { status: 502 });
  }
  const data = await res.json();
  const runs = data.workflow_runs ?? [];

  // Find active run
  const active = runs.find((r: any) => r.status === "queued" || r.status === "in_progress");
  if (active) {
    return NextResponse.json({
      status: "running",
      stage: active.status === "queued" ? "queued" : "syncing",
      run_id: active.id,
      timestamp: active.created_at,
      runUrl: active.html_url,
    });
  }

  // Find last completed dispatch run
  const last = runs.find((r: any) => r.status === "completed");
  if (last) {
    return NextResponse.json({
      status: "idle",
      stage: null,
      timestamp: last.updated_at,
      lastConclusion: last.conclusion,
    });
  }

  return NextResponse.json({ status: "idle", stage: null, timestamp: null });
}

// POST — Trigger pipeline via repository_dispatch
// ?briefing=true → briefing mode
export async function POST(req: NextRequest) {
  if (!GITHUB_PAT || !GITHUB_REPO) {
    return NextResponse.json({ error: "GitHub not configured" }, { status: 503 });
  }

  const isBriefing = req.nextUrl.searchParams.get("briefing") === "true";

  // Fire repository_dispatch
  const dispatchRes = await ghFetch("/dispatches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_type: "run-pipeline",
      client_payload: {
        mode: isBriefing ? "briefing" : "sync",
      },
    }),
  });

  if (!dispatchRes.ok) {
    const text = await dispatchRes.text();
    return NextResponse.json({ error: `Dispatch failed: ${text}` }, { status: 502 });
  }

  // Wait a few seconds for GitHub to register the run
  await new Promise((r) => setTimeout(r, 3000));

  // Find the new run
  const listRes = await ghFetch("/actions/runs?per_page=3&event=repository_dispatch");
  if (listRes.ok) {
    const data = await listRes.json();
    const runs = data.workflow_runs ?? [];
    const newRun = runs.find((r: any) => r.status === "queued" || r.status === "in_progress");
    if (newRun) {
      return NextResponse.json({
        started: true,
        mode: isBriefing ? "briefing" : "sync",
        run_id: newRun.id,
        runUrl: newRun.html_url,
      });
    }
  }

  // Dispatch succeeded but run not found yet — client can poll
  return NextResponse.json({
    started: true,
    mode: isBriefing ? "briefing" : "sync",
    run_id: null,
  });
}
