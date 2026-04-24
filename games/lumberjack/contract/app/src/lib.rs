#![no_std]

use sails_rs::gstd::Syscall;
use sails_rs::prelude::*;

const MAX_BRANCHES: u32 = 100_000;
const MAX_LEADERBOARD_LIMIT: u32 = 1_000;
const INITIAL_PLAYER_CAPACITY: usize = 100_000;

#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
pub struct LeaderboardEntry {
    pub player: ActorId,
    pub branches: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
pub struct SubmitRunReply {
    pub best_branches: u32,
    pub improved: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
pub enum GameError {
    InvalidBranches,
    LimitTooHigh,
    Unauthorized,
}

#[sails_rs::event]
#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
pub enum GameEvent {
    BestRunUpdated {
        player: ActorId,
        branches: u32,
    },
    LeaderboardCleared {
        by: ActorId,
    },
}

pub struct GameState {
    admin: ActorId,
    best_run_by_player: collections::HashMap<ActorId, u32>,
}

impl GameState {
    fn new(admin: ActorId) -> Self {
        Self {
            admin,
            best_run_by_player: collections::HashMap::with_capacity(INITIAL_PLAYER_CAPACITY),
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
    pub fn submit_run(&mut self, branches: u32) -> Result<SubmitRunReply, GameError> {
        validate_run(branches)?;

        let player = Syscall::message_source();
        let (reply, event) = {
            let mut state = self.state.borrow_mut();

            let previous_best = state.best_run_by_player.get(&player).cloned();
            let improved = previous_best.map(|best| branches > best).unwrap_or(true);

            let best_branches = if improved {
                state.best_run_by_player.insert(player, branches);
                branches
            } else {
                previous_best
                    .expect("previous best exists when result is not improved")
            };

            let event = improved.then_some(GameEvent::BestRunUpdated {
                player,
                branches,
            });

            (
                SubmitRunReply {
                    best_branches,
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
    pub fn clear_leaderboard(&mut self) -> Result<(), GameError> {
        let caller = Syscall::message_source();
        let mut state = self.state.borrow_mut();

        if caller != state.admin {
            return Err(GameError::Unauthorized);
        }

        state.best_run_by_player.clear();
        self.emit_event(GameEvent::LeaderboardCleared {
            by: caller,
        })
        .expect("Game event emission failed");
        Ok(())
    }

    #[export]
    pub fn player_best_branches(&self, player: ActorId) -> u32 {
        self.state
            .borrow()
            .best_run_by_player
            .get(&player)
            .copied()
            .unwrap_or(0)
    }

    #[export]
    pub fn player_rank(&self, player: ActorId) -> Option<u32> {
        sorted_leaderboard(&self.state.borrow().best_run_by_player)
            .iter()
            .position(|entry| entry.player == player)
            .map(|index| index as u32 + 1)
    }

    #[export(unwrap_result)]
    pub fn leaderboard(&self, limit: u32) -> Result<Vec<LeaderboardEntry>, GameError> {
        ensure_leaderboard_limit(limit)?;

        Ok(sorted_leaderboard(&self.state.borrow().best_run_by_player)
            .into_iter()
            .take(limit as usize)
            .collect())
    }

}

pub struct Program {
    state: cell::RefCell<GameState>,
}

#[sails_rs::program]
impl Program {
    pub fn create() -> Self {
        let admin = Syscall::message_source();
        Self {
            state: cell::RefCell::new(GameState::new(admin)),
        }
    }

    pub fn game(&self) -> GameService<'_> {
        GameService::new(&self.state)
    }
}

fn validate_run(branches: u32) -> Result<(), GameError> {
    if branches == 0 || branches > MAX_BRANCHES {
        return Err(GameError::InvalidBranches);
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
    best_run_by_player: &collections::HashMap<ActorId, u32>,
) -> Vec<LeaderboardEntry> {
    let mut leaderboard: Vec<_> = best_run_by_player
        .iter()
        .map(|(player, branches)| LeaderboardEntry {
            player: *player,
            branches: *branches,
        })
        .collect();

    leaderboard.sort_by(|left, right| {
        right
            .branches
            .cmp(&left.branches)
            .then_with(|| left.player.cmp(&right.player))
    });

    leaderboard
}
