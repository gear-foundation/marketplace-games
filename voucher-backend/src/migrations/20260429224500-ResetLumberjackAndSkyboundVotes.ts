import { MigrationInterface, QueryRunner } from 'typeorm';

const TARGET_SLUGS = ['lumberjack', 'skybound-jump'];

export class ResetLumberjackAndSkyboundVotes20260429224500 implements MigrationInterface {
  name = 'ResetLumberjackAndSkyboundVotes20260429224500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        DELETE FROM "arcade_game_vote"
        WHERE "game_slug" = ANY($1)
      `,
      [TARGET_SLUGS],
    );
  }

  public async down(): Promise<void> {
    // Irreversible on purpose: this migration clears live vote rows.
  }
}
