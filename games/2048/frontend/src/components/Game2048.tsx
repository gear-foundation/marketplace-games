import { useEffect, useRef, useState } from "react";
import { useAccount } from "@gear-js/react-hooks";
import { Board, type BoardAnimation } from "./Board";
import { Game2048ChainPanel, type Game2048PlayAccess } from "./Game2048ChainPanel";
import { ScorePanel } from "./ScorePanel";
import { continueAfterWin, createNewGame, stepGame } from "../game/game-state";
import type { Board as BoardMatrix, Direction, GameState, Position } from "../game/types";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { useSwipeControls } from "../hooks/useSwipeControls";

const MOVE_ANIMATION_MS = 220;

function createCellId(position: Position) {
  return `${position.row}-${position.col}`;
}

function getOccupiedCellIds(board: BoardMatrix) {
  const ids: string[] = [];

  board.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value > 0) {
        ids.push(`${rowIndex}-${colIndex}`);
      }
    });
  });

  return ids;
}

function getChangedCellIds(previousBoard: BoardMatrix, nextBoard: BoardMatrix) {
  const changed = new Set<string>();

  previousBoard.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value !== nextBoard[rowIndex][colIndex]) {
        changed.add(`${rowIndex}-${colIndex}`);
      }
    });
  });

  return changed;
}

function buildNewGame(bestScore: number): GameState {
  return createNewGame(bestScore);
}

