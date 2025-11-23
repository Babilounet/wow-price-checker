import { Router, Request, Response } from 'express';
import { blizzardApiService } from '../../services/blizzardApi';
import { cacheService, CacheKeys } from '../../services/cacheService';
import { pool } from '../../db';
import { logger } from '../../utils/logger';
import { config } from '../../config';

const router = Router();

/**
 * GET /api/v1/items/search?q={query}&limit=10
 * Search items by name
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters'
      });
    }

    const client = await pool.connect();

    try {
      // Recherche full-text avec PostgreSQL
      const result = await client.query(
        `SELECT item_id, name, quality, item_class, icon_url
         FROM item_cache
         WHERE name ILIKE $1
         ORDER BY
           CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,
           LENGTH(name),
           name
         LIMIT $3`,
        [`%${q}%`, `${q}%`, limit]
      );

      res.json({
        success: true,
        data: {
          items: result.rows,
          count: result.rows.length
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to search items', { error, query: req.query });
    res.status(500).json({
      success: false,
      error: 'Failed to search items'
    });
  }
});

/**
 * GET /items/:itemId
 * Fetch item data
 */
router.get('/:itemId', async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.itemId);

    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid item ID', code: 'INVALID_ITEM_ID' },
      });
    }

    // Check cache
    const cacheKey = CacheKeys.item(itemId);
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      logger.debug('Returning cached item', { itemId });
      return res.json({
        success: true,
        data: cached,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch from Blizzard API
    const itemData = await blizzardApiService.getItem(itemId);

    // Cache for 24 hours (static data rarely changes)
    await cacheService.set(cacheKey, itemData, config.CACHE_ITEM_DATA_TTL);

    res.json({
      success: true,
      data: itemData,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching item', { error });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch item data', code: 'FETCH_ERROR' },
    });
  }
});

/**
 * GET /items/:itemId/media
 * Fetch item media (icon)
 */
router.get('/:itemId/media', async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.itemId);

    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid item ID', code: 'INVALID_ITEM_ID' },
      });
    }

    // Check cache
    const cacheKey = CacheKeys.itemMedia(itemId);
    const cached = await cacheService.get<string>(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: { iconUrl: cached },
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch from Blizzard API
    const iconUrl = await blizzardApiService.getItemMedia(itemId);

    if (!iconUrl) {
      return res.status(404).json({
        success: false,
        error: { message: 'Item media not found', code: 'NOT_FOUND' },
      });
    }

    // Cache for 24 hours
    await cacheService.set(cacheKey, iconUrl, config.CACHE_ITEM_DATA_TTL);

    res.json({
      success: true,
      data: { iconUrl },
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching item media', { error });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch item media', code: 'FETCH_ERROR' },
    });
  }
});

export default router;
