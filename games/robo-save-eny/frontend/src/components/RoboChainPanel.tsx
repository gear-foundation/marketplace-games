import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useApi } from "@gear-js/react-hooks";
import { Wallet } from "@gear-js/wallet-connect";
import type { Sails } from "sails-js";
import type { LevelCompletion } from "../game/types";
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
  formatVaraAmount,
  isInsufficientBalanceError,
  isSignatureRejection,
  PLANCK_PER_VARA,
  parsePlanck,
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

const VARA_PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || "";
const VOUCHER_BACKEND_URL = (import.meta.env.VITE_VOUCHER_BACKEND_URL || "").replace(/\/+$/, "");
const VISIBLE_LEADERBOARD_LIMIT = 5;
const CURRENT_PLAYER_NAME = "YOU";
const MIN_SUBMIT_BALANCE = 2n * PLANCK_PER_VARA;

type RoboChainPanelProps = {
  lastCompletion: LevelCompletion | null;
};

const initialLeaderboardTop: LeaderboardEntry[] = [
  { name: "ROBO", score: 42_500 },
  { name: "ENY", score: 38_800 },
  { name: "LASR", score: 34_200 },
  { name: "GEAR", score: 29_900 },
  { name: "SAFE", score: 25_000 },
];

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
  const value = parsePlanck(state.varaBalance);
  return state.balanceKnown !== false && value !== null && value <= 0n;
}

function hasUsableVoucher(state: VoucherState, programId: `0x${string}`) {
  return hasVoucherProgramAccess(state, programId) && !isVoucherExpired(state.validUpTo) && !isVoucherDrained(state);
}

