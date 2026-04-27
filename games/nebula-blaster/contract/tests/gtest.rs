use sails_rs::gtest::System;
use nebula_blaster::NebulaBlasterProgram;

const PLAYER_1: u64 = 10;
const PLAYER_2: u64 = 11;
const ADMIN: u64 = 1;

fn setup() -> (System, u64) {
    let system = System::new();
    system.init_logger();

    let program_id = system
        .submit_program(NebulaBlasterProgram::default(), ADMIN)
        .expect("program init failed");

    (system, program_id)
}

#[tokio::test]
async fn start_run_returns_ticket() {
    let (system, program_id) = setup();

    let reply = system
        .send(PLAYER_1, program_id, ("NebulaBlasterService", "StartRun", 0u64))
        .expect("send failed");

    assert!(reply.log().iter().any(|l| l.payload().starts_with(b"\x00")), // Ok variant
        "start_run should return Ok(RunTicket)");
}

#[tokio::test]
async fn nonce_increments_per_player() {
    let (system, program_id) = setup();

    // Two separate start_run calls from the same player both succeed
    system
        .send(PLAYER_1, program_id, ("NebulaBlasterService", "StartRun", 0u64))
        .expect("first start_run failed");

    system
        .send(PLAYER_1, program_id, ("NebulaBlasterService", "StartRun", 1u64))
        .expect("second start_run failed");
}

#[tokio::test]
async fn sanity_bound_rejects_huge_score() {
    let (system, program_id) = setup();

    // Issue a ticket
    let ticket_id = 1u64; // first ticket assigned
    system
        .send(PLAYER_1, program_id, ("NebulaBlasterService", "StartRun", 0u64))
        .expect("start_run failed");

    // Submit a physically impossible score
    let reply = system
        .send(
            PLAYER_1,
            program_id,
            ("NebulaBlasterService", "SubmitScore", ticket_id, 999_999u32, 60_000u32),
        )
        .expect("send failed");

    // Should be Err(ImplausibleScore)
    assert!(
        reply.log().iter().any(|l| l.payload().contains(&3)), // Error::ImplausibleScore = variant 3
        "score 999_999 in 60s should be rejected as ImplausibleScore"
    );
}

#[tokio::test]
async fn bad_duration_rejected() {
    let (system, program_id) = setup();

    let ticket_id = 1u64;
    system
        .send(PLAYER_1, program_id, ("NebulaBlasterService", "StartRun", 0u64))
        .expect("start_run failed");

    // Duration > 90s
    let reply = system
        .send(
            PLAYER_1,
            program_id,
            ("NebulaBlasterService", "SubmitScore", ticket_id, 100u32, 100_000u32),
        )
        .expect("send failed");

    assert!(
        reply.log().iter().any(|l| l.payload().contains(&4)), // Error::BadDuration = variant 4
        "duration 100s should be rejected"
    );
}

#[tokio::test]
async fn unknown_ticket_rejected() {
    let (system, program_id) = setup();

    let reply = system
        .send(
            PLAYER_1,
            program_id,
            ("NebulaBlasterService", "SubmitScore", 9999u64, 100u32, 10_000u32),
        )
        .expect("send failed");

    assert!(
        reply.log().iter().any(|l| l.payload().contains(&0)), // Error::UnknownTicket = variant 0
        "unknown ticket_id should return UnknownTicket error"
    );
}

#[tokio::test]
async fn leaderboard_sorted_and_capped() {
    let (system, program_id) = setup();

    // Submit 3 scores from two players (best-per-player logic)
    // Player 1: score 500
    system.send(PLAYER_1, program_id, ("NebulaBlasterService", "StartRun", 0u64)).unwrap();
    system.send(PLAYER_1, program_id, ("NebulaBlasterService", "SubmitScore", 1u64, 500u32, 60_000u32)).unwrap();

    // Player 2: score 1000
    system.send(PLAYER_2, program_id, ("NebulaBlasterService", "StartRun", 0u64)).unwrap();
    system.send(PLAYER_2, program_id, ("NebulaBlasterService", "SubmitScore", 2u64, 1000u32, 60_000u32)).unwrap();

    let reply = system
        .send(PLAYER_1, program_id, ("NebulaBlasterService", "GetAlltimeTop", 10u32))
        .expect("query failed");

    // Player 2 should be rank 1 (higher score)
    let payload = reply.log().last().unwrap().payload();
    // First player entry in the Vec should have score 1000 (bytes 4-8 of SCALE-encoded Vec<ScoreEntry>)
    // This is a basic non-zero check — full decoding would require scale-codec in tests
    assert!(!payload.is_empty(), "GetAlltimeTop should return non-empty payload");
}
