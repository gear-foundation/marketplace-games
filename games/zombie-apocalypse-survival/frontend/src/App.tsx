import { lazy, Suspense, useCallback, useState } from "react";
import { GameCanvas } from "./components/GameCanvas";
import { ZombieChainPanelOffline } from "./components/ZombieChainPanelOffline";
import type { PlayAccess } from "./components/playAccess";
import type { GameEndPayload } from "./game/types";

const CHAIN_ENABLED = import.meta.env.VITE_ENABLE_CHAIN !== "false";
const ZombieChainRuntime = lazy(() => import("./components/ZombieChainRuntime"));
const ZombieChainPanel = lazy(() =>
  import("./components/ZombieChainPanel").then((module) => ({ default: module.ZombieChainPanel })),
);

function createInitialPlayAccess(chainEnabled: boolean): PlayAccess {
  return {
    canPlay: !chainEnabled,
    title: chainEnabled ? "Loading wallet" : "Local mode enabled",
    description: chainEnabled
      ? "Wallet providers are still loading. The arena unlocks as soon as your Vara session is ready."
      : "Wallet, contract, and voucher flows are disabled for now. The game runs entirely locally.",
  };
}

export function ZombieApocalypseApp() {
  if (!CHAIN_ENABLED) {
    return <ZombieApocalypseContent chainEnabled={false} />;
  }

  return (
    <Suspense fallback={<ZombieAppLoading />}>
      <ZombieChainRuntime>
        <ZombieApocalypseContent chainEnabled />
      </ZombieChainRuntime>
    </Suspense>
  );
}

function ZombieApocalypseContent({ chainEnabled }: { chainEnabled: boolean }) {
  const [gameSessionId, setGameSessionId] = useState(1);
  const [pendingRun, setPendingRun] = useState<GameEndPayload | null>(null);
  const [playAccess, setPlayAccess] = useState<PlayAccess>(() => createInitialPlayAccess(chainEnabled));
  const [isCurrentSessionSubmitted, setIsCurrentSessionSubmitted] = useState(!chainEnabled);

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
        {chainEnabled ? (
          <Suspense fallback={<ZombieChainPanelSkeleton />}>
            <ZombieChainPanel
              chainEnabled
              gameSessionId={gameSessionId}
              pendingRun={pendingRun}
              onPlayAccessChange={setPlayAccess}
              onSessionSubmitStateChange={setIsCurrentSessionSubmitted}
            />
          </Suspense>
        ) : (
          <ZombieChainPanelOffline
            pendingRun={pendingRun}
            onPlayAccessChange={setPlayAccess}
            onSessionSubmitStateChange={setIsCurrentSessionSubmitted}
          />
        )}
      </aside>
    </main>
  );
}

function ZombieAppLoading() {
  return (
    <main className="za-shell">
      <section className="za-stage-pane">
        <div className="za-stage-card">
          <div className="za-viewport">
            <div className="za-overlay">
              <div className="za-overlay-card">
                <p className="za-kicker">Vara Session</p>
                <h2>Loading wallet runtime</h2>
                <p>The arena will open as soon as the chain session is ready.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ZombieChainPanelSkeleton() {
  return (
    <section className="za-card za-chain-panel" aria-label="Chain panel loading">
      <div className="za-panel-head">
        <div>
          <p className="za-card-kicker">Vara Session</p>
          <h2>Loading</h2>
        </div>
        <span className="za-chip">Syncing</span>
      </div>
      <div className="za-connection-state">
        <strong>Preparing chain session</strong>
        <p>The arena will unlock as soon as the wallet runtime is ready.</p>
      </div>
    </section>
  );
}
