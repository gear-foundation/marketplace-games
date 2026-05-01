import type { LevelCompletion } from "../game/types";

type OfflineChainPanelProps = {
  lastCompletion: LevelCompletion | null;
};

export function OfflineChainPanel({ lastCompletion }: OfflineChainPanelProps) {
  return (
    <section className="chain-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Vara Session</p>
          <h2>Local Mode</h2>
        </div>
        <span className="status-pill">Offline</span>
      </div>
      <p>
        Puzzle play is enabled locally. Deploy the contract, set <code>VITE_ENABLE_CHAIN=true</code> and
        <code> VITE_PROGRAM_ID</code> to submit rescue scores on-chain.
      </p>
      {lastCompletion ? (
        <div className="last-score">
          <span>Last rescue score</span>
          <strong>{lastCompletion.score.toLocaleString()}</strong>
        </div>
      ) : null}
    </section>
  );
}
