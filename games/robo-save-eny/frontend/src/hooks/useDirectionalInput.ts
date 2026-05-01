import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import type { Direction } from "../game/types";

type DirectionalInputOptions = {
  disabled?: boolean;
  onMove: (direction: Direction) => void;
  onRestart: () => void;
  onBack: () => void;
};

const KEY_TO_DIRECTION: Record<string, Direction | undefined> = {
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowDown: "down",
  s: "down",
  S: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
};

export function useDirectionalInput({ disabled, onMove, onRestart, onBack }: DirectionalInputOptions) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onBack();
        return;
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        onRestart();
        return;
      }

      const direction = KEY_TO_DIRECTION[event.key];
      if (!direction || disabled) return;

      event.preventDefault();
      onMove(direction);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onBack, onMove, onRestart]);

  const onPointerDown = useCallback((event: PointerEvent) => {
    pointerStart.current = { x: event.clientX, y: event.clientY };
  }, []);

  const onPointerUp = useCallback(
    (event: PointerEvent) => {
      if (disabled || !pointerStart.current) return;

      const deltaX = event.clientX - pointerStart.current.x;
      const deltaY = event.clientY - pointerStart.current.y;
      pointerStart.current = null;

      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 32) return;
      onMove(Math.abs(deltaX) > Math.abs(deltaY) ? (deltaX > 0 ? "right" : "left") : deltaY > 0 ? "down" : "up");
    },
    [disabled, onMove],
  );

  return {
    onPointerDown,
    onPointerUp,
  };
}
