import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { LevelSelect } from "./components/LevelSelect";
import { MainMenu } from "./components/MainMenu";
import { OfflineChainPanel } from "./components/OfflineChainPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { loadProgress, recordLevelCompletion, saveProgress } from "./game/gameState";
import { getLevels } from "./game/levelLoader";
import type { GameState, LevelCompletion, ProgressState } from "./game/types";

const CHAIN_ENABLED = import.meta.env.VITE_ENABLE_CHAIN === "true";
const ChainRuntime = lazy(() => import("./components/ChainRuntime"));
const RoboChainPanel = lazy(() =>
  import("./components/RoboChainPanel").then((module) => ({ default: module.RoboChainPanel })),
);

type Screen = "menu" | "levels" | "settings" | "game";

export function RoboSaveEnyApp() {
  const levels = useMemo(() => getLevels(), []);

  if (CHAIN_ENABLED) {
    return (
      <Suspense fallback={<AppLoading />}>
        <ChainRuntime>
          <RoboSaveEnyContent levels={levels} chainEnabled />
        </ChainRuntime>
      </Suspense>
    );
  }

  return <RoboSaveEnyContent levels={levels} chainEnabled={false} />;
}

function RoboSaveEnyContent({ levels, chainEnabled }: { levels: ReturnType<typeof getLevels>; chainEnabled: boolean }) {
  const [screen, setScreen] = useState<Screen>("menu");
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress());
  const [selectedLevelId, setSelectedLevelId] = useState(() => Math.min(loadProgress().unlockedLevel, levels.length));
  const [completion, setCompletion] = useState<LevelCompletion | null>(null);
  const [lastCompletion, setLastCompletion] = useState<LevelCompletion | null>(null);
  const [sessionId, setSessionId] = useState(1);

  const selectedLevel = levels.find((level) => level.id === selectedLevelId) ?? levels[0];
  const hasNextLevel = selectedLevelId < levels.length;

  const updateProgress = useCallback((nextProgress: ProgressState) => {
    setProgress(nextProgress);
    saveProgress(nextProgress);
  }, []);

  const openLevel = useCallback((levelId: number) => {
    setSelectedLevelId(levelId);
    setCompletion(null);
    setScreen("game");
    setSessionId((current) => current + 1);
  }, []);

  const handlePlay = useCallback(() => {
    openLevel(Math.min(progress.unlockedLevel, levels.length));
  }, [levels.length, openLevel, progress.unlockedLevel]);

  const handleComplete = useCallback(
    (state: GameState) => {
      const { progress: nextProgress, score } = recordLevelCompletion(progress, selectedLevel, state.movesCount);
      updateProgress(nextProgress);

      const payload: LevelCompletion = {
        levelId: selectedLevel.id,
        moves: state.movesCount,
        pushes: state.pushesCount,
        score,
        sessionId,
      };

      setCompletion(payload);
      setLastCompletion(payload);
      return payload;
    },
    [progress, selectedLevel, sessionId, updateProgress],
  );

  const restartSession = useCallback(() => {
    setCompletion(null);
    setSessionId((current) => current + 1);
  }, []);

  const nextLevel = useCallback(() => {
    if (!hasNextLevel) return;
    openLevel(selectedLevelId + 1);
  }, [hasNextLevel, openLevel, selectedLevelId]);

  return (
    <main className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <section className="brand-panel">
        <p className="eyebrow">Robo Lab Rescue</p>
        <h2>Laser logic, tiny robot nerves.</h2>
        <p>
          Save Eny first. Then reach the exit. If the portal glows before Eny is safe, Robo politely ignores it.
        </p>
        <div className="brand-stats">
          <span>
            Unlocked <strong>{Math.min(progress.unlockedLevel, levels.length)}/{levels.length}</strong>
          </span>
          <span>
            Completed <strong>{Object.keys(progress.completedLevels).length}</strong>
          </span>
          <span>
            Chain <strong>{chainEnabled ? "On" : "Off"}</strong>
          </span>
        </div>
        {chainEnabled ? (
          <Suspense fallback={<ChainPanelSkeleton />}>
            <RoboChainPanel lastCompletion={lastCompletion} />
          </Suspense>
        ) : (
          <OfflineChainPanel lastCompletion={lastCompletion} />
        )}
      </section>

      <section className="play-panel">
        {screen === "menu" ? (
          <MainMenu onPlay={handlePlay} onLevels={() => setScreen("levels")} onSettings={() => setScreen("settings")} />
        ) : null}
        {screen === "levels" ? (
          <LevelSelect levels={levels} progress={progress} onBack={() => setScreen("menu")} onSelectLevel={openLevel} />
        ) : null}
        {screen === "settings" ? (
          <SettingsPanel progress={progress} onBack={() => setScreen("menu")} onChange={updateProgress} />
        ) : null}
        {screen === "game" ? (
          <GameScreen
            level={selectedLevel}
            hasNextLevel={hasNextLevel}
            completion={completion}
            onComplete={handleComplete}
            onBack={() => setScreen("menu")}
            onRestartSession={restartSession}
            onNextLevel={nextLevel}
          />
        ) : null}
      </section>
    </main>
  );
}

function AppLoading() {
  return (
    <main className="app-shell app-shell--loading">
      <section className="menu-card">
        <p className="eyebrow">Vara Session</p>
        <h1>Loading Robo Lab</h1>
        <p>The rescue deck will open as soon as wallet providers finish warming up.</p>
      </section>
    </main>
  );
}

function ChainPanelSkeleton() {
  return (
    <section className="chain-card">
      <p className="eyebrow">Vara Session</p>
      <h2>Loading</h2>
      <p>Preparing wallet and leaderboard session.</p>
    </section>
  );
}
