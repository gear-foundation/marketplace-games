import { useEffect } from "react";
import type { GameEndPayload } from "../game/types";
import type { PlayAccess } from "./playAccess";

type ZombieChainPanelOfflineProps = {
  pendingRun: GameEndPayload | null;
  onPlayAccessChange?: (state: PlayAccess) => void;
  onSessionSubmitStateChange?: (submitted: boolean) => void;
};

export function ZombieChainPanelOffline({
  pendingRun,
  onPlayAccessChange,
  onSessionSubmitStateChange,
}: ZombieChainPanelOfflineProps) {
  useEffect(() => {
    onPlayAccessChange?.({
      canPlay: true,
      title: "Local mode enabled",
      description: "Wallet, contract, and voucher flows are disabled for now. Runs stay only in the browser session.",
    });
    onSessionSubmitStateChange?.(true);
  }, [onPlayAccessChange, onSessionSubmitStateChange]);

  return (
    <section className="za-card za-chain-panel" aria-label="Local mode panel">
      <div className="za-panel-head">
        <div>
          <p className="za-card-kicker">Offline Prototype</p>
          <h2>Local Mode</h2>
        </div>
        <span className="za-chip">No blockchain</span>
      </div>

      <div className="za-connection-state">
        <strong>Gameplay is fully unlocked</strong>
        <p>
          You can start, restart, and replay immediately. Scores are not sent on-chain until wallet and contract mode is enabled.
        </p>
      </div>

      <section className="za-player-chain" aria-label="Local mode status">
        <div>
          <span>Wallet</span>
          <strong>Disabled</strong>
        </div>
        <div>
          <span>Leaderboard</span>
          <strong>Local only</strong>
        </div>
      </section>

      {pendingRun && (
        <section className="za-submit-box" aria-label="Local score note">
          <h3>Last run stays local</h3>
          <div className="za-stat-row">
            <span>Score</span>
            <strong>{pendingRun.score.toLocaleString()}</strong>
          </div>
          <div className="za-stat-row">
            <span>Survival</span>
            <strong>{pendingRun.survivalSeconds}s</strong>
          </div>
          <p className="za-note">
            To switch back to local-only mode, set `VITE_ENABLE_CHAIN=false`.
          </p>
        </section>
      )}
    </section>
  );
}
