use ::lumberjack_contract_client::{
    LumberjackContractClient as _, LumberjackContractClientCtors as _,
    game::Game as _,
};
use sails_rs::{client::*, gtest::*, prelude::*};

const ACTOR_ID: u64 = 42;
const OTHER_ACTOR_ID: u64 = 43;

#[tokio::test]
async fn stores_only_best_branch_result_and_updates_on_improvement() {
    let (env, program_code_id) = create_env();
    let program = deploy_program(env, program_code_id).await;
    let player: ActorId = ACTOR_ID.into();
    let mut game = program.game();

    let first = game.submit_run(32).await.unwrap();

    assert!(first.improved);
    assert_eq!(first.best_branches, 32);

    let worse = game.submit_run(24).await.unwrap();

    assert!(!worse.improved);
    assert_eq!(worse.best_branches, 32);
    assert_eq!(game.player_best_branches(player).await.unwrap(), 32);

    let better = game.submit_run(41).await.unwrap();

    assert!(better.improved);
    assert_eq!(better.best_branches, 41);
    assert_eq!(game.player_best_branches(player).await.unwrap(), 41);
    assert_eq!(game.player_rank(player).await.unwrap(), Some(1));

    let leaderboard = game.leaderboard(10).await.unwrap();
    assert_eq!(leaderboard.len(), 1);
    assert_eq!(leaderboard[0].player, player);
    assert_eq!(leaderboard[0].branches, 41);
}

#[tokio::test]
async fn clear_leaderboard_removes_saved_results() {
    let (env, program_code_id) = create_env();
    let program = deploy_program(env, program_code_id).await;
    let player: ActorId = ACTOR_ID.into();
    let mut game = program.game();

    game.submit_run(30).await.unwrap();
    assert_eq!(game.player_best_branches(player).await.unwrap(), 30);

    game.clear_leaderboard().await.unwrap();

    assert_eq!(game.player_best_branches(player).await.unwrap(), 0);
    assert_eq!(game.player_rank(player).await.unwrap(), None);
    assert!(game.leaderboard(10).await.unwrap().is_empty());
}

#[tokio::test]
async fn clear_leaderboard_is_admin_only() {
    let (env, program_code_id) = create_env();
    let program = deploy_program(env.clone(), program_code_id).await;
    let player: ActorId = ACTOR_ID.into();
    let mut admin_game = program.game();
    let intruder_env = env.with_actor_id(OTHER_ACTOR_ID.into());
    let intruder_program = sails_rs::client::Actor::<
        ::lumberjack_contract_client::LumberjackContractClientProgram,
        GtestEnv,
    >::new(intruder_env, program.id());
    let mut intruder_game = intruder_program.game();

    admin_game.submit_run(30).await.unwrap();
    assert_eq!(admin_game.player_best_branches(player).await.unwrap(), 30);

    assert!(intruder_game.clear_leaderboard().await.is_err());

    assert_eq!(admin_game.player_best_branches(player).await.unwrap(), 30);
    assert_eq!(admin_game.player_rank(player).await.unwrap(), Some(1));
    assert_eq!(admin_game.leaderboard(10).await.unwrap().len(), 1);
}

async fn deploy_program(
    env: GtestEnv,
    program_code_id: CodeId,
) -> sails_rs::client::Actor<::lumberjack_contract_client::LumberjackContractClientProgram, GtestEnv> {
    env.deploy::<::lumberjack_contract_client::LumberjackContractClientProgram>(program_code_id, b"salt".to_vec())
        .create()
        .await
        .unwrap()
}

fn create_env() -> (GtestEnv, CodeId) {
    let system = System::new();
    system.init_logger_with_default_filter("gwasm=debug,gtest=info,sails_rs=debug");
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);
    system.mint_to(OTHER_ACTOR_ID, 1_000_000_000_000_000);

    let code_id = system.submit_code(::lumberjack_contract::WASM_BINARY);
    let env = GtestEnv::new(system, ACTOR_ID.into());
    (env, code_id)
}
