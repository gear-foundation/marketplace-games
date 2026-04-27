import { useEffect, useRef } from "react";
import { mountCanvas, unmountCanvas, startGame, stop, type GameEndPayload } from "../game/engine";
import { CANVAS_W, CANVAS_H } from "../game/entities";
import { HUD } from "./HUD";

type GameCanvasProps = {
  playing: boolean;
  onGameEnd: (payload: GameEndPayload) => void;
  gameEndPayload: GameEndPayload | null;
};

export function GameCanvas({ playing, onGameEnd, gameEndPayload }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onGameEndRef = useRef(onGameEnd);
  onGameEndRef.current = onGameEnd;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    mountCanvas(el, (payload) => onGameEndRef.current(payload));
    return () => unmountCanvas();
  }, []); // stable — never remounts due to callback identity changes

  useEffect(() => {
    if (playing) {
      startGame();
    } else {
      stop();
    }
  }, [playing]);

  return (
    <div className="nebula-viewport">
      <HUD gameEndPayload={gameEndPayload} />
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="nebula-canvas"
        aria-label="Nebula Blaster game canvas"
      />
    </div>
  );
}
