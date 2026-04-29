import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "@gear-js/react-hooks";
import { DeepSeaChainPanel, type DeepSeaPlayAccess } from "./components/DeepSeaChainPanel";
import {
  CANVAS_PIXEL_RATIO_CAP,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  MAX_FRAME_DELTA_MS,
  TARGET_FRAME_INTERVAL_MS,
} from "./game/constants";
import {
  loadBackgroundImage,
  loadBabyFishBiteFrames,
  loadBabyFishImage,
  loadBabyFishReactionFrames,
  loadLevel2FishBiteFrames,
  loadLevel2FishHurtFrames,
  loadLevel3FishBiteFrames,
  loadLevel3FishHurtFrames,
  loadLevel4FishBiteFrames,
  loadLevel4FishHurtFrames,
  loadLevel5FishBiteFrames,
  loadLevel5FishHurtFrames,
  loadLevel6FishBiteFrames,
  loadLevel6FishHurtFrames,
  loadLevel7FishBiteFrames,
  loadLevel7FishHurtFrames,
  loadLevel8FishBiteFrames,
  loadPlanktonImage,
} from "./game/assets";
import { drawGame, type FishRenderAssets, prepareFishRenderAssets } from "./game/render";
import { createInitialGameState, startGame } from "./game/state";
import type { GameState, InputState } from "./game/types";
import { stepGame } from "./game/update";

const EMPTY_INPUT: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  pointer: null,
};

const HUD_UPDATE_INTERVAL_MS = 140;
const DEFAULT_PLAY_ACCESS: DeepSeaPlayAccess = {
  canPlay: false,
  title: "Loading wallet",
  description: "Wallet providers are still loading. The reef unlocks as soon as a wallet becomes available.",
};

function createEmptyRenderAssets(): FishRenderAssets {
  return {
    babyFishBiteFrames: [],
    level2FishBiteFrames: [],
    level2FishHurtFrames: [],
    level3FishBiteFrames: [],
    level3FishHurtFrames: [],
    level4FishBiteFrames: [],
    level4FishHurtFrames: [],
    level5FishBiteFrames: [],
    level5FishHurtFrames: [],
    level6FishBiteFrames: [],
    level6FishHurtFrames: [],
    level7FishBiteFrames: [],
    level7FishHurtFrames: [],
    level8FishBiteFrames: [],
    babyFishReactionFrames: [],
    babyFishImage: null,
    backgroundCanvas: null,
    planktonImage: null,
  };
}

function formatReason(state: GameState) {
  if (state.reason === "predator") {
    return "A larger predator got you first. Hunt smaller targets and circle around the giants.";
  }

  if (state.reason === "starvation") {
    return "Your saturation hit zero. Keep feeding before the ocean drains your energy.";
  }

  if (state.reason === "hook") {
    return "A fishing hook caught you. Watch the warning lane and avoid the metal hook.";
  }

  return "Eat smaller fish, avoid larger ones, and grow through all eight ocean tiers.";
}

