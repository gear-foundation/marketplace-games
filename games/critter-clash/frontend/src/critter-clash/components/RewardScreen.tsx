import { Reward } from "../game/types";
import { describeReward } from "../game/rewards";

type Props = {
  rewards: Reward[];
  onPick: (reward: Reward) => void;
};

export function RewardScreen({ rewards, onPick }: Props) {
  return (
    <section className="panel">
      <h2>Wave cleared!</h2>
      <p>Choose reward:</p>
      <div className="reward-grid">
        {rewards.map((reward, index) => (
          <button type="button" className="reward-card" key={`${reward.type}-${index}`} onClick={() => onPick(reward)}>
            {describeReward(reward)}
          </button>
        ))}
      </div>
    </section>
  );
}
