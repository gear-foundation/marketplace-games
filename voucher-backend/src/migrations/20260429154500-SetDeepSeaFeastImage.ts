import { MigrationInterface, QueryRunner } from 'typeorm';

const DEEP_SEA_FEAST_SLUG = 'deep-sea-feast';
const DEEP_SEA_FEAST_IMAGE_URL = '/deep_sea_feast.png';

export class SetDeepSeaFeastImage20260429154500 implements MigrationInterface {
  name = 'SetDeepSeaFeastImage20260429154500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "arcade_game"
        SET
          "image_url" = $2,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "slug" = $1
      `,
      [DEEP_SEA_FEAST_SLUG, DEEP_SEA_FEAST_IMAGE_URL],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "arcade_game"
        SET
          "image_url" = NULL,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "slug" = $1
      `,
      [DEEP_SEA_FEAST_SLUG],
    );
  }
}
