use ::chicken_riches_contract_client::{
    ChickenRichesContractClient as _, ChickenRichesContractClientCtors as _,
    game::Game as _,
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

    let first = game.submit_score(180).await.unwrap();

    assert!(first.improved);
    assert_eq!(first.best_score, 180);

    let worse = game.submit_score(40).await.unwrap();

    assert!(!worse.improved);
    assert_eq!(worse.best_score, 180);
    assert_eq!(game.player_best_score(player).await.unwrap(), 180);

    let better = game.submit_score(980).await.unwrap();

    assert!(better.improved);
    assert_eq!(better.best_score, 980);
    assert_eq!(game.player_best_score(player).await.unwrap(), 980);
    assert_eq!(game.player_rank(player).await.unwrap(), Some(1));
    assert_eq!(game.scores_count().await.unwrap(), 1);

    let leaderboard = game.leaderboard(10).await.unwrap();
    assert_eq!(leaderboard.len(), 1);
    assert_eq!(leaderboard[0].player, player);
    assert_eq!(leaderboard[0].score, 980);
}

#[tokio::test]
async fn rejects_invalid_scores_and_oversized_leaderboard_limits() {
    let (env, program_code_id) = create_env();
    let program = deploy_program(env, program_code_id).await;
    let mut game = program.game();

    assert!(game.submit_score(0).await.is_err());
    assert!(game.submit_score(1_000_000_001).await.is_err());
    assert!(game.leaderboard(1_001).await.is_err());
}

#[tokio::test]
async fn leaderboard_is_descending_and_stable_by_actor_id_for_ties() {
    let (env, program_code_id) = create_env();
    let program = deploy_program(env.clone(), program_code_id).await;
    let first_actor: ActorId = ACTOR_ID.into();
    let second_actor: ActorId = SECOND_ACTOR_ID.into();
    let third_actor: ActorId = THIRD_ACTOR_ID.into();

    let mut first_game = program.game();

    let second_program = sails_rs::client::Actor::<
        ::chicken_riches_contract_client::ChickenRichesContractClientProgram,
        GtestEnv,
    >::new(env.clone().with_actor_id(SECOND_ACTOR_ID.into()), program.id());
    let third_program = sails_rs::client::Actor::<
        ::chicken_riches_contract_client::ChickenRichesContractClientProgram,
        GtestEnv,
    >::new(env.with_actor_id(THIRD_ACTOR_ID.into()), program.id());

    let mut second_game = second_program.game();
    let mut third_game = third_program.game();

    third_game.submit_score(740).await.unwrap();
    second_game.submit_score(910).await.unwrap();
    first_game.submit_score(910).await.unwrap();

    let leaderboard = first_game.leaderboard(10).await.unwrap();
    assert_eq!(leaderboard.len(), 3);
    assert_eq!(leaderboard[0].player, first_actor);
    assert_eq!(leaderboard[0].score, 910);
    assert_eq!(leaderboard[1].player, second_actor);
    assert_eq!(leaderboard[1].score, 910);
    assert_eq!(leaderboard[2].player, third_actor);
    assert_eq!(leaderboard[2].score, 740);
    assert_eq!(first_game.player_rank(first_actor).await.unwrap(), Some(1));
    assert_eq!(first_game.player_rank(second_actor).await.unwrap(), Some(2));
    assert_eq!(first_game.player_rank(third_actor).await.unwrap(), Some(3));
}

async fn deploy_program(
    env: GtestEnv,
    program_code_id: CodeId,
) -> sails_rs::client::Actor<::chicken_riches_contract_client::ChickenRichesContractClientProgram, GtestEnv>
{
    env.deploy::<::chicken_riches_contract_client::ChickenRichesContractClientProgram>(
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

    let code_id = system.submit_code(::chicken_riches_contract::WASM_BINARY);
    let env = GtestEnv::new(system, ACTOR_ID.into());
    (env, code_id)
}
