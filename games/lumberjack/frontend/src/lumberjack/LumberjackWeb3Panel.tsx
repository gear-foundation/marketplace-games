import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useApi } from "@gear-js/react-hooks";
import { Wallet } from "@gear-js/wallet-connect";
import type { Sails } from "sails-js";
import "@gear-js/ui/dist/index.css";
import "@gear-js/vara-ui/dist/style.css";
import "@gear-js/wallet-connect/dist/style.css";
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
import type { RunStatus, RunSummary } from "./game/engine";

const VARA_PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || "";
const VOUCHER_BACKEND_URL = (import.meta.env.VITE_VOUCHER_BACKEND_URL || "").replace(/\/+$/, "");
const VISIBLE_LEADERBOARD_LIMIT = 5;
const CURRENT_PLAYER_NAME = "YOU";

const initialLeaderboardTop: LeaderboardEntry[] = [
  { name: "AXE", branches: 64 },
  { name: "CHOP", branches: 52 },
  { name: "VARA", branches: 46 },
  { name: "LOGS", branches: 39 },
  { name: "SAILS", branches: 31 },
];

type LumberjackWeb3PanelProps = {
  runSummary: RunSummary | null;
  runMessage: string;
  submittedRunId: string | null;
  hasUnsubmittedRun: boolean;
  status: RunStatus;
  onStartRun: () => void;
  onRunSubmitted: (runId: string) => void;
  onWalletConnectionChange: (connected: boolean) => void;
};

export default function LumberjackWeb3Panel(props: LumberjackWeb3PanelProps) {
  return <LumberjackWeb3PanelContent {...props} />;
}

