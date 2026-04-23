#![no_std]

use sails_rs::gstd::Syscall;
use sails_rs::prelude::*;

const VERSION: &str = "0.1.0";
const MAX_RUN_ID_LEN: usize = 64;
const MAX_HEIGHT: u32 = 1_000_000;
const MAX_SCORE: u32 = 10_000_000;
const MIN_DURATION_MS: u64 = 1_000;
const MAX_DURATION_MS: u64 = 3_600_000;
const MAX_LEADERBOARD_LIMIT: u32 = 1_000;
const MAX_HEIGHT_PER_SECOND: u64 = 1_800;
const INITIAL_PLAYER_CAPACITY: usize = 100_000;

#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
pub struct RunRecord {
    pub run_id: String,
    pub player: ActorId,
    pub height: u32,
    pub score: u32,
    pub duration_ms: u64,
    pub points_awarded: u128,
}

#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
pub struct LeaderboardEntry {
    pub player: ActorId,
    pub points: u128,
    pub best_height: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
pub struct SubmitRunReply {
    pub run: RunRecord,
    pub player_points: u128,
    pub best_height: u32,
    pub improved: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
pub enum GameError {
    EmptyRunId,
    RunIdTooLong,
    InvalidHeight,
    InvalidScore,
    InvalidDuration,
    ImplausibleResult,
    LimitTooHigh,
    PointsOverflow,
}

#[sails_rs::event]
#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
pub enum GameEvent {
    BestRunUpdated {
        run_id: String,
        player: ActorId,
        height: u32,
        score: u32,
        points: u128,
    },
}

pub struct GameState {
    best_run_by_player: collections::HashMap<ActorId, RunRecord>,
    leaderboard: Vec<LeaderboardEntry>,
}

impl Default for GameState {
    fn default() -> Self {
        Self {
            best_run_by_player: collections::HashMap::with_capacity(INITIAL_PLAYER_CAPACITY),
            leaderboard: Vec::with_capacity(MAX_LEADERBOARD_LIMIT as usize),
        }
    }
}

pub struct GameService<'a> {
    state: &'a cell::RefCell<GameState>,
}

impl<'a> GameService<'a> {
    pub fn new(state: &'a cell::RefCell<GameState>) -> Self {
        Self { state }
    }
}

#[sails_rs::service(events = GameEvent)]
impl GameService<'_> {
    #[export(unwrap_result)]
    pub fn submit_run(
        &mut self,
        run_id: String,
        height: u32,
        score: u32,
        duration_ms: u64,
    ) -> Result<SubmitRunReply, GameError> {
        validate_run(&run_id, height, score, duration_ms)?;

        let player = Syscall::message_source();
        let (reply, event) = {
            let mut state = self.state.borrow_mut();

            let points_awarded = calculate_points(height, score)?;
            let previous_best = state.best_run_by_player.get(&player).cloned();
            let improved = previous_best
                .as_ref()
                .map(|run| is_better_result(points_awarded, height, run))
                .unwrap_or(true);

            let run = RunRecord {
                run_id: run_id.clone(),
                player,
                height,
                score,
                duration_ms,
                points_awarded,
            };

            let (player_points, best_height) = if improved {
                state.best_run_by_player.insert(player, run.clone());
                upsert_leaderboard(&mut state.leaderboard, player, points_awarded, height);
                (points_awarded, height)
            } else {
                let best = previous_best.expect("previous best exists when result is not improved");
                (best.points_awarded, best.height)
            };

            let event = if improved {
                Some(GameEvent::BestRunUpdated {
                    run_id,
                    player,
                    height,
                    score,
                    points: player_points,
                })
            } else {
                None
            };

            (
                SubmitRunReply {
                    run,
                    player_points,
                    best_height,
                    improved,
                },
                event,
            )
        };

        if let Some(event) = event {
            self.emit_event(event).expect("Game event emission failed");
        }

        Ok(reply)
    }

