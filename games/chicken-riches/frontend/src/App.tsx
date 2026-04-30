import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "@gear-js/react-hooks";
import { ChickenRichesChainPanel, type ChickenRichesPlayAccess } from "./components/ChickenRichesChainPanel";
import {
  CANVAS_PIXEL_RATIO_CAP,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  HUD_UPDATE_INTERVAL_MS,
  MAX_BROKEN_EGGS,
  MAX_FRAME_DELTA_MS,
  MAX_BASKET_EGGS,
  TARGET_FRAME_INTERVAL_MS,
} from "./game/constants";
import { preloadGameAssets } from "./game/assets";
import { drawGame } from "./game/render";
import { cloneGameState, createInitialGameState, startGame } from "./game/state";
import type { GameState, InputState } from "./game/types";
import { isFarmerNearCollector, stepGame } from "./game/update";

const EMPTY_INPUT: InputState = {
  left: false,
  right: false,
  jumpQueued: false,
  depositQueued: false,
  throwQueued: false,
};

const DEFAULT_PLAY_ACCESS: ChickenRichesPlayAccess = {
  canPlay: false,
  title: "Loading wallet",
  description: "Wallet providers are still loading. The coop unlocks as soon as a wallet becomes available.",
};

function prepareCanvasForDraw(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const pixelRatio = Math.max(1, Math.min(window.devicePixelRatio || 1, CANVAS_PIXEL_RATIO_CAP));
  const targetWidth = Math.round(FIELD_WIDTH * pixelRatio);
  const targetHeight = Math.round(FIELD_HEIGHT * pixelRatio);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function getCanvasContext(canvas: HTMLCanvasElement | null) {
  if (!canvas) {
    return null;
  }

  return canvas.getContext("2d");
}

function clearActionQueues(input: InputState) {
  input.jumpQueued = false;
  input.depositQueued = false;
  input.throwQueued = false;
}

function clearAllInput(input: InputState) {
  input.left = false;
  input.right = false;
  clearActionQueues(input);
}

function getStatusLabel(status: GameState["status"]) {
  if (status === "playing") return "Playing";
  if (status === "paused") return "Paused";
  if (status === "gameOver") return "Game Over";
  return "Start Screen";
}

function getFoxTimerText(state: GameState) {
  if (!state.fox) {
    return "Calm";
  }

  return `${Math.max(0, (state.fox.attackAt - state.nowMs) / 1000).toFixed(1)}s`;
}

function getStageHint(state: GameState) {
  if (state.status === "start") {
    return "";
  }

  if (state.status === "paused") {
    return "Resume when you're ready, or start a fresh shift.";
  }

  if (state.status === "gameOver") {
    return "This shift is over. Start a fresh one whenever you're ready.";
  }

  if (state.fox) {
    return "The fox is on the roost. Move under the marked hen and press Space to throw an egg straight up.";
  }

  if (state.farmer.basketEggs > 0 && isFarmerNearCollector(state.farmer, state.collector)) {
    return "You're in deposit range. Tap Down to bank eggs and build the combo streak.";
  }

  return "Keep the basket under falling eggs, jump over puddles, bank eggs often, and press Space anytime to throw one upward.";
}

export function App() {
  const { account } = useAccount();
  const [game, setGame] = useState<GameState>(() => createInitialGameState());
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetLoadProgress, setAssetLoadProgress] = useState(0);
  const [assetLoadError, setAssetLoadError] = useState<string | null>(null);
  const [gameSessionId, setGameSessionId] = useState(1);
  const [isCurrentSessionSubmitted, setIsCurrentSessionSubmitted] = useState(false);
  const [playAccess, setPlayAccess] = useState<ChickenRichesPlayAccess>(DEFAULT_PLAY_ACCESS);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const gameRef = useRef<GameState>(game);
  const inputRef = useRef<InputState>({ ...EMPTY_INPUT });
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastHudUpdateTimeRef = useRef(0);
  const accountIdentity = account?.decodedAddress || account?.address || "";
  const previousAccountIdentity = useRef(accountIdentity);

  const aliveChickens = useMemo(() => game.chickens.filter((chicken) => chicken.alive).length, [game.chickens]);
  const canInteractWithGame = assetsReady && !assetLoadError;
  const requiresScoreSubmit = game.status === "gameOver" && game.score > 0 && !isCurrentSessionSubmitted;
  const canStartGame = canInteractWithGame && playAccess.canPlay && !requiresScoreSubmit;
  const stageHint = assetLoadError
    ? "Game art failed to load. Refresh the page to retry the sprite preload."
    : !assetsReady
      ? `Loading game art... ${assetLoadProgress}%`
      : requiresScoreSubmit
        ? "This run is waiting for an on-chain score submit. The wallet signature should open automatically; if needed, retry from the chain panel."
      : getStageHint(game);

  const publishGameState = (urgent = false) => {
    const snapshot = cloneGameState(gameRef.current);

    if (urgent) {
      setGame(snapshot);
      return;
    }

    startTransition(() => {
      setGame(snapshot);
    });
  };

  const drawCurrentFrame = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;

    if (!canvas || !context) {
      return;
    }

    prepareCanvasForDraw(canvas, context);

    if (!assetsReady) {
      context.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
      return;
    }

    drawGame(context, gameRef.current);
  };

  const resetInputState = () => {
    clearAllInput(inputRef.current);
  };

  const beginRun = () => {
    if (!canStartGame) {
      return;
    }

    const now = performance.now();
    gameRef.current = startGame(now);
    lastFrameTimeRef.current = null;
    lastHudUpdateTimeRef.current = now;
    setIsCurrentSessionSubmitted(false);
    setGameSessionId((current) => current + 1);
    setGame(cloneGameState(gameRef.current));
    resetInputState();
    drawCurrentFrame();
  };

  const togglePause = () => {
    if (!canInteractWithGame) {
      return;
    }

    const current = gameRef.current;

    if (current.status === "playing") {
      current.status = "paused";
    } else if (current.status === "paused") {
      current.status = "playing";
      current.nowMs = performance.now();
      lastFrameTimeRef.current = null;
    } else {
      return;
    }

    resetInputState();
    publishGameState(true);
    drawCurrentFrame();
  };

  useEffect(() => {
    contextRef.current = getCanvasContext(canvasRef.current);
    drawCurrentFrame();

    const handleResize = () => {
      drawCurrentFrame();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      contextRef.current = null;
    };
  }, [assetsReady]);

  useEffect(() => {
    let cancelled = false;

    setAssetLoadError(null);
    setAssetLoadProgress(0);

    preloadGameAssets((loaded, total) => {
      if (cancelled) {
        return;
      }

      const nextProgress = total === 0 ? 100 : Math.round((loaded / total) * 100);
      setAssetLoadProgress(nextProgress);
    })
      .then(() => {
        if (cancelled) {
          return;
        }

        setAssetsReady(true);
        setAssetLoadProgress(100);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setAssetLoadError(error instanceof Error ? error.message : "Failed to preload game art.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (previousAccountIdentity.current === accountIdentity) {
      return;
    }

    previousAccountIdentity.current = accountIdentity;
    const nextGame = createInitialGameState();
    gameRef.current = nextGame;
    lastFrameTimeRef.current = null;
    lastHudUpdateTimeRef.current = 0;
    setGame(cloneGameState(nextGame));
    setIsCurrentSessionSubmitted(false);
    setGameSessionId((current) => current + 1);
    resetInputState();
    drawCurrentFrame();
  }, [accountIdentity]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const code = event.code.toLowerCase();
      const input = inputRef.current;

      if (
        code === "arrowleft" || code === "keya" ||
        code === "arrowright" || code === "keyd" ||
        code === "arrowup" || code === "keyw" ||
        code === "arrowdown" || code === "keys" ||
        code === "space" || code === "keyp" || code === "escape" || code === "enter"
      ) {
        event.preventDefault();
      }

      if (code === "arrowleft" || code === "keya") {
        input.left = true;
      }

      if (code === "arrowright" || code === "keyd") {
        input.right = true;
      }

      if (event.repeat) {
        return;
      }

      if (code === "arrowup" || code === "keyw") {
        input.jumpQueued = true;
      }

      if (code === "arrowdown" || code === "keys") {
        input.depositQueued = true;
      }

      if (code === "space") {
        input.throwQueued = true;
      }

      if (code === "keyp" || code === "escape") {
        togglePause();
        return;
      }

      if (code === "enter" && (gameRef.current.status === "start" || gameRef.current.status === "gameOver")) {
        beginRun();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const code = event.code.toLowerCase();
      const input = inputRef.current;

      if (code === "arrowleft" || code === "keya") {
        input.left = false;
      }

      if (code === "arrowright" || code === "keyd") {
        input.right = false;
      }
    };

    const handleBlur = () => {
      resetInputState();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [canInteractWithGame]);

  useEffect(() => {
    drawCurrentFrame();
  }, [assetsReady, game]);

  useEffect(() => {
    if (!assetsReady || game.status !== "playing") {
      drawCurrentFrame();
      return;
    }

    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) {
        return;
      }

      const previousFrameTime = lastFrameTimeRef.current;
      if (previousFrameTime === null) {
        lastFrameTimeRef.current = now;
        drawCurrentFrame();
        animationFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const elapsed = now - previousFrameTime;
      if (elapsed < TARGET_FRAME_INTERVAL_MS) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      lastFrameTimeRef.current = now;
      stepGame(gameRef.current, inputRef.current, Math.min(MAX_FRAME_DELTA_MS, elapsed), now);
      clearActionQueues(inputRef.current);
      drawCurrentFrame();

      if (gameRef.current.status !== "playing") {
        publishGameState(true);
        return;
      }

      if (now - lastHudUpdateTimeRef.current >= HUD_UPDATE_INTERVAL_MS) {
        lastHudUpdateTimeRef.current = now;
        publishGameState(false);
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      lastFrameTimeRef.current = null;
    };
  }, [assetsReady, game.status]);

  return (
    <main className="coop-shell">
      <section className="coop-stage-column">
        <section className="coop-stage-card" aria-label="Chicken Riches game">
          <div className="coop-stage-topline">
            <span>2D arcade · on-chain score submit</span>
            <span>{assetsReady ? getStatusLabel(game.status) : assetLoadError ? "Asset Error" : "Loading Art"}</span>
          </div>

          <div className="coop-canvas-shell">
            <canvas
              ref={canvasRef}
              className="coop-canvas"
              aria-label="Chicken Riches game field"
            />

            {!assetsReady && (
              <div className="coop-loader-overlay" role="status" aria-live="polite">
                <div className="coop-loader-card">
                  {!assetLoadError && <div className="coop-loader-spinner" aria-hidden="true" />}
                  <strong>{assetLoadError ? "Art Load Failed" : "Loading Chicken Riches"}</strong>
                  <span>{assetLoadError ?? `Preparing sprites and props... ${assetLoadProgress}%`}</span>
                </div>
              </div>
            )}

            {assetsReady && !playAccess.canPlay && (
              <div className="coop-lock-overlay" role="status" aria-live="polite">
                <div className="coop-lock-card">
                  <strong>{playAccess.title}</strong>
                  <p>{playAccess.description}</p>
                </div>
              </div>
            )}

            {assetsReady && (
              <div className="coop-field-hud" aria-label="Run metrics">
                <article className="coop-field-metric">
                  <span>Score</span>
                  <strong>{game.score.toLocaleString()}</strong>
                </article>
                <article className="coop-field-metric">
                  <span>Basket</span>
                  <strong>{game.farmer.basketEggs} / {MAX_BASKET_EGGS}</strong>
                </article>
                <article className="coop-field-metric">
                  <span>Broken</span>
                  <strong>{game.brokenEggsCount} / {MAX_BROKEN_EGGS}</strong>
                </article>
                <article className="coop-field-metric">
                  <span>Chickens</span>
                  <strong>{aliveChickens} / 5</strong>
                </article>
                <article className={`coop-field-metric${game.fox ? " coop-field-metric-alert" : ""}`}>
                  <span>Fox timer</span>
                  <strong>{getFoxTimerText(game)}</strong>
                </article>
              </div>
            )}
          </div>

          <div className="coop-action-row">
            <div className="coop-action-main">
              <div className="coop-action-buttons">
                {game.status === "paused" ? (
                  <>
                    <button className="coop-primary-button" type="button" onClick={togglePause} disabled={!canInteractWithGame || !playAccess.canPlay}>
                      Resume Shift
                    </button>
                    <button className="coop-secondary-button" type="button" onClick={beginRun} disabled={!canStartGame}>
                      Restart Shift
                    </button>
                  </>
                ) : game.status === "playing" ? (
                  <button className="coop-secondary-button" type="button" onClick={togglePause} disabled={!canInteractWithGame}>
                    Pause Shift
                  </button>
                ) : (
                  <button className="coop-primary-button" type="button" onClick={beginRun} disabled={!canStartGame}>
                    {game.status === "gameOver" ? "Start New Shift" : "Start Shift"}
                  </button>
                )}
              </div>

              {assetsReady && (
                <div className="coop-controls-bar" aria-label="Controls help">
                  <span>Left / Right: move</span>
                  <span>Up: jump</span>
                  <span>Down: deposit egg</span>
                  <span>Space: throw egg up</span>
                  <span>P or Esc: pause</span>
                </div>
              )}
            </div>

            {stageHint && <p className="coop-button-note">{stageHint}</p>}
          </div>
        </section>
      </section>

      <aside className="coop-sidebar">
        <ChickenRichesChainPanel
          score={game.score}
          status={game.status}
          gameSessionId={gameSessionId}
          autoSubmitOnGameOver
          onPlayAccessChange={setPlayAccess}
          onSessionSubmitStateChange={setIsCurrentSessionSubmitted}
        />
      </aside>
    </main>
  );
}
