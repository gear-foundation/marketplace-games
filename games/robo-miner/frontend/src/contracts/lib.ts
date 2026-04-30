/* eslint-disable */

import { GearApi, BaseGearProgram, HexString } from '@gear-js/api';
import { TypeRegistry } from '@polkadot/types';
import { TransactionBuilder, ActorId, QueryBuilder, getServiceNamePrefix, getFnNamePrefix, ZERO_ADDRESS } from 'sails-js';

export class SailsProgram {
  public readonly registry: TypeRegistry;
  public readonly roboMinerProfile: RoboMinerProfile;
  private _program?: BaseGearProgram;

  constructor(public api: GearApi, programId?: `0x${string}`) {
    const types: Record<string, any> = {
      Profile: {"high_score":"u128","runs_completed":"u64","checkpoints":"u64"},
      LeaderboardEntry: {"player":"[u8;32]","high_score":"u128","runs_completed":"u64","checkpoints":"u64"},
    }

    this.registry = new TypeRegistry();
    this.registry.setKnownTypes({ types });
    this.registry.register(types);
    if (programId) {
      this._program = new BaseGearProgram(programId, api);
    }

    this.roboMinerProfile = new RoboMinerProfile(this);
  }

  public get programId(): `0x${string}` {
    if (!this._program) throw new Error(`Program ID is not set`);
    return this._program.id;
  }

  createCtorFromCode(code: Uint8Array | Buffer | HexString): TransactionBuilder<null> {
    const builder = new TransactionBuilder<null>(
      this.api,
      this.registry,
      'upload_program',
      null,
      'Create',
      null,
      null,
      'String',
      code,
      async (programId) =>  {
        this._program = await BaseGearProgram.new(programId, this.api);
      }
    );
    return builder;
  }

  createCtorFromCodeId(codeId: `0x${string}`) {
    const builder = new TransactionBuilder<null>(
      this.api,
      this.registry,
      'create_program',
      null,
      'Create',
      null,
      null,
      'String',
      codeId,
      async (programId) =>  {
        this._program = await BaseGearProgram.new(programId, this.api);
      }
    );
    return builder;
  }
}

export class RoboMinerProfile {
  constructor(private _program: SailsProgram) {}

  /**
   * Wipe the caller's profile. Useful for tests / fresh restart.
  */
  public resetSelf(): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      'send_message',
      'RoboMinerProfile',
      'ResetSelf',
      null,
      null,
      'Null',
      this._program.programId,
    );
  }

  /**
   * Records a mid-run checkpoint (player chose "Continue" after death).
   * Bumps `checkpoints` and may improve `high_score`, but does NOT
   * touch `runs_completed` — that counter only moves on `submit_run`.
   * Same voucher-friendly contract as `submit_run`.
  */
  public submitCheckpoint(score: number | string | bigint): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      'send_message',
      'RoboMinerProfile',
      'SubmitCheckpoint',
      score,
      'u128',
      'Null',
      this._program.programId,
    );
  }

  /**
   * Records a finished run (death-with-end OR diamond win).
   * `score` = money_at_run_end + (50_000 if diamond_won). If it
   * beats the player's existing high score, also fires NewHighScore.
   * Always increments runs_completed.
   * 
   * Player pays no value — this is voucher-friendly. Sponsor covers
   * gas via a Vara voucher targeting this program.
  */
  public submitRun(score: number | string | bigint): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      'send_message',
      'RoboMinerProfile',
      'SubmitRun',
      score,
      'u128',
      'Null',
      this._program.programId,
    );
  }

  /**
   * Profile for `player`. Defaults to all-zeros if never submitted.
  */
  public profile(player: ActorId): QueryBuilder<Profile> {
    return new QueryBuilder<Profile>(
      this._program.api,
      this._program.registry,
      this._program.programId,
      'RoboMinerProfile',
      'Profile',
      player,
      '[u8;32]',
      'Profile',
    );
  }

  /**
   * Top N players by `high_score`, descending. Limit clamped to 50
   * for gas safety.
  */
  public topPlayers(limit: number): QueryBuilder<Array<LeaderboardEntry>> {
    return new QueryBuilder<Array<LeaderboardEntry>>(
      this._program.api,
      this._program.registry,
      this._program.programId,
      'RoboMinerProfile',
      'TopPlayers',
      limit,
      'u32',
      'Vec<LeaderboardEntry>',
    );
  }

  /**
   * Number of distinct players who've submitted at least one run.
  */
  public totalPlayers(): QueryBuilder<bigint> {
    return new QueryBuilder<bigint>(
      this._program.api,
      this._program.registry,
      this._program.programId,
      'RoboMinerProfile',
      'TotalPlayers',
      null,
      null,
      'u64',
    );
  }

  /**
   * `submit_run` or `submit_checkpoint` improved the caller's high score.
  */
  public subscribeToNewHighScoreEvent(callback: (data: { player: ActorId; score: number | string | bigint }) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'RoboMinerProfile' && getFnNamePrefix(payload) === 'NewHighScore') {
        callback(this._program.registry.createType('(String, String, {"player":"[u8;32]","score":"u128"})', message.payload)[2].toJSON() as unknown as { player: ActorId; score: number | string | bigint });
      }
    });
  }

  /**
   * `submit_run` was called — emitted only on FINAL submissions
   * (death-end OR diamond win). Not emitted for checkpoints.
  */
  public subscribeToRunSubmittedEvent(callback: (data: { player: ActorId; score: number | string | bigint }) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'RoboMinerProfile' && getFnNamePrefix(payload) === 'RunSubmitted') {
        callback(this._program.registry.createType('(String, String, {"player":"[u8;32]","score":"u128"})', message.payload)[2].toJSON() as unknown as { player: ActorId; score: number | string | bigint });
      }
    });
  }

  /**
   * `submit_checkpoint` was called — emitted on each mid-run "Continue".
  */
  public subscribeToCheckpointSubmittedEvent(callback: (data: { player: ActorId; score: number | string | bigint }) => void | Promise<void>): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {;
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'RoboMinerProfile' && getFnNamePrefix(payload) === 'CheckpointSubmitted') {
        callback(this._program.registry.createType('(String, String, {"player":"[u8;32]","score":"u128"})', message.payload)[2].toJSON() as unknown as { player: ActorId; score: number | string | bigint });
      }
    });
  }
}