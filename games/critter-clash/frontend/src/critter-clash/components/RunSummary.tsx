import { RunStats } from "../game/types";

type Props = {
  stats: RunStats;
  score: number;
  onRestart: () => void;
};

export function RunSummary({ stats, score, onRestart }: Props) {
  return (
    <section className="panel">
      <h2>Run Over</h2>
      <p>Wave reached: {stats.waveReached}</p>
      <p>Enemies defeated: {stats.enemiesDefeated}</p>
      <p>Bosses defeated: {stats.bossesDefeated}</p>
      <p>Score: {score}</p>
      <div className="actions-row">
        <button type="button">Submit Score</button>
        <button type="button" onClick={onRestart}>
          Play Again
        </button>
      </div>
    </section>
  );
}
