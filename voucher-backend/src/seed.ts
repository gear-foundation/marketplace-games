import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import {
  GaslessProgram,
  GaslessProgramStatus,
} from './entities/gasless-program.entity';
import { Voucher } from './entities/voucher.entity';

config();

/**
 * Vara Arcade program whitelist.
 *
 * All games can share a single voucher per player account. The first POST of a
 * UTC day funds the voucher to `DAILY_VARA_CAP`; later same-day POSTs for other
 * games only append the new game program to the voucher without re-funding.
 *
 * Add new game contracts here, then run `npm run seed` again.
 */
const PROGRAMS = [
  {
    name: 'SkyboundJump',
    address:
      '0x06463100e93e0e6641c32e5777c404167dc4a12ee083fb4841d0934310bc4e4f',
    weight: 1,
    duration: 86400, // 24h
    oneTime: false,
  },
];

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [GaslessProgram, Voucher],
    synchronize: false,
  });

  await ds.initialize();
  const repo = ds.getRepository(GaslessProgram);

  const dailyCap = Number(process.env.DAILY_VARA_CAP || '100');
  const configuredAddresses = PROGRAMS.map((p) => p.address.toLowerCase());

  for (const p of PROGRAMS) {
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

  console.log('Seed complete.');
  await ds.destroy();
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
