import { MigrationInterface, QueryRunner } from 'typeorm';

const DEEP_SEA_FEAST_SLUG = 'deep-sea-feast';
const DEEP_SEA_FEAST_TITLE = 'Deep Sea Feast';
const DEEP_SEA_FEAST_DESCRIPTION =
  'An underwater survival arcade game where you grow through fish tiers, avoid predators, and submit your best run on-chain.';
const DEEP_SEA_FEAST_CONTRACT =
  '0xbf54fe438121510a6e435686eb255af9106d5e74e5c0593142a7a9de29dad78f';
const DEEP_SEA_FEAST_FRONTEND_URL = 'https://deep-sea-feast-vara.up.railway.app/';
const DEEP_SEA_FEAST_IMAGE_URL = '/deep_sea_feast.png';
const DEEP_SEA_FEAST_TAGS = JSON.stringify(['Arcade', 'Leaderboard', 'Gas voucher']);

export class PublishDeepSeaFeastGame20260429194000 implements MigrationInterface {
  name = 'PublishDeepSeaFeastGame20260429194000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "gasless_program"
        SET
          "name" = 'DeepSeaFeast',
          "status" = 'enabled',
          "one_time" = false
        WHERE LOWER("address") = LOWER($1)
      `,
      [DEEP_SEA_FEAST_CONTRACT],
    );

    await queryRunner.query(
      `
        INSERT INTO "arcade_game" (
          "slug",
          "title",
          "description",
          "frontend_url",
          "contract_address",
          "image_url",
          "tags",
          "status",
          "sort_order"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'live', 50)
        ON CONFLICT ("slug")
        DO UPDATE SET
          "title" = EXCLUDED."title",
          "description" = EXCLUDED."description",
          "frontend_url" = EXCLUDED."frontend_url",
          "contract_address" = EXCLUDED."contract_address",
          "image_url" = EXCLUDED."image_url",
          "tags" = EXCLUDED."tags",
          "status" = 'live',
          "sort_order" = 50,
          "updated_at" = CURRENT_TIMESTAMP
      `,
      [
        DEEP_SEA_FEAST_SLUG,
        DEEP_SEA_FEAST_TITLE,
        DEEP_SEA_FEAST_DESCRIPTION,
        DEEP_SEA_FEAST_FRONTEND_URL,
        DEEP_SEA_FEAST_CONTRACT,
        DEEP_SEA_FEAST_IMAGE_URL,
        DEEP_SEA_FEAST_TAGS,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "arcade_game"
        SET
          "status" = 'hidden',
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "slug" = $1
      `,
      [DEEP_SEA_FEAST_SLUG],
    );
  }
}
