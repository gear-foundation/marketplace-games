import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const APP_NAME = "Games on Vara";
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

const FALLBACK_GAME_URLS: Record<string, string> = {
  "skybound-jump": "https://arcade-vara.up.railway.app",
  lumberjack: "https://lumberjack.up.railway.app",
};

function getPlatformGameImage(slug: string, fallbackImage?: string) {
  switch (slug) {
    case "skybound-jump":
      return "/monkey_run_9x16.webp";
    case "lumberjack":
      return "/lumberjack_9x16.webp";
    default:
      return fallbackImage && fallbackImage.length > 0 ? fallbackImage : "/banana.png";
  }
}

const fallbackGames: GameCard[] = [
  {
    id: "skybound-jump",
    title: "Skybound Jump",
    eyebrow: "Live on Vara",
    description: "A jungle platformer where you jump higher, collect bananas, dodge tigers, and submit your best run on-chain.",
    url: FALLBACK_GAME_URLS["skybound-jump"],
    status: "live",
    image: "/monkey_run_9x16.webp",
    tags: [],
  },
  {
    id: "lumberjack",
    title: "Lumberjack",
    eyebrow: "Live in Arcade",
    description: "A fast tap arcade game where you chop logs, switch sides, dodge branches, and submit your best run on-chain.",
    url: FALLBACK_GAME_URLS.lumberjack,
    status: "live",
    image: "/lumberjack_9x16.webp",
    tags: ["Vara Arcade"],
  },
];

const queryClient = new QueryClient();

function normalizeStatus(status: unknown): GameStatus {
  return status === "live" ? "live" : "soon";
}

function normalizeTags(tags: unknown): string[] {
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
}

function getPlatformGameTags(slug: string, tags: string[]) {
  if (slug === "lumberjack") {
    return tags.filter((tag) => tag !== "Tap arcade" && tag !== "Best run");
  }

  return tags;
}

function normalizeGame(game: ApiGame): GameCard {
  const status = normalizeStatus(game.status);
  const id = String(game.slug || game.id || game.title || "game");
  const backendImage = typeof game.imageUrl === "string" ? game.imageUrl : "";

  return {
    id,
    title: String(game.title || "Untitled Game"),
    eyebrow: status === "live" ? "Live on Vara" : "Coming soon",
    description: String(game.description || ""),
    url: typeof game.url === "string" ? game.url : typeof game.frontendUrl === "string" ? game.frontendUrl : undefined,
    status,
    image: getPlatformGameImage(id, backendImage),
    tags: getPlatformGameTags(id, normalizeTags(game.tags)),
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
  const visibleGames = games.filter((game) => game.status === "live");

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
          <h1 className="brand-logo">
            <img src="/games-on-vara-logo.svg" alt={APP_NAME} />
          </h1>
          <span>Discover playful apps, compete on-chain, and get a daily sponsored gas voucher for supported games.</span>
        </div>
        <strong className="network-badge">Vara Mainnet</strong>
      </header>

      <section className="game-grid" aria-label="Available games">
        {visibleGames.map((game) => (
          <article className={`game-card game-card--${game.id}${game.status === "soon" ? " is-soon" : ""}`} key={game.id}>
            <div className="game-art">
              <img src={game.image} alt="" />
              <button
                className="play-action play-action--overlay"
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
      <PlatformApp />
    </QueryClientProvider>
  </React.StrictMode>,
);
