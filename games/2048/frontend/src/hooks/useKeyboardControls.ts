import { useEffect, useEffectEvent } from "react";
import type { Direction } from "../game/types";

type KeyboardControlsOptions = {
  enabled?: boolean;
  onMove: (direction: Direction) => void;
  onNewGame: () => void;
  onContinue: () => void;
};

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  s: "down",
  S: "down",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
};

export function useKeyboardControls({
  enabled = true,
  onMove,
  onNewGame,
  onContinue,
}: KeyboardControlsOptions) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const direction = KEY_TO_DIRECTION[event.key];

    if (direction) {
      event.preventDefault();
      onMove(direction);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onContinue();
      return;
    }

    if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      onNewGame();
    }
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    window.addEventListener("keydown", handleKeyDown, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}
