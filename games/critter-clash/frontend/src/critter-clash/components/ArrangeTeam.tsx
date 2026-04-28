import { DragEvent } from "react";
import { Critter } from "../game/types";
import { CritterCard } from "./CritterCard";

type Props = {
  team: Critter[];
  onReorder: (from: number, to: number) => void;
};

const SLOT_LABELS = ["Front", "Middle", "Back"];

export function ArrangeTeam({ team, onReorder }: Props) {
  const onDragStart = (event: DragEvent<HTMLElement>, from: number) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(from));
  };

  const onDrop = (event: DragEvent<HTMLElement>, to: number) => {
    event.preventDefault();
    const from = Number(event.dataTransfer.getData("text/plain"));
    if (Number.isNaN(from)) return;
    onReorder(from, to);
  };

  return (
    <section className="arrange-panel">
      <h3>Arrange before battle</h3>
      <p className="muted">Drag critters to set order. Front slot attacks and gets targeted first.</p>
      <div className="arrange-lineup" role="list" aria-label="Arrange team slots">
        {[2, 1, 0].map((slot) => {
          const critter = team[slot];
          return (
            <div
              key={slot}
              className="arrange-slot"
              role="listitem"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop(event, slot)}
            >
              <span className="arrange-slot-label">{SLOT_LABELS[slot]}</span>
              {critter ? (
                <div draggable onDragStart={(event) => onDragStart(event, slot)}>
                  <CritterCard critter={critter} compact />
                </div>
              ) : (
                <article className="critter-card compact slot-card">
                  <div className="slot-placeholder">Open slot</div>
                </article>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
