import React, { Suspense, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
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
const VARA_NODE_ADDRESS = import.meta.env.VITE_NODE_ADDRESS || "wss://rpc.vara.network";
const DEFAULT_BACKEND_URL = "https://arcade-vara-production.up.railway.app";
const BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? "/api" : DEFAULT_BACKEND_URL)
).replace(/\/+$/, "");
const LazyWalletRuntime = React.lazy(() => import("./wallet-runtime"));

function getPlatformGameImage(slug: string, fallback?: string): string {
  switch (slug) {
    case "chicken-riches": return "/chicken_riches.webp";
    case "skybound-jump":   return "/monkey_run_16x9.webp";
    case "lumberjack":      return "/lumberjack_16x9.webp";
    case "nebula-blaster":  return "/nebula_blaster_16x9.webp";
    case "2048":            return "/2048image.webp";
    case "deep-sea-feast":  return "/deep_sea_feast.webp";
    case "robo-miner":      return "/robo_miner_back.jpg";
    default:                return fallback || "";
  }
}

function getGameCategories(slug: string, tags: string[]): CategoryId[] {
  switch (slug) {
    case "chicken-riches": return ["arcade"];
    case "skybound-jump":  return ["platformer", "arcade"];
    case "lumberjack":     return ["arcade"];
    case "robo-miner":     return ["arcade"];
    case "nebula-blaster": return ["shooter", "arcade"];
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
    id: "nebula-blaster",
    title: "Nebula Blaster",
    description: "Pilot your ship through asteroid fields, blast enemies, chain kills for multipliers, and climb the on-chain leaderboard.",
    url: "https://nebula-blaster.up.railway.app",
    status: "live",
    image: "/nebula_blaster_16x9.webp",
    categories: ["shooter", "arcade"],
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
    id: "skybound-jump",
    title: "Skybound Jump",
    description: "A jungle platformer — jump higher, collect bananas, dodge tigers, and submit your best run on-chain.",
    url: "https://arcade-vara.up.railway.app",
    status: "live",
    image: "/monkey_run_16x9.webp",
    categories: ["platformer", "arcade"],
  },
  {
    id: "2048",
    title: "2048",
    description: "Merge tiles, post your best score on-chain, and play with daily gas voucher support on Vara.",
    url: "https://2048-vara.up.railway.app/",
    status: "live",
    image: "/2048image.webp",
    categories: ["brain"],
  },
  {
    id: "deep-sea-feast",
    title: "Deep Sea Feast",
    description: "An underwater survival arcade game where you grow through fish tiers, avoid predators, and submit your best run on-chain.",
    url: "https://deep-sea-feast-vara.up.railway.app/",
    status: "live",
    image: "/deep_sea_feast.webp",
    categories: ["arcade"],
  },
  {
    id: "chicken-riches",
    title: "Chicken Riches",
    description: "Catch eggs, bank them, jump over puddles, and keep the hens safe while chasing the best run on-chain.",
    url: "https://chicken-riches-production.up.railway.app/",
    status: "live",
    image: "/chicken_riches.webp",
    categories: ["arcade"],
  },
  {
    id: "robo-miner",
    title: "Robo Miner",
    description: "Mine resources, build your robot, and compete for the highest score on-chain.",
    url: "https://robo-miner-production.up.railway.app/",
    status: "live",
    image: "/robo_miner_back.jpg",
    categories: ["arcade"],
  },
];

