type MainMenuProps = {
  onPlay: () => void;
  onLevels: () => void;
  onSettings: () => void;
};

export function MainMenu({ onPlay, onLevels, onSettings }: MainMenuProps) {
  return (
    <section className="menu-card menu-card--hero">
      <p className="eyebrow">Cartoon Sci-Fi Puzzle</p>
      <h1>Robo. Save Eny!</h1>
      <p className="hero-copy">
        Push metal blocks into laser beams, rescue Eny, and guide the tiny robot crew back to the portal.
      </p>
      <div className="menu-actions">
        <button className="primary-button" type="button" onClick={onPlay}>
          Play
        </button>
        <button className="secondary-button" type="button" onClick={onLevels}>
          Levels
        </button>
        <button className="secondary-button" type="button" onClick={onSettings}>
          Settings
        </button>
      </div>
      <div className="hero-lab" aria-hidden="true">
        <span className="hero-robot">R</span>
        <span className="hero-laser" />
        <span className="hero-block" />
        <span className="hero-eny">E</span>
      </div>
    </section>
  );
}
