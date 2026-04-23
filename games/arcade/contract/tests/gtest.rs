use ::contract_client::{
    ContractClient as _, ContractClientCtors as _,
    game::Game as _,
};
use sails_rs::{client::*, gtest::*, prelude::*};

const ACTOR_ID: u64 = 42;

#[tokio::test]
async fn best_result_updates_only_when_run_improves() {
    let (env, program_code_id) = create_env();
    let program = deploy_program(env, program_code_id).await;
    let player: ActorId = ACTOR_ID.into();
    let mut game = program.game();

    let first = game
        .submit_run("run-1".to_string(), 1_000, 2_500, 10_000)
        .await
        .unwrap();

    assert!(first.improved);
    assert_eq!(first.player_points, 1_250);
    assert_eq!(first.best_height, 1_000);

    let worse = game
        .submit_run("run-2".to_string(), 700, 1_000, 10_000)
        .await
        .unwrap();

    assert!(!worse.improved);
    assert_eq!(worse.player_points, 1_250);
    assert_eq!(worse.best_height, 1_000);
    assert_eq!(game.player_points(player).await.unwrap(), 1_250);

    let best_run = game.player_best_run(player).await.unwrap().unwrap();
    assert_eq!(best_run.run_id, "run-1");

    let better = game
        .submit_run("run-3".to_string(), 1_300, 4_000, 12_000)
        .await
        .unwrap();

    assert!(better.improved);
    assert_eq!(better.player_points, 1_700);
    assert_eq!(better.best_height, 1_300);
    assert_eq!(game.player_points(player).await.unwrap(), 1_700);
    assert_eq!(game.player_best_height(player).await.unwrap(), 1_300);
    assert_eq!(game.player_rank(player).await.unwrap(), Some(1));

    let leaderboard = game.leaderboard(10).await.unwrap();
    assert_eq!(leaderboard.len(), 1);
    assert_eq!(leaderboard[0].player, player);
    assert_eq!(leaderboard[0].points, 1_700);
    assert_eq!(leaderboard[0].best_height, 1_300);
}

#[tokio::test]
async fn same_run_id_can_update_best_result() {
    let (env, program_code_id) = create_env();
    let program = deploy_program(env, program_code_id).await;
    let player: ActorId = ACTOR_ID.into();
    let mut game = program.game();

    game.submit_run("same-run".to_string(), 800, 1_600, 8_000)
        .await
        .unwrap();

    let improved = game
        .submit_run("same-run".to_string(), 1_200, 3_000, 10_000)
        .await
        .unwrap();

    assert!(improved.improved);
    assert_eq!(improved.player_points, 1_500);

    let best_run = game.player_best_run(player).await.unwrap().unwrap();
    assert_eq!(best_run.run_id, "same-run");
    assert_eq!(best_run.height, 1_200);
    assert_eq!(best_run.points_awarded, 1_500);
}

async fn deploy_program(
    env: GtestEnv,
    program_code_id: CodeId,
) -> sails_rs::client::Actor<::contract_client::ContractClientProgram, GtestEnv> {
    env.deploy::<::contract_client::ContractClientProgram>(program_code_id, b"salt".to_vec())
        .create()
        .await
        .unwrap()
}

fn create_env() -> (GtestEnv, CodeId) {
    let system = System::new();
    system.init_logger_with_default_filter("gwasm=debug,gtest=info,sails_rs=debug");
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);

    let code_id = system.submit_code(::contract::WASM_BINARY);
    let env = GtestEnv::new(system, ACTOR_ID.into());
    (env, code_id)
}
