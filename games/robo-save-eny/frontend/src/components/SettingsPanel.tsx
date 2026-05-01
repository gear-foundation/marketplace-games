import type { ProgressState } from "../game/types";

type SettingsPanelProps = {
  progress: ProgressState;
  onBack: () => void;
  onChange: (progress: ProgressState) => void;
};

export function SettingsPanel({ progress, onBack, onChange }: SettingsPanelProps) {
  const toggleSetting = (key: keyof ProgressState["settings"]) => {
    onChange({
      ...progress,
      settings: {
        ...progress.settings,
        [key]: !progress.settings[key],
      },
    });
  };

  return (
    <section className="menu-card settings-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Lab Console</p>
          <h1>Settings</h1>
        </div>
        <button className="ghost-button" type="button" onClick={onBack}>
          Back
        </button>
      </div>

      <div className="settings-list">
        <button className="setting-row" type="button" onClick={() => toggleSetting("sound")}>
          <span>
            <strong>Sound Effects</strong>
            <em>Stored locally for the future audio pass.</em>
          </span>
          <b>{progress.settings.sound ? "On" : "Off"}</b>
        </button>
        <button className="setting-row" type="button" onClick={() => toggleSetting("music")}>
          <span>
            <strong>Music</strong>
            <em>Stored locally for the future soundtrack pass.</em>
          </span>
          <b>{progress.settings.music ? "On" : "Off"}</b>
        </button>
      </div>
    </section>
  );
}
