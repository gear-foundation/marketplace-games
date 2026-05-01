import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useApi } from "@gear-js/react-hooks";
import type { Sails } from "sails-js";
import contractIdl from "../idl/contract.idl?raw";
import type { GameEndPayload } from "../game/types";
import { WalletGate } from "./WalletGate";
import {
  createSailsClient,
  getConfiguredProgramId,
  mapChainLeaderboard,
  type ChainLeaderboardEntry,
  type LeaderboardEntry,
} from "../shared/chain";
import {
  formatError,
  formatNextVoucherWait,
  formatVaraAmount,
  isSignatureRejection,
  shortAddress,
  toDisplayNumber,
  unwrapOption,
} from "../shared/format";
import {
  describeVoucher,
  ensureVoucher,
  getConfiguredBackendUrl,
  getVoucherState,
  revokeVoucher,
  type VoucherResult,
} from "../shared/voucher";
import { ZombieChainPanelOffline } from "./ZombieChainPanelOffline";
import type { PlayAccess } from "./playAccess";
export type { PlayAccess } from "./playAccess";

const VISIBLE_LEADERBOARD_LIMIT = 8;
const CURRENT_PLAYER_NAME = "YOU";
const DEFAULT_PROGRAM_ID = "0x2f683b880bc03933678250cde86656bb0ddaac526bcfb3e6b5870027ade04a56";
const DEFAULT_VOUCHER_BACKEND_URL = "https://arcade-vara-production.up.railway.app";
const VARA_PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || DEFAULT_PROGRAM_ID;
const VOUCHER_BACKEND_URL = (import.meta.env.VITE_VOUCHER_BACKEND_URL || DEFAULT_VOUCHER_BACKEND_URL).replace(/\/+$/, "");

const placeholderEntries: LeaderboardEntry[] = [
  { name: "ASH", score: 12_840 },
  { name: "HIVE", score: 10_920 },
  { name: "DUSK", score: 8_500 },
];

type ZombieChainPanelProps = {
  chainEnabled: boolean;
  gameSessionId: number;
  pendingRun: GameEndPayload | null;
  onPlayAccessChange?: (state: PlayAccess) => void;
  onSessionSubmitStateChange?: (submitted: boolean) => void;
};

type SubmitStatus = "idle" | "pending" | "success" | "error";

function isFetchFailure(error: unknown) {
  const message = formatError(error).toLowerCase();
  return message.includes("failed to fetch") || message.includes("networkerror");
}

export function ZombieChainPanel({
  chainEnabled,
  ...props
}: ZombieChainPanelProps) {
  if (!chainEnabled) {
    return <ZombieChainPanelOffline {...props} />;
  }

  return <ZombieChainPanelOnline {...props} />;
}

