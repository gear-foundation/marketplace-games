import { MigrationInterface, QueryRunner } from 'typeorm';

const LUMBERJACK_SLUG = 'lumberjack';
const LUMBERJACK_TITLE = 'Lumberjack';
const LUMBERJACK_DESCRIPTION =
  'A fast tap arcade game where you chop logs, switch sides, dodge branches, and submit your best run on-chain.';
const LUMBERJACK_CONTRACT =
  '0xb73d1c31cd10e84420c2c076dffcbaa109e325f91edfe29219595e67dc4990b3';
const LUMBERJACK_IMAGE_URL = '/lumberjack.png';
const LUMBERJACK_FRONTEND_URL = 'https://lumberjack.up.railway.app';
const LUMBERJACK_TAGS = JSON.stringify(['Tap arcade', 'Best run', 'Vara Arcade']);
const DEFAULT_DAILY_CAP = 100;
const DEFAULT_WEIGHT = 1;
const DEFAULT_DURATION = 86400;

export class EnableLumberjackGasless20260424133000 implements MigrationInterface {
  name = 'EnableLumberjackGasless20260424133000';

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
      [LUMBERJACK_TITLE, LUMBERJACK_CONTRACT, DEFAULT_DAILY_CAP, DEFAULT_WEIGHT, DEFAULT_DURATION],
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
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'live', 20)
        ON CONFLICT ("slug")
        DO UPDATE SET
          "title" = EXCLUDED."title",
          "description" = EXCLUDED."description",
          "frontend_url" = EXCLUDED."frontend_url",
          "contract_address" = EXCLUDED."contract_address",
          "image_url" = EXCLUDED."image_url",
          "tags" = EXCLUDED."tags",
          "status" = 'live',
          "sort_order" = 20,
          "updated_at" = CURRENT_TIMESTAMP
      `,
      [
        LUMBERJACK_SLUG,
        LUMBERJACK_TITLE,
        LUMBERJACK_DESCRIPTION,
        LUMBERJACK_FRONTEND_URL,
        LUMBERJACK_CONTRACT,
        LUMBERJACK_IMAGE_URL,
        LUMBERJACK_TAGS,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "gasless_program" SET "status" = 'disabled' WHERE LOWER("address") = LOWER($1)`,
      [LUMBERJACK_CONTRACT],
    );

    await queryRunner.query(
      `UPDATE "arcade_game" SET "contract_address" = NULL, "updated_at" = CURRENT_TIMESTAMP WHERE "slug" = $1`,
      [LUMBERJACK_SLUG],
    );
  }
}