const SOON_GAMES: GameCard[] = [
  {
    id: "zombie-apocalypse-survival",
    title: "Zombie Apocalypse Survival",
    description: "Hold the line through escalating zombie waves, upgrade your run, and prepare for on-chain survival records.",
    status: "soon", image: "/back_zombie.webp", categories: ["battle", "arcade"],
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

function mergeGamesWithFallback(games: GameCard[]): GameCard[] {
  const merged = [...games];
  const knownIds = new Set(games.map((game) => game.id));

  for (const fallbackGame of FALLBACK_GAMES) {
    if (!knownIds.has(fallbackGame.id)) {
      merged.push(fallbackGame);
    }
  }

  return merged;
}

async function fetchGames(): Promise<GameCard[]> {
  if (!BACKEND_URL) return FALLBACK_GAMES;
  const res = await fetch(`${BACKEND_URL}/games`);
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return FALLBACK_GAMES;
  const games = data.map(g => normalizeGame(g as ApiGame));
  return games.length > 0 ? mergeGamesWithFallback(games) : FALLBACK_GAMES;
}

function makeVoteCounts(slugs: string[], source?: Record<string, number>): Record<string, number> {
  return Object.fromEntries(slugs.map((slug) => [slug, source?.[slug] ?? 0]));
}

async function fetchVotes(
  slugs: string[],
  account?: string,
): Promise<{ counts: Record<string, number>; liked: string[] }> {
  const normalizedSlugs = Array.from(
    new Set(slugs.map((slug) => slug.trim()).filter(Boolean)),
  );

  if (!BACKEND_URL || normalizedSlugs.length === 0) {
    return { counts: makeVoteCounts(normalizedSlugs), liked: [] };
  }

  const params = new URLSearchParams();
  params.set("slugs", normalizedSlugs.join(","));
  if (account) params.set("account", account);

  const res = await fetch(`${BACKEND_URL}/games/votes?${params.toString()}`);
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);

  const data = (await res.json()) as {
    counts?: unknown;
    liked?: unknown;
  };

  const counts = makeVoteCounts(normalizedSlugs);
  if (data.counts && typeof data.counts === "object") {
    for (const [slug, value] of Object.entries(data.counts as Record<string, unknown>)) {
      if (slug in counts && typeof value === "number" && Number.isFinite(value)) {
        counts[slug] = value;
      }
    }
  }

  const liked = Array.isArray(data.liked)
    ? data.liked.filter((slug): slug is string => typeof slug === "string")
    : [];

  return { counts, liked };
}

async function toggleGameVote(
  slug: string,
  account: string,
): Promise<{ gameId: string; liked: boolean; votesCount: number }> {
  if (!BACKEND_URL) throw new Error("Backend URL is not configured");

  const res = await fetch(`${BACKEND_URL}/games/${encodeURIComponent(slug)}/votes/toggle`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ account }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);

  return (await res.json()) as { gameId: string; liked: boolean; votesCount: number };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (
    callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function WalletFallbackButton({ loading, onActivate }: { loading?: boolean; onActivate?: () => void }) {
  return (
    <button
      className="wallet-btn"
      onClick={onActivate}
      disabled={loading}
      aria-busy={loading ? "true" : undefined}
    >
      {loading ? "Loading wallet..." : "Connect Wallet"}
    </button>
  );
}

function WalletButton({ onAccountChange }: { onAccountChange: (accountIdentity: string) => void }) {
  const [walletRuntimeEnabled, setWalletRuntimeEnabled] = useState(false);

  useEffect(() => {
    const idleWindow = window as IdleWindow;
    if (idleWindow.requestIdleCallback) {
      const idleHandle = idleWindow.requestIdleCallback(
        () => setWalletRuntimeEnabled(true),
        { timeout: 1200 },
      );
      return () => idleWindow.cancelIdleCallback?.(idleHandle);
    }

    const timeoutHandle = window.setTimeout(() => setWalletRuntimeEnabled(true), 800);
    return () => window.clearTimeout(timeoutHandle);
  }, []);

  const activateWallet = () => setWalletRuntimeEnabled(true);

  return (
    <div
      className="wallet-slot"
      aria-label="Wallet connection"
      onMouseEnter={activateWallet}
      onFocus={activateWallet}
    >
      {walletRuntimeEnabled ? (
        <Suspense fallback={<WalletFallbackButton loading />}>
          <LazyWalletRuntime
            appName={APP_NAME}
            nodeAddress={VARA_NODE_ADDRESS}
            onAccountChange={onAccountChange}
          />
        </Suspense>
      ) : (
        <WalletFallbackButton onActivate={activateWallet} />
      )}
    </div>
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

function VoteBtn({ count, voted, disabled, canVote, onVote }: {
  count: number; voted: boolean; disabled: boolean; canVote: boolean; onVote: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      className={`vote-btn${voted ? " vote-btn--voted" : ""}${disabled ? " vote-btn--disabled" : ""}`}
      disabled={disabled}
      onClick={onVote}
      title={
        !canVote
          ? "Voting is unavailable right now"
          : disabled
            ? "Vote request in progress"
            : voted
              ? "Remove vote"
              : "Vote for this game"
      }
    >
      <HeartIcon filled={voted} />
      <span>{count > 0 ? count.toLocaleString() : "Vote"}</span>
    </button>
  );
}

function GameCardEl({ game, voteCount, voted, canVote, votePending = false, onVote, featured }: {
  game: GameCard;
  voteCount: number;
  voted: boolean;
  canVote: boolean;
  votePending?: boolean;
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
          <img
            src={game.image}
            alt={game.title}
            className="game-card__img"
            loading={featured ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={featured ? "high" : "low"}
          />
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
            disabled={!canVote || votePending}
            canVote={canVote}
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

function PlatformApp() {
  const [liveGames, setLiveGames] = useState<GameCard[]>(FALLBACK_GAMES);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [pendingVotes, setPendingVotes] = useState<Set<string>>(new Set());
  const [accountIdentity, setAccountIdentity] = useState("");
  const votesEnabled = Boolean(BACKEND_URL);
  const walletConnected = Boolean(accountIdentity);
  const canVote = votesEnabled && walletConnected;

  useEffect(() => {
    let cancelled = false;
    fetchGames()
      .then(g => { if (!cancelled) setLiveGames(g); })
      .catch(() => { if (!cancelled) setLiveGames(FALLBACK_GAMES); });
    return () => { cancelled = true; };
  }, []);

  const allGames = useMemo(() => [...liveGames, ...SOON_GAMES], [liveGames]);
  const allGameIds = useMemo(() => allGames.map((game) => game.id), [allGames]);
  const votableGameIds = useMemo(
    () => allGames.filter((game) => game.status === "live").map((game) => game.id),
    [allGames],
  );
  const votableGameIdSet = useMemo(() => new Set(votableGameIds), [votableGameIds]);
  const filteredGames = activeCategory === "all"
    ? allGames
    : allGames.filter(g => g.categories.includes(activeCategory as CategoryId));

  useEffect(() => {
    let cancelled = false;
    fetchVotes(votableGameIds, canVote ? accountIdentity : undefined)
      .then((snapshot) => {
        if (cancelled) return;
        setVotes(makeVoteCounts(allGameIds, snapshot.counts));
        setMyVotes(new Set(snapshot.liked));
      })
      .catch(() => {
        if (cancelled) return;
        setVotes(makeVoteCounts(allGameIds));
        setMyVotes(new Set());
      });
    return () => { cancelled = true; };
  }, [accountIdentity, allGameIds, canVote, votableGameIds]);

  async function handleVote(gameId: string) {
    if (!canVote || !votableGameIdSet.has(gameId) || pendingVotes.has(gameId)) return;
    const wasVoted = myVotes.has(gameId);
    setPendingVotes((prev) => {
      const next = new Set(prev);
      next.add(gameId);
      return next;
    });
    setVotes(v => ({ ...v, [gameId]: Math.max(0, (v[gameId] ?? 0) + (wasVoted ? -1 : 1)) }));
    setMyVotes(prev => {
      const next = new Set(prev);
      wasVoted ? next.delete(gameId) : next.add(gameId);
      return next;
    });

    try {
      const result = await toggleGameVote(gameId, accountIdentity);
      setVotes((prev) => ({ ...prev, [gameId]: result.votesCount }));
      setMyVotes((prev) => {
        const next = new Set(prev);
        if (result.liked) {
          next.add(gameId);
        } else {
          next.delete(gameId);
        }
        return next;
      });
    } catch (error) {
      console.error("Failed to toggle vote", error);
      setVotes(v => ({ ...v, [gameId]: Math.max(0, (v[gameId] ?? 0) + (wasVoted ? 1 : -1)) }));
      setMyVotes(prev => {
        const next = new Set(prev);
        if (wasVoted) {
          next.add(gameId);
        } else {
          next.delete(gameId);
        }
        return next;
      });
    } finally {
      setPendingVotes((prev) => {
        const next = new Set(prev);
        next.delete(gameId);
        return next;
      });
    }
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
        <WalletButton onAccountChange={setAccountIdentity} />
      </header>

      <section className="hero">
        <div className="hero-inner">
          <h1 className="hero-title">
            Play.<span className="hero-accent"> Compete.</span> Win.
          </h1>
          <p className="hero-sub">
            <span className="hero-sub__highlight">Free to play, daily gas vouchers.</span>
            <br />
            <span className="hero-sub__secondary">On-chain games on Vara Network.</span>
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
            canVote={canVote && game.status === "live"}
            votePending={pendingVotes.has(game.id)}
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

      {!votesEnabled && (
        <div className="vote-nudge">
          <span>Voting is temporarily unavailable in this frontend environment.</span>
        </div>
      )}

      {votesEnabled && !walletConnected && (
        <div className="vote-nudge">
          <span>Connect your wallet to vote. Your vote will be linked to that wallet address.</span>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PlatformApp />
  </React.StrictMode>,
);
