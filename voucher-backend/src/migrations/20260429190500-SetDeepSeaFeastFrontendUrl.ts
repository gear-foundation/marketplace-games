import { MigrationInterface, QueryRunner } from 'typeorm';

const DEEP_SEA_FEAST_SLUG = 'deep-sea-feast';
const DEEP_SEA_FEAST_FRONTEND_URL = 'https://deep-sea-feast-vara.up.railway.app/';

export class SetDeepSeaFeastFrontendUrl20260429190500 implements MigrationInterface {
  name = 'SetDeepSeaFeastFrontendUrl20260429190500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "arcade_game"
        SET
          "frontend_url" = $2,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "slug" = $1
      `,
      [DEEP_SEA_FEAST_SLUG, DEEP_SEA_FEAST_FRONTEND_URL],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "arcade_game"
        SET
          "frontend_url" = NULL,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "slug" = $1
      `,
      [DEEP_SEA_FEAST_SLUG],
    );
  }
}
