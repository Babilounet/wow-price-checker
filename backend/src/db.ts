import { Pool } from 'pg';
import { config } from './config';
import { logger } from './utils/logger';

// Create PostgreSQL connection pool
export const pool = new Pool({
  host: config.POSTGRES_HOST,
  port: config.POSTGRES_PORT,
  database: config.POSTGRES_DB,
  user: config.POSTGRES_USER,
  password: config.POSTGRES_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
});

// Test database connection
pool.on('connect', () => {
  logger.info('New database connection established');
});

pool.on('error', (err) => {
  logger.error('Unexpected database error', { error: err });
  process.exit(-1);
});

// Export a helper for running queries
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;

  logger.debug('Executed query', { text, duration, rows: res.rowCount });

  return res;
}

// Initialize database connection
export async function initDatabase() {
  try {
    const client = await pool.connect();
    logger.info('Database connection successful');
    client.release();
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
}
