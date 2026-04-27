import { useEffect, useMemo, useState } from "react";
import { BattleScreen } from "../critter-clash/components/BattleScreen";
import { CritterCard } from "../critter-clash/components/CritterCard";
import { DebugPanel } from "../critter-clash/components/DebugPanel";
import { RewardScreen } from "../critter-clash/components/RewardScreen";
import { RunSummary } from "../critter-clash/components/RunSummary";
import { getBiomeForWave } from "../critter-clash/game/balance";
import { isTeamDead, resolveBattleTurn } from "../critter-clash/game/battle";
import { createStarterOptions } from "../critter-clash/game/critters";
import { createEnemyTeam } from "../critter-clash/game/enemies";
import { createSeededRandom } from "../critter-clash/game/random";
import { applyReward, generateRewards } from "../critter-clash/game/rewards";
import { calculateScore } from "../critter-clash/game/scoring";
import { GameState, Reward } from "../critter-clash/game/types";

const random = createSeededRandom();

function createInitialState(): GameState {
  return {
    phase: "intro",
    wave: 1,
    biome: getBiomeForWave(1),
    playerTeam: [],
    enemyTeam: [],
    starterOptions: [],
    selectedStarterIds: [],
    rewardOptions: [],
    battleLog: [],
    score: 0,
    isAutoBattling: true,
    battleTurnDelayMs: 800,
    runStats: {
      waveReached: 0,
      highestWaveReached: 0,
      enemiesDefeated: 0,
      bossesDefeated: 0,
    },
  };
}

export function Game() {
  const [state, setState] = useState<GameState>(createInitialState());
  const [battleFocusMode, setBattleFocusMode] = useState(false);
  const debugMode = useMemo(() => new URLSearchParams(window.location.search).get("debug") === "true", []);

  useEffect(() => {
    if (state.phase !== "battle") return;
    if (!state.isAutoBattling) return;

    const interval = window.setInterval(
      () => {
        setState((prev) => tickBattle(prev));
      },
      state.battleTurnDelayMs
    );

    return () => window.clearInterval(interval);
  }, [state.phase, state.isAutoBattling, state.battleTurnDelayMs]);

  useEffect(() => {
    if (state.phase !== "battle") {
      setBattleFocusMode(false);
    }
  }, [state.phase]);

  const startRun = () => {
    setState((prev) => ({
      ...createInitialState(),
      phase: "choose_starter",
      starterOptions: createStarterOptions(random),
      selectedStarterIds: [],
    }));
  };

  const toggleStarter = (starterId: string) => {
    setState((prev) => {
      if (prev.phase !== "choose_starter") return prev;
      const isSelected = prev.selectedStarterIds.includes(starterId);
      if (isSelected) {
        return {
          ...prev,
          selectedStarterIds: prev.selectedStarterIds.filter((id) => id !== starterId),
        };
      }
      if (prev.selectedStarterIds.length >= 3) return prev;
      return {
        ...prev,
        selectedStarterIds: [...prev.selectedStarterIds, starterId],
      };
    });
  };

  const startStarterBattle = () => {
    setState((prev) => {
      if (prev.phase !== "choose_starter") return prev;
      if (prev.selectedStarterIds.length !== 3) return prev;
      const selectedTeam = prev.selectedStarterIds
        .map((starterId, index) => {
          const starter = prev.starterOptions.find((item) => item.id === starterId);
          if (!starter) return null;
          return { ...starter, id: `${starter.id}-${Date.now()}-${index}` };
        })
        .filter((starter): starter is NonNullable<typeof starter> => starter !== null);
      if (selectedTeam.length !== 3) return prev;
      const enemyTeam = createEnemyTeam(1, getBiomeForWave(1), random);
      return {
        ...prev,
        phase: "battle",
        wave: 1,
        biome: getBiomeForWave(1),
        playerTeam: selectedTeam,
        enemyTeam,
        battleLog: [],
        selectedStarterIds: [],
      };
    });
  };

  const pickReward = (reward: Reward) => {
    setState((prev) => {
      const playerTeam = applyReward(prev.playerTeam, reward, random);
      const nextWave = prev.wave + 1;
      const biome = getBiomeForWave(nextWave);
      return {
        ...prev,
        phase: "battle",
        wave: nextWave,
        biome,
        playerTeam,
        enemyTeam: createEnemyTeam(nextWave, biome, random),
        rewardOptions: [],
        battleLog: [],
      };
    });
  };

  const restart = () => setState(createInitialState());

  const updateScore = (nextState: GameState): GameState => ({
    ...nextState,
    score: calculateScore(nextState.runStats, nextState.playerTeam),
  });

  const startWave = (wave: number) => {
    setState((prev) => {
      if (prev.playerTeam.length === 0) return prev;
      const biome = getBiomeForWave(wave);
      return {
        ...prev,
        phase: "battle",
        wave,
        biome,
        enemyTeam: createEnemyTeam(wave, biome, random),
        battleLog: [],
      };
    });
  };

  const giveReward = () => {
    setState((prev) => {
      if (prev.playerTeam.length === 0) return prev;
      const [reward] = generateRewards(prev.playerTeam, random);
      return updateScore({ ...prev, playerTeam: applyReward(prev.playerTeam, reward, random) });
    });
  };

  const killEnemyTeam = () => {
    setState((prev) => {
      if (prev.phase !== "battle") return prev;
      const enemyTeam = prev.enemyTeam.map((enemy) => ({ ...enemy, hp: 0 }));
      return tickBattle({ ...prev, enemyTeam });
    });
  };

  const healTeam = () => {
    setState((prev) => ({
      ...prev,
      playerTeam: prev.playerTeam.map((pet) => ({ ...pet, hp: pet.maxHp })),
    }));
  };

  return (
    <main className={`cc-app biome-${state.biome}`}>
      <header>
        <h1>Critter Clash</h1>
        <p>Build a team. Survive endless waves.</p>
      </header>

      {state.phase === "intro" ? (
        <section className="panel center">
          <button type="button" onClick={startRun}>
            Start Run
          </button>
        </section>
      ) : null}

      {state.phase === "choose_starter" ? (
        <section className="panel">
          <h2>Choose 3 critters for your team</h2>
          <p className="muted">
            Selected: {state.selectedStarterIds.length}/3. Battle starts only after you lock in all 3.
          </p>
          <section>
            <h3>Selected team</h3>
            <div className="selected-team-line">
              {state.selectedStarterIds.map((selectedId) => {
                const selectedPet = state.starterOptions.find((pet) => pet.id === selectedId);
                if (!selectedPet) return null;
                return (
                  <CritterCard
                    key={`selected-${selectedPet.id}`}
                    critter={selectedPet}
                    compact
                    buttonLabel="Remove"
                    onClick={() => toggleStarter(selectedPet.id)}
                  />
                );
              })}
              {Array.from({ length: Math.max(0, 3 - state.selectedStarterIds.length) }).map((_, index) => (
                <article key={`slot-${index}`} className="critter-card compact slot-card">
                  <div className="slot-placeholder">Empty slot</div>
                </article>
              ))}
            </div>
          </section>
          <div className="starter-grid">
            {state.starterOptions.map((pet) => (
              <CritterCard
                key={pet.id}
                critter={pet}
                highlighted={state.selectedStarterIds.includes(pet.id)}
                buttonLabel={state.selectedStarterIds.includes(pet.id) ? "Remove" : "Add to team"}
                onClick={() => toggleStarter(pet.id)}
              />
            ))}
          </div>
          <div className="actions-row">
            <button type="button" disabled={state.selectedStarterIds.length !== 3} onClick={startStarterBattle}>
              Start battle
            </button>
          </div>
        </section>
      ) : null}

      {state.phase === "battle" ? (
        <BattleScreen
          wave={state.wave}
          biome={state.biome}
          playerTeam={state.playerTeam}
          enemyTeam={state.enemyTeam}
          battleLog={state.battleLog}
          isAutoBattling={state.isAutoBattling}
          battleTurnDelayMs={state.battleTurnDelayMs}
          focusMode={battleFocusMode}
          onToggleFocusMode={() => setBattleFocusMode((prev) => !prev)}
          onToggleAutoBattle={(value: boolean) => setState((prev) => ({ ...prev, isAutoBattling: value }))}
          onNextTurn={() => setState((prev) => tickBattle(prev))}
          onChangeBattleSpeed={(value: number) => setState((prev) => ({ ...prev, battleTurnDelayMs: value }))}
        />
      ) : null}

      {state.phase === "reward" ? <RewardScreen rewards={state.rewardOptions} onPick={pickReward} /> : null}

      {state.phase === "summary" ? <RunSummary stats={state.runStats} score={state.score} onRestart={restart} /> : null}

      <section className="panel stats">
        <h3>Run stats</h3>
        <p>Highest wave: {state.runStats.highestWaveReached}</p>
        <p>Wave reached: {state.runStats.waveReached}</p>
        <p>Enemies defeated: {state.runStats.enemiesDefeated}</p>
        <p>Bosses defeated: {state.runStats.bossesDefeated}</p>
        <p>Score: {state.score}</p>
      </section>

      {debugMode ? (
        <DebugPanel
          onStartWave={startWave}
          onKillEnemies={killEnemyTeam}
          onHealTeam={healTeam}
          onGiveReward={giveReward}
          autoBattle={state.isAutoBattling}
          setAutoBattle={(value) => setState((prev) => ({ ...prev, isAutoBattling: value }))}
        />
      ) : null}
    </main>
  );
}

