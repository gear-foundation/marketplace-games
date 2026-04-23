import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArcadeGameCatalog20260423000200 implements MigrationInterface {
  name = 'AddArcadeGameCatalog20260423000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'arcade_game_status_enum') THEN
          CREATE TYPE "arcade_game_status_enum" AS ENUM ('live', 'soon', 'hidden');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "arcade_game" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying NOT NULL,
        "title" character varying NOT NULL,
        "description" character varying NOT NULL,
        "frontend_url" character varying,
        "contract_address" character varying,
        "image_url" character varying,
        "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "status" "arcade_game_status_enum" NOT NULL DEFAULT 'soon',
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_arcade_game_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_arcade_game_slug"
      ON "arcade_game" ("slug")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_arcade_game_status_sort"
      ON "arcade_game" ("status", "sort_order")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_arcade_game_status_sort"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_arcade_game_slug"');
    await queryRunner.query('DROP TABLE IF EXISTS "arcade_game"');
    await queryRunner.query('DROP TYPE IF EXISTS "arcade_game_status_enum"');
  }
}
