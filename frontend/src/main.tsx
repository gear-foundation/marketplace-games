import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AccountProvider, AlertProvider, ApiProvider, useAccount, useApi } from "@gear-js/react-hooks";
import { Alert, alertStyles } from "@gear-js/ui";
import { Wallet } from "@gear-js/wallet-connect";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Sails } from "sails-js";
import "@gear-js/ui/dist/index.css";
import "@gear-js/vara-ui/dist/style.css";
import "@gear-js/wallet-connect/dist/style.css";
import "./styles.css";
import contractIdl from "./idl/contract.idl?raw";

type Platform = {
  x: number;
  y: number;
  width: number;
  kind: "stable" | "boost" | "cracked";
  hasTiger?: boolean;
  breakStartedAt?: number;
  boostStartedAt?: number;
};

type Banana = {
  id: number;
  x: number;
  y: number;
};

type Tiger = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  phase: number;
  minX: number;
  maxX: number;
  vx: number;
};

type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
};

type RunStatus = "ready" | "playing" | "ended";

type RunSummary = {
  runId: string;
  height: number;
  score: number;
  bananas: number;
  durationMs: number;
};

type LeaderboardEntry = {
  name: string;
  points: number;
  height: number;
  player?: string;
};

type ChainLeaderboardEntry = {
  player?: string;
  points?: unknown;
  best_height?: unknown;
  bestHeight?: unknown;
};

type ChainRunRecord = {
  height?: unknown;
  points_awarded?: unknown;
  pointsAwarded?: unknown;
};

type VoucherState = {
  voucherId: string | null;
  programs?: string[];
};

type VoucherCreateResponse = {
  voucherId?: unknown;
};

const WORLD_WIDTH = 420;
const WORLD_HEIGHT = 700;
const GRAVITY = 1850;
const JUMP_VELOCITY = -820;
const BOOST_VELOCITY = -1120;
const MOVE_SPEED = 520;
const PLATFORM_GAP_MIN = 74;
const PLATFORM_GAP_MAX = 118;
const VISIBLE_LEADERBOARD_LIMIT = 5;
const CURRENT_PLAYER_NAME = "YOU";
const BANANA_SCORE = 250;
const MONKEY_SPRITE_WIDTH = 86;
const MONKEY_SPRITE_HEIGHT = 112;
const BANANA_SPRITE_SIZE = 42;
const BANANA_ANIMATION_FPS = 10;
const BANANA_ROTATION_FRAMES = 8;
const TIGER_WIDTH = 90;
const TIGER_HEIGHT = 46;
const TIGER_SPRITE_WIDTH = 112;
const TIGER_SPRITE_HEIGHT = 70;
const TIGER_PATROL_SPEED = 62;
const TIGER_EDGE_PADDING = 8;
const TIGER_PLATFORM_MIN_WIDTH = 250;
const TIGER_SPAWN_MIN_HEIGHT = 5000;
const PLATFORM_BREAK_FPS = 12;
const PLATFORM_BREAK_FRAMES = 5;
const PLATFORM_BREAK_FIRST_ACTIVE_FRAME = 2;
const BOOST_SPRING_FPS = 14;
const BOOST_SPRING_FRAMES = 5;
const BOOST_SPRING_FIRST_ACTIVE_FRAME = 2;
const APP_NAME = "Skybound Jump";
const VARA_NODE_ADDRESS = import.meta.env.VITE_NODE_ADDRESS || "wss://testnet.vara.network";
const VARA_PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || "";
const VOUCHER_BACKEND_URL = (import.meta.env.VITE_VOUCHER_BACKEND_URL || "").replace(/\/+$/, "");

const initialLeaderboardTop: LeaderboardEntry[] = [
  { name: "LUISA", points: 8200, height: 7600 },
  { name: "VARA", points: 6400, height: 5910 },
  { name: "SAILS", points: 4100, height: 3780 },
  { name: "BOOST", points: 2800, height: 2480 },
  { name: "JUMP", points: 1900, height: 1680 },
];

const queryClient = new QueryClient();

function makeRunId() {
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getConfiguredProgramId(programId: string): `0x${string}` | "" {
  return /^0x[0-9a-fA-F]{64}$/.test(programId) ? (programId as `0x${string}`) : "";
}

function getConfiguredBackendUrl(url: string) {
  return /^https?:\/\/.+/.test(url) ? url : "";
}

function toDisplayNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value.replaceAll(",", "")) || 0;
  if (value && typeof value === "object" && "toString" in value) {
    return Number((value as { toString: () => string }).toString().replaceAll(",", "")) || 0;
  }
  return 0;
}

function unwrapOption<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    const option = value as Record<string, unknown>;
    if ("None" in option || "none" in option) return null;
    if ("Some" in option) return option.Some as T;
    if ("some" in option) return option.some as T;
  }
  return value as T;
}

function shortAddress(address: string) {
  if (!address) return "UNKNOWN";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isSignatureRejection(error: unknown) {
  const message = formatError(error).toLowerCase();
  return (
    message.includes("reject") ||
    message.includes("denied") ||
    message.includes("cancel") ||
    message.includes("closed") ||
    message.includes("user")
  );
}

function mapChainLeaderboard(entries: ChainLeaderboardEntry[], currentPlayer?: string): LeaderboardEntry[] {
  return entries.map((entry) => {
    const player = String(entry.player || "");
    const isCurrentPlayer = currentPlayer !== undefined && player.toLowerCase() === currentPlayer.toLowerCase();

    return {
      name: isCurrentPlayer ? CURRENT_PLAYER_NAME : shortAddress(player),
      points: toDisplayNumber(entry.points),
      height: toDisplayNumber(entry.best_height ?? entry.bestHeight),
      player,
    };
  });
}

async function createSailsClient(api: Parameters<Sails["setApi"]>[0], programId: `0x${string}`) {
  const [{ Sails }, { SailsIdlParser }] = await Promise.all([import("sails-js"), import("sails-js-parser")]);
  const parser = await SailsIdlParser.new();
  return new Sails(parser).setApi(api).setProgramId(programId).parseIdl(contractIdl);
}

async function readVoucherJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message =
      typeof json?.message === "string"
        ? json.message
        : Array.isArray(json?.message)
          ? json.message.join(", ")
          : `Voucher backend returned ${response.status}`;
    throw new Error(message);
  }

  return json as T;
}

