import { MigrationInterface, QueryRunner } from 'typeorm';

const CHICKEN_RICHES_SLUG = 'chicken-riches';
const CHICKEN_RICHES_TITLE = 'Chicken Riches';
const CHICKEN_RICHES_PROGRAM_NAME = 'ChickenRiches';
const CHICKEN_RICHES_DESCRIPTION =
  'A barnyard arcade game where you catch eggs, bank them before they break, fend off fox attacks, and submit your best shift on-chain.';
const CHICKEN_RICHES_CONTRACT =
  '0xf97028c91e25e8725af8373fad4f01c882bf187146e8ee5373f76e1d0bb43ac4';
const CHICKEN_RICHES_TAGS = JSON.stringify(['Arcade', 'Leaderboard', 'Gas voucher']);
const DEFAULT_DAILY_CAP = 100;
const DEFAULT_WEIGHT = 1;
const DEFAULT_DURATION = 86400;

export class EnableChickenRichesGasless20260430153000 implements MigrationInterface {
  name = 'EnableChickenRichesGasless20260430153000';

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
        CHICKEN_RICHES_PROGRAM_NAME,
        CHICKEN_RICHES_CONTRACT,
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
        VALUES ($1, $2, $3, NULL, $4, NULL, $5::jsonb, 'hidden', 60)
        ON CONFLICT ("slug")
        DO UPDATE SET
          "title" = EXCLUDED."title",
          "description" = EXCLUDED."description",
          "contract_address" = EXCLUDED."contract_address",
          "tags" = EXCLUDED."tags",
          "status" = 'hidden',
          "sort_order" = 60,
          "updated_at" = CURRENT_TIMESTAMP
      `,
      [
        CHICKEN_RICHES_SLUG,
        CHICKEN_RICHES_TITLE,
        CHICKEN_RICHES_DESCRIPTION,
        CHICKEN_RICHES_CONTRACT,
        CHICKEN_RICHES_TAGS,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "gasless_program" SET "status" = 'disabled' WHERE LOWER("address") = LOWER($1)`,
      [CHICKEN_RICHES_CONTRACT],
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
      [CHICKEN_RICHES_SLUG],
    );
  }
}
