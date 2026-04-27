import { useEffectEvent, useRef } from "react";
import type { PointerEventHandler } from "react";
import type { Direction } from "../game/types";

type SwipeControlsOptions = {
  enabled?: boolean;
  onMove: (direction: Direction) => void;
};

type SwipePoint = {
  x: number;
  y: number;
};

const SWIPE_THRESHOLD = 24;

export function useSwipeControls({ enabled = true, onMove }: SwipeControlsOptions) {
  const startRef = useRef<SwipePoint | null>(null);

  const resetSwipe = useEffectEvent(() => {
    startRef.current = null;
  });

  const onPointerDown = useEffectEvent<PointerEventHandler<HTMLElement>>((event) => {
    if (!enabled || event.pointerType === "mouse") {
      return;
    }

    startRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  });

  const onPointerUp = useEffectEvent<PointerEventHandler<HTMLElement>>((event) => {
    if (!enabled || event.pointerType === "mouse" || !startRef.current) {
      return;
    }

    const deltaX = event.clientX - startRef.current.x;
    const deltaY = event.clientY - startRef.current.y;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    resetSwipe();

    if (Math.max(horizontalDistance, verticalDistance) < SWIPE_THRESHOLD) {
      return;
    }

    if (horizontalDistance > verticalDistance) {
      onMove(deltaX > 0 ? "right" : "left");
      return;
    }

    onMove(deltaY > 0 ? "down" : "up");
  });

  const onPointerCancel = useEffectEvent<PointerEventHandler<HTMLElement>>(() => {
    resetSwipe();
  });

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave: onPointerCancel,
  };
}
