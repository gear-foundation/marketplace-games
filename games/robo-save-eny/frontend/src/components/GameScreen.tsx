import { useCallback, useEffect, useMemo, useState } from "react";
import { stoneIndexAt } from "../game/collision";
import { createInitialState } from "../game/levelLoader";
import { getLaserCellDirectionMap } from "../game/lasers";
import { movePlayer } from "../game/movement";
import { positionKey, samePosition } from "../game/position";
import type { Direction, GameState, Level, LevelCompletion } from "../game/types";
import { useDirectionalInput } from "../hooks/useDirectionalInput";
import { LevelCompleteModal } from "./LevelCompleteModal";

type GameScreenProps = {
  level: Level;
  hasNextLevel: boolean;
  completion: LevelCompletion | null;
  onComplete: (state: GameState) => LevelCompletion;
  onBack: () => void;
  onRestartSession: () => void;
  onNextLevel: () => void;
};

const LASER_SYMBOL: Record<Direction, string> = {
  up: "^",
  down: "v",
  left: "<",
  right: ">",
};

export function GameScreen({
  level,
  hasNextLevel,
  completion,
  onComplete,
  onBack,
  onRestartSession,
  onNextLevel,
}: GameScreenProps) {
  const [state, setState] = useState(() => createInitialState(level));
  const [completionReported, setCompletionReported] = useState(false);

  useEffect(() => {
    setState(createInitialState(level));
    setCompletionReported(false);
  }, [level]);

  const resetLevel = useCallback(() => {
    setState(createInitialState(level));
    setCompletionReported(false);
    onRestartSession();
  }, [level, onRestartSession]);

  const handleMove = useCallback(
    (direction: Direction) => {
      setState((current) => movePlayer(level, current, direction).state);
    },
    [level],
  );

  useEffect(() => {
    if (!state.isCompleted || completionReported) return;
    onComplete(state);
    setCompletionReported(true);
  }, [completionReported, onComplete, state]);

  const swipeHandlers = useDirectionalInput({
    disabled: state.isCompleted,
    onMove: handleMove,
    onRestart: resetLevel,
    onBack,
  });

  const laserCellsByKey = useMemo(() => getLaserCellDirectionMap(level, state.stones), [level, state.stones]);
  const laserByKey = useMemo(() => new Map(level.objects.lasers.map((laser) => [positionKey(laser), laser])), [level]);
  const cellSize = `minmax(28px, 1fr)`;

  return (
    <section className="game-layout">
      <div className="game-card">
        <div className="game-topbar">
          <button className="ghost-button" type="button" onClick={onBack}>
            Back
          </button>
          <div>
            <p className="eyebrow">Level {level.id}</p>
            <h1>Save Eny</h1>
          </div>
          <button className="ghost-button" type="button" onClick={resetLevel}>
            Restart
          </button>
        </div>

        <div
          className="board"
          style={{ gridTemplateColumns: `repeat(${level.width}, ${cellSize})` }}
          {...swipeHandlers}
          aria-label={`Level ${level.id} board`}
        >
          {level.tiles.flatMap((row, y) =>
            row.split("").map((tile, x) => {
              const position = { x, y };
              const key = positionKey(position);
              const stoneIndex = stoneIndexAt(state.stones, position);
              const laser = laserByKey.get(key);
              const laserDirections = laserCellsByKey.get(key) ?? [];
              const hasLaser = laserDirections.length > 0;
              const hasRobo = samePosition(state.robo, position);
              const hasEny = samePosition(state.eny, position) && !state.hasEny;
              const hasExit = samePosition(state.exit, position);
              const isWall = tile === "#";

              return (
                <div
                  className={[
                    "cell",
                    isWall ? "cell--wall" : "cell--floor",
                    hasLaser ? "cell--laser" : "",
                    hasExit ? "cell--exit" : "",
                    state.rescuedThisMove && hasRobo ? "cell--rescued" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={key}
                >
                  {laserDirections.map((direction) => (
                    <span className={`laser-beam laser-beam--${direction}`} key={direction} />
                  ))}
                  {hasExit ? <span className="exit-portal">X</span> : null}
                  {laser ? <span className="laser-gun">{LASER_SYMBOL[laser.direction]}</span> : null}
                  {stoneIndex !== -1 ? <span className="stone-block">S</span> : null}
                  {hasEny ? <span className="eny-bot">E</span> : null}
                  {hasRobo ? (
                    <span className="robo-bot">
                      R
                      {state.hasEny ? <em>E</em> : null}
                    </span>
                  ) : null}
                </div>
              );
            }),
          )}
        </div>

        <div className="dpad" aria-label="Movement controls">
          <button type="button" onClick={() => handleMove("up")} disabled={state.isCompleted}>
            Up
          </button>
          <button type="button" onClick={() => handleMove("left")} disabled={state.isCompleted}>
            Left
          </button>
          <button type="button" onClick={() => handleMove("down")} disabled={state.isCompleted}>
            Down
          </button>
          <button type="button" onClick={() => handleMove("right")} disabled={state.isCompleted}>
            Right
          </button>
        </div>
      </div>

      <aside className="mission-panel">
        <section className="info-card">
          <p className="eyebrow">Mission</p>
          <h2>{state.hasEny ? "Escort Eny to the portal" : "Reach Eny first"}</h2>
          <p>
            Push blocks into red beams. Robo cannot enter active lasers or laser cannons, but stones can shut beams down.
          </p>
        </section>
        <section className="stats-card">
          <span>
            Moves <strong>{state.movesCount}</strong>
          </span>
          <span>
            Pushes <strong>{state.pushesCount}</strong>
          </span>
          <span>
            Eny <strong>{state.hasEny ? "Saved" : "Waiting"}</strong>
          </span>
        </section>
      </aside>

      {state.isCompleted && completion ? (
        <LevelCompleteModal
          levelId={level.id}
          moves={completion.moves}
          pushes={completion.pushes}
          score={completion.score}
          hasNextLevel={hasNextLevel}
          onNext={onNextLevel}
          onRestart={resetLevel}
          onMenu={onBack}
        />
      ) : null}
    </section>
  );
}
