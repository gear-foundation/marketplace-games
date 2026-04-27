import { Critter, Enemy } from "../game/types";
import { CritterCard } from "./CritterCard";

type Props = {
  title: string;
  team: Array<Critter | Enemy>;
  frontId?: string;
  align?: "left" | "right";
};

export function TeamLine({ title, team, frontId, align = "left" }: Props) {
  const aliveTeam = team.filter((unit) => unit.hp > 0);
  const displayTeam = align === "left" ? [...aliveTeam].reverse() : aliveTeam;

  return (
    <section className={`team-side team-side-${align}`}>
      <h3>{title}</h3>
      <div className={`team-line ${align === "right" ? "team-line-right" : ""}`}>
        {displayTeam.map((unit) => (
          <CritterCard key={unit.id} critter={unit} compact highlighted={unit.id === frontId} />
        ))}
      </div>
    </section>
  );
}
