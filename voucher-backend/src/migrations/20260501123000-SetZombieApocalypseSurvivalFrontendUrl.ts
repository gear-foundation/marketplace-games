import { MigrationInterface, QueryRunner } from 'typeorm';

const ZOMBIE_APOCALYPSE_SURVIVAL_SLUG = 'zombie-apocalypse-survival';
const ZOMBIE_APOCALYPSE_SURVIVAL_FRONTEND_URL =
  'https://zombie-apocalypse-survival-vara.up.railway.app';

export class SetZombieApocalypseSurvivalFrontendUrl20260501123000 implements MigrationInterface {
  name = 'SetZombieApocalypseSurvivalFrontendUrl20260501123000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "arcade_game"
        SET
          "frontend_url" = $2,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "slug" = $1
      `,
      [ZOMBIE_APOCALYPSE_SURVIVAL_SLUG, ZOMBIE_APOCALYPSE_SURVIVAL_FRONTEND_URL],
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
      [ZOMBIE_APOCALYPSE_SURVIVAL_SLUG],
    );
  }
}
