import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type GameStatus = "live" | "soon";
type CategoryId = "arcade" | "platformer" | "shooter" | "battle" | "retro" | "relaxing" | "brain";

type GameCard = {
  id: string;
  title: string;
  description: string;
  url?: string;
  status: GameStatus;
  image: string;
  categories: CategoryId[];
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

// ─── Category Config ──────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  arcade:     { label: "Arcade",      color: "#f59e0b" },
  platformer: { label: "Platformer",  color: "#00e87b" },
  shooter:    { label: "Shooter",     color: "#ef4444" },
  battle:     { label: "Battle",      color: "#a855f7" },
  retro:      { label: "Retro",       color: "#ec4899" },
  relaxing:   { label: "Relaxing",    color: "#06b6d4" },
  brain:      { label: "Brain Boost", color: "#3b82f6" },
};

const FILTER_TABS = [
  "all", "arcade", "platformer", "shooter", "battle", "retro", "relaxing", "brain",
] as const;

// ─── Static Data ──────────────────────────────────────────────────────────────

const APP_NAME = "Vara Arcade";
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

const INITIAL_VOTES: Record<string, number> = {
  "skybound-jump": 847,
  lumberjack: 1203,
  "2048": 0,
};

function getPlatformGameImage(slug: string, fallback?: string): string {
  switch (slug) {
    case "skybound-jump": return "/monkey_run_16x9.webp";
    case "lumberjack":    return "/lumberjack_16x9.webp";
    case "2048":          return "/2048image.png";
    default:              return fallback || "";
  }
}

function getGameCategories(slug: string, tags: string[]): CategoryId[] {
  switch (slug) {
    case "skybound-jump": return ["platformer", "arcade"];
    case "lumberjack":    return ["arcade"];
    default: {
      const tl = tags.map(t => t.toLowerCase());
      const cats: CategoryId[] = [];
      if (tl.some(t => t.includes("shooter")))              cats.push("shooter");
      if (tl.some(t => t.includes("battle")))               cats.push("battle");
      if (tl.some(t => t.includes("retro") || t.includes("pixel"))) cats.push("retro");
      if (tl.some(t => t.includes("platform")))             cats.push("platformer");
      if (tl.some(t => t.includes("relax") || t.includes("zen")))   cats.push("relaxing");
      if (tl.some(t => t.includes("brain") || t.includes("puzzle"))) cats.push("brain");
      if (tl.some(t => t.includes("arcade") || t.includes("tap")))  cats.push("arcade");
      return cats.length > 0 ? cats : ["arcade"];
    }
  }
}

const FALLBACK_GAMES: GameCard[] = [
  {
    id: "skybound-jump",
    title: "Skybound Jump",
    description: "A jungle platformer — jump higher, collect bananas, dodge tigers, and submit your best run on-chain.",
    url: "https://arcade-vara.up.railway.app",
    status: "live",
    image: "/monkey_run_16x9.webp",
    categories: ["platformer", "arcade"],
  },
  {
    id: "lumberjack",
    title: "Lumberjack",
    description: "A fast tap game — chop logs, switch sides, dodge branches, and put your best run on-chain.",
    url: "https://lumberjack.up.railway.app",
    status: "live",
    image: "/lumberjack_16x9.webp",
    categories: ["arcade"],
  },
  {
    id: "2048",
    title: "2048",
    description: "Merge tiles, post your best score on-chain, and play with daily gas voucher support on Vara.",
    url: "https://2048-vara.up.railway.app/",
    status: "live",
    image: "/2048image.png",
    categories: ["brain"],
  },
];

const SOON_GAMES: GameCard[] = [
  {
    id: "nebula-blaster",
    title: "Nebula Blaster",
    description: "Pilot your ship through asteroid fields, blast enemies, and climb the on-chain leaderboard.",
    status: "soon", image: "", categories: ["shooter"],
  },
  {
    id: "chain-battles",
    title: "Chain Battles",
    description: "Real-time PvP arena brawler. Every move verified on Vara Network.",
    status: "soon", image: "", categories: ["battle"],
  },
  {
    id: "pixel-dungeon",
    title: "Pixel Dungeon",
    description: "Classic rogue-like with procedurally generated on-chain levels.",
    status: "soon", image: "", categories: ["retro"],
  },
  {
    id: "flow-state",
    title: "Flow State",
    description: "A meditative puzzle game. Guide the stream, earn VARA for perfect solutions.",
    status: "soon", image: "", categories: ["relaxing"],
  },
  {
    id: "brain-chain",
    title: "Brain Chain",
    description: "Memory and logic puzzles. The harder you play, the higher the on-chain reward.",
    status: "soon", image: "", categories: ["brain"],
  },
  {
    id: "turbo-rush",
    title: "Turbo Rush",
    description: "Hyper-speed endless runner. React fast, go further, dominate the leaderboard.",
    status: "soon", image: "", categories: ["arcade"],
  },
];

