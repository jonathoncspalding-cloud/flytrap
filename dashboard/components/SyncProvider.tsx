"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

type SyncStage = "queued" | "syncing" | "briefing" | "complete" | "error" | null;
type Freshness = "fresh" | "stale" | "never";

interface SyncState {
  /** Current pipeline stage */
  stage: SyncStage;
  /** Whether sync/briefing is actively running */
  isRunning: boolean;
  /** Elapsed seconds since sync started */
  elapsed: number;
  /** Freshness indicator: green (≤2h), yellow (>2h), gray (never) */
  freshness: Freshness;
  /** ISO timestamp of last successful sync */
  lastSynced: string | null;
  /** Error message if sync failed */
  error: string | null;
  /** Whether today's briefing already exists */
  briefingExists: boolean;
  /** Whether GitHub is not configured (PAT missing) */
  isDisabled: boolean;
  /** URL to the GitHub Actions run (for debugging) */
  runUrl: string | null;
  /** Trigger a sync */
  startSync: () => Promise<void>;
  /** Trigger briefing generation */
  startBriefing: () => Promise<void>;
}

const SyncContext = createContext<SyncState>({
  stage: null,
  isRunning: false,
  elapsed: 0,
  freshness: "never",
  lastSynced: null,
  error: null,
  briefingExists: false,
  isDisabled: false,
  runUrl: null,
  startSync: async () => {},
  startBriefing: async () => {},
});

export function useSyncState() {
  return useContext(SyncContext);
}

const STAGE_LABELS: Record<string, string> = {
  queued: "Starting…",
  syncing: "Syncing…",
  briefing: "Generating briefing…",
  complete: "Complete",
  error: "Error",
};

export { STAGE_LABELS };

function computeFreshness(lastSynced: string | null): Freshness {
  if (!lastSynced) return "never";
  const age = Date.now() - new Date(lastSynced).getTime();
  return age <= 2 * 60 * 60 * 1000 ? "fresh" : "stale";
}

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [stage, setStage] = useState<SyncStage>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [briefingExists, setBriefingExists] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const runIdRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll sync status
  const pollStatus = useCallback(async () => {
    try {
      const url = runIdRef.current
        ? `/api/sync?run_id=${runIdRef.current}`
        : "/api/sync";
      const res = await fetch(url);

      if (res.status === 503) {
        setIsDisabled(true);
        return;
      }
      const data = await res.json();

      if (data.runUrl) setRunUrl(data.runUrl);

      // If we don't have a run_id yet but the response has one (found active run)
      if (!runIdRef.current && data.run_id) {
        runIdRef.current = data.run_id;
      }

      if (data.status === "running") {
        setStage(data.stage);
        setIsRunning(true);
      } else if (data.status === "complete") {
        setStage("complete");
        setIsRunning(false);
        setLastSynced(data.timestamp);
        setError(null);
        runIdRef.current = null;
        // Stop polling
        if (pollRef.current) clearInterval(pollRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        pollRef.current = null;
        timerRef.current = null;
        startTimeRef.current = null;
        // Refresh server data
        router.refresh();
        // Re-check briefing status
        checkBriefingStatus();
      } else if (data.status === "error") {
        setStage("error");
        setIsRunning(false);
        setError(data.error ?? "Workflow failed");
        runIdRef.current = null;
        if (pollRef.current) clearInterval(pollRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        pollRef.current = null;
        timerRef.current = null;
        startTimeRef.current = null;
      } else {
        // idle
        if (data.timestamp) setLastSynced(data.timestamp);
      }
    } catch {
      // Network error — ignore, will retry
    }
  }, [router]);

  const checkBriefingStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/briefing-status");
      if (res.ok) {
        const data = await res.json();
        setBriefingExists(data.exists);
      }
    } catch {
      // ignore
    }
  }, []);

  // Initial status check on mount
  useEffect(() => {
    pollStatus();
    checkBriefingStatus();
  }, [pollStatus, checkBriefingStatus]);

  // Start polling + elapsed timer
  const startPolling = useCallback(() => {
    startTimeRef.current = Date.now();
    setElapsed(0);

    // Poll every 5s (GitHub API rate-limit friendly)
    pollRef.current = setInterval(pollStatus, 5000);

    // Elapsed timer every 1s
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
  }, [pollStatus]);

  const startSync = useCallback(async () => {
    if (isRunning || isDisabled) return;
    setIsRunning(true);
    setStage("queued");
    setError(null);
    setRunUrl(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start sync");
      }
      const data = await res.json();
      if (data.run_id) {
        runIdRef.current = data.run_id;
      }
      if (data.runUrl) setRunUrl(data.runUrl);
      startPolling();
    } catch (e: any) {
      setIsRunning(false);
      setStage("error");
      setError(e.message);
    }
  }, [isRunning, isDisabled, startPolling]);

  const startBriefing = useCallback(async () => {
    if (isRunning || isDisabled || briefingExists) return;
    setIsRunning(true);
    setStage("briefing");
    setError(null);
    setRunUrl(null);
    try {
      const res = await fetch("/api/sync?briefing=true", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start briefing");
      }
      const data = await res.json();
      if (data.run_id) {
        runIdRef.current = data.run_id;
      }
      if (data.runUrl) setRunUrl(data.runUrl);
      startPolling();
    } catch (e: any) {
      setIsRunning(false);
      setStage("error");
      setError(e.message);
    }
  }, [isRunning, isDisabled, briefingExists, startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const freshness = computeFreshness(lastSynced);

  return (
    <SyncContext.Provider
      value={{
        stage,
        isRunning,
        elapsed,
        freshness,
        lastSynced,
        error,
        briefingExists,
        isDisabled,
        runUrl,
        startSync,
        startBriefing,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
