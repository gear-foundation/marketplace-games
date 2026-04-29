#![no_std]

use sails_rs::gstd::Syscall;
use sails_rs::prelude::*;

const MAX_SCORE: u32 = 1_000_000_000;
const MAX_LEADERBOARD_LIMIT: u32 = 1_000;
const INITIAL_PLAYER_CAPACITY: usize = 100_000;

#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
pub struct LeaderboardEntry {
    pub player: ActorId,
    pub score: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
pub struct SubmitScoreReply {
    pub best_score: u32,
    pub improved: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
pub enum GameError {
    InvalidScore,
    LimitTooHigh,
}

#[sails_rs::event]
#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
pub enum GameEvent {
    BestScoreUpdated {
        player: ActorId,
        score: u32,
    },
}

pub struct GameState {
    best_score_by_player: collections::HashMap<ActorId, u32>,
}

impl Default for GameState {
    fn default() -> Self {
        Self {
            best_score_by_player: collections::HashMap::with_capacity(INITIAL_PLAYER_CAPACITY),
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
    pub fn submit_score(&mut self, score: u32) -> Result<SubmitScoreReply, GameError> {
        validate_score(score)?;

        let player = Syscall::message_source();
        let (reply, event) = {
            let mut state = self.state.borrow_mut();

            let previous_best = state.best_score_by_player.get(&player).copied();
            let improved = previous_best.map(|best| score > best).unwrap_or(true);

            let best_score = if improved {
                state.best_score_by_player.insert(player, score);
                score
            } else {
                previous_best.expect("previous best exists when score is not improved")
            };

            let event = improved.then_some(GameEvent::BestScoreUpdated { player, score });

            (
                SubmitScoreReply {
                    best_score,
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

    #[export(unwrap_result)]
    pub fn leaderboard(&self, limit: u32) -> Result<Vec<LeaderboardEntry>, GameError> {
        ensure_leaderboard_limit(limit)?;

        Ok(sorted_leaderboard(&self.state.borrow().best_score_by_player)
            .into_iter()
            .take(limit as usize)
            .collect())
    }

    #[export]
    pub fn player_best_score(&self, player: ActorId) -> u32 {
        self.state
            .borrow()
            .best_score_by_player
            .get(&player)
            .copied()
            .unwrap_or(0)
    }

    #[export]
    pub fn player_rank(&self, player: ActorId) -> Option<u32> {
        sorted_leaderboard(&self.state.borrow().best_score_by_player)
            .iter()
            .position(|entry| entry.player == player)
            .map(|index| index as u32 + 1)
    }

    #[export(unwrap_result)]
    pub fn scores_count(&self) -> Result<u32, GameError> {
        Ok(self.state.borrow().best_score_by_player.len() as u32)
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

fn validate_score(score: u32) -> Result<(), GameError> {
    if score == 0 || score > MAX_SCORE {
        return Err(GameError::InvalidScore);
    }

    Ok(())
}

fn ensure_leaderboard_limit(limit: u32) -> Result<(), GameError> {
    if limit > MAX_LEADERBOARD_LIMIT {
        return Err(GameError::LimitTooHigh);
    }

    Ok(())
}

fn sorted_leaderboard(
    best_score_by_player: &collections::HashMap<ActorId, u32>,
) -> Vec<LeaderboardEntry> {
    let mut leaderboard: Vec<_> = best_score_by_player
        .iter()
        .map(|(player, score)| LeaderboardEntry {
            player: *player,
            score: *score,
        })
        .collect();

    leaderboard.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| left.player.cmp(&right.player))
    });

    leaderboard
}
