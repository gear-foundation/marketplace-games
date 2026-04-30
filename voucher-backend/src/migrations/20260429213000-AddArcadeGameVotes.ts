import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArcadeGameVotes20260429213000 implements MigrationInterface {
  name = 'AddArcadeGameVotes20260429213000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "arcade_game_vote" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "game_slug" character varying NOT NULL,
        "voter_address" character varying NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_arcade_game_vote_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_arcade_game_vote_game_slug_voter_address"
      ON "arcade_game_vote" ("game_slug", "voter_address")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_arcade_game_vote_game_slug"
      ON "arcade_game_vote" ("game_slug")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_arcade_game_vote_voter_address"
      ON "arcade_game_vote" ("voter_address")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_arcade_game_vote_voter_address"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_arcade_game_vote_game_slug"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_arcade_game_vote_game_slug_voter_address"');
    await queryRunner.query('DROP TABLE IF EXISTS "arcade_game_vote"');
  }
}
