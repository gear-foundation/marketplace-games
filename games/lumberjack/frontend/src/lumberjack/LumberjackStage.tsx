import { useEffect, useRef, type MutableRefObject } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH, drawScene, type LumberjackRuntime, type Side } from "./game/engine";
import { useLumberjackAssets } from "./useLumberjackAssets";

type HudState = {
  status: "ready" | "playing" | "ended";
  logs: number;
  timeLeftLabel: string;
};

type LumberjackStageProps = {
  hud: HudState;
  isLocked: boolean;
  lockMessage: string;
  runtimeRef: MutableRefObject<LumberjackRuntime>;
  onStartRun: () => void;
  onChop: (side: Side) => void;
  advanceFrame: (now: number) => void;
};

export function LumberjackStage({
  hud,
  isLocked,
  lockMessage,
  runtimeRef,
  onStartRun,
  onChop,
  advanceFrame,
}: LumberjackStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const { assetsRef, isStageReady } = useLumberjackAssets();

  useEffect(() => {
    if (!isStageReady) return undefined;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const draw = (now: number) => {
      const { width: cssWidth, height: cssHeight } = canvas.getBoundingClientRect();
      const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
      const nextWidth = Math.max(1, Math.round(cssWidth * devicePixelRatio));
      const nextHeight = Math.max(1, Math.round(cssHeight * devicePixelRatio));

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }

      ctx.setTransform(canvas.width / CANVAS_WIDTH, 0, 0, canvas.height / CANVAS_HEIGHT, 0, 0);
      advanceFrame(now);
      drawScene(ctx, runtimeRef.current, now, assetsRef.current);
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [advanceFrame, assetsRef, isStageReady, runtimeRef]);

  return (
    <section className="lumberjack-stage" aria-label="Lumberjack game">
      <img className="lumberjack-stage-title" src="/lumberjack_name.png" alt="Lumberjack" />

      <div className="lumberjack-stage-viewport">
        {isStageReady && (
          <div className="lumberjack-hud">
            <span className="lumberjack-hud-side">{hud.logs} branches</span>
            <span className="lumberjack-hud-timer">{hud.timeLeftLabel}</span>
            <span className="lumberjack-hud-side" aria-hidden="true" />
          </div>
        )}

        {isLocked && (
          <div className="lumberjack-stage-lock" role="status" aria-live="polite">
            <strong>Wallet required</strong>
            <span>{lockMessage}</span>
          </div>
        )}

        {!isStageReady && (
          <div className="lumberjack-canvas-loading" aria-hidden="true">
            <strong>Lumberjack</strong>
            <span>Loading stage assets...</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={isStageReady ? "is-ready" : "is-hidden"}
        />
      </div>

      <div className="lumberjack-controls" aria-label="Chop controls">
        <button type="button" onClick={() => onChop("left")} aria-label="Chop left" disabled={isLocked}>
          ←
        </button>
        <button
          type="button"
          onClick={onStartRun}
          aria-label={hud.status === "playing" ? "Restart run" : "Start run"}
          disabled={isLocked}
        >
          {hud.status === "playing" ? "↻" : "▶"}
        </button>
        <button type="button" onClick={() => onChop("right")} aria-label="Chop right" disabled={isLocked}>
          →
        </button>
      </div>
    </section>
  );
}
