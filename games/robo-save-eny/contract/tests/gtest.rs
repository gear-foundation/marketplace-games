use ::robo_save_eny_contract_client::{
    RoboSaveEnyContractClient as _, RoboSaveEnyContractClientCtors as _, game::Game as _,
};
use sails_rs::{client::*, gtest::*, prelude::*};

const ACTOR_ID: u64 = 42;
const SECOND_ACTOR_ID: u64 = 43;
const THIRD_ACTOR_ID: u64 = 44;

#[tokio::test]
async fn stores_only_best_score_and_updates_on_improvement() {
    let (env, program_code_id) = create_env();
    let program = deploy_program(env, program_code_id).await;
    let player: ActorId = ACTOR_ID.into();
    let mut game = program.game();

    let first = game.submit_score(12_480).await.unwrap();

    assert!(first.improved);
    assert_eq!(first.best_score, 12_480);

    let worse = game.submit_score(11_900).await.unwrap();

    assert!(!worse.improved);
    assert_eq!(worse.best_score, 12_480);
    assert_eq!(game.player_best_score(player).await.unwrap(), 12_480);

    let better = game.submit_score(25_120).await.unwrap();

    assert!(better.improved);
    assert_eq!(better.best_score, 25_120);
    assert_eq!(game.player_best_score(player).await.unwrap(), 25_120);
    assert_eq!(game.player_rank(player).await.unwrap(), Some(1));
    assert_eq!(game.scores_count().await.unwrap(), 1);

    let leaderboard = game.leaderboard(10).await.unwrap();
    assert_eq!(leaderboard.len(), 1);
    assert_eq!(leaderboard[0].player, player);
    assert_eq!(leaderboard[0].score, 25_120);
}

#[tokio::test]
async fn rejects_invalid_scores() {
    let (env, program_code_id) = create_env();
    let program = deploy_program(env, program_code_id).await;
    let mut game = program.game();

    assert!(game.submit_score(0).await.is_err());
    assert!(game.submit_score(1_000_000_001).await.is_err());
}

#[tokio::test]
async fn sorts_leaderboard_by_score_then_actor_id() {
    let (env, program_code_id) = create_env();
    let program = deploy_program(env.clone(), program_code_id).await;
    let first_actor: ActorId = ACTOR_ID.into();
    let second_actor: ActorId = SECOND_ACTOR_ID.into();
    let third_actor: ActorId = THIRD_ACTOR_ID.into();

    let first_program = sails_rs::client::Actor::<
        ::robo_save_eny_contract_client::RoboSaveEnyContractClientProgram,
        GtestEnv,
    >::new(env.clone(), program.id());
    let second_program = sails_rs::client::Actor::<
        ::robo_save_eny_contract_client::RoboSaveEnyContractClientProgram,
        GtestEnv,
    >::new(
        env.clone().with_actor_id(SECOND_ACTOR_ID.into()),
        program.id(),
    );
    let third_program = sails_rs::client::Actor::<
        ::robo_save_eny_contract_client::RoboSaveEnyContractClientProgram,
        GtestEnv,
    >::new(env.with_actor_id(THIRD_ACTOR_ID.into()), program.id());

    let mut first_game = first_program.game();
    let mut second_game = second_program.game();
    let mut third_game = third_program.game();

    third_game.submit_score(800).await.unwrap();
    second_game.submit_score(800).await.unwrap();
    first_game.submit_score(500).await.unwrap();

    let leaderboard = first_game.leaderboard(10).await.unwrap();
    assert_eq!(leaderboard[0].player, second_actor);
    assert_eq!(leaderboard[1].player, third_actor);
    assert_eq!(leaderboard[2].player, first_actor);
}

async fn deploy_program(
    env: GtestEnv,
    program_code_id: CodeId,
) -> sails_rs::client::Actor<
    ::robo_save_eny_contract_client::RoboSaveEnyContractClientProgram,
    GtestEnv,
> {
    env.deploy::<::robo_save_eny_contract_client::RoboSaveEnyContractClientProgram>(
        program_code_id,
        b"salt".to_vec(),
    )
    .create()
    .await
    .unwrap()
}

fn create_env() -> (GtestEnv, CodeId) {
    let system = System::new();
    system.init_logger_with_default_filter("gwasm=debug,gtest=info,sails_rs=debug");
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);
    system.mint_to(SECOND_ACTOR_ID, 1_000_000_000_000_000);
    system.mint_to(THIRD_ACTOR_ID, 1_000_000_000_000_000);

    let code_id = system.submit_code(::robo_save_eny_contract::WASM_BINARY);
    let env = GtestEnv::new(system, ACTOR_ID.into());
    (env, code_id)
}