function tickBattle(state: GameState): GameState {
  if (state.phase !== "battle") return state;

  if (isTeamDead(state.enemyTeam)) {
    const rewardOptions = generateRewards(state.playerTeam, random);
    const enemiesDefeated =
      state.runStats.enemiesDefeated + state.enemyTeam.filter((enemy) => enemy.hp === 0).length;
    const bossesDefeated =
      state.runStats.bossesDefeated + (state.enemyTeam.some((enemy) => enemy.enemyType === "boss") ? 1 : 0);

    const nextState: GameState = {
      ...state,
      phase: "reward",
      rewardOptions,
      runStats: {
        waveReached: state.wave,
        highestWaveReached: Math.max(state.runStats.highestWaveReached, state.wave),
        enemiesDefeated,
        bossesDefeated,
      },
    };

    return {
      ...nextState,
      score: calculateScore(nextState.runStats, nextState.playerTeam),
    };
  }

  if (isTeamDead(state.playerTeam)) {
    const summaryState: GameState = {
      ...state,
      phase: "summary",
      runStats: {
        ...state.runStats,
        waveReached: state.wave,
        highestWaveReached: Math.max(state.runStats.highestWaveReached, state.wave),
      },
    };
    return {
      ...summaryState,
      score: calculateScore(summaryState.runStats, summaryState.playerTeam),
    };
  }

  const turn = resolveBattleTurn(state.playerTeam, state.enemyTeam);
  return {
    ...state,
    playerTeam: turn.playerTeam,
    enemyTeam: turn.enemyTeam,
    battleLog: [...state.battleLog.slice(-6), turn.event],
  };
}
