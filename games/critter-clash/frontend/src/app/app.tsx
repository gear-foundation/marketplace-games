import { DragEvent, useEffect, useMemo, useState } from "react";
import { BattleScreen } from "../critter-clash/components/BattleScreen";
import { CritterCard } from "../critter-clash/components/CritterCard";
import { DebugPanel } from "../critter-clash/components/DebugPanel";
import { RewardScreen } from "../critter-clash/components/RewardScreen";
import { RunSummary } from "../critter-clash/components/RunSummary";
import { getBiomeForWave } from "../critter-clash/game/balance";
import { createRoundTurnOrderIds, isTeamDead, resolveBattleTurn } from "../critter-clash/game/battle";
import { createStarterOptions } from "../critter-clash/game/critters";
import { createEnemyTeam } from "../critter-clash/game/enemies";
import { createSeededRandom } from "../critter-clash/game/random";
import { applyReward, generateRewards } from "../critter-clash/game/rewards";
import { calculateScore } from "../critter-clash/game/scoring";
import { GameState, Reward } from "../critter-clash/game/types";

const random = createSeededRandom();
const STARTER_SLOT_COUNT = 3;
const ROUND_PREP_MS = 450;
const DEATH_PAUSE_MS = 450;

function createInitialState(): GameState {
  return {
    phase: "intro",
    wave: 1,
    biome: getBiomeForWave(1),
    playerTeam: [],
    enemyTeam: [],
    starterOptions: [],
    selectedStarterIds: Array.from({ length: STARTER_SLOT_COUNT }, () => null),
    rewardOptions: [],
    battleLog: [],
    roundTurnOrderIds: [],
    battleRound: 1,
    battleRoundSize: 0,
    roundPauseUntilMs: null,
    deathPauseUntilMs: null,
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
  const debugMode = useMemo(
    () => new URLSearchParams(window.location.search).get("debug") === "true",
    []
  );

  useEffect(() => {
    if (state.phase !== "battle") return;
    if (!state.isAutoBattling) return;

    const interval = window.setInterval(() => {
      setState((prev) => tickBattle(prev));
    }, state.battleTurnDelayMs);

    return () => window.clearInterval(interval);
  }, [state.phase, state.isAutoBattling, state.battleTurnDelayMs]);

  const startRun = () => {
    setState((prev) => ({
      ...createInitialState(),
      phase: "choose_starter",
      starterOptions: createStarterOptions(random),
      selectedStarterIds: Array.from({ length: STARTER_SLOT_COUNT }, () => null),
    }));
  };

  const reorderSelectedStarters = (from: number, to: number) => {
    setState((prev) => {
      if (prev.phase !== "choose_starter") return prev;
      if (from === to) return prev;
      if (from < 0 || to < 0) return prev;
      if (
        from >= prev.selectedStarterIds.length ||
        to >= prev.selectedStarterIds.length
      )
        return prev;
      const next = [...prev.selectedStarterIds];
      [next[from], next[to]] = [next[to], next[from]];
      return { ...prev, selectedStarterIds: next };
    });
  };

  const toggleStarter = (starterId: string) => {
    setState((prev) => {
      if (prev.phase !== "choose_starter") return prev;
      const isSelected = prev.selectedStarterIds.includes(starterId);
      if (isSelected) {
        return {
          ...prev,
          selectedStarterIds: prev.selectedStarterIds.map((id) =>
            id === starterId ? null : id
          ),
        };
      }
      const firstEmptySlot = prev.selectedStarterIds.findIndex((id) => id === null);
      if (firstEmptySlot === -1) return prev;
      const next = [...prev.selectedStarterIds];
      next[firstEmptySlot] = starterId;
      return {
        ...prev,
        selectedStarterIds: next,
      };
    });
  };

  const startStarterBattle = () => {
    setState((prev) => {
      if (prev.phase !== "choose_starter") return prev;
      const selectedStarterCount = prev.selectedStarterIds.filter(Boolean).length;
      if (selectedStarterCount !== STARTER_SLOT_COUNT) return prev;
      const selectedTeam = prev.selectedStarterIds
        .map((starterId, index) => {
          if (!starterId) return null;
          const starter = prev.starterOptions.find(
            (item) => item.id === starterId
          );
          if (!starter) return null;
          return { ...starter, id: `${starter.id}-${Date.now()}-${index}` };
        })
        .filter(
          (starter): starter is NonNullable<typeof starter> => starter !== null
        );
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
        roundTurnOrderIds: [],
        battleRound: 1,
        battleRoundSize: 0,
        roundPauseUntilMs: null,
        deathPauseUntilMs: null,
        selectedStarterIds: Array.from({ length: STARTER_SLOT_COUNT }, () => null),
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
        roundTurnOrderIds: [],
        battleRound: 1,
        battleRoundSize: 0,
        roundPauseUntilMs: null,
        deathPauseUntilMs: null,
      };
    });
  };

  const selectedStarterSlots = state.selectedStarterIds
    .map((selectedId) => state.starterOptions.find((pet) => pet.id === selectedId))
    .map((pet) => pet ?? null);
  const selectedStarterCount = state.selectedStarterIds.filter(Boolean).length;

  const onLineupDragStart = (event: DragEvent<HTMLElement>, from: number) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(from));
  };

  const onLineupDrop = (event: DragEvent<HTMLElement>, to: number) => {
    event.preventDefault();
    const from = Number(event.dataTransfer.getData("text/plain"));
    if (Number.isNaN(from)) return;
    reorderSelectedStarters(from, to);
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
        roundTurnOrderIds: [],
        battleRound: 1,
        battleRoundSize: 0,
        roundPauseUntilMs: null,
        deathPauseUntilMs: null,
      };
    });
  };

  const giveReward = () => {
    setState((prev) => {
      if (prev.playerTeam.length === 0) return prev;
      const [reward] = generateRewards(prev.playerTeam, random);
      return updateScore({
        ...prev,
        playerTeam: applyReward(prev.playerTeam, reward, random),
      });
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
        <h1>Meme Pet Clash</h1>
        <p>
          Pick your meme squad, outplay enemy waves, and scale your run score.
        </p>
      </header>

      {state.phase === "intro" ? (
        <section className="panel center">
          <button type="button" onClick={startRun}>
            Start Meme Run
          </button>
        </section>
      ) : null}

      {state.phase === "choose_starter" ? (
        <section className="panel">
          <h2>Choose your starter roster (3/3)</h2>
          <p className="muted">
            Pick from the 12 meme pets from the sprite pack. Lock 3 to begin the
            first clash.
          </p>
          <section>
            <h3>Your lineup</h3>
            <div className="selected-team-line">
              {selectedStarterSlots.map((selectedPet, slot) => (
                <div
                  key={`slot-${slot}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onLineupDrop(event, slot)}
                >
                  {selectedPet ? (
                    <div
                      draggable
                      onDragStart={(event) => onLineupDragStart(event, slot)}
                    >
                      <CritterCard
                        critter={selectedPet}
                        compact
                        onClick={() => toggleStarter(selectedPet.id)}
                      />
                    </div>
                  ) : (
                    <article className="critter-card compact slot-card">
                      <div className="slot-placeholder">Open slot</div>
                    </article>
                  )}
                </div>
              ))}
            </div>
            <div className="actions-row">
              <button
                className="start-clash-button"
                type="button"
                disabled={selectedStarterCount !== STARTER_SLOT_COUNT}
                onClick={startStarterBattle}
              >
                Start clash
              </button>
            </div>
          </section>
          <div className="starter-grid">
            {state.starterOptions.map((pet) => (
              <CritterCard
                key={pet.id}
                critter={pet}
                highlighted={state.selectedStarterIds.includes(pet.id)}
                onClick={() => toggleStarter(pet.id)}
              />
            ))}
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
          roundTurnOrderIds={state.roundTurnOrderIds}
          battleRound={state.battleRound}
          battleRoundSize={state.battleRoundSize}
          isRoundPreparing={
            state.roundPauseUntilMs !== null && Date.now() < state.roundPauseUntilMs
          }
          isAutoBattling={state.isAutoBattling}
          battleTurnDelayMs={state.battleTurnDelayMs}
          onToggleAutoBattle={(value: boolean) =>
            setState((prev) => ({ ...prev, isAutoBattling: value }))
          }
          onNextTurn={() => setState((prev) => tickBattle(prev))}
          onChangeBattleSpeed={(value: number) =>
            setState((prev) => ({ ...prev, battleTurnDelayMs: value }))
          }
        />
      ) : null}

      {state.phase === "reward" ? (
        <RewardScreen rewards={state.rewardOptions} onPick={pickReward} />
      ) : null}

      {state.phase === "summary" ? (
        <RunSummary
          stats={state.runStats}
          score={state.score}
          onRestart={restart}
        />
      ) : null}

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
          setAutoBattle={(value) =>
            setState((prev) => ({ ...prev, isAutoBattling: value }))
          }
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
      state.runStats.enemiesDefeated +
      state.enemyTeam.filter((enemy) => enemy.hp === 0).length;
    const bossesDefeated =
      state.runStats.bossesDefeated +
      (state.enemyTeam.some((enemy) => enemy.enemyType === "boss") ? 1 : 0);

    const nextState: GameState = {
      ...state,
      phase: "reward",
      rewardOptions,
      roundTurnOrderIds: [],
      battleRound: 1,
      battleRoundSize: 0,
      roundPauseUntilMs: null,
      deathPauseUntilMs: null,
      runStats: {
        waveReached: state.wave,
        highestWaveReached: Math.max(
          state.runStats.highestWaveReached,
          state.wave
        ),
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
      roundTurnOrderIds: [],
      battleRound: 1,
      battleRoundSize: 0,
      roundPauseUntilMs: null,
      deathPauseUntilMs: null,
      runStats: {
        ...state.runStats,
        waveReached: state.wave,
        highestWaveReached: Math.max(
          state.runStats.highestWaveReached,
          state.wave
        ),
      },
    };
    return {
      ...summaryState,
      score: calculateScore(summaryState.runStats, summaryState.playerTeam),
    };
  }

  const aliveIds = new Set(
    [...state.playerTeam, ...state.enemyTeam]
      .filter((unit) => unit.hp > 0)
      .map((unit) => unit.id)
  );
  let roundTurnOrderIds = state.roundTurnOrderIds.filter((id) => aliveIds.has(id));
  let battleRound = state.battleRound;
  let battleRoundSize = state.battleRoundSize;
  let roundPauseUntilMs = state.roundPauseUntilMs;
  if (roundTurnOrderIds.length === 0) {
    roundTurnOrderIds = createRoundTurnOrderIds(state.playerTeam, state.enemyTeam);
    if (state.battleLog.length > 0 || state.battleRoundSize > 0) {
      battleRound += 1;
      roundPauseUntilMs = Date.now() + ROUND_PREP_MS;
    }
    battleRoundSize = roundTurnOrderIds.length;
  }
  if (roundPauseUntilMs !== null && Date.now() < roundPauseUntilMs) {
    return {
      ...state,
      roundTurnOrderIds,
      battleRound,
      battleRoundSize,
      roundPauseUntilMs,
    };
  }
  roundPauseUntilMs = null;
  if (state.deathPauseUntilMs !== null && Date.now() < state.deathPauseUntilMs) {
    return state;
  }

  const attackerId = roundTurnOrderIds[0];
  const turn = resolveBattleTurn(state.playerTeam, state.enemyTeam, attackerId);
  const aliveAfterTurnIds = new Set(
    [...turn.playerTeam, ...turn.enemyTeam]
      .filter((unit) => unit.hp > 0)
      .map((unit) => unit.id)
  );
  const nextRoundTurnOrderIds = roundTurnOrderIds
    .slice(1)
    .filter((id) => aliveAfterTurnIds.has(id));

  return {
    ...state,
    playerTeam: turn.playerTeam,
    enemyTeam: turn.enemyTeam,
    roundTurnOrderIds: nextRoundTurnOrderIds,
    battleRound,
    battleRoundSize,
    roundPauseUntilMs,
    deathPauseUntilMs: turn.event.targetDied ? Date.now() + DEATH_PAUSE_MS : null,
    battleLog: [...state.battleLog.slice(-6), turn.event],
  };
}
