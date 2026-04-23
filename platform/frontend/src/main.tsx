import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AccountProvider, AlertProvider, ApiProvider } from "@gear-js/react-hooks";
import { Alert, alertStyles } from "@gear-js/ui";
import { Wallet } from "@gear-js/wallet-connect";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@gear-js/ui/dist/index.css";
import "@gear-js/vara-ui/dist/style.css";
import "@gear-js/wallet-connect/dist/style.css";
import "./styles.css";

type GameStatus = "live" | "soon";

type GameCard = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  url?: string;
  status: GameStatus;
  image: string;
  tags: string[];
};

type ApiGame = {
  id?: unknown;
  slug?: unknown;
  title?: unknown;
  description?: unknown;
  url?: unknown;
  frontendUrl?: unknown;
  imageUrl?: unknown;
  tags?: unknown;
  status?: unknown;
};

const APP_NAME = "Vara Arcade";
const VARA_NODE_ADDRESS = import.meta.env.VITE_NODE_ADDRESS || "wss://rpc.vara.network";
const SKYBOUND_JUMP_URL = import.meta.env.VITE_SKYBOUND_JUMP_URL || "https://arcade-vara.up.railway.app";
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

const fallbackGames: GameCard[] = [
  {
    id: "skybound-jump",
    title: "Skybound Jump",
    eyebrow: "Live on Vara",
    description: "A jungle platformer where you jump higher, collect bananas, dodge tigers, and submit your best run on-chain.",
    url: SKYBOUND_JUMP_URL,
    status: "live",
    image: "/monkey.png",
    tags: ["Leaderboard", "Gas voucher", "Mainnet"],
  },
  {
    id: "next-game",
    title: "Next Game",
    eyebrow: "Coming soon",
    description: "The next arcade contract will appear here with its own leaderboard, assets, and voucher access.",
    status: "soon",
    image: "/banana.png",
    tags: ["Shared wallet", "New contract", "Vara Arcade"],
  },
];

const queryClient = new QueryClient();

function normalizeStatus(status: unknown): GameStatus {
  return status === "live" ? "live" : "soon";
}

function normalizeTags(tags: unknown): string[] {
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
}

function normalizeGame(game: ApiGame): GameCard {
  const status = normalizeStatus(game.status);
  const id = String(game.slug || game.id || game.title || "game");

  return {
    id,
    title: String(game.title || "Untitled Game"),
    eyebrow: status === "live" ? "Live on Vara" : "Coming soon",
    description: String(game.description || ""),
    url: typeof game.url === "string" ? game.url : typeof game.frontendUrl === "string" ? game.frontendUrl : undefined,
    status,
    image: typeof game.imageUrl === "string" && game.imageUrl.length > 0 ? game.imageUrl : "/banana.png",
    tags: normalizeTags(game.tags),
  };
}

async function fetchGames(): Promise<GameCard[]> {
  if (!BACKEND_URL) return fallbackGames;

  const response = await fetch(`${BACKEND_URL}/games`);
  if (!response.ok) {
    throw new Error(`Games backend returned ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) return fallbackGames;

  const games = data.map((game) => normalizeGame(game as ApiGame));
  return games.length > 0 ? games : fallbackGames;
}

function openGame(game: GameCard) {
  if (!game.url) return;
  window.location.href = game.url;
}

function PlatformApp() {
  const [games, setGames] = useState<GameCard[]>(fallbackGames);

  useEffect(() => {
    let cancelled = false;

    fetchGames()
      .then((nextGames) => {
        if (!cancelled) setGames(nextGames);
      })
      .catch(() => {
        if (!cancelled) setGames(fallbackGames);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="platform-shell">
      <header className="platform-header">
        <div className="brand-copy">
          <p>Vara Arcade</p>
          <h1>Play on-chain games</h1>
        </div>
        <div className="wallet-dock" aria-label="Wallet connection">
          <Wallet theme="vara" displayBalance={false} />
        </div>
      </header>

      <section className="game-grid" aria-label="Available games">
        {games.map((game) => (
          <article className={`game-card${game.status === "soon" ? " is-soon" : ""}`} key={game.id}>
            <div className="game-art">
              <img src={game.image} alt="" />
            </div>
            <div className="game-content">
              <div className="game-title-block">
                <span>{game.eyebrow}</span>
                <h2>{game.title}</h2>
              </div>
              <p>{game.description}</p>
              <div className="tag-row" aria-label={`${game.title} features`}>
                {game.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <button
                className="play-action"
                type="button"
                disabled={game.status !== "live"}
                onClick={() => openGame(game)}
              >
                {game.status === "live" ? "Play" : "Soon"}
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApiProvider initialArgs={{ endpoint: VARA_NODE_ADDRESS }}>
        <AccountProvider appName={APP_NAME}>
          <AlertProvider template={Alert} containerClassName={alertStyles.root}>
            <PlatformApp />
          </AlertProvider>
        </AccountProvider>
      </ApiProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
