import { MigrationInterface, QueryRunner } from 'typeorm';

const VARA_GAME_SLUG = 'vara-game';
const VARA_GAME_TITLE = 'Vara Game';
const VARA_GAME_DESCRIPTION =
  'A hidden Vara Arcade game with gas voucher support enabled for contract integration.';
const VARA_GAME_CONTRACT =
  '0x201f2fb491236d75b6c971a9910593bf8755eae13c62ab3ac10b4ae9c08a3bb4';
const VARA_GAME_TAGS = JSON.stringify(['Vara Arcade', 'Gas voucher']);
const DEFAULT_DAILY_CAP = 100;
const DEFAULT_WEIGHT = 1;
const DEFAULT_DURATION = 86400;

export class EnableVaraGameGasless20260427113000 implements MigrationInterface {
  name = 'EnableVaraGameGasless20260427113000';

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
        VARA_GAME_TITLE,
        VARA_GAME_CONTRACT,
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
        VALUES ($1, $2, $3, NULL, $4, NULL, $5::jsonb, 'hidden', 30)
        ON CONFLICT ("slug")
        DO UPDATE SET
          "title" = EXCLUDED."title",
          "description" = EXCLUDED."description",
          "contract_address" = EXCLUDED."contract_address",
          "tags" = EXCLUDED."tags",
          "status" = 'hidden',
          "sort_order" = 30,
          "updated_at" = CURRENT_TIMESTAMP
      `,
      [
        VARA_GAME_SLUG,
        VARA_GAME_TITLE,
        VARA_GAME_DESCRIPTION,
        VARA_GAME_CONTRACT,
        VARA_GAME_TAGS,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "gasless_program" SET "status" = 'disabled' WHERE LOWER("address") = LOWER($1)`,
      [VARA_GAME_CONTRACT],
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
      [VARA_GAME_SLUG],
    );
  }
}