function LumberjackWeb3PanelContent({
  runSummary,
  runMessage,
  submittedRunId,
  hasUnsubmittedRun,
  status,
  onStartRun,
  onRunSubmitted,
  onWalletConnectionChange,
}: LumberjackWeb3PanelProps) {
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
  const autoSubmittedRunIdRef = useRef<string | null>(null);

  const programId = useMemo(() => getConfiguredProgramId(VARA_PROGRAM_ID), []);
  const voucherBackendUrl = useMemo(() => getConfiguredBackendUrl(VOUCHER_BACKEND_URL), []);
  const connectedAccountAddress = account?.decodedAddress || account?.address || "";
  const shouldShowCurrentPlayerRank =
    currentPlayerRank !== null && currentPlayerRank > VISIBLE_LEADERBOARD_LIMIT && currentPlayerEntry !== null;

  const submitDisabledReason = useMemo(() => {
    if (!runSummary) return "finish a run first";
    if (!isApiReady || !api) return "network is connecting";
    if (!programId) return "lumberjack program id is not configured";
    if (!voucherBackendUrl) return "voucher backend is not configured";
    if (!sailsClient) return chainStatusMessage || "contract client is loading";
    if (!isAccountReady) return "wallets are still loading";
    if (!connectedAccountAddress) return "wallet required";
    return "";
  }, [
    api,
    chainStatusMessage,
    connectedAccountAddress,
    isAccountReady,
    isApiReady,
    programId,
    runSummary,
    sailsClient,
    voucherBackendUrl,
  ]);
  const playDisabledReason = useMemo(() => {
    if (!isAccountReady) return "wallets are still loading";
    if (!connectedAccountAddress) return "connect wallet to play";
    return "";
  }, [connectedAccountAddress, isAccountReady]);

  useEffect(() => {
    onWalletConnectionChange(Boolean(connectedAccountAddress));
  }, [connectedAccountAddress, onWalletConnectionChange]);

  useEffect(() => {
    setSubmitStatus("idle");
    setSubmitMessage("");
  }, [runSummary?.runId]);

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

      const [rankResult, bestBranchesResult] = await Promise.all([
        game.queries.PlayerRank(account.decodedAddress).withAddress(account.decodedAddress).call(),
        game.queries.PlayerBestBranches(account.decodedAddress).withAddress(account.decodedAddress).call(),
      ]);
      const rank = unwrapOption<unknown>(rankResult);
      const bestBranches = toDisplayNumber(bestBranchesResult);

      setCurrentPlayerRank(rank === null ? null : toDisplayNumber(rank));
      setCurrentPlayerEntry(
        bestBranches > 0
          ? {
              name: CURRENT_PLAYER_NAME,
              branches: bestBranches,
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

  const refreshVoucherState = useCallback(async () => {
    if (!voucherBackendUrl || !programId || !account?.decodedAddress) {
      setVoucherMessage(voucherBackendUrl ? "" : "Voucher backend is not configured yet.");
      return;
    }

    try {
      const state = await getVoucherState(voucherBackendUrl, account.decodedAddress);
      setVoucherMessage(describeVoucher(state, programId));
    } catch (error) {
      setVoucherMessage(`Voucher unavailable · ${formatError(error)}`);
    }
  }, [account?.decodedAddress, programId, voucherBackendUrl]);

  useEffect(() => {
    void refreshVoucherState();
  }, [refreshVoucherState]);

  const submitRunOnChain = useCallback(async () => {
    if (submitDisabledReason || !runSummary || !account || !sailsClient || !api) {
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
    const configuredProgramId = programId;
    if (!configuredProgramId) {
      setSubmitStatus("error");
      setSubmitMessage("lumberjack program id is not configured");
      return;
    }

    const send = async (voucherId?: `0x${string}`) => {
      const tx = game.functions.SubmitRun(runSummary.logs);
      tx.withAccount(submitAccountId, { signer: account.signer }).withValue(0n);
      if (voucherId) tx.withVoucher(voucherId);
      await tx.calculateGas(false, 20);
      const result = await tx.signAndSend();
      const reply = (await result.response()) as { improved?: boolean };
      return { result, reply };
    };

    const getWalletBalance = async () => {
      const balance = await api.balance.findOut(submitAccountId);
      return balance.toBigInt();
    };

    const submitWithWalletBalance = async (walletBalance: bigint | null) => {
      const walletBalanceText = walletBalance === null ? "wallet balance" : `${formatVaraAmount(walletBalance)} VARA available`;
      setSubmitMessage(
        `Voucher cannot pay this transaction. Confirm wallet payment from ${shortAddress(submitAccountId)} (${walletBalanceText}).`,
      );

      try {
        const { result, reply } = await send();
        onRunSubmitted(runSummary.runId);
        setSubmitStatus("success");
        setSubmitMessage(
          `${reply.improved ? "Best run updated" : "Run submitted; best run unchanged"} · paid with wallet balance · tx ${shortAddress(
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
      setSubmitMessage("Requesting gas voucher for this lumberjack result.");

      let activeVoucher: VoucherResult | null = null;

      try {
        const voucher = await ensureVoucher(voucherBackendUrl, submitAccountId, configuredProgramId);
        activeVoucher = voucher;
        setVoucherMessage(
          `${voucher.source === "issued" ? "Voucher issued" : "Voucher ready"} · ${voucher.balanceText} · ${shortAddress(voucher.voucherId)}`,
        );

        setSubmitMessage("Confirm the result transaction in your wallet extension. Gas is covered by voucher.");
        const { result, reply } = await send(voucher.voucherId);
        onRunSubmitted(runSummary.runId);
        setSubmitStatus("success");
        setSubmitMessage(`${reply.improved ? "Best run updated" : "Run submitted; best run unchanged"} · tx ${shortAddress(result.txHash)}`);
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
            setVoucherMessage(`Voucher revoke failed · ${formatError(revokeError)}`);
          }
        } else {
          setVoucherMessage(`Voucher cancelled for this submit · ${formatError(error)}`);
        }
      }

      setSubmitMessage("Voucher cannot pay this transaction. Checking wallet balance.");
      const fallbackWalletBalance = await getWalletBalance().catch(() => null);
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
          ? "Signature required to submit this run."
          : `On-chain submit failed: ${formatError(error)}`,
      );
    }
  }, [
    account,
    api,
    onRunSubmitted,
    programId,
    refreshChainState,
    refreshVoucherState,
    runSummary,
    sailsClient,
    submitDisabledReason,
    voucherBackendUrl,
  ]);

  useEffect(() => {
    if (!runSummary) return;
    if (autoSubmittedRunIdRef.current === runSummary.runId) return;
    if (submitDisabledReason || submitStatus === "pending" || submittedRunId === runSummary.runId) return;

    autoSubmittedRunIdRef.current = runSummary.runId;
    void submitRunOnChain();
  }, [runSummary, submitDisabledReason, submitRunOnChain, submittedRunId, submitStatus]);

  const resultMessage = submitMessage || runMessage || submitDisabledReason || "Run result is ready to submit.";
  const isCurrentRunSubmitted = runSummary !== null && submittedRunId === runSummary.runId;
  const primaryActionLabel = hasUnsubmittedRun ? (submitStatus === "pending" ? "Signing..." : "Sign result") : "Run";
  const primaryActionDisabled = hasUnsubmittedRun
    ? submitStatus === "pending"
    : Boolean(playDisabledReason) || status === "playing";

  return (
    <>
      <div className="wallet-widget" aria-label="Wallet connection">
        <Wallet theme="vara" displayBalance={false} />
      </div>

      <button
        className="lumberjack-primary"
        type="button"
        onClick={hasUnsubmittedRun ? submitRunOnChain : onStartRun}
        disabled={primaryActionDisabled}
      >
        {primaryActionLabel}
      </button>
      {!hasUnsubmittedRun && playDisabledReason && <p className="lumberjack-empty">{playDisabledReason}</p>}
      {hasUnsubmittedRun && submitStatus !== "pending" && submitDisabledReason && (
        <p className="lumberjack-empty">{submitDisabledReason}</p>
      )}

      <section className="lumberjack-result" aria-label="Run result">
        <h2>Run Result</h2>
        {runSummary ? (
          <>
            <dl>
              <div>
                <dt>Branches</dt>
                <dd>{runSummary.logs}</dd>
              </div>
            </dl>
            <p className={`lumberjack-note ${submitStatus}`}>
              {isCurrentRunSubmitted && submitStatus === "idle" ? "Run result already submitted." : resultMessage}
            </p>
          </>
        ) : (
          <p className="lumberjack-empty">{runMessage || "Finish a run to prepare an on-chain result."}</p>
        )}
      </section>

      <section className="lumberjack-result" aria-label="Gas voucher">
        <h2>Gas Voucher</h2>
        <p className="lumberjack-empty">{voucherMessage || "Voucher will be requested after a run."}</p>
      </section>

      <section className="lumberjack-leaderboard" aria-label="Leaderboard">
        <h2>Leaderboard</h2>
        {chainStatusMessage && <p className="lumberjack-empty">{chainStatusMessage}</p>}
        {leaderboardTop.map((entry, index) => (
          <div className={`lumberjack-row${entry.name === CURRENT_PLAYER_NAME ? " is-current" : ""}`} key={`${entry.name}-${index}`}>
            <span>{index + 1}</span>
            <strong>{entry.name}</strong>
            <em>{entry.branches} branches</em>
          </div>
        ))}
        {shouldShowCurrentPlayerRank && currentPlayerEntry && currentPlayerRank !== null && (
          <div className="lumberjack-row is-current">
            <span>{currentPlayerRank}</span>
            <strong>{currentPlayerEntry.name}</strong>
            <em>{currentPlayerEntry.branches} branches</em>
          </div>
        )}
      </section>
    </>
  );
}