// ─── API Helpers ──────────────────────────────────────────────────────────────

function normalizeStatus(s: unknown): GameStatus {
  return s === "live" ? "live" : "soon";
}

function normalizeTags(t: unknown): string[] {
  return Array.isArray(t) ? t.filter((x): x is string => typeof x === "string") : [];
}

function normalizeGame(game: ApiGame): GameCard {
  const id = String(game.slug || game.id || game.title || "game");
  const tags = normalizeTags(game.tags);
  return {
    id,
    title: String(game.title || "Untitled Game"),
    description: String(game.description || ""),
    url: typeof game.url === "string" ? game.url : typeof game.frontendUrl === "string" ? game.frontendUrl : undefined,
    status: normalizeStatus(game.status),
    image: getPlatformGameImage(id, typeof game.imageUrl === "string" ? game.imageUrl : ""),
    categories: getGameCategories(id, tags),
  };
}

async function fetchGames(): Promise<GameCard[]> {
  if (!BACKEND_URL) return FALLBACK_GAMES;
  const res = await fetch(`${BACKEND_URL}/games`);
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return FALLBACK_GAMES;
  const games = data.map(g => normalizeGame(g as ApiGame));
  return games.length > 0 ? games : FALLBACK_GAMES;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function WalletButton({
  address, onConnect, onDisconnect,
}: { address: string | null; onConnect: () => void; onDisconnect: () => void }) {
  if (address) {
    return (
      <button className="wallet-btn wallet-btn--connected" onClick={onDisconnect}>
        <span className="wallet-dot" />
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }
  return (
    <button className="wallet-btn" onClick={onConnect}>
      Connect Wallet
    </button>
  );
}

function CategoryPill({ id, active, onClick }: { id: string; active: boolean; onClick: () => void }) {
  const meta = id === "all"
    ? { label: "All Games", color: "#ffffff" }
    : (CATEGORY_META[id] ?? { label: id, color: "#ffffff" });
  return (
    <button
      className={`category-pill${active ? " category-pill--active" : ""}`}
      style={active ? ({ "--pill-color": meta.color } as React.CSSProperties) : undefined}
      onClick={onClick}
    >
      {meta.label}
    </button>
  );
}

function VoteBtn({ count, voted, disabled, onVote }: {
  count: number; voted: boolean; disabled: boolean; onVote: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      className={`vote-btn${voted ? " vote-btn--voted" : ""}${disabled ? " vote-btn--disabled" : ""}`}
      onClick={onVote}
      title={disabled ? "Connect wallet to vote" : voted ? "Remove vote" : "Vote for this game"}
    >
      <HeartIcon filled={voted} />
      <span>{count > 0 ? count.toLocaleString() : "Vote"}</span>
    </button>
  );
}

function GameCardEl({ game, voteCount, voted, walletConnected, onVote, featured }: {
  game: GameCard;
  voteCount: number;
  voted: boolean;
  walletConnected: boolean;
  onVote: () => void;
  featured: boolean;
}) {
  const primaryCat = game.categories[0];
  const accent = primaryCat ? (CATEGORY_META[primaryCat]?.color ?? "#00e87b") : "#00e87b";
  const isLive = game.status === "live";

  return (
    <article
      className={`game-card game-card--${game.id}${featured ? " game-card--featured" : ""}${!isLive ? " game-card--soon" : ""}`}
      style={{ "--card-accent": accent } as React.CSSProperties}
    >
      <div className="game-card__bg">
        {game.image ? (
          <img src={game.image} alt={game.title} className="game-card__img" />
        ) : (
          <div className="game-card__placeholder" />
        )}
        <div className="game-card__overlay" />
      </div>

      <div className="game-card__top">
        {isLive ? (
          <span className="badge badge--live"><span className="live-dot" />Live</span>
        ) : (
          <span className="badge badge--soon">Coming Soon</span>
        )}
        <div className="game-card__cats">
          {game.categories.map(cat => {
            const m = CATEGORY_META[cat];
            return m ? (
              <span key={cat} className="badge badge--cat" style={{ "--cat-color": m.color } as React.CSSProperties}>
                {m.label}
              </span>
            ) : null;
          })}
        </div>
      </div>

      <div className="game-card__bottom">
        <div className="game-card__meta">
          <h2 className="game-card__title">{game.title}</h2>
          {featured && <p className="game-card__desc">{game.description}</p>}
        </div>
        <div className="game-card__actions">
          <VoteBtn
            count={voteCount}
            voted={voted}
            disabled={!walletConnected}
            onVote={(e) => { e.stopPropagation(); onVote(); }}
          />
          {isLive && game.url && (
            <button
              className="play-btn"
              onClick={(e) => { e.stopPropagation(); window.location.href = game.url!; }}
            >
              Play
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

const queryClient = new QueryClient();

function PlatformApp() {
  const [liveGames, setLiveGames] = useState<GameCard[]>(FALLBACK_GAMES);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>(INITIAL_VOTES);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchGames()
      .then(g => { if (!cancelled) setLiveGames(g); })
      .catch(() => { if (!cancelled) setLiveGames(FALLBACK_GAMES); });
    return () => { cancelled = true; };
  }, []);

  const allGames = [...liveGames, ...SOON_GAMES];
  const filteredGames = activeCategory === "all"
    ? allGames
    : allGames.filter(g => g.categories.includes(activeCategory as CategoryId));

  function handleVote(gameId: string) {
    if (!walletAddress) return;
    const wasVoted = myVotes.has(gameId);
    setVotes(v => ({ ...v, [gameId]: (v[gameId] ?? 0) + (wasVoted ? -1 : 1) }));
    setMyVotes(prev => {
      const next = new Set(prev);
      wasVoted ? next.delete(gameId) : next.add(gameId);
      return next;
    });
  }

  // TODO: replace with @gear-js/wallet-connect integration
  function handleConnect() {
    setWalletAddress("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY");
  }
  function handleDisconnect() {
    setWalletAddress(null);
    setMyVotes(new Set());
  }

  const liveCount = liveGames.filter(g => g.status === "live").length;
  const totalVotes = Object.values(votes).reduce((s, v) => s + v, 0);

  return (
    <div className="platform-shell">
      <header className="platform-header">
        <a href="/" className="header-logo" aria-label={APP_NAME}>
          <img src="/games-on-vara-logo.svg" alt={APP_NAME} />
        </a>
        <span className="network-badge">
          <span className="network-dot" />
          Vara Mainnet
        </span>
        <WalletButton address={walletAddress} onConnect={handleConnect} onDisconnect={handleDisconnect} />
      </header>

      <section className="hero">
        <div className="hero-inner">
          <h1 className="hero-title">
            Play.<span className="hero-accent"> Compete.</span> Win.
          </h1>
          <p className="hero-sub">
            On-chain games on Vara Network. Free to play, daily gas vouchers.
          </p>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">{liveCount}</span>
              <span className="stat-label">Live Games</span>
            </div>
            <span className="stat-divider" />
            <div className="stat">
              <span className="stat-value">{SOON_GAMES.length}</span>
              <span className="stat-label">Coming Soon</span>
            </div>
            <span className="stat-divider" />
            <div className="stat">
              <span className="stat-value">{totalVotes.toLocaleString()}+</span>
              <span className="stat-label">Votes Cast</span>
            </div>
          </div>
        </div>
      </section>

      <div className="category-bar">
        <div className="category-bar__scroll">
          {FILTER_TABS.map(cat => (
            <CategoryPill
              key={cat}
              id={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
        </div>
      </div>

      <main className="game-grid" aria-label="Game Library">
        {filteredGames.map((game, i) => (
          <GameCardEl
            key={game.id}
            game={game}
            voteCount={votes[game.id] ?? 0}
            voted={myVotes.has(game.id)}
            walletConnected={!!walletAddress}
            onVote={() => handleVote(game.id)}
            featured={i === 0 && activeCategory === "all"}
          />
        ))}
        <div className="cta-card">
          <div className="cta-card__inner">
            <span className="cta-card__eyebrow">Build on Vara</span>
            <h3 className="cta-card__title">Ship the next on-chain game</h3>
            <p className="cta-card__desc">Deploy gasless, reach thousands of players, earn on-chain rewards.</p>
            <a href="https://vara.network" target="_blank" rel="noopener noreferrer" className="cta-btn">
              Get Started
            </a>
          </div>
        </div>
      </main>

      {!walletAddress && (
        <div className="vote-nudge">
          <span>Connect your Vara wallet to vote for upcoming games.</span>
          <button className="wallet-btn wallet-btn--sm" onClick={handleConnect}>Connect Wallet</button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PlatformApp />
    </QueryClientProvider>
  </React.StrictMode>,
);
