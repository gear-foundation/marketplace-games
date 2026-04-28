import { Critter } from "../game/types";
import { getSpriteUrl } from "../game/sprites";

export type AnimState = "attack" | "hurt" | "dying";

type Props = {
  critter: Critter;
  onClick?: () => void;
  compact?: boolean;
  highlighted?: boolean;
  mirrored?: boolean;
  animState?: AnimState;
};

export function CritterCard({
  critter,
  onClick,
  compact = false,
  highlighted = false,
  mirrored = false,
  animState,
}: Props) {
  const classes = [
    "critter-card",
    compact ? "compact" : "",
    highlighted ? "highlight" : "",
    onClick ? "clickable" : "",
    animState ? `anim-${animState}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={classes}
      onClick={onClick}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && onClick) {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="card-stats-top">
        <span className="stat-pill stat-left" title="Attack">
          <img className={`stat-icon ${mirrored ? "stat-icon-mirrored" : ""}`} src="/icons/attack.webp" alt="ATK" />
          <span>{critter.atk}</span>
        </span>
        <span className="stat-pill stat-center" title="Speed">
          <img className={`stat-icon ${mirrored ? "stat-icon-mirrored" : ""}`} src="/icons/speed.webp" alt="SPD" />
          <span>{critter.speed}</span>
        </span>
        <span className="stat-pill stat-right" title="Health">
          <img className="stat-icon" src="/icons/heart.webp" alt="HP" />
          <span>{critter.hp}</span>
        </span>
      </div>

      <div className="sprite-wrap">
        <img
          className={`sprite ${mirrored ? "sprite-mirrored" : ""}`}
          src={getSpriteUrl(critter.spriteKey)}
          alt={critter.name}
          loading="lazy"
        />
      </div>

      <h3 className="critter-name">{critter.name}</h3>
    </article>
  );
}