function ZombieChainPanelOnline({
  gameSessionId,
  pendingRun,
  onPlayAccessChange,
  onSessionSubmitStateChange,
}: Omit<ZombieChainPanelProps, "chainEnabled">) {
  const { account, isAccountReady } = useAccount();
  const { api, isApiReady } = useApi();

  const [walletConnected, setWalletConnected] = useState(false);
  const [leaderboardTop, setLeaderboardTop] = useState<LeaderboardEntry[]>(placeholderEntries);
  const [playerBest, setPlayerBest] = useState<number | null>(null);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [survivorsCount, setSurvivorsCount] = useState<number | null>(null);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [voucherMessage, setVoucherMessage] = useState("");
  const [chainStatusMessage, setChainStatusMessage] = useState("");
  const [sailsClient, setSailsClient] = useState<Sails | null>(null);
  const [submittedSessionId, setSubmittedSessionId] = useState<number | null>(null);

  const autoSubmitSessionRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);

  const programId = useMemo(() => getConfiguredProgramId(VARA_PROGRAM_ID), []);
  const voucherBackendUrl = useMemo(() => getConfiguredBackendUrl(VOUCHER_BACKEND_URL), []);
  const connectedAddress = account?.decodedAddress || account?.address || "";
  const isSubmittedForCurrentSession = pendingRun === null || submittedSessionId === gameSessionId;
  const voucherStatus = useMemo(() => {
    if (!voucherBackendUrl) return "Backend missing";
    if (!programId) return "Program missing";
    if (!connectedAddress) return "Wallet required";
    return "Checking access";
  }, [connectedAddress, programId, voucherBackendUrl]);

  const playAccess = useMemo<PlayAccess>(() => {
    if (!isAccountReady) {
      return {
        canPlay: false,
        title: "Loading wallet",
        description: "Wallet providers are still loading. The arena unlocks as soon as your Vara session is ready.",
      };
    }

    if (!walletConnected || !connectedAddress) {
      return {
        canPlay: false,
        title: "Connect your wallet",
        description: "Connect a Vara wallet to enter the arena and submit your survival score on-chain with voucher support.",
      };
    }

    if (!isApiReady || !api) {
      return {
        canPlay: false,
        title: "Connecting to Vara",
        description: "Network access is still initializing. Hold tight while the bunker uplink comes online.",
      };
    }

    if (!programId) {
      return {
        canPlay: false,
        title: "Program ID required",
        description: "Set VITE_PROGRAM_ID to the deployed Zombie Apocalypse Survival contract address.",
      };
    }

    if (!sailsClient) {
      return {
        canPlay: false,
        title: "Loading contract",
        description: chainStatusMessage || "The contract client is still loading from the IDL.",
      };
    }

    return {
      canPlay: true,
      title: "Arena ready",
      description: "Start a run. When you fall, the score submission prompt will open automatically.",
    };
  }, [api, chainStatusMessage, connectedAddress, isAccountReady, isApiReady, programId, sailsClient, walletConnected]);

  useEffect(() => {
    onPlayAccessChange?.(playAccess);
  }, [onPlayAccessChange, playAccess]);

  useEffect(() => {
    onSessionSubmitStateChange?.(isSubmittedForCurrentSession);
  }, [isSubmittedForCurrentSession, onSessionSubmitStateChange]);

  useEffect(() => {
    let cancelled = false;

    setSailsClient(null);
    if (!isApiReady || !api || !programId) {
      return undefined;
    }

    createSailsClient(api, programId, contractIdl)
      .then((client) => {
        if (cancelled) return;
        setSailsClient(client);
        setChainStatusMessage("");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setChainStatusMessage(`Contract client error: ${formatError(error)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [api, isApiReady, programId]);

  const refreshChainState = useCallback(async () => {
    if (!sailsClient || isRefreshingRef.current) {
      return;
    }

    const game = sailsClient.services.Game;
    if (!game) {
      setChainStatusMessage("Game service is missing from the loaded IDL.");
      return;
    }

    isRefreshingRef.current = true;

    try {
      const leaderboardQuery = game.queries.Leaderboard(VISIBLE_LEADERBOARD_LIMIT);
      if (connectedAddress) {
        leaderboardQuery.withAddress(connectedAddress);
      }

      const leaderboardRaw = (await leaderboardQuery.call()) as ChainLeaderboardEntry[];
      setLeaderboardTop(mapChainLeaderboard(leaderboardRaw, CURRENT_PLAYER_NAME, connectedAddress || undefined));

      const totalQuery = game.queries.ScoresCount();
      if (connectedAddress) {
        totalQuery.withAddress(connectedAddress);
      }
      const totalRaw = await totalQuery.call();
      setSurvivorsCount(toDisplayNumber(totalRaw));

      if (!connectedAddress) {
        setPlayerBest(null);
        setPlayerRank(null);
      } else {
        const [bestRaw, rankRaw] = await Promise.all([
          game.queries.PlayerBestScore(connectedAddress).withAddress(connectedAddress).call(),
          game.queries.PlayerRank(connectedAddress).withAddress(connectedAddress).call(),
        ]);

        setPlayerBest(toDisplayNumber(bestRaw));
        const rank = unwrapOption<unknown>(rankRaw);
        setPlayerRank(rank === null ? null : toDisplayNumber(rank));
      }

      setChainStatusMessage("");
    } catch (error: unknown) {
      setChainStatusMessage(`Leaderboard unavailable: ${formatError(error)}`);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [connectedAddress, sailsClient]);

  useEffect(() => {
    void refreshChainState();
  }, [refreshChainState]);

  useEffect(() => {
    if (!voucherBackendUrl) {
      setVoucherMessage("Voucher backend is not configured.");
      return;
    }

    if (!programId) {
      setVoucherMessage("Program ID is missing, so voucher access cannot be checked.");
      return;
    }

    if (!connectedAddress) {
      setVoucherMessage("Connect your wallet to check gas voucher access for this game.");
      return;
    }

    setVoucherMessage("Checking voucher access...");

    let cancelled = false;

    getVoucherState(voucherBackendUrl, connectedAddress)
      .then((state) => {
        if (cancelled) return;
        const summary = describeVoucher(state, programId);
        setVoucherMessage(summary || "No active voucher yet. A voucher will be requested automatically on submit.");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setVoucherMessage(
          isFetchFailure(error)
            ? `Voucher backend is unreachable from this frontend.`
            : `Voucher check failed: ${formatError(error)}`,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [connectedAddress, programId, voucherBackendUrl]);

  useEffect(() => {
    setSubmittedSessionId(null);
    autoSubmitSessionRef.current = null;
    setSubmitStatus("idle");
    setSubmitMessage("");
  }, [gameSessionId]);

  const submitRun = useCallback(async (run: GameEndPayload, sessionId: number) => {
    if (!sailsClient || !programId || !isApiReady || !api || !account) {
      setSubmitStatus("error");
      setSubmitMessage("Wallet or contract is not ready yet. Reconnect and retry this score.");
      return;
    }

    const game = sailsClient.services.Game;
    if (!game) {
      setSubmitStatus("error");
      setSubmitMessage("Contract service missing in the IDL.");
      return;
    }

    const accountId = account.decodedAddress || account.address;
    if (!accountId) {
      setSubmitStatus("error");
      setSubmitMessage("Connect a wallet before submitting your run.");
      return;
    }

    const sendTx = async (voucherId?: `0x${string}`) => {
      const tx = game.functions.SubmitScore(run.score);
      tx.withAccount(accountId, { signer: account.signer }).withValue(0n);
      if (voucherId) {
        tx.withVoucher(voucherId);
      }
      await tx.calculateGas(false, 20);
      return tx.signAndSend();
    };

    try {
      setSubmitStatus("pending");
      setSubmitMessage("Preparing score submission…");

      let activeVoucher: VoucherResult | null = null;

      if (voucherBackendUrl && programId) {
        try {
          const voucher = await ensureVoucher(voucherBackendUrl, accountId, programId);
          activeVoucher = voucher;
          setVoucherMessage(
            `${voucher.source === "issued" ? "Voucher issued" : "Voucher ready"} · ${voucher.balanceText} · ${shortAddress(voucher.voucherId)}`,
          );
          setSubmitMessage("Confirm the voucher-backed transaction in your wallet.");

          const result = await sendTx(voucher.voucherId);
          await result.response();
          await refreshChainState();
          setSubmittedSessionId(sessionId);
          setSubmitStatus("success");
          setSubmitMessage("Score submitted with voucher support.");
          return;
        } catch (error: unknown) {
          if (isSignatureRejection(error)) {
            throw error;
          }

          if (activeVoucher) {
            try {
              await revokeVoucher(voucherBackendUrl, accountId, activeVoucher.voucherId);
              setVoucherMessage(`Voucher revoked · ${shortAddress(activeVoucher.voucherId)}`);
            } catch {
              setVoucherMessage("Voucher revoke failed.");
            }
          } else {
            setVoucherMessage(
              isFetchFailure(error)
                ? `Voucher backend blocked from ${window.location.origin}. Check CORS settings.`
                : `Voucher unavailable · ${formatError(error)}`,
            );
          }
        }
      }

      const walletBalance = await (async () => {
        try {
          const balance = await api.balance.findOut(accountId);
          return balance.toBigInt();
        } catch {
          return null;
        }
      })();

      if (walletBalance === null || walletBalance > 0n) {
        const balanceText = walletBalance === null ? "wallet balance" : `${formatVaraAmount(walletBalance)} VARA`;
        setSubmitMessage(`Confirm a wallet-paid transaction from ${shortAddress(accountId)} (${balanceText}).`);
        const result = await sendTx();
        await result.response();
        await refreshChainState();
        setSubmittedSessionId(sessionId);
        setSubmitStatus("success");
        setSubmitMessage("Score submitted from wallet balance.");
        return;
      }

      throw new Error(
        `Wallet ${shortAddress(accountId)} has no spendable VARA. Top up or wait ${formatNextVoucherWait()} for the next voucher window.`,
      );
    } catch (error: unknown) {
      setSubmitStatus("error");
      setSubmitMessage(
        isSignatureRejection(error)
          ? "Signature rejected. Retry when you are ready to sign the score submission."
          : `Submit failed: ${formatError(error)}`,
      );
    }
  }, [account, api, isApiReady, programId, refreshChainState, sailsClient, voucherBackendUrl]);

  useEffect(() => {
    if (!pendingRun || !playAccess.canPlay || submittedSessionId === gameSessionId || submitStatus === "pending") {
      return;
    }

    if (autoSubmitSessionRef.current === gameSessionId) {
      return;
    }

    autoSubmitSessionRef.current = gameSessionId;
    void submitRun(pendingRun, gameSessionId);
  }, [gameSessionId, pendingRun, playAccess.canPlay, submitRun, submitStatus, submittedSessionId]);

  return (
    <section className="za-card za-chain-panel" aria-label="On-chain leaderboard">
      <div className="za-panel-head">
        <div>
          <p className="za-card-kicker">Wallet & Leaderboard</p>
          <h2>Vara Relay</h2>
        </div>
        {survivorsCount !== null && <span className="za-chip">{survivorsCount} survivors ranked</span>}
      </div>

      <WalletGate onConnectionChange={setWalletConnected} />

      <div className="za-connection-state">
        <strong>{playAccess.title}</strong>
        <p>{playAccess.description}</p>
      </div>

      <section className="za-voucher-box" aria-label="Gas voucher status">
        <h3>Gas voucher</h3>
        <div className="za-stat-row">
          <span>Status</span>
          <strong>{voucherStatus}</strong>
        </div>
        <div className="za-stat-row">
          <span>Backend</span>
          <strong>{voucherBackendUrl ? "Connected" : "Missing"}</strong>
        </div>
        <p className="za-note">{voucherMessage}</p>
      </section>

      {pendingRun && (
        <section className="za-submit-box" aria-label="Score submission">
          <h3>Last run</h3>
          <div className="za-stat-row">
            <span>Score</span>
            <strong>{pendingRun.score.toLocaleString()}</strong>
          </div>
          <div className="za-stat-row">
            <span>Survival</span>
            <strong>{pendingRun.survivalSeconds}s</strong>
          </div>
          <div className="za-stat-row">
            <span>Kills</span>
            <strong>{pendingRun.kills}</strong>
          </div>
          <p className={`za-note za-note--${submitStatus}`}>{submitMessage || "The next run unlocks after this result is submitted."}</p>
          {submitStatus === "error" && (
            <button
              className="za-button za-button--secondary"
              type="button"
              onClick={() => void submitRun(pendingRun, gameSessionId)}
            >
              Retry submit
            </button>
          )}
        </section>
      )}

      {chainStatusMessage && <p className="za-note za-note--error">{chainStatusMessage}</p>}

      <section className="za-player-chain" aria-label="Player chain stats">
        <div>
          <span>Chain best</span>
          <strong>{playerBest !== null ? playerBest.toLocaleString() : "—"}</strong>
        </div>
        <div>
          <span>Rank</span>
          <strong>{playerRank !== null ? `#${playerRank}` : "—"}</strong>
        </div>
      </section>

      <section className="za-leaderboard" aria-label="Leaderboard">
        <div className="za-panel-head za-panel-head--compact">
          <div>
            <p className="za-card-kicker">Top Survivors</p>
            <h3>Best scores</h3>
          </div>
        </div>

        <ol className="za-leaderboard-list">
          {leaderboardTop.map((entry, index) => (
            <li
              key={`${entry.player || entry.name}-${index}`}
              className={`za-leaderboard-row${entry.name === CURRENT_PLAYER_NAME ? " za-leaderboard-row--you" : ""}`}
            >
              <span>{index + 1}</span>
              <strong>{entry.name}</strong>
              <em>{entry.score.toLocaleString()}</em>
            </li>
          ))}
          {leaderboardTop.length === 0 && <li className="za-empty">No survivor has uploaded a score yet.</li>}
        </ol>
      </section>
    </section>
  );
}
