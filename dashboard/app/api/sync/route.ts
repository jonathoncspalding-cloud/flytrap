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

// Typical sync durations (seconds) — used for progress estimation
const SETUP_DURATION = 30; // checkout + python + deps
const SYNC_DURATION = 600; // ~10 min for collect + process + forecast
const TOTAL_ESTIMATED = SETUP_DURATION + SYNC_DURATION;

// Pipeline sub-stages with estimated time offsets (seconds into "Run pipeline" step)
const PIPELINE_STAGES = [
  { offset: 0, label: "Collecting signals…", pct: 10 },
  { offset: 120, label: "Processing trends…", pct: 30 },
  { offset: 420, label: "Forecasting moments…", pct: 75 },
];

function estimateProgress(run: any, jobs: any[]): { progress: number; stageLabel: string } {
  if (!jobs || jobs.length === 0) {
    return { progress: 5, stageLabel: "Starting…" };
  }

  const job = jobs[0]; // single-job workflow
  const steps = job.steps ?? [];

  // Find which step is currently running
  const runPipelineStep = steps.find((s: any) => s.name === "Run pipeline");
  const setupSteps = steps.filter((s: any) =>
    ["Checkout", "Set up Python", "Install dependencies", "Determine pipeline stage"].includes(s.name)
  );
  const completedSetup = setupSteps.filter((s: any) => s.status === "completed").length;

  // If the pipeline step hasn't started yet, we're in setup
  if (!runPipelineStep || runPipelineStep.status === "queued") {
    const setupPct = Math.min(10, Math.round((completedSetup / 4) * 10));
    const currentSetupStep = setupSteps.find((s: any) => s.status === "in_progress");
    return {
      progress: setupPct,
      stageLabel: currentSetupStep ? `${currentSetupStep.name}…` : "Setting up…",
    };
  }

  // Pipeline step is running — estimate sub-stage from elapsed time
  if (runPipelineStep.status === "in_progress") {
    const stepStart = new Date(runPipelineStep.started_at).getTime();
    const elapsed = (Date.now() - stepStart) / 1000;

    // Find which sub-stage we're likely in
    let stageLabel = PIPELINE_STAGES[0].label;
    let basePct = PIPELINE_STAGES[0].pct;
    let nextPct = PIPELINE_STAGES[1]?.pct ?? 90;
    let stageStart = 0;
    let stageEnd = PIPELINE_STAGES[1]?.offset ?? SYNC_DURATION;

    for (let i = PIPELINE_STAGES.length - 1; i >= 0; i--) {
      if (elapsed >= PIPELINE_STAGES[i].offset) {
        stageLabel = PIPELINE_STAGES[i].label;
        basePct = PIPELINE_STAGES[i].pct;
        stageStart = PIPELINE_STAGES[i].offset;
        nextPct = PIPELINE_STAGES[i + 1]?.pct ?? 90;
        stageEnd = PIPELINE_STAGES[i + 1]?.offset ?? SYNC_DURATION;
        break;
      }
    }

    // Interpolate within the current sub-stage
    const stageElapsed = elapsed - stageStart;
    const stageDuration = stageEnd - stageStart;
    const stageProgress = Math.min(1, stageElapsed / stageDuration);
    const progress = Math.min(89, Math.round(basePct + stageProgress * (nextPct - basePct)));

    return { progress, stageLabel };
  }

  // Pipeline step completed
  if (runPipelineStep.status === "completed") {
    // Check if upload step is still running
    const uploadStep = steps.find((s: any) => s.name === "Upload pipeline log");
    if (uploadStep && uploadStep.status !== "completed") {
      return { progress: 92, stageLabel: "Finishing up…" };
    }
    return { progress: 100, stageLabel: "Complete" };
  }

  return { progress: 5, stageLabel: "Starting…" };
}

// GET — Poll sync status
// ?run_id=123 → check specific workflow run (with job step progress)
// (no params) → check for any active run, or return last completed
export async function GET(req: NextRequest) {
  if (!GITHUB_PAT || !GITHUB_REPO) {
    return NextResponse.json({ status: "disabled", message: "GitHub not configured" }, { status: 503 });
  }

  const runId = req.nextUrl.searchParams.get("run_id");

  if (runId) {
    // Poll specific run + its jobs for step-level progress
    const [runRes, jobsRes] = await Promise.all([
      ghFetch(`/actions/runs/${runId}`),
      ghFetch(`/actions/runs/${runId}/jobs`),
    ]);

    if (!runRes.ok) {
      return NextResponse.json({ status: "error", error: "Failed to fetch run" }, { status: 502 });
    }
    const run = await runRes.json();
    const htmlUrl = run.html_url;

    // Get job step data for progress estimation
    let jobs: any[] = [];
    if (jobsRes.ok) {
      const jobsData = await jobsRes.json();
      jobs = jobsData.jobs ?? [];
    }

    if (run.status === "completed") {
      return NextResponse.json({
        status: run.conclusion === "success" ? "complete" : "error",
        stage: "complete",
        stageLabel: "Complete",
        progress: 100,
        timestamp: run.updated_at,
        error: run.conclusion !== "success" ? `Workflow ${run.conclusion}` : null,
        runUrl: htmlUrl,
      });
    }

    // queued or in_progress — estimate progress from job steps
    const { progress, stageLabel } = estimateProgress(run, jobs);
    return NextResponse.json({
      status: "running",
      stage: run.status === "queued" ? "queued" : "syncing",
      stageLabel,
      progress,
      timestamp: run.created_at,
      runUrl: htmlUrl,
    });
  }

  // No run_id — check for active runs
  const res = await ghFetch("/actions/workflows/pipeline.yml/runs?per_page=5");
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
      stageLabel: active.status === "queued" ? "Queued…" : "Syncing…",
      progress: active.status === "queued" ? 0 : 5,
      run_id: active.id,
      timestamp: active.created_at,
      runUrl: active.html_url,
    });
  }

  // Find last completed run
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
  const listRes = await ghFetch("/actions/workflows/pipeline.yml/runs?per_page=3");
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
