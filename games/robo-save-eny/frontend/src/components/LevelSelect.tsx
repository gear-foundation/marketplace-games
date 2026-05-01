import type { Level, ProgressState } from "../game/types";

type LevelSelectProps = {
  levels: Level[];
  progress: ProgressState;
  onBack: () => void;
  onSelectLevel: (levelId: number) => void;
};

export function LevelSelect({ levels, progress, onBack, onSelectLevel }: LevelSelectProps) {
  return (
    <section className="menu-card level-select-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Mission Deck</p>
          <h1>Choose Level</h1>
        </div>
        <button className="ghost-button" type="button" onClick={onBack}>
          Back
        </button>
      </div>

      <div className="level-grid">
        {levels.map((level) => {
          const completed = progress.completedLevels[String(level.id)];
          const locked = level.id > progress.unlockedLevel;

          return (
            <button
              className={`level-button${locked ? " is-locked" : ""}${completed ? " is-complete" : ""}`}
              type="button"
              key={level.id}
              onClick={() => onSelectLevel(level.id)}
              disabled={locked}
            >
              <span>Level {level.id}</span>
              <strong>{locked ? "Locked" : completed ? `${completed.bestMoves} moves` : "Open"}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}
