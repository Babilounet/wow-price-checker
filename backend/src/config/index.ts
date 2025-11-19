import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_PREFIX: z.string().default('/api/v1'),

  // Blizzard API
  BLIZZARD_CLIENT_ID: z.string().min(1, 'Blizzard Client ID is required'),
  BLIZZARD_CLIENT_SECRET: z.string().min(1, 'Blizzard Client Secret is required'),
  BLIZZARD_REGION: z.enum(['us', 'eu', 'kr', 'tw', 'cn']).default('eu'),

  // Database
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.string().transform(Number).default('5432'),
  POSTGRES_DB: z.string().default('wow_price_checker'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().min(1, 'Database password is required'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_TTL: z.string().transform(Number).default('600'),

  // Rate Limiting
  BLIZZARD_API_RATE_LIMIT_PER_HOUR: z.string().transform(Number).default('36000'),
  BLIZZARD_API_RATE_LIMIT_PER_SECOND: z.string().transform(Number).default('100'),

  // Caching
  CACHE_AH_SNAPSHOT_TTL: z.string().transform(Number).default('3600'),
  CACHE_ITEM_DATA_TTL: z.string().transform(Number).default('86400'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // WebSocket
  WS_PORT: z.string().transform(Number).default('3001'),

  // Jobs
  ENABLE_AH_FETCH_JOB: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  AH_FETCH_CRON: z.string().default('0 * * * *'),

  // Monitoring
  ENABLE_HEALTH_CHECK: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
});

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

export const config = parseEnv();

export const getBlizzardApiUrl = (region: string): string => {
  const regionMap: Record<string, string> = {
    us: 'https://us.api.blizzard.com',
    eu: 'https://eu.api.blizzard.com',
    kr: 'https://kr.api.blizzard.com',
    tw: 'https://tw.api.blizzard.com',
    cn: 'https://gateway.battlenet.com.cn',
  };
  return regionMap[region] || regionMap.eu;
};

export const getBlizzardOAuthUrl = (region: string): string => {
  const regionMap: Record<string, string> = {
    us: 'https://oauth.battle.net',
    eu: 'https://oauth.battle.net',
    kr: 'https://oauth.battle.net',
    tw: 'https://oauth.battle.net',
    cn: 'https://oauth.battlenet.com.cn',
  };
  return regionMap[region] || regionMap.eu;
};
