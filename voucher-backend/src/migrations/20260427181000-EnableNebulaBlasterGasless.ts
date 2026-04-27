import { MigrationInterface, QueryRunner } from 'typeorm';

const NEBULA_BLASTER_SLUG = 'nebula-blaster';
const NEBULA_BLASTER_TITLE = 'Nebula Blaster';
const NEBULA_BLASTER_DESCRIPTION =
  'A fast wave-survival shooter where you dodge, blast enemies, chain multipliers, and submit your best run on-chain.';
const NEBULA_BLASTER_CONTRACT =
  '0x201f2fb491236d75b6c971a9910593bf8755eae13c62ab3ac10b4ae9c08a3bb4';
const NEBULA_BLASTER_IMAGE_URL = '/nebula_blaster_16x9.webp';
const NEBULA_BLASTER_FRONTEND_URL = 'https://nebula-blaster.up.railway.app';
const NEBULA_BLASTER_TAGS = JSON.stringify(['Shooter', 'Leaderboard', 'Gas voucher']);
const DEFAULT_DAILY_CAP = 100;
const DEFAULT_WEIGHT = 1;
const DEFAULT_DURATION = 86400;

export class EnableNebulaBlasterGasless20260427181000 implements MigrationInterface {
  name = 'EnableNebulaBlasterGasless20260427181000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO "gasless_program" (
          "name",
          "address",
          "vara_to_issue",
          "weight",
          "duration",
          "status",
          "one_time"
        )
        VALUES ($1, $2, $3, $4, $5, 'enabled', false)
        ON CONFLICT ("address")
        DO UPDATE SET
          "name" = EXCLUDED."name",
          "vara_to_issue" = EXCLUDED."vara_to_issue",
          "weight" = EXCLUDED."weight",
          "duration" = EXCLUDED."duration",
          "status" = 'enabled',
          "one_time" = false
      `,
      [NEBULA_BLASTER_TITLE, NEBULA_BLASTER_CONTRACT, DEFAULT_DAILY_CAP, DEFAULT_WEIGHT, DEFAULT_DURATION],
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
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'live', 5)
        ON CONFLICT ("slug")
        DO UPDATE SET
          "title" = EXCLUDED."title",
          "description" = EXCLUDED."description",
          "frontend_url" = EXCLUDED."frontend_url",
          "contract_address" = EXCLUDED."contract_address",
          "image_url" = EXCLUDED."image_url",
          "tags" = EXCLUDED."tags",
          "status" = 'live',
          "sort_order" = 5,
          "updated_at" = CURRENT_TIMESTAMP
      `,
      [
        NEBULA_BLASTER_SLUG,
        NEBULA_BLASTER_TITLE,
        NEBULA_BLASTER_DESCRIPTION,
        NEBULA_BLASTER_FRONTEND_URL,
        NEBULA_BLASTER_CONTRACT,
        NEBULA_BLASTER_IMAGE_URL,
        NEBULA_BLASTER_TAGS,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "gasless_program" SET "status" = 'disabled' WHERE LOWER("address") = LOWER($1)`,
      [NEBULA_BLASTER_CONTRACT],
    );

    await queryRunner.query(
      `UPDATE "arcade_game" SET "contract_address" = NULL, "updated_at" = CURRENT_TIMESTAMP WHERE "slug" = $1`,
      [NEBULA_BLASTER_SLUG],
    );
  }
}