async function ensureVoucher(backendUrl: string, account: string, programId: `0x${string}`): Promise<`0x${string}`> {
  const stateResponse = await fetch(`${backendUrl}/voucher/${encodeURIComponent(account)}`);
  const state = await readVoucherJson<VoucherState>(stateResponse);
  const normalizedProgram = programId.toLowerCase();

  if (
    state.voucherId &&
    /^0x[0-9a-fA-F]{64}$/.test(state.voucherId) &&
    state.programs?.some((program) => program.toLowerCase() === normalizedProgram)
  ) {
    return state.voucherId as `0x${string}`;
  }

  const createResponse = await fetch(`${backendUrl}/voucher`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account, program: programId }),
  });
  const created = await readVoucherJson<VoucherCreateResponse>(createResponse);
  const voucherId = String(created.voucherId || "");

  if (!/^0x[0-9a-fA-F]{64}$/.test(voucherId)) {
    throw new Error("Voucher backend returned an invalid voucher id.");
  }

  return voucherId as `0x${string}`;
}

function randomPlatformKind(index: number): Platform["kind"] {
  if (index < 4) return "stable";
  const roll = Math.random();
  if (roll > 0.9) return "boost";
  if (roll < 0.14) return "cracked";
  return "stable";
}

function createPlatforms(): Platform[] {
  const platforms: Platform[] = [{ x: 150, y: 620, width: 128, kind: "stable" }];
  let y = 560;
  let index = 0;

  while (y > -240) {
    platforms.push({
      x: 28 + Math.random() * (WORLD_WIDTH - 116),
      y,
      width: 82 + Math.random() * 42,
      kind: randomPlatformKind(index),
    });
    y -= PLATFORM_GAP_MIN + Math.random() * (PLATFORM_GAP_MAX - PLATFORM_GAP_MIN);
    index += 1;
  }

  return platforms;
}

function maybeCreateBanana(platform: Platform, id: number): Banana | null {
  if (platform.y > 540 || platform.hasTiger || Math.random() > 0.48) return null;

  return {
    id,
    x: platform.x + platform.width / 2 + (Math.random() - 0.5) * 38,
    y: platform.y - 38,
  };
}

function createBananas(platforms: Platform[]): Banana[] {
  return platforms
    .map((platform, index) => maybeCreateBanana(platform, index))
    .filter((banana): banana is Banana => banana !== null);
}

function maybeCreateTiger(platform: Platform, id: number, platformHeight: number): Tiger | null {
  if (platformHeight < TIGER_SPAWN_MIN_HEIGHT || platform.kind !== "stable" || Math.random() > 0.13) return null;

  if (platform.width < TIGER_PLATFORM_MIN_WIDTH) {
    const centerX = platform.x + platform.width / 2;
    platform.width = TIGER_PLATFORM_MIN_WIDTH;
    platform.x = Math.max(18, Math.min(WORLD_WIDTH - platform.width - 18, centerX - platform.width / 2));
  }

  const halfWidth = TIGER_WIDTH / 2;
  const minX = platform.x + TIGER_EDGE_PADDING + halfWidth;
  const maxX = platform.x + platform.width - TIGER_EDGE_PADDING - halfWidth;
  if (minX >= maxX) return null;

  platform.hasTiger = true;

  return {
    id,
    x: minX + Math.random() * (maxX - minX),
    y: platform.y - 29,
    width: TIGER_WIDTH,
    height: TIGER_HEIGHT,
    phase: Math.random() * Math.PI * 2,
    minX,
    maxX,
    vx: (Math.random() > 0.5 ? 1 : -1) * TIGER_PATROL_SPEED,
  };
}

function createTigers(platforms: Platform[]): Tiger[] {
  return platforms
    .map((platform, index) => maybeCreateTiger(platform, index, 560 - platform.y))
    .filter((tiger): tiger is Tiger => tiger !== null);
}

function updateTiger(tiger: Tiger, dt: number) {
  tiger.x += tiger.vx * dt;

  if (tiger.x <= tiger.minX) {
    tiger.x = tiger.minX;
    tiger.vx = TIGER_PATROL_SPEED;
  } else if (tiger.x >= tiger.maxX) {
    tiger.x = tiger.maxX;
    tiger.vx = -TIGER_PATROL_SPEED;
  }
}

