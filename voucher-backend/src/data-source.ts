import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { GaslessProgram } from './entities/gasless-program.entity';
import { Voucher } from './entities/voucher.entity';

config();

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: required('DB_USER'),
  password: required('DB_PASSWORD'),
  database: required('DB_NAME'),
  entities: [GaslessProgram, Voucher],
  migrations: ['dist/src/migrations/*.js'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
});
