import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';

// Routes
import auctionsRouter from './api/routes/auctions';
import itemsRouter from './api/routes/items';
import healthRouter from './api/routes/health';

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
const startServer = () => {
  app.listen(config.PORT, () => {
    logger.info(`Server started successfully`, {
      port: config.PORT,
      env: config.NODE_ENV,
      region: config.BLIZZARD_REGION,
    });
  });
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
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
