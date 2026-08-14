import dotenv from 'dotenv';

dotenv.config();

const Config = {
  VRC_USERNAME: process.env.VRC_USERNAME,
  VRC_PASSWORD: process.env.VRC_PASSWORD,
  VRC_TOTP_KEY: process.env.VRC_TOTP_KEY,
  DATABASE_PATH: process.env.DATABASE_PATH || './worlds.db',
  API_PORT: Number(process.env.API_PORT) || 3000,
  API_HOST: process.env.API_HOST || '0.0.0.0',
  API_ALLOWED_ORIGINS: process.env.API_ALLOWED_ORIGINS
    ? process.env.API_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [],
  API_ALLOWED_IPS: process.env.API_ALLOWED_IPS
    ? process.env.API_ALLOWED_IPS.split(',').map((ip) => ip.trim())
    : [],
  DISABLE_API_RESTRICTIONS:
    process.env.DISABLE_API_RESTRICTIONS === 'true' ||
    process.env.DEV === 'true'
};

export default Config;
