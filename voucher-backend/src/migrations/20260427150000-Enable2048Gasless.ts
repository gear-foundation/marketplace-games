import { MigrationInterface, QueryRunner } from 'typeorm';

const GAME_2048_SLUG = '2048';
const GAME_2048_TITLE = '2048';
const GAME_2048_PROGRAM_NAME = 'Game2048';
const GAME_2048_DESCRIPTION =
  'A hidden 2048 puzzle game with wallet score submission and gas voucher support on Vara.';
const GAME_2048_CONTRACT =
  '0xc7869c8ae18d9b4e51df2237788e837a614538c8ca52ef3f0fac81d9442f78d5';
const GAME_2048_TAGS = JSON.stringify(['Puzzle', 'Leaderboard', 'Gas voucher']);
const DEFAULT_DAILY_CAP = 100;
const DEFAULT_WEIGHT = 1;
const DEFAULT_DURATION = 86400;

export class Enable2048Gasless20260427150000 implements MigrationInterface {
  name = 'Enable2048Gasless20260427150000';

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
        GAME_2048_PROGRAM_NAME,
        GAME_2048_CONTRACT,
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
        VALUES ($1, $2, $3, NULL, $4, NULL, $5::jsonb, 'hidden', 40)
        ON CONFLICT ("slug")
        DO UPDATE SET
          "title" = EXCLUDED."title",
          "description" = EXCLUDED."description",
          "contract_address" = EXCLUDED."contract_address",
          "tags" = EXCLUDED."tags",
          "status" = 'hidden',
          "sort_order" = 40,
          "updated_at" = CURRENT_TIMESTAMP
      `,
      [
        GAME_2048_SLUG,
        GAME_2048_TITLE,
        GAME_2048_DESCRIPTION,
        GAME_2048_CONTRACT,
        GAME_2048_TAGS,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "gasless_program" SET "status" = 'disabled' WHERE LOWER("address") = LOWER($1)`,
      [GAME_2048_CONTRACT],
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
      [GAME_2048_SLUG],
    );
  }
}
