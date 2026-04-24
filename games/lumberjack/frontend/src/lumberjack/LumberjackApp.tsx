import { Suspense, lazy, useState } from "react";
import { AccountProvider, AlertProvider, ApiProvider } from "@gear-js/react-hooks";
import { Alert, alertStyles } from "@gear-js/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LumberjackStage } from "./LumberjackStage";
import { useLumberjackGame } from "./useLumberjackGame";
import "./lumberjack.css";

const LumberjackWeb3Panel = lazy(() => import("./LumberjackWeb3Panel"));
const APP_NAME = "Lumberjack";
const VARA_NODE_ADDRESS = import.meta.env.VITE_NODE_ADDRESS || "wss://rpc.vara.network";
const queryClient = new QueryClient();

export function LumberjackApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider initialArgs={{ endpoint: VARA_NODE_ADDRESS }}>
        <AccountProvider appName={APP_NAME}>
          <AlertProvider template={Alert} containerClassName={alertStyles.root}>
            <LumberjackAppContent />
          </AlertProvider>
        </AccountProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

function LumberjackAppContent() {
  const [canPlay, setCanPlay] = useState(false);
  const game = useLumberjackGame(canPlay);
  const isSubmissionLocked = game.hasUnsubmittedRun;
  const isStageLocked = !canPlay || isSubmissionLocked;
  const stageLockMessage = isSubmissionLocked ? "Sign the previous result to continue." : "Connect wallet to play.";

  return (
    <main className="lumberjack-shell">
      <LumberjackStage
        hud={game.hud}
        isLocked={isStageLocked}
        lockMessage={stageLockMessage}
        runtimeRef={game.runtimeRef}
        onStartRun={game.startRun}
        onChop={game.chop}
        advanceFrame={game.advanceFrame}
      />

      <aside className="lumberjack-panel">
        <Suspense
          fallback={
            <section className="lumberjack-result lumberjack-loading-panel" aria-label="Web3 panel loading">
              <h2>Wallet & Chain</h2>
              <p className="lumberjack-empty">Loading wallet, leaderboard, and submit controls.</p>
            </section>
          }
        >
          <LumberjackWeb3Panel
            runSummary={game.runSummary}
            runMessage={game.runMessage}
            submittedRunId={game.submittedRunId}
            hasUnsubmittedRun={game.hasUnsubmittedRun}
            status={game.hud.status}
            onStartRun={game.startRun}
            onRunSubmitted={game.markRunSubmitted}
            onWalletConnectionChange={setCanPlay}
          />
        </Suspense>
      </aside>
    </main>
  );
}
