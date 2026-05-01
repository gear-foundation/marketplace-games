import { useEffect, useRef, useState } from "react";
import type { GameEndPayload, HudData, LoadingData } from "../game/types";
import { CANVAS_H, CANVAS_W, WEAPON_LABELS } from "../game/constants";
import {
  getHudData,
  getLoadingData,
  goToMenu,
  mountCanvas,
  pauseGame,
  resumeGame,
  startGame,
  subscribeUi,
  unmountCanvas,
} from "../game/engine";
import type { PlayAccess } from "./playAccess";

type GameCanvasProps = {
  playAccess: PlayAccess;
  canStartRun: boolean;
  startDisabledReason: string;
  onRunStart: () => boolean;
  onRunEnd: (payload: GameEndPayload) => void;
};

export function GameCanvas({
  playAccess,
  canStartRun,
  startDisabledReason,
  onRunStart,
  onRunEnd,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onRunEndRef = useRef(onRunEnd);
  const [hud, setHud] = useState<HudData>(getHudData());
  const [loading, setLoading] = useState<LoadingData>(getLoadingData());

  onRunEndRef.current = onRunEnd;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    mountCanvas(canvas, (payload) => onRunEndRef.current(payload));
    return () => {
      unmountCanvas();
    };
  }, []);

  useEffect(() => {
    return subscribeUi(() => {
      setHud({ ...getHudData() });
      setLoading({ ...getLoadingData() });
    });
  }, []);

  function tryStart() {
    if (!canStartRun) {
      return;
    }

    if (onRunStart()) {
      startGame();
    }
  }

  return (
    <div className="za-stage-card">
      <div className="za-viewport">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="za-canvas"
          aria-label="Zombie Apocalypse Survival canvas"
        />

        {hud.status !== "menu" && (
          <header className="za-hud" aria-label="Game HUD">
            <div className="za-hud__group">
              <div className="za-hud__health">
                <span>HP</span>
                <strong>{hud.health} / {hud.maxHealth}</strong>
              </div>
              <div className="za-hud__bar">
                <span style={{ width: `${hud.maxHealth > 0 ? (hud.health / hud.maxHealth) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="za-hud__group za-hud__group--center">
              <span className="za-hud__badge">Weapon: {WEAPON_LABELS[hud.weapon]}</span>
              <span className="za-hud__badge">Time: {hud.time}s</span>
              <span className="za-hud__badge">Kills: {hud.kills}</span>
              <span className="za-hud__badge">Score: {hud.score.toLocaleString()}</span>
            </div>

            <div className="za-hud__group za-hud__group--right">
              {hud.shieldTime > 0 && <span className="za-effect-chip za-effect-chip--shield">Shield {hud.shieldTime}s</span>}
              {hud.speedTime > 0 && <span className="za-effect-chip za-effect-chip--speed">Speed {hud.speedTime}s</span>}
              {hud.stunTime > 0 && <span className="za-effect-chip za-effect-chip--stun">Stunned {hud.stunTime}s</span>}
              {hud.shotgunCharge > 0 && (
                <span className={`za-effect-chip${hud.shotgunCharged ? " za-effect-chip--charged" : ""}`}>
                  Charge {Math.round(hud.shotgunCharge * 100)}%
                </span>
              )}
            </div>
          </header>
        )}

        {hud.banner && hud.bannerTimer > 0 && (
          <div className="za-banner" role="status" aria-live="polite">
            {hud.banner}
          </div>
        )}

        {loading.active && (
          <div className="za-loader" role="status" aria-live="polite">
            <div className="za-loader__card">
              <div className="za-loader__spinner" aria-hidden="true" />
              <strong>{loading.label}</strong>
              <div className="za-loader__bar">
                <span style={{ width: `${Math.round(loading.progress * 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        {(hud.status === "menu" || hud.status === "paused" || hud.status === "game_over" || !playAccess.canPlay) && (
          <div className="za-overlay">
            {!playAccess.canPlay ? (
              <div className="za-overlay-card">
                <p className="za-kicker">Access Locked</p>
                <h2>{playAccess.title}</h2>
                <p>{playAccess.description}</p>
              </div>
            ) : hud.status === "menu" ? (
              <div className="za-overlay-card">
                <p className="za-kicker">Quarantine Zone</p>
                <h2>Survive the horde</h2>
                <p>
                  Turn with <kbd>←</kbd>/<kbd>→</kbd>, move with <kbd>↑</kbd>/<kbd>↓</kbd>, shoot with <kbd>Space</kbd>,
                  and pause with <kbd>Esc</kbd>.
                </p>
                <button
                  className="za-button za-button--primary"
                  type="button"
                  onClick={tryStart}
                  disabled={!canStartRun}
                >
                  Start run
                </button>
                {!canStartRun && <p className="za-note">{startDisabledReason}</p>}
              </div>
            ) : hud.status === "paused" ? (
              <div className="za-overlay-card">
                <p className="za-kicker">Paused</p>
                <h2>Hold the line</h2>
                <div className="za-overlay-actions">
                  <button className="za-button za-button--primary" type="button" onClick={resumeGame}>
                    Continue
                  </button>
                  <button
                    className="za-button za-button--secondary"
                    type="button"
                    onClick={tryStart}
                    disabled={!canStartRun}
                  >
                    Restart
                  </button>
                  <button className="za-button za-button--ghost" type="button" onClick={() => {
                    pauseGame();
                    goToMenu();
                  }}>
                    Main menu
                  </button>
                </div>
              </div>
            ) : (
              <div className="za-overlay-card">
                <p className="za-kicker">Game Over</p>
                <h2>The horde got through</h2>
                {hud.result && (
                  <div className="za-overlay-stats">
                    <div><span>Time</span><strong>{hud.result.survivalSeconds}s</strong></div>
                    <div><span>Kills</span><strong>{hud.result.kills}</strong></div>
                    <div><span>Score</span><strong>{hud.result.score.toLocaleString()}</strong></div>
                  </div>
                )}
                <div className="za-overlay-actions">
                  <button
                    className="za-button za-button--primary"
                    type="button"
                    onClick={tryStart}
                    disabled={!canStartRun}
                  >
                    Restart
                  </button>
                  <button className="za-button za-button--ghost" type="button" onClick={goToMenu}>
                    Main menu
                  </button>
                </div>
                {!canStartRun && <p className="za-note">{startDisabledReason}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
