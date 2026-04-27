import { Suspense, useCallback, useRef, useState } from "react";
import { AccountProvider, AlertProvider, ApiProvider } from "@gear-js/react-hooks";
import { Alert, alertStyles } from "@gear-js/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GameCanvas } from "./components/GameCanvas";
import { Leaderboard } from "./components/Leaderboard";
import { WalletGate } from "./components/WalletGate";
import { useNebulaProgram } from "./hooks/useNebulaProgram";
import { useSubmitScore } from "./hooks/useSubmitScore";
import type { GameEndPayload } from "./game/engine";

const APP_NAME = "Nebula Blaster";
const VARA_NODE_ADDRESS = import.meta.env.VITE_NODE_ADDRESS || "wss://rpc.vara.network";
const queryClient = new QueryClient();

export function NebulaApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider initialArgs={{ endpoint: VARA_NODE_ADDRESS }}>
        <AccountProvider appName={APP_NAME}>
          <AlertProvider template={Alert} containerClassName={alertStyles.root}>
            <NebulaAppContent />
          </AlertProvider>
        </AccountProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

function NebulaAppContent() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [gameEndPayload, setGameEndPayload] = useState<GameEndPayload | null>(null);
  const runIdRef = useRef(0);

  const { sailsClient, programId, statusMsg: contractStatusMsg } = useNebulaProgram();
  const {
    submitScore,
    retrySubmit,
    submitStatus,
    submitMessage,
    voucherMessage,
    lastRun,
    refetchTrigger,
    canSubmit,
  } = useSubmitScore(sailsClient, programId);

  const handleGameEnd = useCallback(async (payload: GameEndPayload) => {
    setPlaying(false);
    setGameEndPayload(payload);
    const runId = String(++runIdRef.current);
    await submitScore(payload, runId);
  }, [submitScore]);

  const handlePlay = useCallback(() => {
    if (!walletConnected) return;
    setGameEndPayload(null);
    setPlaying(true);
  }, [walletConnected]);

  const playDisabledReason = !walletConnected
    ? "Connect wallet to play"
    : playing
    ? "Game in progress"
    : submitStatus === "pending"
    ? "Submitting score…"
    : "";

  return (
    <main className="nebula-shell">
      <section className="nebula-stage" aria-label="Nebula Blaster game">
        <GameCanvas
          playing={playing}
          onGameEnd={handleGameEnd}
          gameEndPayload={gameEndPayload}
        />
      </section>

      <aside className="nebula-panel">
        <div className="nebula-brand">
          <h1>Nebula<br />Blaster</h1>
          <span>Pilot your ship, blast enemies, chain kills for multipliers, and climb the on-chain leaderboard.</span>
        </div>

        <Suspense fallback={<div className="nebula-loading">Loading wallet…</div>}>
          <WalletGate onConnectionChange={setWalletConnected} />
        </Suspense>

        <button
          className="nebula-play-btn"
          onClick={handlePlay}
          disabled={Boolean(playDisabledReason)}
        >
          {playing ? "Playing…" : "Play"}
        </button>
        {playDisabledReason && !playing && (
          <p className="nebula-note nebula-note--muted">{playDisabledReason}</p>
        )}

        {contractStatusMsg && (
          <p className="nebula-note nebula-note--error">{contractStatusMsg}</p>
        )}

        {/* Run result */}
        {gameEndPayload && (
          <section className="nebula-result" aria-label="Run result">
            <h2>{gameEndPayload.reason === "timeout" ? "Victory!" : "Game Over"}</h2>
            <dl>
              <div>
                <dt>Score</dt>
                <dd>{gameEndPayload.score.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{(gameEndPayload.durationMs / 1000).toFixed(1)}s</dd>
              </div>
              {lastRun?.outcome && (
                <div>
                  <dt>Rank (today)</dt>
                  <dd>{lastRun.outcome.rankDaily !== null ? `#${lastRun.outcome.rankDaily}` : "—"}</dd>
                </div>
              )}
            </dl>
            <p className={`nebula-note nebula-note--${submitStatus}`}>{submitMessage}</p>
            {submitStatus === "error" && gameEndPayload && (
              <button
                className="nebula-retry-btn"
                onClick={() => retrySubmit(gameEndPayload, String(runIdRef.current))}
              >
                Retry Submit
              </button>
            )}
          </section>
        )}

        {/* Voucher status */}
        {voucherMessage && (
          <section className="nebula-result" aria-label="Gas voucher">
            <h2>Gas Voucher</h2>
            <p className="nebula-note">{voucherMessage}</p>
          </section>
        )}

        {/* Leaderboard */}
        <Leaderboard sailsClient={sailsClient} refetchTrigger={refetchTrigger} />
      </aside>
    </main>
  );
}
