import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useApi } from "@gear-js/react-hooks";
import { Wallet } from "@gear-js/wallet-connect";
import type { Sails } from "sails-js";
import type { GameStatus } from "../game/types";
import contractIdl from "../idl/contract.idl?raw";
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
  PLANCK_PER_VARA,
  formatVaraAmount,
  isInsufficientBalanceError,
  parsePlanck,
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
  type VoucherState,
} from "../shared/voucher";

const DEFAULT_PROGRAM_ID = "0xbf54fe438121510a6e435686eb255af9106d5e74e5c0593142a7a9de29dad78f";
const VARA_PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || DEFAULT_PROGRAM_ID;
const VOUCHER_BACKEND_URL = (import.meta.env.VITE_VOUCHER_BACKEND_URL || "").replace(/\/+$/, "");
const VISIBLE_LEADERBOARD_LIMIT = 5;
const CURRENT_PLAYER_NAME = "YOU";
const MIN_PLAY_BALANCE = 2n * PLANCK_PER_VARA;

const initialLeaderboardTop: LeaderboardEntry[] = [
  { name: "REEF", score: 1280 },
  { name: "TIDE", score: 960 },
  { name: "EEL", score: 720 },
  { name: "KELP", score: 540 },
  { name: "HOOK", score: 360 },
];

export type DeepSeaPlayAccess = {
  canPlay: boolean;
  title: string;
  description: string;
};

type DeepSeaChainPanelProps = {
  score: number;
  status: GameStatus;
  gameSessionId: number;
  onPlayAccessChange?: (state: DeepSeaPlayAccess) => void;
  onSessionSubmitStateChange?: (submitted: boolean) => void;
};

function isFetchFailure(error: unknown) {
  const message = formatError(error).toLowerCase();
  return message.includes("failed to fetch") || message.includes("networkerror");
}

function hasVoucherProgramAccess(state: VoucherState, programId: `0x${string}`) {
  return Boolean(
    state.voucherId &&
      /^0x[0-9a-fA-F]{64}$/.test(state.voucherId) &&
      state.programs?.some((program) => program.toLowerCase() === programId.toLowerCase()),
  );
}

function isVoucherExpired(validUpTo: string | null | undefined) {
  if (!validUpTo) return false;
  const expiresAt = Date.parse(validUpTo);
  return Number.isFinite(expiresAt) ? expiresAt <= Date.now() : false;
}

function isVoucherDrained(state: VoucherState) {
  const balance = parsePlanck(state.varaBalance);
  return state.balanceKnown !== false && balance !== null && balance <= 0n;
}

function hasUsableVoucher(state: VoucherState, programId: `0x${string}`) {
  return hasVoucherProgramAccess(state, programId) && !isVoucherExpired(state.validUpTo) && !isVoucherDrained(state);
}