function createCanvasPosition(target: HTMLElement, clientX: number, clientY: number) {
  const rect = target.getBoundingClientRect();
  const scaleX = FIELD_WIDTH / rect.width;
  const scaleY = FIELD_HEIGHT / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function isMovementCode(code: string) {
  return code === "arrowup" || code === "keyw"
    || code === "arrowdown" || code === "keys"
    || code === "arrowleft" || code === "keya"
    || code === "arrowright" || code === "keyd";
}

function hasKeyboardMovement(input: InputState) {
  return input.up || input.down || input.left || input.right;
}

function prepareCanvasForDraw(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const pixelRatio = Math.max(1, Math.min(window.devicePixelRatio || 1, CANVAS_PIXEL_RATIO_CAP));
  const targetWidth = Math.round(FIELD_WIDTH * pixelRatio);
  const targetHeight = Math.round(FIELD_HEIGHT * pixelRatio);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return pixelRatio;
}

function getCanvasContext(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;

  return canvas.getContext("2d", { alpha: false });
}

function drawCanvasFrame(canvas: HTMLCanvasElement | null, context: CanvasRenderingContext2D | null, state: GameState, assets: FishRenderAssets) {
  if (!canvas || !context) return;
  prepareCanvasForDraw(canvas, context);
  drawGame(context, state, assets);
}

function createGameSnapshot(state: GameState): GameState {
  return {
    ...state,
    player: { ...state.player },
    hook: state.hook ? { ...state.hook } : null,
  };
}

export function App() {
  const { account } = useAccount();
  const [game, setGame] = useState<GameState>(() => createInitialGameState());
  const [assets, setAssets] = useState<FishRenderAssets>(() => createEmptyRenderAssets());
  const [assetsLoadState, setAssetsLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [gameSessionId, setGameSessionId] = useState(1);
  const [isCurrentSessionSubmitted, setIsCurrentSessionSubmitted] = useState(false);
  const [playAccess, setPlayAccess] = useState<DeepSeaPlayAccess>(DEFAULT_PLAY_ACCESS);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const gameRef = useRef<GameState>(game);
  const assetsRef = useRef<FishRenderAssets>(assets);
  const inputRef = useRef<InputState>({ ...EMPTY_INPUT });
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastHudUpdateTimeRef = useRef(0);
  const accountIdentity = account?.decodedAddress || account?.address || "";
  const previousAccountIdentity = useRef(accountIdentity);

  const saturationProgress = useMemo(() => Math.max(0, Math.min(100, game.player.saturation)), [game.player.saturation]);
  const growthProgress = useMemo(() => Math.max(0, Math.min(100, game.player.growthProgress)), [game.player.growthProgress]);
  const isAssetsReady = assetsLoadState === "ready";
  const requiresScoreSubmit = game.status === "over" && game.score > 0 && !isCurrentSessionSubmitted;
  const canStartGame = isAssetsReady && playAccess.canPlay && !requiresScoreSubmit;

  useEffect(() => {
    contextRef.current = getCanvasContext(canvasRef.current) ?? null;
    drawCanvasFrame(canvasRef.current, contextRef.current, gameRef.current, assetsRef.current);

    const handleResize = () => {
      drawCanvasFrame(canvasRef.current, contextRef.current, gameRef.current, assetsRef.current);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      contextRef.current = null;
    };
  }, []);

  useEffect(() => {
    const current = gameRef.current;
    const isAnimating = current.status === "playing" || (current.status === "over" && current.gameOverOverlayDelayMs > 0);
    if (!isAnimating) {
      drawCanvasFrame(canvasRef.current, contextRef.current, current, assetsRef.current);
    }
  }, [game]);

  useEffect(() => {
    assetsRef.current = assets;
    drawCanvasFrame(canvasRef.current, contextRef.current, gameRef.current, assets);
  }, [assets]);

  useEffect(() => {
    let isMounted = true;
    setAssetsLoadState("loading");

    Promise.all([
      loadBabyFishBiteFrames(),
      loadLevel2FishBiteFrames(),
      loadLevel2FishHurtFrames(),
      loadLevel3FishBiteFrames(),
      loadLevel3FishHurtFrames(),
      loadLevel4FishBiteFrames(),
      loadLevel4FishHurtFrames(),
      loadLevel5FishBiteFrames(),
      loadLevel5FishHurtFrames(),
      loadLevel6FishBiteFrames(),
      loadLevel6FishHurtFrames(),
      loadLevel7FishBiteFrames(),
      loadLevel7FishHurtFrames(),
      loadLevel8FishBiteFrames(),
      loadBabyFishReactionFrames(),
      loadBabyFishImage(),
      loadBackgroundImage(),
      loadPlanktonImage(),
    ])
      .then(([babyFrames, level2Frames, level2HurtFrames, level3Frames, level3HurtFrames, level4Frames, level4HurtFrames, level5Frames, level5HurtFrames, level6Frames, level6HurtFrames, level7Frames, level7HurtFrames, level8Frames, reactionFrames, loadedBabyFishImage, loadedBackgroundImage, loadedPlanktonImage]) => {
        if (isMounted) {
          const loadedAssets = prepareFishRenderAssets({
            babyFishBiteFrames: babyFrames,
            level2FishBiteFrames: level2Frames,
            level2FishHurtFrames: level2HurtFrames,
            level3FishBiteFrames: level3Frames,
            level3FishHurtFrames: level3HurtFrames,
            level4FishBiteFrames: level4Frames,
            level4FishHurtFrames: level4HurtFrames,
            level5FishBiteFrames: level5Frames,
            level5FishHurtFrames: level5HurtFrames,
            level6FishBiteFrames: level6Frames,
            level6FishHurtFrames: level6HurtFrames,
            level7FishBiteFrames: level7Frames,
            level7FishHurtFrames: level7HurtFrames,
            level8FishBiteFrames: level8Frames,
            babyFishReactionFrames: reactionFrames,
            babyFishImage: loadedBabyFishImage,
            backgroundImage: loadedBackgroundImage,
            planktonImage: loadedPlanktonImage,
          });

          assetsRef.current = loadedAssets;
          setAssets(loadedAssets);
          setAssetsLoadState("ready");
          drawCanvasFrame(canvasRef.current, contextRef.current, gameRef.current, loadedAssets);
        }
      })
      .catch((error: unknown) => {
        console.error(error);
        if (isMounted) {
          setAssetsLoadState("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (previousAccountIdentity.current === accountIdentity) {
      return;
    }

    previousAccountIdentity.current = accountIdentity;
    inputRef.current = { ...EMPTY_INPUT };
    const next = createInitialGameState();
    gameRef.current = next;
    lastHudUpdateTimeRef.current = 0;
    setGame(next);
    setIsCurrentSessionSubmitted(false);
    setGameSessionId((current) => current + 1);
    drawCanvasFrame(canvasRef.current, contextRef.current, next, assetsRef.current);
  }, [accountIdentity]);

  useEffect(() => {
    const shouldAnimate = gameRef.current.status === "playing"
      || (gameRef.current.status === "over" && gameRef.current.gameOverOverlayDelayMs > 0);

    if (!shouldAnimate) {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastFrameTimeRef.current = null;
      return undefined;
    }

    const tick = (time: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = time;
      }

      const elapsedMs = time - lastFrameTimeRef.current;
      if (elapsedMs < TARGET_FRAME_INTERVAL_MS) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const deltaMs = Math.min(MAX_FRAME_DELTA_MS, elapsedMs);
      lastFrameTimeRef.current = time - (elapsedMs % TARGET_FRAME_INTERVAL_MS);

      const current = gameRef.current;
      const previousStatus = current.status;
      const next = stepGame(current, inputRef.current, deltaMs);
      const reachedEnd = previousStatus !== "over"
        && next.status === "over";
      const shouldContinue = next.status === "playing" || (next.status === "over" && next.gameOverOverlayDelayMs > 0);
      const shouldSyncHud = reachedEnd
        || !shouldContinue
        || time - lastHudUpdateTimeRef.current >= HUD_UPDATE_INTERVAL_MS;

      gameRef.current = next;
      drawCanvasFrame(canvasRef.current, contextRef.current, next, assetsRef.current);

      if (shouldSyncHud) {
        lastHudUpdateTimeRef.current = time;
        setGame(createGameSnapshot(next));
      }

      if (shouldContinue) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        animationFrameRef.current = null;
        lastFrameTimeRef.current = null;
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      lastFrameTimeRef.current = null;
    };
  }, [game.status]);

  useEffect(() => {
    const onKeyChange = (event: KeyboardEvent, isPressed: boolean) => {
      if (event.repeat && isPressed) return;

      const code = event.code.toLowerCase();
      if (code === "arrowup" || code === "keyw") inputRef.current.up = isPressed;
      if (code === "arrowdown" || code === "keys") inputRef.current.down = isPressed;
      if (code === "arrowleft" || code === "keya") inputRef.current.left = isPressed;
      if (code === "arrowright" || code === "keyd") inputRef.current.right = isPressed;

      if (isMovementCode(code)) {
        inputRef.current.pointer = null;
        event.preventDefault();
      }

      if ((code === "space" || code === "enter") && isPressed && gameRef.current.status !== "playing" && canStartGame) {
        const next = startGame();
        gameRef.current = next;
        lastHudUpdateTimeRef.current = 0;
        setGame(createGameSnapshot(next));
        drawCanvasFrame(canvasRef.current, contextRef.current, next, assetsRef.current);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => onKeyChange(event, true);
    const handleKeyUp = (event: KeyboardEvent) => onKeyChange(event, false);
    const handleBlur = () => {
      inputRef.current = { ...EMPTY_INPUT };
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [canStartGame]);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (hasKeyboardMovement(inputRef.current)) {
      return;
    }

    inputRef.current.pointer = createCanvasPosition(event.currentTarget, event.clientX, event.clientY);
  }

  function handlePointerLeave() {
    inputRef.current.pointer = null;
  }

  function handleStart() {
    if (!canStartGame) {
      return;
    }

    const next = startGame();
    inputRef.current.pointer = null;
    gameRef.current = next;
    lastHudUpdateTimeRef.current = 0;
    setGame(createGameSnapshot(next));
    setIsCurrentSessionSubmitted(false);
    setGameSessionId((current) => current + 1);
    drawCanvasFrame(canvasRef.current, contextRef.current, next, assetsRef.current);
  }

  const startButtonLabel = assetsLoadState === "loading"
    ? "Loading Reef..."
    : assetsLoadState === "error"
      ? "Load Failed"
      : !playAccess.canPlay
        ? playAccess.title || "Wallet Locked"
        : game.status === "playing"
            ? "Restart Dive"
            : game.status === "over"
              ? "Dive Again"
              : "Start Dive";

  const statusCopy = assetsLoadState === "loading"
    ? "Loading every fish, frame, and background before the dive begins."
    : assetsLoadState === "error"
      ? "Some art assets failed to load. Refresh the page and try again."
      : !playAccess.canPlay
        ? playAccess.description
        : formatReason(game);
  const showFieldAction = game.status !== "playing" && game.gameOverOverlayDelayMs <= 0;

  return (
    <main className="reef-shell">
      <section className="reef-stage-column">
        <div className="reef-stage-card">
          <div className="reef-stage-topline">
            <span>Wide Reef</span>
            <span>
              {assetsLoadState === "loading"
                ? "Loading all art assets..."
                : !playAccess.canPlay
                  ? "Wallet and voucher check required"
                  : "8 enemy sizes crossing the reef"}
            </span>
          </div>

          <div className="reef-stage-scorebar">
            <div className="reef-stage-scorebar__grid">
              <div className="reef-stage-meter-card">
                <div className="reef-meter">
                  <div className="reef-meter__row">
                    <span>Saturation</span>
                    <strong>{Math.round(saturationProgress)}%</strong>
                  </div>
                  <div className="reef-meter__track">
                    <div className="reef-meter__fill reef-meter__fill--saturation" style={{ width: `${saturationProgress}%` }} />
                  </div>
                </div>
              </div>

              <div className="reef-stage-meter-card">
                <div className="reef-meter">
                  <div className="reef-meter__row">
                    <span>Next Growth</span>
                    <strong>{Math.max(0, Math.round(growthProgress))}%</strong>
                  </div>
                  <div className="reef-meter__track">
                    <div className="reef-meter__fill reef-meter__fill--growth" style={{ width: `${Math.max(0, Math.min(100, growthProgress))}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="reef-canvas-shell"
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          >
            <canvas
              ref={canvasRef}
              width={FIELD_WIDTH}
              height={FIELD_HEIGHT}
              className="reef-canvas"
              aria-label="Deep Sea Feast game field"
            />
            {isAssetsReady && !playAccess.canPlay ? (
              <div className="reef-lock-overlay" role="status" aria-live="polite">
                <strong>{playAccess.title}</strong>
                <p>{playAccess.description}</p>
              </div>
            ) : null}
            {showFieldAction ? (
              <div className="reef-field-action-overlay">
                <div className="reef-field-action-card">
                  <button className="reef-action reef-field-action-button" type="button" onClick={handleStart} disabled={!canStartGame}>
                    {startButtonLabel}
                  </button>
                  <p className="reef-status-copy reef-field-action-copy">{statusCopy}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <aside className="reef-sidebar">
        <DeepSeaChainPanel
          score={game.score}
          status={game.status}
          gameSessionId={gameSessionId}
          onPlayAccessChange={setPlayAccess}
          onSessionSubmitStateChange={setIsCurrentSessionSubmitted}
        />
      </aside>
    </main>
  );
}
