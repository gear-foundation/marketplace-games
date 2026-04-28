import { useEffect, useRef, useState } from "react";
import { AnimState } from "./CritterCard";
import { BattleEvent, Critter, Enemy } from "../game/types";
import { TeamLine } from "./TeamLine";

type Props = {
  wave: number;
  biome: string;
  playerTeam: Critter[];
  enemyTeam: Enemy[];
  battleLog: BattleEvent[];
  isAutoBattling: boolean;
  battleTurnDelayMs: number;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onToggleAutoBattle: (value: boolean) => void;
  onNextTurn: () => void;
  onChangeBattleSpeed: (value: number) => void;
};

const SPEED_OPTIONS = [
  { label: "Slow", value: 1200 },
  { label: "Normal", value: 800 },
  { label: "Fast", value: 450 },
];

type FloatingDamage = {
  id: string;
  damage: number;
  targetSide: "player" | "enemy";
};

const ATTACK_MS = 380;
const HURT_MS = 480;
const DYING_MS = 700;

export function BattleScreen({
  wave,
  biome,
  playerTeam,
  enemyTeam,
  battleLog,
  isAutoBattling,
  battleTurnDelayMs,
  focusMode,
  onToggleFocusMode,
  onToggleAutoBattle,
  onNextTurn,
  onChangeBattleSpeed,
}: Props) {
  const lastEvent = battleLog[battleLog.length - 1];
  const playerFront = playerTeam.find((p) => p.hp > 0)?.id;
  const enemyFront = enemyTeam.find((e) => e.hp > 0)?.id;

  const [floatingDamages, setFloatingDamages] = useState<FloatingDamage[]>([]);
  const [animStates, setAnimStates] = useState<Record<string, AnimState>>({});
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!lastEvent || lastEvent.damage <= 0) return;

    // Clear old timers from previous event
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const { attackerId, targetId, targetDied } = lastEvent;

    setAnimStates((prev) => ({
      ...prev,
      [attackerId]: "attack",
      [targetId]: targetDied ? "dying" : "hurt",
    }));

    // Clear attack anim
    timersRef.current.push(
      setTimeout(() => {
        setAnimStates((prev) => {
          if (prev[attackerId] !== "attack") return prev;
          const next = { ...prev };
          delete next[attackerId];
          return next;
        });
      }, ATTACK_MS)
    );

    // Clear hurt anim
    if (!targetDied) {
      timersRef.current.push(
        setTimeout(() => {
          setAnimStates((prev) => {
            if (prev[targetId] !== "hurt") return prev;
            const next = { ...prev };
            delete next[targetId];
            return next;
          });
        }, HURT_MS)
      );
    }

    // Clear dying anim (after this TeamLine will filter it out naturally via hp=0)
    if (targetDied) {
      timersRef.current.push(
        setTimeout(() => {
          setAnimStates((prev) => {
            if (prev[targetId] !== "dying") return prev;
            const next = { ...prev };
            delete next[targetId];
            return next;
          });
        }, DYING_MS)
      );
    }

    // Floating damage number
    const targetSide = lastEvent.attackerSide === "player" ? "enemy" : "player";
    const floatingDamage: FloatingDamage = {
      id: `${lastEvent.id}-float`,
      damage: lastEvent.damage,
      targetSide,
    };
    setFloatingDamages((prev) => [...prev, floatingDamage]);
    timersRef.current.push(
      setTimeout(() => {
        setFloatingDamages((prev) => prev.filter((item) => item.id !== floatingDamage.id));
      }, 650)
    );

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [lastEvent]);

  const dyingIds = new Set(
    Object.entries(animStates)
      .filter(([, s]) => s === "dying")
      .map(([id]) => id)
  );

  return (
    <section className={`panel battle-panel${focusMode ? " battle-panel-focus" : ""}`}>
      <div className="battle-head">
        <h2>Wave {wave}</h2>
        <span>{biome}</span>
      </div>
      <div className="actions-row battle-controls">
        <button type="button" onClick={onToggleFocusMode}>
          {focusMode ? "Close battle screen" : "Open battle screen"}
        </button>
        <button type="button" onClick={() => onToggleAutoBattle(!isAutoBattling)}>
          {isAutoBattling ? "Pause auto battle" : "Start auto battle"}
        </button>
        <button type="button" onClick={onNextTurn} disabled={isAutoBattling}>
          Next turn
        </button>
        <label>
          Speed
          <select
            value={battleTurnDelayMs}
            onChange={(event) => onChangeBattleSpeed(Number(event.target.value))}
            disabled={!isAutoBattling}
          >
            {SPEED_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="battle-lanes">
        <div className="floating-damage-layer" aria-hidden>
          {floatingDamages.map((item) => (
            <span
              key={item.id}
              className={`floating-damage floating-damage-${item.targetSide === "player" ? "left" : "right"}`}
            >
              -{item.damage}
            </span>
          ))}
        </div>
        <TeamLine
          title="Your Team"
          team={playerTeam}
          frontId={playerFront}
          align="left"
          animStates={animStates}
          dyingIds={dyingIds}
        />
        <TeamLine
          title="Enemy Team"
          team={enemyTeam}
          frontId={enemyFront}
          align="right"
          animStates={animStates}
          dyingIds={dyingIds}
        />
      </div>
      {lastEvent ? (
        <p className="battle-log">
          {lastEvent.attackerSide === "player" ? "Your critter" : "Enemy"} dealt{" "}
          <strong>{lastEvent.damage}</strong> damage
          {lastEvent.targetDied ? " (KO)" : ""}
        </p>
      ) : (
        <p className="battle-log">Battle started. Use "Next turn" to watch each move step-by-step.</p>
      )}
    </section>
  );
}
