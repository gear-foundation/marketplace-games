import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialVoucherSchema20260423000100 implements MigrationInterface {
  name = 'InitialVoucherSchema20260423000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gasless_program_status_enum') THEN
          CREATE TYPE "gasless_program_status_enum" AS ENUM ('enabled', 'disabled');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gasless_program" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying,
        "address" character varying,
        "vara_to_issue" integer NOT NULL,
        "weight" integer NOT NULL DEFAULT 1,
        "duration" integer NOT NULL,
        "status" "gasless_program_status_enum" NOT NULL DEFAULT 'enabled',
        "one_time" boolean DEFAULT false,
        "created_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_gasless_program_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gasless_program_address"
      ON "gasless_program" ("address")
      WHERE "address" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "voucher" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "voucher_id" character varying NOT NULL,
        "account" character varying NOT NULL,
        "programs" jsonb NOT NULL,
        "vara_to_issue" double precision NOT NULL DEFAULT 0,
        "created_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "valid_up_to_block" bigint NOT NULL,
        "valid_up_to" timestamp without time zone NOT NULL,
        "revoked" boolean NOT NULL DEFAULT false,
        "last_renewed_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_voucher_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_voucher_voucher_id"
      ON "voucher" ("voucher_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_voucher_account"
      ON "voucher" ("account")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_voucher_account"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_voucher_voucher_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "voucher"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_gasless_program_address"');
    await queryRunner.query('DROP TABLE IF EXISTS "gasless_program"');
    await queryRunner.query('DROP TYPE IF EXISTS "gasless_program_status_enum"');
  }
}