function App() {
  const { account, isAccountReady, isAnyWallet } = useAccount();
  const { api, isApiReady } = useApi();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef({ left: false, right: false });
  const monkeyImageRef = useRef<HTMLImageElement | null>(null);
  const monkeyImageReadyRef = useRef(false);
  const bananaImageRef = useRef<HTMLImageElement | null>(null);
  const bananaImageReadyRef = useRef(false);
  const tigerImageRef = useRef<HTMLImageElement | null>(null);
  const tigerImageReadyRef = useRef(false);
  const initialPlatformsRef = useRef<Platform[]>(createPlatforms());
  const playerRef = useRef<Player>({ x: 210, y: 560, vx: 0, vy: JUMP_VELOCITY, radius: 18 });
  const platformsRef = useRef<Platform[]>(initialPlatformsRef.current);
  const tigersRef = useRef<Tiger[]>(createTigers(initialPlatformsRef.current));
  const bananasRef = useRef<Banana[]>(createBananas(initialPlatformsRef.current));
  const nextBananaIdRef = useRef(1000);
  const nextTigerIdRef = useRef(2000);
  const cameraYRef = useRef(0);
  const startingPlayerYRef = useRef(560);
  const maxHeightRef = useRef(0);
  const bananasCollectedRef = useRef(0);
  const startTimeRef = useRef(0);
  const statusRef = useRef<RunStatus>("ready");
  const rafRef = useRef<number | null>(null);
  const jumpButtonTimerRef = useRef<number | null>(null);
  const leaderboardTopRef = useRef<LeaderboardEntry[]>(initialLeaderboardTop);
  const autoSubmittedRunIdRef = useRef<string | null>(null);

  const [status, setStatus] = useState<RunStatus>("ready");
  const [height, setHeight] = useState(0);
  const [score, setScore] = useState(0);
  const [bananas, setBananas] = useState(0);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [leaderboardTop, setLeaderboardTop] = useState(initialLeaderboardTop);
  const [currentPlayerRank, setCurrentPlayerRank] = useState<number | null>(null);
  const [currentPlayerEntry, setCurrentPlayerEntry] = useState<LeaderboardEntry | null>(null);
  const [isJumpButtonSpringing, setIsJumpButtonSpringing] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "ready" | "pending" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [chainStatusMessage, setChainStatusMessage] = useState("");
  const [sailsClient, setSailsClient] = useState<Sails | null>(null);

  const programId = useMemo(() => getConfiguredProgramId(VARA_PROGRAM_ID), []);
  const voucherBackendUrl = useMemo(() => getConfiguredBackendUrl(VOUCHER_BACKEND_URL), []);
  const pointsPreview = useMemo(() => Math.max(0, height + Math.floor(score / 10)), [height, score]);
  const shouldShowCurrentPlayerRank =
    currentPlayerRank !== null && currentPlayerRank > VISIBLE_LEADERBOARD_LIMIT && currentPlayerEntry !== null;
  const hasUnsubmittedRun = runSummary !== null && submitStatus !== "success";
  const startActionLabel = hasUnsubmittedRun ? "Sign result" : status === "playing" ? "Restart run" : "Start run";
  const submitDisabledReason = useMemo(() => {
    if (!runSummary) return "finish a run first";
    if (!isApiReady) return "network is connecting";
    if (!programId) return "program id is not configured";
    if (!voucherBackendUrl) return "voucher backend url is not configured";
    if (!sailsClient) return "contract client is loading";
    if (!isAccountReady) return "wallets are still loading";
    if (!isAnyWallet) return "no wallet extension found";
    if (!account) return "wallet required";
    return "";
  }, [account, isAccountReady, isAnyWallet, isApiReady, programId, runSummary, sailsClient, voucherBackendUrl]);

  const syncStatus = useCallback((next: RunStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    setSailsClient(null);
    if (!isApiReady || !programId) return undefined;

    createSailsClient(api, programId)
      .then((client) => {
        if (isCancelled) return;
        setSailsClient(client);
        setChainStatusMessage("");
      })
      .catch((error: unknown) => {
        if (isCancelled) return;
        setChainStatusMessage(`Contract client error: ${formatError(error)}`);
      });

    return () => {
      isCancelled = true;
    };
  }, [api, isApiReady, programId]);

  const refreshChainState = useCallback(async () => {
    if (!sailsClient) return;

    const game = sailsClient.services.Game;
    if (!game) {
      setChainStatusMessage("Game service is missing in the loaded IDL.");
      return;
    }

    try {
      const leaderboardQuery = game.queries.Leaderboard(VISIBLE_LEADERBOARD_LIMIT);
      if (account?.decodedAddress) {
        leaderboardQuery.withAddress(account.decodedAddress);
      }

      const topEntries = (await leaderboardQuery.call()) as ChainLeaderboardEntry[];
      const mappedTop = mapChainLeaderboard(topEntries, account?.decodedAddress);

      leaderboardTopRef.current = mappedTop;
      setLeaderboardTop(mappedTop);

      if (!account?.decodedAddress) {
        setCurrentPlayerRank(null);
        setCurrentPlayerEntry(null);
        setChainStatusMessage("");
        return;
      }

      const [rankResult, bestRunResult] = await Promise.all([
        game.queries.PlayerRank(account.decodedAddress).withAddress(account.decodedAddress).call(),
        game.queries.PlayerBestRun(account.decodedAddress).withAddress(account.decodedAddress).call(),
      ]);
      const rank = unwrapOption<unknown>(rankResult);
      const bestRun = unwrapOption<ChainRunRecord>(bestRunResult);

      setCurrentPlayerRank(rank === null ? null : toDisplayNumber(rank));
      setCurrentPlayerEntry(
        bestRun
          ? {
              name: CURRENT_PLAYER_NAME,
              points: toDisplayNumber(bestRun.points_awarded ?? bestRun.pointsAwarded),
              height: toDisplayNumber(bestRun.height),
              player: account.decodedAddress,
            }
          : null,
      );
      setChainStatusMessage("");
    } catch (error) {
      setChainStatusMessage(`Leaderboard unavailable: ${formatError(error)}`);
    }
  }, [account?.decodedAddress, sailsClient]);

  useEffect(() => {
    void refreshChainState();
  }, [refreshChainState]);

  const resetRun = useCallback(() => {
    const startingPlatforms = createPlatforms();
    playerRef.current = { x: 210, y: 560, vx: 0, vy: JUMP_VELOCITY, radius: 18 };
    platformsRef.current = startingPlatforms;
    tigersRef.current = createTigers(startingPlatforms);
    bananasRef.current = createBananas(startingPlatforms);
    nextBananaIdRef.current = 1000;
    nextTigerIdRef.current = 2000;
    cameraYRef.current = 0;
    startingPlayerYRef.current = 560;
    maxHeightRef.current = 0;
    bananasCollectedRef.current = 0;
    startTimeRef.current = performance.now();
    setHeight(0);
    setScore(0);
    setBananas(0);
    setRunSummary(null);
    autoSubmittedRunIdRef.current = null;
    setSubmitStatus("idle");
    setSubmitMessage("");
    syncStatus("playing");
  }, [syncStatus]);

  const springJumpButton = useCallback(() => {
    if (jumpButtonTimerRef.current !== null) {
      window.clearTimeout(jumpButtonTimerRef.current);
    }

    setIsJumpButtonSpringing(false);
    window.requestAnimationFrame(() => {
      setIsJumpButtonSpringing(true);
      jumpButtonTimerRef.current = window.setTimeout(() => {
        setIsJumpButtonSpringing(false);
        jumpButtonTimerRef.current = null;
      }, 540);
    });
  }, []);

  const submitRunOnChain = useCallback(async () => {
    if (submitDisabledReason || !runSummary || !account || !sailsClient) {
      setSubmitStatus("error");
      setSubmitMessage(submitDisabledReason || "wallet is not ready");
      return;
    }

    const game = sailsClient.services.Game;
    if (!game) {
      setSubmitStatus("error");
      setSubmitMessage("Game service is missing in the loaded IDL.");
      return;
    }

    const configuredProgramId = programId;
    if (!configuredProgramId) {
      setSubmitStatus("error");
      setSubmitMessage("program id is not configured");
      return;
    }

    try {
      setSubmitStatus("pending");
      setSubmitMessage("Requesting gas voucher for this result.");

      const voucherId = await ensureVoucher(voucherBackendUrl, account.decodedAddress || account.address, configuredProgramId);

      const tx = game.functions.SubmitRun(runSummary.runId, runSummary.height, runSummary.score, runSummary.durationMs);
      tx.withAccount(account.address, { signer: account.signer }).withValue(0n);
      tx.withVoucher(voucherId);
      setSubmitMessage("Confirm the result transaction in your wallet extension. Gas is covered by voucher.");
      await tx.calculateGas(false, 20);

      const result = await tx.signAndSend();
      const reply = (await result.response()) as { improved?: boolean };

      setSubmitStatus("success");
      setSubmitMessage(
        `${reply.improved ? "Best run updated" : "Run submitted; best run unchanged"} · tx ${shortAddress(result.txHash)}`,
      );
      await refreshChainState();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(
        isSignatureRejection(error)
          ? "Signature required to keep playing. Confirm the previous result in your wallet."
          : `On-chain submit failed: ${formatError(error)}`,
      );
    }
  }, [account, programId, refreshChainState, runSummary, sailsClient, submitDisabledReason, voucherBackendUrl]);

  const startRunWithButtonSpring = useCallback(() => {
    springJumpButton();

    if (runSummary && submitStatus !== "success") {
      if (submitStatus === "pending") {
        setSubmitMessage("Confirm the result transaction in your wallet extension.");
        return;
      }

      setSubmitMessage("Sign the previous result before starting another run.");
      autoSubmittedRunIdRef.current = null;
      void submitRunOnChain();
      return;
    }

    resetRun();
  }, [resetRun, runSummary, springJumpButton, submitRunOnChain, submitStatus]);

  useEffect(() => {
    if (!runSummary) return;
    if (autoSubmittedRunIdRef.current === runSummary.runId) return;
    if (submitDisabledReason || submitStatus === "pending" || submitStatus === "success") return;

    autoSubmittedRunIdRef.current = runSummary.runId;
    void submitRunOnChain();
  }, [runSummary, submitDisabledReason, submitRunOnChain, submitStatus]);

  const endRun = useCallback(() => {
    if (statusRef.current === "ended") return;

    const finalHeight = Math.floor(maxHeightRef.current);
    const finalBananas = bananasCollectedRef.current;
    const finalScore = Math.floor(finalHeight + finalHeight * 0.18 + finalBananas * BANANA_SCORE);
    const durationMs = Math.floor(performance.now() - startTimeRef.current);
    const summary = {
      runId: makeRunId(),
      height: finalHeight,
      score: finalScore,
      bananas: finalBananas,
      durationMs,
    };

    setRunSummary(summary);
    syncStatus("ended");
  }, [syncStatus]);

  useEffect(() => {
    const image = new Image();
    image.src = "/monkey.png";
    image.onload = () => {
      monkeyImageReadyRef.current = true;
    };
    image.onerror = () => {
      monkeyImageReadyRef.current = false;
    };
    monkeyImageRef.current = image;

    const bananaImage = new Image();
    bananaImage.src = "/banana.png";
    bananaImage.onload = () => {
      bananaImageReadyRef.current = true;
    };
    bananaImage.onerror = () => {
      bananaImageReadyRef.current = false;
    };
    bananaImageRef.current = bananaImage;

    const tigerImage = new Image();
    tigerImage.src = "/tiger.png?v=transparent-2";
    tigerImage.onload = () => {
      tigerImageReadyRef.current = true;
    };
    tigerImage.onerror = () => {
      tigerImageReadyRef.current = false;
    };
    tigerImageRef.current = tigerImage;
  }, []);

  useEffect(() => {
    return () => {
      if (jumpButtonTimerRef.current !== null) {
        window.clearTimeout(jumpButtonTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keysRef.current.left = true;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keysRef.current.right = true;
      if (event.key === " " && statusRef.current !== "playing") startRunWithButtonSpring();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keysRef.current.left = false;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keysRef.current.right = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [resetRun, startRunWithButtonSpring]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.floor(WORLD_WIDTH * pixelRatio);
    canvas.height = Math.floor(WORLD_HEIGHT * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    let last = performance.now();

    const drawPlatform = (platform: Platform, screenY: number, now: number) => {
      const breakFrame =
        platform.breakStartedAt === undefined
          ? 0
          : Math.min(
              PLATFORM_BREAK_FRAMES - 1,
              PLATFORM_BREAK_FIRST_ACTIVE_FRAME + Math.floor(((now - platform.breakStartedAt) / 1000) * PLATFORM_BREAK_FPS),
            );
      const isBreaking = platform.breakStartedAt !== undefined;
      const plankHeight = 16;
      const leftWidth = platform.width / 2 - 3;
      const rightWidth = platform.width / 2 - 3;
      const gap = breakFrame >= 3 ? 8 + breakFrame * 3 : 0;
      const fallOffset = breakFrame === 4 ? 18 : 0;
      const bend = breakFrame >= 2 ? 3 : 0;
      const boostFrame =
        platform.kind !== "boost" || platform.boostStartedAt === undefined
          ? 0
          : Math.min(
              BOOST_SPRING_FRAMES - 1,
              BOOST_SPRING_FIRST_ACTIVE_FRAME + Math.floor(((now - platform.boostStartedAt) / 1000) * BOOST_SPRING_FPS),
            );
      const boostShape =
        boostFrame === 1
          ? { y: 4, scaleX: 1.06, scaleY: 0.88, springHeight: 15 }
          : boostFrame === 2
            ? { y: 8, scaleX: 1.14, scaleY: 0.72, springHeight: 9 }
            : boostFrame === 3
              ? { y: -7, scaleX: 0.9, scaleY: 1.16, springHeight: 29 }
              : boostFrame === 4
                ? { y: -2, scaleX: 0.98, scaleY: 1.04, springHeight: 23 }
                : { y: 0, scaleX: 1, scaleY: 1, springHeight: 20 };
      const plankY = screenY + bend + (platform.kind === "boost" ? boostShape.y : 0);
      const plankDrawHeight = plankHeight * (platform.kind === "boost" ? boostShape.scaleY : 1);
      const plankDrawWidth = platform.width * (platform.kind === "boost" ? boostShape.scaleX : 1);
      const plankDrawX = platform.x + (platform.width - plankDrawWidth) / 2;

      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 14;
      ctx.lineJoin = "round";

      if (breakFrame >= 3) {
        ctx.fillStyle = "#8b5a2b";
        ctx.strokeStyle = "#1f2937";
        ctx.lineWidth = 3;

        ctx.save();
        ctx.translate(platform.x + leftWidth / 2 - gap / 2, screenY + fallOffset);
        ctx.rotate(-0.16 - breakFrame * 0.03);
        ctx.beginPath();
        ctx.roundRect(-leftWidth / 2, -plankHeight / 2, leftWidth, plankHeight, 6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.translate(platform.x + platform.width - rightWidth / 2 + gap / 2, screenY + fallOffset * 1.08);
        ctx.rotate(0.16 + breakFrame * 0.03);
        ctx.beginPath();
        ctx.roundRect(-rightWidth / 2, -plankHeight / 2, rightWidth, plankHeight, 6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.shadowBlur = 0;
        return;
      }

      ctx.fillStyle = "#8b5a2b";
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(plankDrawX, plankY, plankDrawWidth, plankDrawHeight, 7);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (platform.kind === "boost") {
        const springX = platform.x + platform.width / 2;
        const springTop = plankY + plankDrawHeight + 1;
        const springBottom = springTop + boostShape.springHeight;

        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(springX - 11, springBottom);
        ctx.lineTo(springX - 5, springTop + boostShape.springHeight * 0.72);
        ctx.lineTo(springX + 5, springTop + boostShape.springHeight * 0.48);
        ctx.lineTo(springX - 5, springTop + boostShape.springHeight * 0.24);
        ctx.lineTo(springX + 11, springTop);
        ctx.stroke();

        ctx.fillStyle = "#e2e8f0";
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(springX - 18, springBottom - 2, 36, 6, 3);
        ctx.fill();
        ctx.stroke();

      }

      ctx.strokeStyle = "#5b341c";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(plankDrawX + 12, plankY + plankDrawHeight * 0.36);
      ctx.lineTo(plankDrawX + plankDrawWidth - 14, plankY + plankDrawHeight * 0.28);
      ctx.moveTo(plankDrawX + 18, plankY + plankDrawHeight * 0.78);
      ctx.lineTo(plankDrawX + plankDrawWidth - 20, plankY + plankDrawHeight * 0.84);
      ctx.stroke();

      if (platform.kind === "cracked" || isBreaking) {
        ctx.strokeStyle = "#1f2937";
        ctx.lineWidth = breakFrame >= 2 ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(platform.x + platform.width / 2 - 5, screenY + 2 + bend);
        ctx.lineTo(platform.x + platform.width / 2 + 2, screenY + 7 + bend);
        ctx.lineTo(platform.x + platform.width / 2 - 3, screenY + 14 + bend);
        if (breakFrame >= 2) {
          ctx.moveTo(platform.x + platform.width / 2 + 2, screenY + 7 + bend);
          ctx.lineTo(platform.x + platform.width / 2 + 14, screenY + 3 + bend);
          ctx.moveTo(platform.x + platform.width / 2 + 1, screenY + 8 + bend);
          ctx.lineTo(platform.x + platform.width / 2 - 15, screenY + 12 + bend);
        }
        ctx.stroke();
      }
    };

    const drawBackground = () => {
      const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
      sky.addColorStop(0, "#9ee7ff");
      sky.addColorStop(0.48, "#dff8ff");
      sky.addColorStop(1, "#effbe7");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
      for (let i = 0; i < 10; i += 1) {
        const y = (i * 126 + (cameraYRef.current * 0.08) % 126 + WORLD_HEIGHT) % WORLD_HEIGHT;
        const x = 28 + ((i * 83) % 360);
        ctx.beginPath();
        ctx.ellipse(x, y, 28, 10, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 22, y + 2, 20, 8, 0, 0, Math.PI * 2);
        ctx.ellipse(x - 20, y + 4, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      const drawTreeLayer = (offset: number, color: string, alpha: number, scale: number) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;

        for (let i = -1; i < 7; i += 1) {
          const baseX = i * 82 + ((cameraYRef.current * offset) % 82);
          const baseY = WORLD_HEIGHT - 120 + Math.sin(i * 1.7) * 18;
          const trunkHeight = 180 * scale;
          const trunkWidth = 18 * scale;

          ctx.beginPath();
          ctx.roundRect(baseX, baseY - trunkHeight, trunkWidth, trunkHeight + 180, trunkWidth / 2);
          ctx.fill();

          ctx.beginPath();
          ctx.ellipse(baseX + trunkWidth / 2, baseY - trunkHeight - 18, 48 * scale, 34 * scale, 0, 0, Math.PI * 2);
          ctx.ellipse(baseX - 26 * scale, baseY - trunkHeight + 10, 40 * scale, 28 * scale, -0.25, 0, Math.PI * 2);
          ctx.ellipse(baseX + 34 * scale, baseY - trunkHeight + 12, 42 * scale, 30 * scale, 0.24, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      };

      drawTreeLayer(0.025, "#8fcfae", 0.28, 1.25);
      drawTreeLayer(0.045, "#66b889", 0.22, 0.9);
    };

    const drawBanana = (banana: Banana) => {
      const screenY = banana.y - cameraYRef.current;
      const frame = Math.floor((performance.now() / 1000) * BANANA_ANIMATION_FPS) % BANANA_ROTATION_FRAMES;
      const rotation = frame * ((Math.PI * 2) / BANANA_ROTATION_FRAMES);
      const squash = Math.max(0.22, Math.abs(Math.cos(rotation)));
      const facingBack = Math.cos(rotation) < 0;

      ctx.save();
      ctx.translate(banana.x, screenY);
      ctx.rotate(rotation - 0.28);

      if (bananaImageRef.current && bananaImageReadyRef.current) {
        ctx.drawImage(
          bananaImageRef.current,
          -BANANA_SPRITE_SIZE / 2,
          -BANANA_SPRITE_SIZE / 2,
          BANANA_SPRITE_SIZE,
          BANANA_SPRITE_SIZE,
        );
        ctx.restore();
        return;
      }

      ctx.scale(squash, 1);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-17, 4);
      ctx.bezierCurveTo(-8, 21, 15, 16, 20, -8);
      ctx.stroke();

      ctx.strokeStyle = facingBack ? "#eab308" : "#facc15";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-15, 4);
      ctx.bezierCurveTo(-6, 18, 13, 13, 17, -6);
      ctx.stroke();

      if (!facingBack) {
        ctx.strokeStyle = "#fde047";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-9, 5);
        ctx.bezierCurveTo(-2, 10, 8, 7, 12, -5);
        ctx.stroke();
      }

      ctx.strokeStyle = "#7c2d12";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(15, -8);
      ctx.lineTo(20, -12);
      ctx.moveTo(-15, 4);
      ctx.lineTo(-20, 4);
      ctx.stroke();
      ctx.restore();
    };

    const drawTiger = (tiger: Tiger, now: number) => {
      const screenY = tiger.y - cameraYRef.current;
      const breathe = Math.sin(now / 180 + tiger.phase) * 1.4;

      ctx.save();
      ctx.translate(tiger.x, screenY + breathe);
      if (tiger.vx < 0) ctx.scale(-1, 1);

      if (tigerImageRef.current && tigerImageReadyRef.current) {
        ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
        ctx.shadowBlur = 8;
        ctx.drawImage(
          tigerImageRef.current,
          -TIGER_SPRITE_WIDTH / 2,
          -TIGER_SPRITE_HEIGHT + 28,
          TIGER_SPRITE_WIDTH,
          TIGER_SPRITE_HEIGHT,
        );
        ctx.restore();
        return;
      }

      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      ctx.shadowColor = "rgba(15, 23, 42, 0.1)";
      ctx.shadowBlur = 5;
      ctx.fillStyle = "#f97316";
      ctx.strokeStyle = "#172033";
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.roundRect(-30, -7, 55, 24, 13);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.ellipse(-4, 8, 22, 7, 0.05, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f97316";
      ctx.strokeStyle = "#172033";
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.ellipse(27, -15, 23, 22, 0.02, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f97316";
      ctx.strokeStyle = "#172033";
      ctx.beginPath();
      ctx.arc(15, -34, 8, 0, Math.PI * 2);
      ctx.arc(41, -33, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(15, -34, 4.5, 0, Math.PI * 2);
      ctx.arc(41, -33, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.ellipse(33, -8, 18, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#172033";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-23, -7);
      ctx.lineTo(-26, 9);
      ctx.moveTo(-8, -8);
      ctx.lineTo(-12, 14);
      ctx.moveTo(7, -7);
      ctx.lineTo(3, 11);
      ctx.moveTo(18, -29);
      ctx.lineTo(25, -21);
      ctx.moveTo(33, -32);
      ctx.lineTo(30, -21);
      ctx.moveTo(41, -23);
      ctx.lineTo(35, -17);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#172033";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(22, -17, 6.2, 8, 0.1, 0, Math.PI * 2);
      ctx.ellipse(39, -17, 6.2, 8, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(24.5, -16.6, 2.2, 0, Math.PI * 2);
      ctx.arc(41.5, -16.6, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.ellipse(34, -7, 5, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(34, -4);
      ctx.quadraticCurveTo(29, 1, 22, -2);
      ctx.moveTo(34, -4);
      ctx.quadraticCurveTo(40, 3, 47, -2);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#172033";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(25, -2);
      ctx.lineTo(29, 5);
      ctx.lineTo(32, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "#172033";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-31, 1);
      ctx.bezierCurveTo(-48, 10, -58, 0, -48, -10);
      ctx.bezierCurveTo(-40, -18, -35, -8, -42, -5);
      ctx.stroke();

      ctx.strokeStyle = "#172033";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-47, -1);
      ctx.lineTo(-39, -2);
      ctx.moveTo(-37, 5);
      ctx.lineTo(-30, 2);
      ctx.stroke();

      const step = Math.sin(now / 150 + tiger.phase) * 2.2;
      ctx.beginPath();
      ctx.moveTo(-23, 15);
      ctx.lineTo(-27 - step, 27);
      ctx.lineTo(-17 - step, 27);
      ctx.moveTo(-5, 15);
      ctx.lineTo(-4 + step, 27);
      ctx.lineTo(6 + step, 27);
      ctx.moveTo(15, 14);
      ctx.lineTo(14 - step, 27);
      ctx.lineTo(25 - step, 27);
      ctx.moveTo(29, 10);
      ctx.lineTo(38 + step, 24);
      ctx.lineTo(49 + step, 24);
      ctx.stroke();
      ctx.restore();
    };

    const draw = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.03);
      last = now;

      const player = playerRef.current;
      const platforms = platformsRef.current;
      const bananasList = bananasRef.current;
      const tigersList = tigersRef.current;

      if (statusRef.current === "playing") {
        const previousX = player.x;
        const previousY = player.y;
        const previousBottom = previousY + player.radius;
        const direction = Number(keysRef.current.right) - Number(keysRef.current.left);
        player.vx = direction * MOVE_SPEED;
        player.vy += GRAVITY * dt;
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        const currentBottom = player.y + player.radius;

        if (player.x < -player.radius) player.x = WORLD_WIDTH + player.radius;
        if (player.x > WORLD_WIDTH + player.radius) player.x = -player.radius;

        for (const tiger of tigersList) {
          updateTiger(tiger, dt);
        }

        for (let i = platforms.length - 1; i >= 0; i -= 1) {
          const platform = platforms[i];
          if (platform.breakStartedAt !== undefined) continue;
          const crossedPlatformTop = previousBottom <= platform.y && currentBottom >= platform.y;
          const leftMostX = Math.min(previousX, player.x) - player.radius;
          const rightMostX = Math.max(previousX, player.x) + player.radius;
          const overlapsPlatformX = rightMostX >= platform.x && leftMostX <= platform.x + platform.width;

          if (player.vy > 0 && crossedPlatformTop && overlapsPlatformX) {
            player.y = platform.y - player.radius;
            if (platform.kind === "cracked") {
              platform.breakStartedAt = now - 1;
              player.vy = JUMP_VELOCITY;
            } else {
              if (platform.kind === "boost") {
                platform.boostStartedAt = now;
              }
              player.vy = platform.kind === "boost" ? BOOST_VELOCITY : JUMP_VELOCITY;
            }
            break;
          }
        }

        for (let i = bananasList.length - 1; i >= 0; i -= 1) {
          const banana = bananasList[i];
          const dx = banana.x - player.x;
          const dy = banana.y - player.y;
          if (Math.hypot(dx, dy) < player.radius + 17) {
            bananasList.splice(i, 1);
            bananasCollectedRef.current += 1;
          }
        }

        for (const tiger of tigersList) {
          const touchesTiger =
            Math.abs(player.x - tiger.x) < player.radius + tiger.width * 0.42 &&
            Math.abs(player.y - tiger.y) < player.radius + tiger.height * 0.5;
          if (touchesTiger) {
            endRun();
            break;
          }
        }

        const targetCamera = Math.min(cameraYRef.current, player.y - WORLD_HEIGHT * 0.42);
        cameraYRef.current += (targetCamera - cameraYRef.current) * 0.12;

        const currentHeight = Math.max(0, startingPlayerYRef.current - player.y);
        maxHeightRef.current = Math.max(maxHeightRef.current, currentHeight);

        let topY = platforms.reduce((min, platform) => Math.min(min, platform.y), Infinity);
        while (topY > cameraYRef.current - 240) {
          topY -= PLATFORM_GAP_MIN + Math.random() * (PLATFORM_GAP_MAX - PLATFORM_GAP_MIN);
          const platform: Platform = {
            x: 28 + Math.random() * (WORLD_WIDTH - 116),
            y: topY,
            width: 74 + Math.random() * 46,
            kind: randomPlatformKind(platforms.length),
          };
          platforms.push(platform);
          const tiger = maybeCreateTiger(platform, nextTigerIdRef.current, startingPlayerYRef.current - platform.y);
          nextTigerIdRef.current += 1;
          const banana = tiger ? null : maybeCreateBanana(platform, nextBananaIdRef.current);
          nextBananaIdRef.current += 1;
          if (banana) bananasList.push(banana);
          if (tiger) tigersList.push(tiger);
        }

        platformsRef.current = platforms.filter((platform) => {
          const isDoneBreaking =
            platform.breakStartedAt !== undefined &&
            now - platform.breakStartedAt > (PLATFORM_BREAK_FRAMES / PLATFORM_BREAK_FPS) * 1000 + 120;
          return !isDoneBreaking && platform.y - cameraYRef.current < WORLD_HEIGHT + 80;
        });
        bananasRef.current = bananasList.filter((banana) => banana.y - cameraYRef.current < WORLD_HEIGHT + 80);
        tigersRef.current = tigersList.filter((tiger) => tiger.y - cameraYRef.current < WORLD_HEIGHT + 90);

        const nextHeight = Math.floor(maxHeightRef.current);
        const nextScore = Math.floor(nextHeight + nextHeight * 0.18 + bananasCollectedRef.current * BANANA_SCORE);
        setHeight(nextHeight);
        setScore(nextScore);
        setBananas(bananasCollectedRef.current);

        if (player.y - cameraYRef.current > WORLD_HEIGHT + 80) {
          endRun();
        }
      }

      drawBackground();

      for (const platform of platformsRef.current) {
        const screenY = platform.y - cameraYRef.current;
        if (screenY > -40 && screenY < WORLD_HEIGHT + 80) drawPlatform(platform, screenY, now);
      }

      for (const banana of bananasRef.current) {
        const screenY = banana.y - cameraYRef.current;
        if (screenY > -40 && screenY < WORLD_HEIGHT + 40) drawBanana(banana);
      }

      for (const tiger of tigersRef.current) {
        const screenY = tiger.y - cameraYRef.current;
        if (screenY > -60 && screenY < WORLD_HEIGHT + 60) drawTiger(tiger, now);
      }

      const screenPlayerY = player.y - cameraYRef.current;
      const tilt = Math.max(-0.18, Math.min(0.18, player.vx / MOVE_SPEED / 5));
      ctx.save();
      ctx.translate(player.x, screenPlayerY);
      ctx.rotate(tilt);

      if (monkeyImageRef.current && monkeyImageReadyRef.current) {
        ctx.shadowColor = "rgba(15, 23, 42, 0.24)";
        ctx.shadowBlur = 16;
        ctx.drawImage(
          monkeyImageRef.current,
          -MONKEY_SPRITE_WIDTH / 2,
          -MONKEY_SPRITE_HEIGHT * 0.62,
          MONKEY_SPRITE_WIDTH,
          MONKEY_SPRITE_HEIGHT,
        );
        ctx.restore();
      } else {
      ctx.shadowColor = "rgba(15, 23, 42, 0.22)";
      ctx.shadowBlur = 18;
      ctx.strokeStyle = "#8b5a2b";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-14, 11);
      ctx.bezierCurveTo(-38, 6, -38, 30, -22, 28);
      ctx.bezierCurveTo(-11, 26, -17, 15, -26, 20);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#8b5a2b";
      ctx.beginPath();
      ctx.ellipse(0, 7, 17, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f3c98b";
      ctx.beginPath();
      ctx.ellipse(0, 8, 11, 17, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#8b5a2b";
      ctx.beginPath();
      ctx.ellipse(0, -18, 23, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-9, -36);
      ctx.lineTo(-2, -52);
      ctx.lineTo(2, -34);
      ctx.lineTo(13, -49);
      ctx.lineTo(8, -32);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.ellipse(-24, -17, 9, 12, 0.1, 0, Math.PI * 2);
      ctx.ellipse(24, -17, 9, 12, -0.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#d97706";
      ctx.beginPath();
      ctx.ellipse(-24, -17, 5, 8, 0.1, 0, Math.PI * 2);
      ctx.ellipse(24, -17, 5, 8, -0.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f3c98b";
      ctx.beginPath();
      ctx.ellipse(0, -15, 16, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-7, -21, 6.7, 0, Math.PI * 2);
      ctx.arc(7, -21, 6.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#050505";
      ctx.beginPath();
      ctx.arc(-6.5, -20.5, 3.7, 0, Math.PI * 2);
      ctx.arc(7.5, -20.5, 3.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-5.2, -23, 1.3, 0, Math.PI * 2);
      ctx.arc(8.8, -23, 1.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#3f2415";
      ctx.beginPath();
      ctx.ellipse(0, -12, 2.8, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#3f2415";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, -8, 8, 0.17 * Math.PI, 0.83 * Math.PI);
      ctx.stroke();

      ctx.strokeStyle = "#8b5a2b";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-23, 14);
      ctx.moveTo(12, 0);
      ctx.lineTo(23, 14);
      ctx.moveTo(-8, 27);
      ctx.lineTo(-15, 40);
      ctx.moveTo(8, 27);
      ctx.lineTo(15, 40);
      ctx.stroke();

      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.ellipse(-24, 15, 8, 5, -0.2, 0, Math.PI * 2);
      ctx.ellipse(24, 15, 8, 5, 0.2, 0, Math.PI * 2);
      ctx.ellipse(-15, 42, 13, 5.5, -0.16, 0, Math.PI * 2);
      ctx.ellipse(15, 42, 13, 5.5, 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      }

      if (statusRef.current !== "playing") {
        ctx.fillStyle = "rgba(15, 23, 42, 0.54)";
        ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 34px Inter, system-ui";
        ctx.textAlign = "center";
        ctx.fillText(statusRef.current === "ready" ? "Skybound Jump" : "Run Complete", WORLD_WIDTH / 2, 300);
        ctx.font = "500 16px Inter, system-ui";
        ctx.fillText("Space or Start", WORLD_WIDTH / 2, 336);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [endRun]);

  return (
    <main className="app-shell">
      <section className="game-stage" aria-label="Skybound Jump game">
        <div className="hud">
          <span>{height} m</span>
          <span>{bananas} bananas</span>
          <span>{pointsPreview} pts</span>
        </div>
        <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} />
        <div className="touch-controls" aria-label="Touch controls">
          <button type="button" onPointerDown={() => (keysRef.current.left = true)} onPointerUp={() => (keysRef.current.left = false)}>
            ←
          </button>
          <button
            className={`jump-button${isJumpButtonSpringing ? " is-springing" : ""}`}
            type="button"
            onClick={startRunWithButtonSpring}
            aria-label={startActionLabel}
          >
            {hasUnsubmittedRun ? "✓" : status === "playing" ? "↻" : "▶"}
          </button>
          <button type="button" onPointerDown={() => (keysRef.current.right = true)} onPointerUp={() => (keysRef.current.right = false)}>
            →
          </button>
        </div>
      </section>

      <aside className="side-panel">
        <div className="wallet-widget" aria-label="Wallet connection">
          <Wallet theme="vara" displayBalance={false} />
        </div>

        <div className="brand-block">
          <p>Vara Arcade</p>
          <h1>Skybound Jump</h1>
        </div>

        <div className="stat-grid">
          <div>
            <span>Height</span>
            <strong>{height}</strong>
          </div>
          <div>
            <span>Bananas</span>
            <strong>{bananas}</strong>
          </div>
          <div>
            <span>Points</span>
            <strong>{pointsPreview}</strong>
          </div>
        </div>

        <button className="primary-action" type="button" onClick={startRunWithButtonSpring}>
          {startActionLabel}
        </button>

        <section className="result-panel" aria-label="Run result">
          <h2>Run Result</h2>
          {runSummary ? (
            <>
              <dl>
                <div>
                  <dt>Run</dt>
                  <dd>{runSummary.runId}</dd>
                </div>
                <div>
                  <dt>Height</dt>
                  <dd>{runSummary.height} m</dd>
                </div>
                <div>
                  <dt>Bananas</dt>
                  <dd>{runSummary.bananas}</dd>
                </div>
                <div>
                  <dt>Score</dt>
                  <dd>{runSummary.score}</dd>
                </div>
              </dl>

              <p className={`submit-note ${submitStatus}`}>
                {submitMessage || submitDisabledReason || "Run result will be submitted automatically."}
              </p>
            </>
          ) : (
            <p className="empty-state">Finish a run to prepare an on-chain result.</p>
          )}
        </section>

        <section className="leaderboard" aria-label="Leaderboard">
          <h2>Leaderboard</h2>
          {chainStatusMessage && <p className="chain-note">{chainStatusMessage}</p>}
          {leaderboardTop.map((entry, index) => (
            <div className={`leaderboard-row${entry.name === CURRENT_PLAYER_NAME ? " is-current" : ""}`} key={entry.name}>
              <span>{index + 1}</span>
              <strong>{entry.name}</strong>
              <em>{entry.points} pts</em>
            </div>
          ))}
          {shouldShowCurrentPlayerRank && currentPlayerEntry && currentPlayerRank !== null && (
            <>
              <div className="leaderboard-gap" aria-hidden="true">
                <span>...</span>
              </div>
              <div className="leaderboard-row is-current" key={CURRENT_PLAYER_NAME}>
                <span>{currentPlayerRank}</span>
                <strong>{currentPlayerEntry.name}</strong>
                <em>{currentPlayerEntry.points} pts</em>
              </div>
            </>
          )}
        </section>
      </aside>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApiProvider initialArgs={{ endpoint: VARA_NODE_ADDRESS }}>
        <AccountProvider appName={APP_NAME}>
          <AlertProvider template={Alert} containerClassName={alertStyles.root}>
            <App />
          </AlertProvider>
        </AccountProvider>
      </ApiProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
