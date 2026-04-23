import 'reflect-metadata';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import {
  GaslessProgram,
  GaslessProgramStatus,
} from './entities/gasless-program.entity';
import { ArcadeGame, ArcadeGameStatus } from './entities/arcade-game.entity';
import { Voucher } from './entities/voucher.entity';

config();

type CatalogGame = {
  slug: string;
  title: string;
  description: string;
  frontendUrl: string | null;
  contractAddress: string | null;
  imageUrl: string | null;
  tags: string[];
  status: ArcadeGameStatus;
  sortOrder: number;
  gasless?: {
    enabled?: boolean;
    name?: string;
    weight?: number;
    duration?: number;
    oneTime?: boolean;
  };
};

function expandEnv(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)(?::([^}]*))?\}/g, (_match, name: string, fallback = '') => {
      return process.env[name] || fallback;
    });
  }

  if (Array.isArray(value)) return value.map(expandEnv);

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, expandEnv(item)]),
    );
  }

  return value;
}

function loadCatalogGames(): CatalogGame[] {
  const catalogPath = join(__dirname, 'catalog', 'games.json');
  const raw = readFileSync(catalogPath, 'utf8');
  const expanded = expandEnv(JSON.parse(raw));

  if (!Array.isArray(expanded)) {
    throw new Error('catalog/games.json must contain an array of games');
  }

  return expanded as CatalogGame[];
}

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [GaslessProgram, Voucher, ArcadeGame],
    synchronize: false,
  });

  await ds.initialize();
  const repo = ds.getRepository(GaslessProgram);
  const gamesRepo = ds.getRepository(ArcadeGame);

  const dailyCap = Number(process.env.DAILY_VARA_CAP || '100');
  const catalogGames = loadCatalogGames();
  const gaslessPrograms = catalogGames
    .filter((game) => game.gasless?.enabled && game.contractAddress)
    .map((game) => ({
      name: game.gasless?.name || game.title.replace(/\s+/g, ''),
      address: game.contractAddress as string,
      weight: game.gasless?.weight ?? 1,
      duration: game.gasless?.duration ?? 86400,
      oneTime: game.gasless?.oneTime ?? false,
    }));
  const configuredAddresses = gaslessPrograms.map((p) => p.address.toLowerCase());

  for (const p of gaslessPrograms) {
    // varaToIssue is inactive in the arcade policy (kept for schema compat).
    // Display value tracks dailyCap so the DB state is self-documenting.
    const varaToIssue = dailyCap;
    const existing = await repo.findOneBy({ address: p.address });

    if (existing) {
      existing.weight = p.weight;
      existing.varaToIssue = varaToIssue;
      existing.duration = p.duration;
      existing.status = GaslessProgramStatus.Enabled;
      existing.oneTime = p.oneTime;
      await repo.save(existing);
      console.log(`[update] ${p.name} ${p.address.slice(0, 12)}... (cap=${dailyCap} VARA)`);
      continue;
    }

    await repo.save({
      name: p.name,
      address: p.address,
      varaToIssue,
      weight: p.weight,
      duration: p.duration,
      status: GaslessProgramStatus.Enabled,
      oneTime: p.oneTime,
      createdAt: new Date(),
    });
    console.log(`[seed] ${p.name} ${p.address.slice(0, 12)}... (cap=${dailyCap} VARA)`);
  }

  await repo
    .createQueryBuilder()
    .update(GaslessProgram)
    .set({ status: GaslessProgramStatus.Disabled })
    .where('LOWER(address) NOT IN (:...configuredAddresses)', { configuredAddresses })
    .execute();

  for (const game of catalogGames) {
    const existing = await gamesRepo.findOneBy({ slug: game.slug });
    const nextGame = {
      slug: game.slug,
      title: game.title,
      description: game.description,
      frontendUrl: game.frontendUrl,
      contractAddress: game.contractAddress,
      imageUrl: game.imageUrl,
      tags: game.tags,
      status: game.status,
      sortOrder: game.sortOrder,
      updatedAt: new Date(),
    };

    if (existing) {
      await gamesRepo.save({ ...existing, ...nextGame });
      console.log(`[update] game ${game.slug}`);
      continue;
    }

    await gamesRepo.save({
      ...nextGame,
      createdAt: new Date(),
    });
    console.log(`[seed] game ${game.slug}`);
  }

  console.log('Seed complete.');
  await ds.destroy();
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
