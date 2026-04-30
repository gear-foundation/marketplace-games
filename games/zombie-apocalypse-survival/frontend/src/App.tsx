import { useCallback, useState } from "react";
import { AccountProvider, AlertProvider, ApiProvider } from "@gear-js/react-hooks";
import { Alert, alertStyles } from "@gear-js/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GameCanvas } from "./components/GameCanvas";
import { ZombieChainPanel, type PlayAccess } from "./components/ZombieChainPanel";
import type { GameEndPayload } from "./game/types";

const APP_NAME = "Zombie Apocalypse Survival";
const VARA_NODE_ADDRESS = import.meta.env.VITE_NODE_ADDRESS || "wss://rpc.vara.network";
const CHAIN_ENABLED = import.meta.env.VITE_ENABLE_CHAIN === "true";
const queryClient = new QueryClient();

const initialPlayAccess: PlayAccess = {
  canPlay: !CHAIN_ENABLED,
  title: CHAIN_ENABLED ? "Loading wallet" : "Local mode enabled",
  description: CHAIN_ENABLED
    ? "Wallet providers are still loading. The arena unlocks as soon as your Vara session is ready."
    : "Wallet, contract, and voucher flows are disabled for now. The game runs entirely locally.",
};

export function ZombieApocalypseApp() {
  if (!CHAIN_ENABLED) {
    return <ZombieApocalypseContent chainEnabled={false} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider initialArgs={{ endpoint: VARA_NODE_ADDRESS }}>
        <AccountProvider appName={APP_NAME}>
          <AlertProvider template={Alert} containerClassName={alertStyles.root}>
            <ZombieApocalypseContent chainEnabled />
          </AlertProvider>
        </AccountProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

function ZombieApocalypseContent({ chainEnabled }: { chainEnabled: boolean }) {
  const [gameSessionId, setGameSessionId] = useState(1);
  const [pendingRun, setPendingRun] = useState<GameEndPayload | null>(null);
  const [playAccess, setPlayAccess] = useState<PlayAccess>(initialPlayAccess);
  const [isCurrentSessionSubmitted, setIsCurrentSessionSubmitted] = useState(!CHAIN_ENABLED);

  const canStartRun = playAccess.canPlay && (!chainEnabled || pendingRun === null || isCurrentSessionSubmitted);
  const startDisabledReason = !playAccess.canPlay
    ? playAccess.description
    : chainEnabled && pendingRun !== null && !isCurrentSessionSubmitted
      ? "Submit the previous survival run before opening the next bunker door."
      : "";

  const handleRunStart = useCallback(() => {
    if (!canStartRun) {
      return false;
    }

    setPendingRun(null);
    setIsCurrentSessionSubmitted(true);
    setGameSessionId((current) => current + 1);
    return true;
  }, [canStartRun]);

  const handleRunEnd = useCallback((payload: GameEndPayload) => {
    setPendingRun(payload);
    setIsCurrentSessionSubmitted(!chainEnabled);
  }, [chainEnabled]);

  return (
    <main className="za-shell">
      <section className="za-stage-pane">
        <GameCanvas
          playAccess={playAccess}
          canStartRun={canStartRun}
          startDisabledReason={startDisabledReason}
          onRunStart={handleRunStart}
          onRunEnd={handleRunEnd}
        />
      </section>

      <aside className="za-panel">
        <section className="za-brand">
          <p className="za-kicker">Top-Down Survival</p>
          <h1>Zombie Apocalypse Survival</h1>
          <p className="za-copy">
            {chainEnabled
              ? "Hold the quarantine zone, swap weapons as the night gets worse, and bank your best survival score on Vara."
              : "Hold the quarantine zone, swap weapons as the night gets worse, and iterate on the core survival loop locally without wallet friction."}
          </p>
        </section>

        {pendingRun && (
          <section className="za-run-summary" aria-label="Last run summary">
            <div>
              <span>Time</span>
              <strong>{pendingRun.survivalSeconds}s</strong>
            </div>
            <div>
              <span>Kills</span>
              <strong>{pendingRun.kills}</strong>
            </div>
            <div>
              <span>Score</span>
              <strong>{pendingRun.score.toLocaleString()}</strong>
            </div>
          </section>
        )}

        <ZombieChainPanel
          chainEnabled={chainEnabled}
          gameSessionId={gameSessionId}
          pendingRun={pendingRun}
          onPlayAccessChange={setPlayAccess}
          onSessionSubmitStateChange={setIsCurrentSessionSubmitted}
        />
      </aside>
    </main>
  );
}
