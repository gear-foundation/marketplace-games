type LevelCompleteModalProps = {
  levelId: number;
  moves: number;
  pushes: number;
  score: number;
  hasNextLevel: boolean;
  onNext: () => void;
  onRestart: () => void;
  onMenu: () => void;
};

export function LevelCompleteModal({
  levelId,
  moves,
  pushes,
  score,
  hasNextLevel,
  onNext,
  onRestart,
  onMenu,
}: LevelCompleteModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Level complete">
      <section className="complete-modal">
        <p className="eyebrow">Level {levelId} Complete</p>
        <h2>Eny is safe!</h2>
        <div className="complete-stats">
          <span>
            Moves <strong>{moves}</strong>
          </span>
          <span>
            Pushes <strong>{pushes}</strong>
          </span>
          <span>
            Score <strong>{score.toLocaleString()}</strong>
          </span>
        </div>
        <div className="menu-actions">
          <button className="primary-button" type="button" onClick={onNext} disabled={!hasNextLevel}>
            Next Level
          </button>
          <button className="secondary-button" type="button" onClick={onRestart}>
            Restart
          </button>
          <button className="secondary-button" type="button" onClick={onMenu}>
            Menu
          </button>
        </div>
      </section>
    </div>
  );
}
