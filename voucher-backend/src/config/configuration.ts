import { config } from 'dotenv';

config();

const required = (name: string): string => {
  const val = process.env[name];
  if (!val) throw new Error(`${name} is not set`);
  return val;
};

const list = (value = ''): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default () => ({
  port: Number(process.env.PORT || '3001'),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    name: required('DB_NAME'),
  },
  nodeUrl: required('NODE_URL'),
  voucherAccount: required('VOUCHER_ACCOUNT'),
  dailyVaraCap: Number(process.env.DAILY_VARA_CAP || '100'),
  perIpDailyVaraCeiling: Number(process.env.PER_IP_DAILY_VARA_CEILING || '1000'),
  frontendOrigins: list(process.env.FRONTEND_ORIGINS || 'http://localhost:5173'),
  infoApiKey: process.env.INFO_API_KEY || '',
});
