import { useEffect, useState } from "react";
import { getHudData, type GameEndPayload } from "../game/engine";
import type { HudData } from "../game/entities";

type HudProps = {
  onGameEnd: (payload: GameEndPayload) => void;
  gameEndPayload: GameEndPayload | null;
};

export function HUD({ gameEndPayload }: Pick<HudProps, "gameEndPayload">) {
  const [hud, setHud] = useState<HudData>(getHudData());

  // Poll the mutable HUD object at 4 Hz — no React inside the game loop
  useEffect(() => {
    const id = setInterval(() => {
      setHud({ ...getHudData() });
    }, 250);
    return () => clearInterval(id);
  }, []);

  if (hud.status !== "playing") return null;

  return (
    <div className="nebula-hud" aria-label="Game HUD" style={{ pointerEvents: "none" }}>
      <div className="nebula-hud__left">
        <span className="nebula-hud__score">{hud.score.toLocaleString()}</span>
        {hud.multiplier > 1 && (
          <span className="nebula-hud__multi">×{hud.multiplier}</span>
        )}
      </div>

      <div className="nebula-hud__center">
        <span className="nebula-hud__timer">{hud.timeLeft}</span>
      </div>

      <div className="nebula-hud__right">
        <HpPips hp={hud.hp} />
        {hud.hasShield && <span className="nebula-hud__icon nebula-hud__icon--shield" title="Shield">S</span>}
        {hud.hasTripleShot && <span className="nebula-hud__icon nebula-hud__icon--triple" title="Triple Shot">3</span>}
      </div>
    </div>
  );
}

function HpPips({ hp }: { hp: number }) {
  return (
    <div className="nebula-hud__hp">
      {[1, 2, 3].map(i => (
        <span key={i} className={`nebula-hud__pip${i <= hp ? " nebula-hud__pip--full" : ""}`} />
      ))}
    </div>
  );
}
