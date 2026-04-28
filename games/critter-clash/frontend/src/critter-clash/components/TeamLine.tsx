import { Critter, Enemy } from "../game/types";
import { AnimState, CritterCard } from "./CritterCard";

type Props = {
  title: string;
  team: Array<Critter | Enemy>;
  frontId?: string;
  align?: "left" | "right";
  animStates?: Record<string, AnimState>;
  dyingIds?: ReadonlySet<string>;
};

export function TeamLine({
  title,
  team,
  frontId,
  align = "left",
  animStates = {},
  dyingIds = new Set(),
}: Props) {
  // Keep dying units visible during their animation
  const aliveTeam = team.filter((unit) => unit.hp > 0 || dyingIds.has(unit.id));
  const displayTeam = align === "left" ? [...aliveTeam].reverse() : aliveTeam;

  return (
    <section className={`team-side team-side-${align}`}>
      <h3>{title}</h3>
      <div className={`team-line ${align === "right" ? "team-line-right" : ""}`}>
        {displayTeam.map((unit) => (
          <CritterCard
            key={unit.id}
            critter={unit}
            compact
            highlighted={unit.id === frontId}
            mirrored={align === "right"}
            animState={animStates[unit.id]}
          />
        ))}
      </div>
    </section>
  );
}
