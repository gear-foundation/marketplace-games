import { MigrationInterface, QueryRunner } from 'typeorm';

const GAME_2048_SLUG = '2048';
const GAME_2048_TITLE = '2048';
const GAME_2048_DESCRIPTION =
  'A 2048 puzzle game with wallet score submission and gas voucher support on Vara.';
const GAME_2048_CONTRACT =
  '0xc7869c8ae18d9b4e51df2237788e837a614538c8ca52ef3f0fac81d9442f78d5';
const GAME_2048_FRONTEND_URL = 'https://2048.up.railway.app';
const GAME_2048_IMAGE_URL = '/2048_16x9.svg';
const GAME_2048_TAGS = JSON.stringify(['Puzzle', 'Leaderboard', 'Gas voucher']);

export class Publish2048Game20260427154000 implements MigrationInterface {
  name = 'Publish2048Game20260427154000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "gasless_program"
        SET
          "name" = 'Game2048',
          "status" = 'enabled',
          "one_time" = false
        WHERE LOWER("address") = LOWER($1)
      `,
      [GAME_2048_CONTRACT],
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
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'live', 40)
        ON CONFLICT ("slug")
        DO UPDATE SET
          "title" = EXCLUDED."title",
          "description" = EXCLUDED."description",
          "frontend_url" = EXCLUDED."frontend_url",
          "contract_address" = EXCLUDED."contract_address",
          "image_url" = EXCLUDED."image_url",
          "tags" = EXCLUDED."tags",
          "status" = 'live',
          "sort_order" = 40,
          "updated_at" = CURRENT_TIMESTAMP
      `,
      [
        GAME_2048_SLUG,
        GAME_2048_TITLE,
        GAME_2048_DESCRIPTION,
        GAME_2048_FRONTEND_URL,
        GAME_2048_CONTRACT,
        GAME_2048_IMAGE_URL,
        GAME_2048_TAGS,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "arcade_game"
        SET
          "frontend_url" = NULL,
          "image_url" = NULL,
          "status" = 'hidden',
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "slug" = $1
      `,
      [GAME_2048_SLUG],
    );
  }
}
