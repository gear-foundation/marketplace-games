type Props = {
  onStartWave: (wave: number) => void;
  onKillEnemies: () => void;
  onHealTeam: () => void;
  onGiveReward: () => void;
  autoBattle: boolean;
  setAutoBattle: (value: boolean) => void;
};

export function DebugPanel({
  onStartWave,
  onKillEnemies,
  onHealTeam,
  onGiveReward,
  autoBattle,
  setAutoBattle,
}: Props) {
  return (
    <section className="panel debug">
      <h3>Debug panel</h3>
      <div className="actions-row">
        <button type="button" onClick={() => onStartWave(1)}>
          Start wave 1
        </button>
        <button type="button" onClick={() => onStartWave(10)}>
          Start wave 10
        </button>
        <button type="button" onClick={() => onStartWave(20)}>
          Start wave 20
        </button>
      </div>
      <div className="actions-row">
        <button type="button" onClick={onKillEnemies}>
          Kill enemy team
        </button>
        <button type="button" onClick={onHealTeam}>
          Heal player team
        </button>
        <button type="button" onClick={onGiveReward}>
          Give random reward
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={autoBattle} onChange={(e) => setAutoBattle(e.target.checked)} />
        Auto battle x10
      </label>
    </section>
  );
}
