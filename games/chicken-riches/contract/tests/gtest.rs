use ::deep_sea_feast_contract_client::{
    DeepSeaFeastContractClient as _, DeepSeaFeastContractClientCtors as _,
    game::Game as _,
};
use sails_rs::{client::*, gtest::*, prelude::*};

const ACTOR_ID: u64 = 42;

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
async fn rejects_invalid_scores() {
    let (env, program_code_id) = create_env();
    let program = deploy_program(env, program_code_id).await;
    let mut game = program.game();

    assert!(game.submit_score(0).await.is_err());
    assert!(game.submit_score(1_000_000_001).await.is_err());
}

async fn deploy_program(
    env: GtestEnv,
    program_code_id: CodeId,
) -> sails_rs::client::Actor<::deep_sea_feast_contract_client::DeepSeaFeastContractClientProgram, GtestEnv>
{
    env.deploy::<::deep_sea_feast_contract_client::DeepSeaFeastContractClientProgram>(
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

    let code_id = system.submit_code(::deep_sea_feast_contract::WASM_BINARY);
    let env = GtestEnv::new(system, ACTOR_ID.into());
    (env, code_id)
}
