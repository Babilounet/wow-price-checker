import { Router, Request, Response } from 'express';
import { cacheService } from '../../services/cacheService';
import { blizzardAuthService } from '../../auth/blizzardAuth';

const router = Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', async (_req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      redis: false,
      blizzardAuth: false,
    },
  };

  try {
    // Check Redis
    await cacheService.exists('health-check');
    health.services.redis = true;
  } catch (error) {
    health.status = 'degraded';
  }

  try {
    // Check Blizzard Auth
    health.services.blizzardAuth = blizzardAuthService.isTokenValid();
  } catch (error) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
