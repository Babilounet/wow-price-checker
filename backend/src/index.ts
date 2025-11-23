import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';
import { startWatcher, stopWatcher } from './services/savedVariablesWatcher';
import { initDatabase } from './db';

// Routes
import auctionsRouter from './api/routes/auctions';
import itemsRouter from './api/routes/items';
import healthRouter from './api/routes/health';
import ingestRouter from './api/routes/ingest';
import pricesRouter from './api/routes/prices';
import inventoryRouter from './api/routes/inventory';

const app: Application = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors({ origin: config.CORS_ORIGIN })); // CORS
app.use(compression()); // Gzip compression
app.use(express.json()); // JSON body parser
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Routes
app.use(`${config.API_PREFIX}/auctions`, auctionsRouter);
app.use(`${config.API_PREFIX}/items`, itemsRouter);
app.use(`${config.API_PREFIX}/health`, healthRouter);
app.use(`${config.API_PREFIX}/ingest`, ingestRouter);
app.use(`${config.API_PREFIX}/prices`, pricesRouter);
app.use(`${config.API_PREFIX}/inventory`, inventoryRouter);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'WoW Price Checker API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: `${config.API_PREFIX}/health`,
      auctions: `${config.API_PREFIX}/auctions/:realmId`,
      prices: `${config.API_PREFIX}/auctions/:realmId/prices/:itemId`,
      items: `${config.API_PREFIX}/items/:itemId`,
    },
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND',
    },
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err });
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
});

// Start server
const startServer = async () => {
  // Initialize database connection
  await initDatabase();

  app.listen(config.PORT, () => {
    logger.info(`Server started successfully`, {
      port: config.PORT,
      env: config.NODE_ENV,
      region: config.BLIZZARD_REGION,
    });
  });

  // Start SavedVariables watcher if enabled
  const watcherEnabled = process.env.SAVEDVARS_WATCHER_ENABLED === 'true';
  if (watcherEnabled) {
    await startWatcher({
      wowPath: process.env.WOW_PATH,
      accountName: process.env.WOW_ACCOUNT_NAME,
      enabled: true,
    });
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await stopWatcher();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await stopWatcher();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  process.exit(1);
});

startServer();

export default app;
