import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHOP_LOCK_MS,
  RUN_DURATION_MS,
  SAFE_BRANCH_ROWS,
  createBranches,
  createInitialRuntime,
  hasBranchCollision,
  makeRunId,
  randomBranch,
  type LumberjackRuntime,
  type RunStatus,
  type RunSummary,
  type Side,
} from "./game/engine";

type HudState = {
  status: RunStatus;
  logs: number;
  combo: number;
  timeLeftSeconds: number;
  timeLeftLabel: string;
};

function formatTimeLeft(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getHudState(runtime: LumberjackRuntime): HudState {
  const timeLeftSeconds = Math.max(0, Math.ceil(runtime.energy * (RUN_DURATION_MS / 1000)));
  return {
    status: runtime.status,
    logs: runtime.logs,
    combo: runtime.combo,
    timeLeftSeconds,
    timeLeftLabel: formatTimeLeft(timeLeftSeconds),
  };
}

function isSameHudState(first: HudState, second: HudState) {
  return (
    first.status === second.status &&
    first.logs === second.logs &&
    first.combo === second.combo &&
    first.timeLeftSeconds === second.timeLeftSeconds
  );
}

export function useLumberjackGame(canPlay = true) {
  const runtimeRef = useRef(createInitialRuntime());
  const [hud, setHud] = useState<HudState>(getHudState(runtimeRef.current));
  const hudRef = useRef(hud);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [submittedRunId, setSubmittedRunId] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState("");
  const hasUnsubmittedRun = runSummary !== null && submittedRunId !== runSummary.runId;

  const commitHud = useCallback((nextHud: HudState) => {
    if (isSameHudState(hudRef.current, nextHud)) return;
    hudRef.current = nextHud;
    setHud(nextHud);
  }, []);

  const syncHudFromRuntime = useCallback(
    (runtime: LumberjackRuntime) => {
      commitHud(getHudState(runtime));
    },
    [commitHud],
  );

  const syncRemainingTime = useCallback(
    (runtime: LumberjackRuntime) => {
      const timeLeftSeconds = Math.max(0, Math.ceil(runtime.energy * (RUN_DURATION_MS / 1000)));
      const nextHud = {
        ...hudRef.current,
        timeLeftSeconds,
        timeLeftLabel: formatTimeLeft(timeLeftSeconds),
      };
      commitHud(nextHud);
    },
    [commitHud],
  );

  const finishRun = useCallback(
    (reason: "branch" | "timeout") => {
      const runtime = runtimeRef.current;
      if (runtime.status === "ended") return;

      runtime.status = "ended";
      syncHudFromRuntime(runtime);

      if (runtime.logs <= 0) {
        setRunMessage(reason === "branch" ? "Branch hit before the first chop." : "Timer ran out.");
        return;
      }

      const durationMs = Math.max(1000, Math.floor(performance.now() - runtime.startTime));
      setRunSummary({
        runId: makeRunId(),
        height: runtime.logs,
        logs: runtime.logs,
        combo: runtime.combo,
        durationMs,
      });
      setSubmittedRunId(null);
      setRunMessage(reason === "branch" ? "Branch hit. Result is ready to sign." : "One minute is over. Result is ready to sign.");
    },
    [syncHudFromRuntime],
  );

  const startRun = useCallback(() => {
    if (!canPlay) {
      setRunMessage("Connect wallet to play.");
      return;
    }

    if (hasUnsubmittedRun) {
      setRunMessage("Sign the previous result before starting another run.");
      return;
    }

    const now = performance.now();
    const runtime = runtimeRef.current;

    runtime.branches = createBranches();
    runtime.chopEffect = null;
    runtime.side = "left";
    runtime.chops = 0;
    runtime.logs = 0;
    runtime.combo = 0;
    runtime.energy = 1;
    runtime.startTime = now;
    runtime.lastFrame = now;
    runtime.lastChopAt = 0;
    runtime.status = "playing";

    setRunSummary(null);
    setSubmittedRunId(null);
    setRunMessage("");
    syncHudFromRuntime(runtime);
  }, [canPlay, hasUnsubmittedRun, syncHudFromRuntime]);

  const chop = useCallback(
    (nextSide: Side) => {
      if (!canPlay) {
        setRunMessage("Connect wallet to play.");
        return;
      }

      if (hasUnsubmittedRun) {
        setRunMessage("Sign the previous result before continuing.");
        return;
      }

      const runtime = runtimeRef.current;

      if (runtime.status === "ended") {
        startRun();
        return;
      }

      if (runtime.status !== "playing") {
        startRun();
      }

      const now = performance.now();
      if (now - runtime.lastChopAt < CHOP_LOCK_MS) {
        return;
      }

      runtime.side = nextSide;

      if (hasBranchCollision(runtime.branches, nextSide)) {
        finishRun("branch");
        return;
      }

      const nextCombo = runtime.combo + 1;
      const nextChops = runtime.chops + 1;
      const clearedBranch = runtime.branches[SAFE_BRANCH_ROWS];
      const nextLogs = runtime.logs + (clearedBranch && clearedBranch !== "none" ? 1 : 0);
      const runProgress = Math.max(0, Math.min(1, (now - runtime.startTime) / RUN_DURATION_MS));
      runtime.branches = [...runtime.branches.slice(1), randomBranch(nextChops, runtime.branches.slice(-2), runProgress)];
      runtime.chopEffect = { side: nextSide, startedAt: now };
      runtime.lastChopAt = now;
      runtime.chops = nextChops;
      runtime.logs = nextLogs;
      runtime.combo = nextCombo;

      syncHudFromRuntime(runtime);

      // A chop shifts the whole trunk immediately, so collision should be
      // evaluated synchronously instead of waiting for the next animation frame.
      if (hasBranchCollision(runtime.branches, runtime.side)) {
        finishRun("branch");
      }
    },
    [canPlay, finishRun, hasUnsubmittedRun, startRun, syncHudFromRuntime],
  );

  const advanceFrame = useCallback(
    (now: number) => {
      const runtime = runtimeRef.current;
      if (runtime.lastFrame === 0) {
        runtime.lastFrame = now;
      }

      const elapsedSeconds = Math.min(0.05, (now - runtime.lastFrame) / 1000 || 0);
      runtime.lastFrame = now;

      if (runtime.status !== "playing") return;

      const elapsedMs = now - runtime.startTime;
      const remainingMs = Math.max(0, RUN_DURATION_MS - elapsedMs);
      runtime.energy = remainingMs / RUN_DURATION_MS;
      syncRemainingTime(runtime);

      if (hasBranchCollision(runtime.branches, runtime.side)) {
        finishRun("branch");
      } else if (runtime.energy <= 0) {
        finishRun("timeout");
      }
    },
    [finishRun, syncRemainingTime],
  );

  const markRunSubmitted = useCallback((runId: string) => {
    setSubmittedRunId(runId);
  }, []);

  useEffect(() => {
    if (canPlay) return;

    const runtime = runtimeRef.current;
    if (runtime.status === "playing") {
      runtimeRef.current = createInitialRuntime();
      syncHudFromRuntime(runtimeRef.current);
    }
    setRunMessage("Connect wallet to play.");
  }, [canPlay, syncHudFromRuntime]);

  useEffect(() => {
    if (!canPlay) return;
    setRunMessage((current) => (current === "Connect wallet to play." ? "" : current));
  }, [canPlay]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!canPlay) return;
      if (hasUnsubmittedRun) return;
      if (event.repeat) return;

      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        event.preventDefault();
        chop("left");
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        event.preventDefault();
        chop("right");
      }
      if (event.code === "Space") {
        event.preventDefault();
        startRun();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canPlay, chop, hasUnsubmittedRun, startRun]);

  return {
    runtimeRef,
    hud,
    runSummary,
    submittedRunId,
    runMessage,
    hasUnsubmittedRun,
    advanceFrame,
    startRun,
    chop,
    markRunSubmitted,
  };
}
