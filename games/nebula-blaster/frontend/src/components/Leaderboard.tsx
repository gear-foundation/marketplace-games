import { useEffect, useState, useCallback, useRef } from "react";
import { useAccount, useApi } from "@gear-js/react-hooks";
import type { Sails } from "sails-js";
import { shortAddress, toDisplayNumber } from "../shared/format";
import { mapChainLeaderboard, type ChainScoreEntry, type LeaderboardEntry, parsePlayerStats } from "../shared/chain";

const POLL_INTERVAL = 30_000;
const VISIBLE_LIMIT = 10;
const CURRENT_PLAYER_NAME = "YOU";

type Tab = "today" | "alltime";

const placeholderEntries: LeaderboardEntry[] = [
  { name: "NOVA", score: 8540 },
  { name: "ARGO", score: 6220 },
  { name: "ZETA", score: 4810 },
  { name: "ORBI", score: 3190 },
  { name: "PULS", score: 1780 },
];

type LeaderboardProps = {
  sailsClient: Sails | null;
  refetchTrigger: number;
};

export function Leaderboard({ sailsClient, refetchTrigger }: LeaderboardProps) {
  const { account } = useAccount();
  const { api, isApiReady } = useApi();
  const [tab, setTab] = useState<Tab>("today");
  const [daily, setDaily] = useState<LeaderboardEntry[]>(placeholderEntries);
  const [alltime, setAlltime] = useState<LeaderboardEntry[]>(placeholderEntries);
  const [playerBest, setPlayerBest] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const isFetching = useRef(false);

  const fetchBoards = useCallback(async () => {
    if (!sailsClient || !isApiReady || isFetching.current) return;
    isFetching.current = true;

    const svc = sailsClient.services.NebulaBlasterService;
    if (!svc) {
      setStatusMsg("Contract service not found in IDL.");
      isFetching.current = false;
      return;
    }

    try {
      const addr = account?.decodedAddress;
      const dailyQ = svc.queries.GetDailyTop(VISIBLE_LIMIT);
      if (addr) dailyQ.withAddress(addr);
      const alltimeQ = svc.queries.GetAlltimeTop(VISIBLE_LIMIT);
      if (addr) alltimeQ.withAddress(addr);

      const [dailyRaw, alltimeRaw] = await Promise.all([dailyQ.call(), alltimeQ.call()]);

      setDaily(mapChainLeaderboard(dailyRaw as ChainScoreEntry[], CURRENT_PLAYER_NAME, addr));
      setAlltime(mapChainLeaderboard(alltimeRaw as ChainScoreEntry[], CURRENT_PLAYER_NAME, addr));

      if (addr) {
        const statsQ = svc.queries.GetPlayerStats(addr);
        statsQ.withAddress(addr);
        const statsRaw = await statsQ.call();
        const stats = parsePlayerStats(statsRaw);
        setPlayerBest(stats?.bestScore ?? null);
      }

      setStatusMsg("");
    } catch (err) {
      setStatusMsg(`Leaderboard unavailable: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      isFetching.current = false;
    }
  }, [sailsClient, isApiReady, account?.decodedAddress]);

  // Initial + refetch trigger
  useEffect(() => {
    void fetchBoards();
  }, [fetchBoards, refetchTrigger]);

  // Poll every 30s while idle
  useEffect(() => {
    const id = setInterval(() => void fetchBoards(), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchBoards]);

  const entries = tab === "today" ? daily : alltime;

  return (
    <section className="nebula-leaderboard" aria-label="Leaderboard">
      <div className="nebula-leaderboard__tabs">
        <button
          className={`nebula-tab${tab === "today" ? " nebula-tab--active" : ""}`}
          onClick={() => setTab("today")}
        >
          Today
        </button>
        <button
          className={`nebula-tab${tab === "alltime" ? " nebula-tab--active" : ""}`}
          onClick={() => setTab("alltime")}
        >
          All-Time
        </button>
      </div>

      {statusMsg && <p className="nebula-note">{statusMsg}</p>}

      <ol className="nebula-leaderboard__list">
        {entries.map((entry, i) => (
          <li
            key={`${entry.name}-${i}`}
            className={`nebula-lb-row${entry.name === CURRENT_PLAYER_NAME ? " nebula-lb-row--you" : ""}`}
          >
            <span className="nebula-lb-rank">{i + 1}</span>
            <strong className="nebula-lb-name">{entry.name}</strong>
            <em className="nebula-lb-score">{entry.score.toLocaleString()}</em>
          </li>
        ))}
        {entries.length === 0 && (
          <li className="nebula-lb-empty">No scores yet. Be the first!</li>
        )}
      </ol>

      {playerBest !== null && (
        <p className="nebula-note nebula-note--best">Your best: {playerBest.toLocaleString()}</p>
      )}
    </section>
  );
}