export function DeepSeaChainPanel({
  score,
  status,
  gameSessionId,
  onPlayAccessChange,
  onSessionSubmitStateChange,
}: DeepSeaChainPanelProps) {
  const { account, isAccountReady } = useAccount();
  const { api, isApiReady } = useApi();

  const [leaderboardTop, setLeaderboardTop] = useState(initialLeaderboardTop);
  const [currentPlayerRank, setCurrentPlayerRank] = useState<number | null>(null);
  const [currentPlayerEntry, setCurrentPlayerEntry] = useState<LeaderboardEntry | null>(null);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [voucherMessage, setVoucherMessage] = useState("");
  const [chainStatusMessage, setChainStatusMessage] = useState("");
  const [sailsClient, setSailsClient] = useState<Sails | null>(null);
  const [submittedSessionId, setSubmittedSessionId] = useState<number | null>(null);
  const [playAccess, setPlayAccess] = useState<DeepSeaPlayAccess>({
    canPlay: false,
    title: "Loading wallet",
    description: "Wallet providers are still loading. The reef unlocks as soon as a wallet becomes available.",
  });

  const programId = useMemo(() => getConfiguredProgramId(VARA_PROGRAM_ID), []);
  const voucherBackendUrl = useMemo(() => getConfiguredBackendUrl(VOUCHER_BACKEND_URL), []);
  const connectedAccountAddress = account?.decodedAddress || account?.address || "";
  const finalRunScore = status === "over" ? score : 0;
  const isSubmittedForCurrentSession = submittedSessionId === gameSessionId;
  const shouldShowCurrentPlayerRank =
    currentPlayerRank !== null && currentPlayerRank > VISIBLE_LEADERBOARD_LIMIT && currentPlayerEntry !== null;

  const submitDisabledReason = useMemo(() => {
    if (!playAccess.canPlay) return playAccess.description || "wallet access is still locked";
    if (status !== "over") return "finish the current dive first";
    if (isSubmittedForCurrentSession) return "score already submitted for this dive";
    if (finalRunScore <= 0) return "score some points first";
    if (!isApiReady || !api) return "network is connecting";
    if (!programId) return "Deep Sea Feast program id is not configured";
    if (!sailsClient) return chainStatusMessage || "contract client is loading";
    if (!isAccountReady) return "wallets are still loading";
    if (!connectedAccountAddress) return "wallet required";
    return "";
  }, [
    api,
    chainStatusMessage,
    connectedAccountAddress,
    finalRunScore,
    isAccountReady,
    isApiReady,
    isSubmittedForCurrentSession,
    playAccess,
    programId,
    sailsClient,
    status,
  ]);

  useEffect(() => {
    onPlayAccessChange?.(playAccess);
  }, [onPlayAccessChange, playAccess]);

  useEffect(() => {
    onSessionSubmitStateChange?.(isSubmittedForCurrentSession);
  }, [isSubmittedForCurrentSession, onSessionSubmitStateChange]);

  useEffect(() => {
    setSubmittedSessionId(null);
    setSubmitStatus("idle");
    setSubmitMessage("");
  }, [gameSessionId]);

  useEffect(() => {
    if (isSubmittedForCurrentSession || submitStatus === "pending") {
      return;
    }

    setSubmitStatus("idle");
    setSubmitMessage("");
  }, [finalRunScore, isSubmittedForCurrentSession, submitStatus]);

  useEffect(() => {
    let isCancelled = false;

    setSailsClient(null);
    if (!isApiReady || !programId) return undefined;

    createSailsClient(api, programId, contractIdl)
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
      setLeaderboardTop(mapChainLeaderboard(topEntries, CURRENT_PLAYER_NAME, account?.decodedAddress));

      if (!account?.decodedAddress) {
        setCurrentPlayerRank(null);
        setCurrentPlayerEntry(null);
        setChainStatusMessage("");
        return;
      }

      const [rankResult, bestScoreResult] = await Promise.all([
        game.queries.PlayerRank(account.decodedAddress).withAddress(account.decodedAddress).call(),
        game.queries.PlayerBestScore(account.decodedAddress).withAddress(account.decodedAddress).call(),
      ]);
      const rank = unwrapOption<unknown>(rankResult);
      const chainBestScore = toDisplayNumber(bestScoreResult);

      setCurrentPlayerRank(rank === null ? null : toDisplayNumber(rank));
      setCurrentPlayerEntry(
        chainBestScore > 0
          ? {
              name: CURRENT_PLAYER_NAME,
              score: chainBestScore,
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

  const getWalletBalance = useCallback(
    async (address: string) => {
      if (!api) {
        throw new Error("network is connecting");
      }

      const balance = await api.balance.findOut(address);
      return balance.toBigInt();
    },
    [api],
  );

  const refreshVoucherState = useCallback(async () => {
    if (!isAccountReady) {
      setVoucherMessage("");
      setPlayAccess({
        canPlay: false,
        title: "Loading wallet",
        description: "Wallet providers are still loading. The reef unlocks as soon as a wallet becomes available.",
      });
      return;
    }

    if (!connectedAccountAddress) {
      setVoucherMessage("");
      setPlayAccess({
        canPlay: false,
        title: "Connect wallet",
        description: "Connect your Vara wallet in the panel to unlock the reef and start playing.",
      });
      return;
    }

    if (!isApiReady || !api) {
      setVoucherMessage("Connecting to the Vara network before checking voucher access.");
      setPlayAccess({
        canPlay: false,
        title: "Connecting network",
        description: "Connecting to Vara and checking whether your wallet can play with a voucher or wallet balance.",
      });
      return;
    }

    if (!programId) {
      setVoucherMessage("Deep Sea Feast program id is not configured.");
      setPlayAccess({
        canPlay: false,
        title: "Program unavailable",
        description: "Deep Sea Feast program id is missing, so voucher access cannot be verified.",
      });
      return;
    }

    const unlockWithWalletBalance = async (baseMessage: string, allowNextDayReturn: boolean) => {
      try {
        const walletBalance = await getWalletBalance(connectedAccountAddress);
        const walletBalanceText = `${formatVaraAmount(walletBalance)} VARA`;
        const hasEnoughForPlay = walletBalance >= MIN_PLAY_BALANCE;

        setVoucherMessage(`${baseMessage} · wallet balance ${walletBalanceText}`);
        setPlayAccess(
          hasEnoughForPlay
            ? {
                canPlay: true,
                title: "",
                description: "",
              }
            : {
                canPlay: false,
                title: "Low balance",
                description: allowNextDayReturn
                  ? `${baseMessage} Your wallet has ${walletBalanceText}. Top up to at least 2 VARA, or come back in ${formatNextVoucherWait()} when the next daily voucher can be issued.`
                  : `${baseMessage} Your wallet has ${walletBalanceText}. Top up to at least 2 VARA to cover transaction fees.`,
              },
        );
      } catch (error) {
        setVoucherMessage(`${baseMessage} · wallet balance unavailable`);
        setPlayAccess({
          canPlay: false,
          title: "Balance check failed",
          description: `${baseMessage} Wallet balance could not be checked right now. Try reconnecting or retry in a moment.`,
        });
        if (!isFetchFailure(error)) {
          setChainStatusMessage((current) => current || `Wallet balance lookup failed: ${formatError(error)}`);
        }
      }
    };

    setPlayAccess({
      canPlay: false,
      title: "Checking access",
      description: "Checking your voucher and wallet balance before unlocking the reef.",
    });

    if (!voucherBackendUrl) {
      await unlockWithWalletBalance("Voucher backend is not configured for this frontend session.", false);
      return;
    }

    try {
      const state = await getVoucherState(voucherBackendUrl, connectedAccountAddress);

      if (hasUsableVoucher(state, programId)) {
        setVoucherMessage(describeVoucher(state, programId));
        setPlayAccess({ canPlay: true, title: "", description: "" });
        return;
      }

      const voucherUnavailableToday =
        state.revokedToday || (Boolean(state.fundedToday) && (isVoucherExpired(state.validUpTo) || isVoucherDrained(state)));

      if (voucherUnavailableToday) {
        const unavailableReason = state.revokedToday
          ? "Daily voucher already used today."
          : isVoucherExpired(state.validUpTo)
            ? "Today's voucher has expired."
            : "Today's voucher has no VARA left.";

        await unlockWithWalletBalance(unavailableReason, true);
        return;
      }

      const voucher = await ensureVoucher(voucherBackendUrl, connectedAccountAddress, programId);
      setVoucherMessage(
        `${voucher.source === "issued" ? "Voucher issued" : "Voucher ready"} · ${voucher.balanceText} · ${shortAddress(voucher.voucherId)}`,
      );
      setPlayAccess({ canPlay: true, title: "", description: "" });
    } catch (error) {
      const fallbackReason = isFetchFailure(error)
        ? "Voucher backend is unreachable from this frontend session."
        : `Voucher unavailable: ${formatError(error)}`;
      const allowNextDayReturn = /daily voucher already used/i.test(formatError(error));
      await unlockWithWalletBalance(fallbackReason, allowNextDayReturn);
    }
  }, [api, connectedAccountAddress, getWalletBalance, isAccountReady, isApiReady, programId, voucherBackendUrl]);

  useEffect(() => {
    void refreshVoucherState();
  }, [refreshVoucherState]);

  const submitScoreOnChain = useCallback(async () => {
    if (submitDisabledReason || !account || !sailsClient || !api || finalRunScore <= 0) {
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

    const submitAccountId = account.decodedAddress || account.address;

    const send = async (voucherId?: `0x${string}`) => {
      const tx = game.functions.SubmitScore(finalRunScore);
      tx.withAccount(submitAccountId, { signer: account.signer }).withValue(0n);
      if (voucherId) tx.withVoucher(voucherId);
      await tx.calculateGas(false, 20);
      const result = await tx.signAndSend();
      const reply = (await result.response()) as { improved?: boolean };
      return { result, reply };
    };

    const submitWithWalletBalance = async (walletBalance: bigint | null) => {
      const walletBalanceText = walletBalance === null ? "wallet balance" : `${formatVaraAmount(walletBalance)} VARA available`;
      setSubmitMessage(
        `Confirm wallet payment from ${shortAddress(submitAccountId)} to submit ${finalRunScore} points (${walletBalanceText}).`,
      );

      try {
        const { result, reply } = await send();
        setSubmittedSessionId(gameSessionId);
        setSubmitStatus("success");
        setSubmitMessage(
          `${reply.improved ? "Best score updated" : "Score submitted; best on-chain score unchanged"} · tx ${shortAddress(
            result.txHash,
          )}`,
        );
        await refreshVoucherState();
        await refreshChainState();
      } catch (error) {
        if (isSignatureRejection(error)) {
          throw error;
        }

        if (isInsufficientBalanceError(error)) {
          const balanceText =
            walletBalance === null ? "this wallet balance" : `this wallet balance (${formatVaraAmount(walletBalance)} VARA)`;
          throw new Error(
            `Voucher cannot pay this transaction, and wallet payment from ${shortAddress(
              submitAccountId,
            )} failed because ${balanceText} is too low to pay fees. Top up VARA to continue, or come back in ${formatNextVoucherWait()} for the next daily voucher.`,
          );
        }

        throw error;
      }
    };

    try {
      setSubmitStatus("pending");

      if (!voucherBackendUrl) {
        setSubmitMessage(`Confirm ${finalRunScore} points in your wallet extension.`);
        await submitWithWalletBalance(null);
        return;
      }

      if (!programId) {
        setSubmitStatus("error");
        setSubmitMessage("Deep Sea Feast program id is not configured");
        return;
      }

      setSubmitMessage("Requesting gas voucher for this Deep Sea Feast score.");

      let activeVoucher: VoucherResult | null = null;

      try {
        const voucher = await ensureVoucher(voucherBackendUrl, submitAccountId, programId);
        activeVoucher = voucher;
        setVoucherMessage(
          `${voucher.source === "issued" ? "Voucher issued" : "Voucher ready"} · ${voucher.balanceText} · ${shortAddress(voucher.voucherId)}`,
        );

        setSubmitMessage("Confirm the score transaction in your wallet extension. Gas is covered by voucher.");
        const { result, reply } = await send(voucher.voucherId);
        setSubmittedSessionId(gameSessionId);
        setSubmitStatus("success");
        setSubmitMessage(
          `${reply.improved ? "Best score updated" : "Score submitted; best on-chain score unchanged"} · tx ${shortAddress(
            result.txHash,
          )}`,
        );
        await refreshVoucherState();
        await refreshChainState();
        return;
      } catch (error) {
        if (isSignatureRejection(error)) {
          throw error;
        }

        if (activeVoucher) {
          setSubmitMessage("Voucher cannot pay this transaction. Revoking voucher.");
          try {
            await revokeVoucher(voucherBackendUrl, submitAccountId, activeVoucher.voucherId);
            setVoucherMessage(`Voucher revoked · ${shortAddress(activeVoucher.voucherId)}`);
          } catch (revokeError) {
            setVoucherMessage(
              isFetchFailure(revokeError)
                ? `Voucher revoke request is blocked from ${window.location.origin}. Check CORS/frontend origin settings.`
                : `Voucher revoke failed · ${formatError(revokeError)}`,
            );
          }
        } else {
          setVoucherMessage(
            isFetchFailure(error)
              ? `Voucher request is blocked from ${window.location.origin}. Check CORS/frontend origin settings.`
              : `Voucher cancelled for this submit · ${formatError(error)}`,
          );
        }
      }

      setSubmitMessage("Voucher cannot pay this transaction. Checking wallet balance.");
      const fallbackWalletBalance = await getWalletBalance(submitAccountId).catch(() => null);
      if (fallbackWalletBalance === null || fallbackWalletBalance > 0n) {
        await submitWithWalletBalance(fallbackWalletBalance);
        return;
      }

      throw new Error(
        `Voucher cannot pay this transaction, and wallet ${shortAddress(
          submitAccountId,
        )} has no spendable VARA. Top up VARA to continue, or come back in ${formatNextVoucherWait()} for the next daily voucher.`,
      );
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(
        isSignatureRejection(error)
          ? "Signature required to submit this score."
          : `On-chain submit failed: ${formatError(error)}`,
      );
    }
  }, [
    account,
    api,
    finalRunScore,
    gameSessionId,
    getWalletBalance,
    programId,
    refreshChainState,
    refreshVoucherState,
    sailsClient,
    submitDisabledReason,
    voucherBackendUrl,
  ]);

  const buttonLabel =
    submitStatus === "pending" ? "Submitting..." : isSubmittedForCurrentSession ? "Submitted For This Dive" : "Submit Score";
  const isSubmitDisabled = Boolean(submitDisabledReason) || submitStatus === "pending";
  const chainBestScore = currentPlayerEntry?.score ?? 0;
  const resultHint =
    submitMessage ||
    (status === "over"
      ? finalRunScore > 0
        ? "Dive over. Submit your score to unlock the next run."
        : "This dive ended without a score to submit."
      : "Submit unlocks only after the current dive ends.");

  return (
    <>
      <section className="reef-panel reef-chain-panel" aria-label="Wallet and chain">
        <div className="reef-wallet-widget" aria-label="Wallet connection">
          <Wallet theme="vara" displayBalance={false} />
        </div>

        <button className="reef-action" type="button" onClick={submitScoreOnChain} disabled={isSubmitDisabled}>
          {buttonLabel}
        </button>

        {submitDisabledReason && submitStatus !== "pending" ? <p className="reef-chain-empty">{submitDisabledReason}</p> : null}
        <p className={`reef-status-copy reef-chain-note reef-chain-note--${submitStatus}`}>{resultHint}</p>
      </section>

      <section className="reef-panel" aria-label="Gas voucher">
        <h2>Gas Voucher</h2>
        <p className="reef-status-copy reef-chain-note">
          {voucherMessage || "Voucher will be checked automatically as soon as the wallet connects."}
        </p>
      </section>

      <section className="reef-panel" aria-label="On-chain leaderboard">
        <h2>Leaderboard</h2>
        {chainStatusMessage ? <p className="reef-chain-empty">{chainStatusMessage}</p> : null}
        <div className="reef-chain-rows">
          {leaderboardTop.map((entry, index) => (
            <div className={`reef-chain-row${entry.name === CURRENT_PLAYER_NAME ? " is-current" : ""}`} key={`${entry.name}-${index}`}>
              <span>{index + 1}</span>
              <strong>{entry.name}</strong>
              <em>{entry.score.toLocaleString()} pts</em>
            </div>
          ))}
          {shouldShowCurrentPlayerRank && currentPlayerEntry && currentPlayerRank !== null ? (
            <div className="reef-chain-row is-current">
              <span>{currentPlayerRank}</span>
              <strong>{currentPlayerEntry.name}</strong>
              <em>{currentPlayerEntry.score.toLocaleString()} pts</em>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
