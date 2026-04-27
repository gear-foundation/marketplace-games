#![no_std]

use sails_rs::gstd::{exec, msg};
use sails_rs::prelude::*;

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_LEADERBOARD: usize = 100;
const MAX_SCORE_PER_SECOND: u32 = 200;
const MAX_RUN_MS: u32 = 90_000;
const MIN_RUN_MS: u32 = 1_000;
const DAY_MS: u64 = 86_400_000;

// ─── Shared types ─────────────────────────────────────────────────────────────

#[derive(Clone, Debug, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub struct ScoreEntry {
    pub player: ActorId,
    pub score: u32,
    pub submitted_at: u64,
}

#[derive(Clone, Debug, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub struct PlayerStats {
    pub runs_played: u32,
    pub best_score: u32,
    pub last_played_at: u64,
}

#[derive(Clone, Debug, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub enum SubmitOutcome {
    Accepted {
        rank_daily: Option<u32>,
        rank_alltime: Option<u32>,
        new_best: bool,
    },
}

#[derive(Clone, Debug, Encode, Decode, TypeInfo, PartialEq)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub enum Error {
    ImplausibleScore,
    BadDuration,
}

// ─── Event ────────────────────────────────────────────────────────────────────

#[sails_rs::event]
#[derive(Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub enum NebulaBlasterEvent {
    ScoreSubmitted {
        player: ActorId,
        score: u32,
        new_best: bool,
    },
}

// ─── State ────────────────────────────────────────────────────────────────────

pub struct NebulaBlasterState {
    players: collections::BTreeMap<ActorId, PlayerStats>,
    daily_top: Vec<ScoreEntry>,
    daily_epoch_start: u64,
    alltime_top: Vec<ScoreEntry>,
}

impl NebulaBlasterState {
    fn new() -> Self {
        Self {
            players: collections::BTreeMap::new(),
            daily_top: Vec::new(),
            daily_epoch_start: exec::block_timestamp(),
            alltime_top: Vec::new(),
        }
    }

    fn upsert_leaderboard(board: &mut Vec<ScoreEntry>, entry: ScoreEntry) {
        if let Some(existing) = board.iter_mut().find(|e| e.player == entry.player) {
            if entry.score > existing.score {
                *existing = entry;
            }
        } else {
            board.push(entry);
        }
        board.sort_by(|a, b| b.score.cmp(&a.score));
        if board.len() > MAX_LEADERBOARD {
            board.truncate(MAX_LEADERBOARD);
        }
    }

    fn rank_in(board: &[ScoreEntry], player: &ActorId) -> Option<u32> {
        board
            .iter()
            .position(|e| &e.player == player)
            .map(|i| (i + 1) as u32)
    }

    fn maybe_reset_daily(&mut self) {
        let now = exec::block_timestamp();
        if now.saturating_sub(self.daily_epoch_start) >= DAY_MS {
            self.daily_top.clear();
            self.daily_epoch_start = now;
        }
    }
}

// ─── Service ──────────────────────────────────────────────────────────────────

pub struct NebulaBlasterService<'a> {
    state: &'a cell::RefCell<NebulaBlasterState>,
}

impl<'a> NebulaBlasterService<'a> {
    pub fn new(state: &'a cell::RefCell<NebulaBlasterState>) -> Self {
        Self { state }
    }
}

#[sails_rs::service(events = NebulaBlasterEvent)]
impl NebulaBlasterService<'_> {
    // ── Commands ────────────────────────────────────────────────────────────

    #[export]
    pub fn submit_score(
        &mut self,
        score: u32,
        run_duration_ms: u32,
    ) -> Result<SubmitOutcome, Error> {
        let caller = msg::source();
        let now = exec::block_timestamp();

        if run_duration_ms > MAX_RUN_MS || run_duration_ms < MIN_RUN_MS {
            return Err(Error::BadDuration);
        }

        let cap = MAX_SCORE_PER_SECOND.saturating_mul(run_duration_ms / 1000 + 1);
        if score > cap {
            return Err(Error::ImplausibleScore);
        }

        let (rank_daily, rank_alltime, new_best) = {
            let mut s = self.state.borrow_mut();

            s.maybe_reset_daily();

            let stats = s.players.entry(caller).or_insert(PlayerStats {
                runs_played: 0,
                best_score: 0,
                last_played_at: 0,
            });
            stats.runs_played += 1;
            let new_best = score > stats.best_score;
            if new_best {
                stats.best_score = score;
            }
            stats.last_played_at = now;

            let entry = ScoreEntry { player: caller, score, submitted_at: now };
            NebulaBlasterState::upsert_leaderboard(&mut s.daily_top, entry.clone());
            NebulaBlasterState::upsert_leaderboard(&mut s.alltime_top, entry);

            let rank_daily = NebulaBlasterState::rank_in(&s.daily_top, &caller);
            let rank_alltime = NebulaBlasterState::rank_in(&s.alltime_top, &caller);

            (rank_daily, rank_alltime, new_best)
        };

        self.emit_event(NebulaBlasterEvent::ScoreSubmitted { player: caller, score, new_best })
            .expect("failed to emit ScoreSubmitted");

        Ok(SubmitOutcome::Accepted { rank_daily, rank_alltime, new_best })
    }

    // ── Queries ─────────────────────────────────────────────────────────────

    #[export]
    pub fn get_daily_top(&self, limit: u32) -> Vec<ScoreEntry> {
        let s = self.state.borrow();
        let n = (limit as usize).min(s.daily_top.len());
        s.daily_top[..n].to_vec()
    }

    #[export]
    pub fn get_alltime_top(&self, limit: u32) -> Vec<ScoreEntry> {
        let s = self.state.borrow();
        let n = (limit as usize).min(s.alltime_top.len());
        s.alltime_top[..n].to_vec()
    }

    #[export]
    pub fn get_player_stats(&self, who: ActorId) -> Option<PlayerStats> {
        self.state.borrow().players.get(&who).cloned()
    }
}

// ─── Program ──────────────────────────────────────────────────────────────────

pub struct NebulaBlasterProgram {
    state: cell::RefCell<NebulaBlasterState>,
}

#[sails_rs::program]
impl NebulaBlasterProgram {
    pub fn new() -> Self {
        Self {
            state: cell::RefCell::new(NebulaBlasterState::new()),
        }
    }

    pub fn nebula_blaster_service(&self) -> NebulaBlasterService<'_> {
        NebulaBlasterService::new(&self.state)
    }
}
