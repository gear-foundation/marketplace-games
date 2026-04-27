import { Critter } from "../game/types";

type Props = {
  critter: Critter;
  buttonLabel?: string;
  onClick?: () => void;
  compact?: boolean;
  highlighted?: boolean;
};

export function CritterCard({ critter, buttonLabel, onClick, compact = false, highlighted = false }: Props) {
  return (
    <article className={`critter-card ${compact ? "compact" : ""} ${highlighted ? "highlight" : ""}`}>
      <div className="sprite" aria-hidden>
        {critter.name.slice(0, 1)}
      </div>
      <div>
        <h3>{critter.name}</h3>
        <p className="muted">{critter.class}</p>
        <p>
          HP {critter.hp}/{critter.maxHp} · ATK {critter.atk} · SPD {critter.speed}
        </p>
        <p>Lv {critter.level}</p>
        {critter.item ? <p className="muted">Item: {critter.item.name}</p> : null}
      </div>
      {onClick ? (
        <button type="button" onClick={onClick}>
          {buttonLabel ?? "Choose"}
        </button>
      ) : null}
    </article>
  );
}