export function RoboChainPanel({ lastCompletion }: RoboChainPanelProps) {
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

  const programId = useMemo(() => getConfiguredProgramId(VARA_PROGRAM_ID), []);
  const voucherBackendUrl = useMemo(() => getConfiguredBackendUrl(VOUCHER_BACKEND_URL), []);
  const connectedAccountAddress = account?.decodedAddress || account?.address || "";
  const isSubmittedForCompletion = Boolean(lastCompletion && submittedSessionId === lastCompletion.sessionId);

  useEffect(() => {
    setSubmitStatus("idle");
    setSubmitMessage("");
  }, [lastCompletion?.sessionId]);

  useEffect(() => {
    setSailsClient(null);
    if (!isApiReady || !programId) return undefined;

    let cancelled = false;
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
      if (!api) throw new Error("network is connecting");
      const balance = await api.balance.findOut(address);
      return balance.toBigInt();
    },
    [api],
  );

  const refreshVoucherState = useCallback(async () => {
    if (!connectedAccountAddress || !voucherBackendUrl || !programId) {
      setVoucherMessage("");
      return;
    }

    try {
      const state = await getVoucherState(voucherBackendUrl, connectedAccountAddress);
      setVoucherMessage(
        hasUsableVoucher(state, programId)
          ? describeVoucher(state, programId)
          : "Voucher will be requested when you submit a completed rescue score.",
      );
    } catch (error) {
      setVoucherMessage(
        isFetchFailure(error)
          ? "Voucher backend is unreachable from this frontend session."
          : `Voucher state unavailable: ${formatError(error)}`,
      );
    }
  }, [connectedAccountAddress, programId, voucherBackendUrl]);

  useEffect(() => {
    void refreshVoucherState();
  }, [refreshVoucherState]);

  const submitDisabledReason = useMemo(() => {
    if (!lastCompletion) return "complete a level first";
    if (isSubmittedForCompletion) return "latest rescue score already submitted";
    if (!programId) return "set VITE_PROGRAM_ID after deploying the contract";
    if (!isApiReady || !api) return "network is connecting";
    if (!sailsClient) return chainStatusMessage || "contract client is loading";
    if (!isAccountReady) return "wallets are still loading";
    if (!connectedAccountAddress || !account) return "connect wallet";
    return "";
  }, [
    account,
    api,
    chainStatusMessage,
    connectedAccountAddress,
    isAccountReady,
    isApiReady,
    isSubmittedForCompletion,
    lastCompletion,
    programId,
    sailsClient,
  ]);

  const submitScoreOnChain = useCallback(async () => {
    if (submitDisabledReason || !lastCompletion || !account || !api || !sailsClient) {
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
    const score = lastCompletion.score;

    const send = async (voucherId?: `0x${string}`) => {
      const tx = game.functions.SubmitScore(score);
      tx.withAccount(submitAccountId, { signer: account.signer }).withValue(0n);
      if (voucherId) tx.withVoucher(voucherId);
      await tx.calculateGas(false, 20);
      const result = await tx.signAndSend();
      const reply = (await result.response()) as { improved?: boolean };
      return { result, reply };
    };

    const submitWithWalletBalance = async (walletBalance: bigint | null) => {
      const walletBalanceText = walletBalance === null ? "wallet balance" : `${formatVaraAmount(walletBalance)} VARA available`;
      setSubmitMessage(`Confirm wallet payment from ${shortAddress(submitAccountId)} (${walletBalanceText}).`);

      try {
        const { result, reply } = await send();
        setSubmittedSessionId(lastCompletion.sessionId);
        setSubmitStatus("success");
        setSubmitMessage(
          `${reply.improved ? "Best rescue score updated" : "Score submitted; best unchanged"} · tx ${shortAddress(
            result.txHash,
          )}`,
        );
        await refreshVoucherState();
        await refreshChainState();
      } catch (error) {
        if (isSignatureRejection(error)) throw error;
        if (isInsufficientBalanceError(error)) {
          throw new Error(
            `Voucher cannot pay this transaction, and wallet payment from ${shortAddress(
              submitAccountId,
            )} failed because balance is too low. Top up VARA, or come back in ${formatNextVoucherWait()}.`,
          );
        }
        throw error;
      }
    };

    try {
      setSubmitStatus("pending");

      if (!voucherBackendUrl || !programId) {
        setSubmitMessage(`Confirm ${score.toLocaleString()} rescue points in your wallet extension.`);
        await submitWithWalletBalance(null);
        return;
      }

      let activeVoucher: VoucherResult | null = null;
      try {
        const voucher = await ensureVoucher(voucherBackendUrl, submitAccountId, programId);
        activeVoucher = voucher;
        setVoucherMessage(
          `${voucher.source === "issued" ? "Voucher issued" : "Voucher ready"} · ${voucher.balanceText} · ${shortAddress(voucher.voucherId)}`,
        );

        setSubmitMessage("Confirm score submission. Gas is covered by voucher.");
        const { result, reply } = await send(voucher.voucherId);
        setSubmittedSessionId(lastCompletion.sessionId);
        setSubmitStatus("success");
        setSubmitMessage(
          `${reply.improved ? "Best rescue score updated" : "Score submitted; best unchanged"} · tx ${shortAddress(
            result.txHash,
          )}`,
        );
        await refreshVoucherState();
        await refreshChainState();
        return;
      } catch (error) {
        if (isSignatureRejection(error)) throw error;

        if (activeVoucher) {
          setSubmitMessage("Voucher cannot pay this transaction. Revoking voucher.");
          try {
            await revokeVoucher(voucherBackendUrl, submitAccountId, activeVoucher.voucherId);
            setVoucherMessage(`Voucher revoked · ${shortAddress(activeVoucher.voucherId)}`);
          } catch (revokeError) {
            setVoucherMessage(`Voucher revoke failed · ${formatError(revokeError)}`);
          }
        } else {
          setVoucherMessage(`Voucher unavailable · ${formatError(error)}`);
        }
      }

      const fallbackWalletBalance = await getWalletBalance(submitAccountId).catch(() => null);
      if (fallbackWalletBalance === null || fallbackWalletBalance >= MIN_SUBMIT_BALANCE) {
        await submitWithWalletBalance(fallbackWalletBalance);
        return;
      }

      throw new Error(
        `Wallet ${shortAddress(submitAccountId)} has ${formatVaraAmount(
          fallbackWalletBalance,
        )} VARA. Top up to at least 2 VARA or wait ${formatNextVoucherWait()} for a fresh voucher.`,
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
    getWalletBalance,
    lastCompletion,
    programId,
    refreshChainState,
    refreshVoucherState,
    sailsClient,
    submitDisabledReason,
    voucherBackendUrl,
  ]);

  const chainBestScore = currentPlayerEntry?.score ?? 0;
  const shouldShowCurrentPlayerRank =
    currentPlayerRank !== null && currentPlayerRank > VISIBLE_LEADERBOARD_LIMIT && currentPlayerEntry !== null;

  return (
    <section className="chain-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Vara Session</p>
          <h2>Leaderboard</h2>
        </div>
        <div className="wallet-widget">
          <Wallet theme="vara" displayBalance={false} />
        </div>
      </div>

      <div className="chain-stats">
        <span>
          Last Score <strong>{lastCompletion?.score.toLocaleString() ?? "none"}</strong>
        </span>
        <span>
          Chain Best <strong>{chainBestScore.toLocaleString()}</strong>
        </span>
      </div>

      <button className="primary-button chain-submit" type="button" onClick={submitScoreOnChain} disabled={Boolean(submitDisabledReason) || submitStatus === "pending"}>
        {submitStatus === "pending" ? "Submitting..." : isSubmittedForCompletion ? "Submitted" : "Submit Score"}
      </button>

      <p className={`chain-note ${submitStatus}`}>
        {submitMessage || submitDisabledReason || "Complete a rescue mission, then submit the score on Vara."}
      </p>
      <p className="chain-note">{voucherMessage || "Voucher state appears here after wallet connection."}</p>
      {chainStatusMessage ? <p className="chain-note error">{chainStatusMessage}</p> : null}

      <div className="leaderboard-list">
        {leaderboardTop.map((entry, index) => (
          <div className={`leaderboard-row${entry.name === CURRENT_PLAYER_NAME ? " is-current" : ""}`} key={`${entry.name}-${index}`}>
            <span>{index + 1}</span>
            <strong>{entry.name}</strong>
            <em>{entry.score.toLocaleString()}</em>
          </div>
        ))}
        {shouldShowCurrentPlayerRank && currentPlayerEntry && currentPlayerRank !== null ? (
          <div className="leaderboard-row is-current">
            <span>{currentPlayerRank}</span>
            <strong>{currentPlayerEntry.name}</strong>
            <em>{currentPlayerEntry.score.toLocaleString()}</em>
          </div>
        ) : null}
      </div>
    </section>
  );
}
