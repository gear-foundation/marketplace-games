import { MigrationInterface, QueryRunner } from 'typeorm';

const DEEP_SEA_FEAST_SLUG = 'deep-sea-feast';
const DEEP_SEA_FEAST_TITLE = 'Deep Sea Feast';
const DEEP_SEA_FEAST_PROGRAM_NAME = 'DeepSeaFeast';
const DEEP_SEA_FEAST_DESCRIPTION =
  'An underwater survival arcade game where you grow through fish tiers, avoid predators, and submit your best run on-chain.';
const DEEP_SEA_FEAST_CONTRACT =
  '0xbf54fe438121510a6e435686eb255af9106d5e74e5c0593142a7a9de29dad78f';
const DEEP_SEA_FEAST_TAGS = JSON.stringify(['Arcade', 'Leaderboard', 'Gas voucher']);
const DEFAULT_DAILY_CAP = 100;
const DEFAULT_WEIGHT = 1;
const DEFAULT_DURATION = 86400;

export class EnableDeepSeaFeastGasless20260429112000 implements MigrationInterface {
  name = 'EnableDeepSeaFeastGasless20260429112000';

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
      [
        DEEP_SEA_FEAST_PROGRAM_NAME,
        DEEP_SEA_FEAST_CONTRACT,
        DEFAULT_DAILY_CAP,
        DEFAULT_WEIGHT,
        DEFAULT_DURATION,
      ],
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
        VALUES ($1, $2, $3, NULL, $4, NULL, $5::jsonb, 'hidden', 50)
        ON CONFLICT ("slug")
        DO UPDATE SET
          "title" = EXCLUDED."title",
          "description" = EXCLUDED."description",
          "contract_address" = EXCLUDED."contract_address",
          "tags" = EXCLUDED."tags",
          "status" = 'hidden',
          "sort_order" = 50,
          "updated_at" = CURRENT_TIMESTAMP
      `,
      [
        DEEP_SEA_FEAST_SLUG,
        DEEP_SEA_FEAST_TITLE,
        DEEP_SEA_FEAST_DESCRIPTION,
        DEEP_SEA_FEAST_CONTRACT,
        DEEP_SEA_FEAST_TAGS,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "gasless_program" SET "status" = 'disabled' WHERE LOWER("address") = LOWER($1)`,
      [DEEP_SEA_FEAST_CONTRACT],
    );

    await queryRunner.query(
      `
        UPDATE "arcade_game"
        SET
          "contract_address" = NULL,
          "status" = 'hidden',
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "slug" = $1
      `,
      [DEEP_SEA_FEAST_SLUG],
    );
  }
}