export function Game2048() {
  const { account } = useAccount();
  const [game, setGame] = useState<GameState>(() => buildNewGame(0));
  const [gameSessionId, setGameSessionId] = useState(1);
  const [isCurrentSessionSubmitted, setIsCurrentSessionSubmitted] = useState(false);
  const [moveId, setMoveId] = useState(1);
  const [animatedCellIds, setAnimatedCellIds] = useState<string[]>([]);
  const [spawnedCellId, setSpawnedCellId] = useState<string | null>(null);
  const [boardAnimation, setBoardAnimation] = useState<(BoardAnimation & { pulseCellIds: string[]; spawnCellId: string | null }) | null>(
    null,
  );
  const [playAccess, setPlayAccess] = useState<Game2048PlayAccess>({
    canPlay: false,
    title: "Loading wallet",
    description: "Wallet providers are still loading. The board unlocks as soon as a wallet becomes available.",
  });
  const accountIdentity = account?.decodedAddress || account?.address || "";
  const previousAccountIdentity = useRef(accountIdentity);
  const canPlay = playAccess.canPlay;
  const requiresScoreSubmit = game.status === "lost" && !isCurrentSessionSubmitted;
  const canStartNewGame = canPlay && !requiresScoreSubmit;

  useEffect(() => {
    if (!boardAnimation) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setBoardAnimation(null);
      setAnimatedCellIds(boardAnimation.pulseCellIds);
      setSpawnedCellId(boardAnimation.spawnCellId);
      setMoveId((current) => current + 1);
    }, MOVE_ANIMATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [boardAnimation]);

  useEffect(() => {
    if (previousAccountIdentity.current === accountIdentity) {
      return;
    }

    previousAccountIdentity.current = accountIdentity;
    const nextGame = buildNewGame(0);
    setGame(nextGame);
    setBoardAnimation(null);
    setAnimatedCellIds(getOccupiedCellIds(nextGame.board));
    setSpawnedCellId(null);
    setIsCurrentSessionSubmitted(false);
    setGameSessionId((current) => current + 1);
    setMoveId((current) => current + 1);
  }, [accountIdentity]);

  function startNewGame() {
    if (!canStartNewGame) {
      return;
    }

    const nextGame = buildNewGame(game.bestScore);
    setGame(nextGame);
    setBoardAnimation(null);
    setAnimatedCellIds(getOccupiedCellIds(nextGame.board));
    setSpawnedCellId(null);
    setIsCurrentSessionSubmitted(false);
    setGameSessionId((current) => current + 1);
    setMoveId((current) => current + 1);
  }

  function continueGame() {
    if (!canPlay) {
      return;
    }

    if (boardAnimation || game.status !== "won") {
      return;
    }

    setGame(continueAfterWin(game));
    setSpawnedCellId(null);
    setAnimatedCellIds([]);
  }

  function handleMove(direction: Direction) {
    if (!canPlay) {
      return;
    }

    if (boardAnimation) {
      return;
    }

    const result = stepGame(game, direction);

    if (!result.changed) {
      return;
    }

    const hiddenCellIds = [...new Set(result.transitions.map((transition) => createCellId(transition.from)))];
    const nextSpawnedCellId = result.spawnPosition ? createCellId(result.spawnPosition) : null;

    setGame(result.state);
    setAnimatedCellIds([]);
    setSpawnedCellId(null);
    setBoardAnimation({
      previousBoard: game.board,
      transitions: result.transitions,
      hiddenCellIds,
      pulseCellIds: [],
      spawnCellId: nextSpawnedCellId,
    });
  }

  useKeyboardControls({
    enabled: canPlay,
    onMove: handleMove,
    onNewGame: startNewGame,
    onContinue: continueGame,
  });

  const swipeHandlers = useSwipeControls({
    enabled: canPlay,
    onMove: handleMove,
  });

  const visibleStatus = boardAnimation ? "playing" : game.status;
  const statusTitle = visibleStatus === "won" ? "You win!" : visibleStatus === "lost" ? "Game over" : null;
  const statusText =
    visibleStatus === "won"
      ? "The 2048 tile is on the board. Continue if you want to chase a bigger score."
      : visibleStatus === "lost"
        ? requiresScoreSubmit
          ? "No more valid moves remain. Submit your score to unlock the next run."
          : "No more valid moves remain on the board. Start a new run and try a different route."
        : "";

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Puzzle Sprint</p>
          <h1>2048</h1>
        </div>

        <div className="hero-actions">
          <div className="score-grid" aria-label="Scoreboard">
            <ScorePanel label="Score" value={game.score} accent="gold" />
            <ScorePanel label="Best" value={game.bestScore} accent="ink" />
          </div>

          <div className="button-row">
            <button className="action-button action-button--primary" type="button" onClick={startNewGame} disabled={!canStartNewGame}>
              New Game
            </button>
            {visibleStatus === "won" ? (
              <button className="action-button action-button--secondary" type="button" onClick={continueGame} disabled={!canPlay}>
                Continue
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="play-layout">
        <div className="play-surface">
          <div className="board-shell">
            <div className="board-topline">
              <span>Board 4×4</span>
              <span>{getOccupiedCellIds(game.board).length}/16 tiles</span>
            </div>

            <div className={`board-touch-zone${canPlay ? "" : " board-touch-zone--locked"}`} {...swipeHandlers}>
              <Board
                board={game.board}
                animatedCellIds={animatedCellIds}
                spawnedCellId={spawnedCellId}
                moveId={moveId}
                animation={boardAnimation}
              />

              {!canPlay ? (
                <div className="status-overlay status-overlay--locked" role="status" aria-live="polite">
                  <strong>{playAccess.title}</strong>
                  <p>{playAccess.description}</p>
                </div>
              ) : statusTitle ? (
                <div className={`status-overlay status-overlay--${visibleStatus}`} role="status" aria-live="polite">
                  <strong>{statusTitle}</strong>
                  <p>{statusText}</p>
                  <div className="overlay-actions">
                    {visibleStatus === "won" ? (
                      <button className="action-button action-button--secondary" type="button" onClick={continueGame}>
                        Continue
                      </button>
                    ) : null}
                    <button className="action-button action-button--primary" type="button" onClick={startNewGame} disabled={!canStartNewGame}>
                      New Game
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="touch-pad" aria-label="Direction controls">
            <button type="button" className="touch-button" onClick={() => handleMove("up")} disabled={!canPlay}>
              Up
            </button>
            <div className="touch-pad__middle">
              <button type="button" className="touch-button" onClick={() => handleMove("left")} disabled={!canPlay}>
                Left
              </button>
              <button type="button" className="touch-button" onClick={() => handleMove("right")} disabled={!canPlay}>
                Right
              </button>
            </div>
            <button type="button" className="touch-button" onClick={() => handleMove("down")} disabled={!canPlay}>
              Down
            </button>
          </div>
        </div>

        <aside className="info-panel">
          <Game2048ChainPanel
            bestScore={game.bestScore}
            score={game.score}
            status={visibleStatus}
            gameSessionId={gameSessionId}
            onPlayAccessChange={setPlayAccess}
            onSessionSubmitStateChange={setIsCurrentSessionSubmitted}
          />
        </aside>
      </section>
    </main>
  );
}