    #[export]
    pub fn player_points(&self, player: ActorId) -> u128 {
        self.state
            .borrow()
            .best_run_by_player
            .get(&player)
            .map(|run| run.points_awarded)
            .unwrap_or(0)
    }

    #[export]
    pub fn player_best_height(&self, player: ActorId) -> u32 {
        self.state
            .borrow()
            .best_run_by_player
            .get(&player)
            .map(|run| run.height)
            .unwrap_or(0)
    }

    #[export]
    pub fn player_best_run(&self, player: ActorId) -> Option<RunRecord> {
        self.state
            .borrow()
            .best_run_by_player
            .get(&player)
            .cloned()
    }

    #[export]
    pub fn player_rank(&self, player: ActorId) -> Option<u32> {
        self.state
            .borrow()
            .leaderboard
            .iter()
            .position(|entry| entry.player == player)
            .map(|index| index as u32 + 1)
    }

    #[export(unwrap_result)]
    pub fn leaderboard(&self, limit: u32) -> Result<Vec<LeaderboardEntry>, GameError> {
        ensure_leaderboard_limit(limit)?;

        Ok(self
            .state
            .borrow()
            .leaderboard
            .iter()
            .take(limit as usize)
            .cloned()
            .collect())
    }

    #[export]
    pub fn version(&self) -> String {
        VERSION.to_string()
    }
}

#[derive(Default)]
pub struct Program {
    state: cell::RefCell<GameState>,
}

#[sails_rs::program]
impl Program {
    pub fn create() -> Self {
        Self::default()
    }

    pub fn game(&self) -> GameService<'_> {
        GameService::new(&self.state)
    }
}

fn validate_run(
    run_id: &str,
    height: u32,
    score: u32,
    duration_ms: u64,
) -> Result<(), GameError> {
    if run_id.is_empty() {
        return Err(GameError::EmptyRunId);
    }
    if run_id.len() > MAX_RUN_ID_LEN {
        return Err(GameError::RunIdTooLong);
    }
    if height == 0 || height > MAX_HEIGHT {
        return Err(GameError::InvalidHeight);
    }
    if score == 0 || score > MAX_SCORE {
        return Err(GameError::InvalidScore);
    }
    if !(MIN_DURATION_MS..=MAX_DURATION_MS).contains(&duration_ms) {
        return Err(GameError::InvalidDuration);
    }

    let elapsed_seconds = duration_ms.div_ceil(1_000).max(1);
    if u64::from(height) > elapsed_seconds.saturating_mul(MAX_HEIGHT_PER_SECOND) {
        return Err(GameError::ImplausibleResult);
    }

    Ok(())
}

fn calculate_points(height: u32, score: u32) -> Result<u128, GameError> {
    u128::from(height)
        .checked_add(u128::from(score / 10))
        .ok_or(GameError::PointsOverflow)
}

fn is_better_result(points: u128, height: u32, previous: &RunRecord) -> bool {
    points > previous.points_awarded
        || (points == previous.points_awarded && height > previous.height)
}

fn ensure_leaderboard_limit(limit: u32) -> Result<(), GameError> {
    if limit > MAX_LEADERBOARD_LIMIT {
        return Err(GameError::LimitTooHigh);
    }
    Ok(())
}

fn upsert_leaderboard(
    leaderboard: &mut Vec<LeaderboardEntry>,
    player: ActorId,
    points: u128,
    best_height: u32,
) {
    if let Some(entry) = leaderboard.iter_mut().find(|entry| entry.player == player) {
        entry.points = points;
        entry.best_height = best_height;
    } else {
        leaderboard.push(LeaderboardEntry {
            player,
            points,
            best_height,
        });
    }

    leaderboard.sort_by(|left, right| {
        right
            .points
            .cmp(&left.points)
            .then_with(|| right.best_height.cmp(&left.best_height))
            .then_with(|| left.player.cmp(&right.player))
    });

    leaderboard.truncate(MAX_LEADERBOARD_LIMIT as usize);
}
