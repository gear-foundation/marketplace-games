import { useCallback, useRef, useState } from "react";
import { useAccount, useApi } from "@gear-js/react-hooks";
import type { Sails } from "sails-js";
import { formatError, formatVaraAmount, isInsufficientBalanceError, isSignatureRejection, shortAddress, formatNextVoucherWait } from "../shared/format";
import { parseSubmitOutcome, type SubmitOutcome } from "../shared/chain";
import { ensureVoucher, revokeVoucher, getConfiguredBackendUrl, type VoucherResult } from "../shared/voucher";
import type { GameEndPayload } from "../game/engine";

const VOUCHER_BACKEND_URL = (import.meta.env.VITE_VOUCHER_BACKEND_URL || "").replace(/\/+$/, "");

export type SubmitStatus = "idle" | "pending" | "success" | "error";

export type RunRecord = {
  runId: string;
  score: number;
  durationMs: number;
  outcome: SubmitOutcome | null;
};

function isFetchFailure(error: unknown) {
  const msg = formatError(error).toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("networkerror");
}

export function useSubmitScore(
  sailsClient: Sails | null,
  programId: `0x${string}` | "",
) {
  const { account } = useAccount();
  const { api, isApiReady } = useApi();

  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [voucherMessage, setVoucherMessage] = useState("");
  const [lastRun, setLastRun] = useState<RunRecord | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const submittedRunIdRef = useRef<string | null>(null);

  const voucherBackendUrl = getConfiguredBackendUrl(VOUCHER_BACKEND_URL);

  const canSubmit = Boolean(
    sailsClient &&
    programId &&
    isApiReady &&
    api &&
    account?.decodedAddress,
  );

  const submitScore = useCallback(async (payload: GameEndPayload, runId: string) => {
    if (submittedRunIdRef.current === runId) return;
    if (!sailsClient || !programId || !isApiReady || !api || !account) {
      setSubmitStatus("error");
      setSubmitMessage("Wallet or contract not ready. Score kept locally — retry below.");
      return;
    }

    const svc = sailsClient.services.NebulaBlasterService;
    if (!svc) {
      setSubmitStatus("error");
      setSubmitMessage("Contract service missing in IDL.");
      return;
    }

    const accountId = account.decodedAddress || account.address;

    const sendTx = async (vId?: `0x${string}`) => {
      const tx = svc.functions.SubmitScore(payload.score, payload.durationMs);
      tx.withAccount(accountId, { signer: account.signer }).withValue(0n);
      if (vId) tx.withVoucher(vId);
      await tx.calculateGas(false, 20);
      const result = await tx.signAndSend();
      const raw = await result.response();
      return { result, raw };
    };

    try {
      setSubmitStatus("pending");
      setSubmitMessage("Requesting gas voucher…");

      let activeVoucher: VoucherResult | null = null;

      if (voucherBackendUrl && programId) {
        try {
          const voucher = await ensureVoucher(voucherBackendUrl, accountId, programId);
          activeVoucher = voucher;
          setVoucherMessage(`${voucher.source === "issued" ? "Voucher issued" : "Voucher ready"} · ${voucher.balanceText} · ${shortAddress(voucher.voucherId)}`);
          setSubmitMessage("Confirm transaction in your wallet. Gas covered by voucher.");

          const { raw } = await sendTx(voucher.voucherId);
          finalize(raw, payload, runId);
          return;
        } catch (err) {
          if (isSignatureRejection(err)) throw err;

          if (activeVoucher) {
            try {
              await revokeVoucher(voucherBackendUrl, accountId, activeVoucher.voucherId);
              setVoucherMessage(`Voucher revoked · ${shortAddress(activeVoucher.voucherId)}`);
            } catch {
              setVoucherMessage("Voucher revoke failed.");
            }
          } else {
            setVoucherMessage(
              isFetchFailure(err)
                ? `Voucher request blocked from ${window.location.origin}. Check CORS settings.`
                : `Voucher unavailable · ${formatError(err)}`,
            );
          }
        }
      }

      // Wallet-balance fallback
      const walletBalance = await (async () => {
        try {
          const bal = await api.balance.findOut(accountId);
          return bal.toBigInt();
        } catch {
          return null;
        }
      })();

      if (walletBalance === null || walletBalance > 0n) {
        const balText = walletBalance === null ? "wallet balance" : `${formatVaraAmount(walletBalance)} VARA`;
        setSubmitMessage(`Confirm wallet payment from ${shortAddress(accountId)} (${balText}).`);
        const { raw } = await sendTx();
        finalize(raw, payload, runId);
        return;
      }

      throw new Error(
        `Wallet ${shortAddress(accountId)} has no spendable VARA. Top up or wait ${formatNextVoucherWait()} for the next daily voucher.`,
      );
    } catch (err) {
      setSubmitStatus("error");
      setSubmitMessage(
        isSignatureRejection(err)
          ? "Signature required to submit this run."
          : `Submit failed: ${formatError(err)}`,
      );
    }

    function finalize(raw: unknown, p: GameEndPayload, id: string) {
      const outcome = parseSubmitOutcome((raw as Record<string, unknown>)?.Ok ?? raw);
      submittedRunIdRef.current = id;
      setLastRun({ runId: id, score: p.score, durationMs: p.durationMs, outcome });
      setSubmitStatus("success");
      const msg = outcome?.newBest ? "New best score!" : "Score submitted.";
      setSubmitMessage(outcome ? `${msg} Rank: ${outcome.rankDaily !== null ? `#${outcome.rankDaily} today` : "unranked today"}` : msg);
      setRefetchTrigger((n) => n + 1);
    }
  }, [account, api, isApiReady, programId, sailsClient, voucherBackendUrl]);

  const retrySubmit = useCallback((payload: GameEndPayload, runId: string) => {
    submittedRunIdRef.current = null;
    void submitScore(payload, runId);
  }, [submitScore]);

  return {
    submitScore,
    retrySubmit,
    submitStatus,
    submitMessage,
    voucherMessage,
    lastRun,
    refetchTrigger,
    canSubmit,
  };
}
