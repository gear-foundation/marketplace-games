import { MigrationInterface, QueryRunner } from 'typeorm';

const ZOMBIE_APOCALYPSE_SURVIVAL_SLUG = 'zombie-apocalypse-survival';
const ZOMBIE_APOCALYPSE_SURVIVAL_TITLE = 'Zombie Apocalypse Survival';
const ZOMBIE_APOCALYPSE_SURVIVAL_PROGRAM_NAME = 'ZombieApocalypseSurvival';
const ZOMBIE_APOCALYPSE_SURVIVAL_DESCRIPTION =
  'A top-down survival shooter where you outlast waves of zombies and submit your best run on-chain.';
const ZOMBIE_APOCALYPSE_SURVIVAL_CONTRACT =
  '0x2f683b880bc03933678250cde86656bb0ddaac526bcfb3e6b5870027ade04a56';
const ZOMBIE_APOCALYPSE_SURVIVAL_TAGS = JSON.stringify(['Shooter', 'Leaderboard', 'Gas voucher']);
const DEFAULT_DAILY_CAP = 100;
const DEFAULT_WEIGHT = 1;
const DEFAULT_DURATION = 86400;

export class EnableZombieApocalypseSurvivalGasless20260501120000 implements MigrationInterface {
  name = 'EnableZombieApocalypseSurvivalGasless20260501120000';

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
        ZOMBIE_APOCALYPSE_SURVIVAL_PROGRAM_NAME,
        ZOMBIE_APOCALYPSE_SURVIVAL_CONTRACT,
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
        VALUES ($1, $2, $3, NULL, $4, NULL, $5::jsonb, 'hidden', 70)
        ON CONFLICT ("slug")
        DO UPDATE SET
          "title" = EXCLUDED."title",
          "description" = EXCLUDED."description",
          "contract_address" = EXCLUDED."contract_address",
          "tags" = EXCLUDED."tags",
          "status" = 'hidden',
          "sort_order" = 70,
          "updated_at" = CURRENT_TIMESTAMP
      `,
      [
        ZOMBIE_APOCALYPSE_SURVIVAL_SLUG,
        ZOMBIE_APOCALYPSE_SURVIVAL_TITLE,
        ZOMBIE_APOCALYPSE_SURVIVAL_DESCRIPTION,
        ZOMBIE_APOCALYPSE_SURVIVAL_CONTRACT,
        ZOMBIE_APOCALYPSE_SURVIVAL_TAGS,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "gasless_program" SET "status" = 'disabled' WHERE LOWER("address") = LOWER($1)`,
      [ZOMBIE_APOCALYPSE_SURVIVAL_CONTRACT],
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
      [ZOMBIE_APOCALYPSE_SURVIVAL_SLUG],
    );
  }
}
