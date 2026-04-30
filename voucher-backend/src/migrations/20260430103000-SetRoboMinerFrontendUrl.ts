import { MigrationInterface, QueryRunner } from 'typeorm';

const ROBO_MINER_SLUG = 'robo-miner';
const PREVIOUS_ROBO_MINER_FRONTEND_URL = 'https://robo-miner.up.railway.app';
const ROBO_MINER_FRONTEND_URL = 'https://robo-miner-production.up.railway.app';

export class SetRoboMinerFrontendUrl20260430103000 implements MigrationInterface {
  name = 'SetRoboMinerFrontendUrl20260430103000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "arcade_game"
        SET
          "frontend_url" = $2,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "slug" = $1
      `,
      [ROBO_MINER_SLUG, ROBO_MINER_FRONTEND_URL],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "arcade_game"
        SET
          "frontend_url" = $2,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "slug" = $1
      `,
      [ROBO_MINER_SLUG, PREVIOUS_ROBO_MINER_FRONTEND_URL],
    );
  }
}
