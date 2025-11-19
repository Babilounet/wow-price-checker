import { Router, Request, Response } from 'express';
import { blizzardApiService } from '../../services/blizzardApi';
import { cacheService, CacheKeys } from '../../services/cacheService';
import { analyzePrices, analyzeBulkPrices } from '../../utils/priceAnalysis';
import { logger } from '../../utils/logger';
import { config } from '../../config';

const router = Router();

/**
 * GET /auctions/:realmId
 * Fetch auction house data for a realm
 */
router.get('/:realmId', async (req: Request, res: Response) => {
  try {
    const realmId = parseInt(req.params.realmId);

    if (isNaN(realmId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid realm ID', code: 'INVALID_REALM_ID' },
      });
    }

    // Check cache first
    const cacheKey = CacheKeys.auctions(realmId);
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      logger.debug('Returning cached auctions', { realmId });
      return res.json({
        success: true,
        data: cached,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch from Blizzard API
    const auctionData = await blizzardApiService.getAuctions(realmId);

    // Cache the result
    await cacheService.set(cacheKey, auctionData, config.CACHE_AH_SNAPSHOT_TTL);

    res.json({
      success: true,
      data: auctionData,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching auctions', { error });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch auction data', code: 'FETCH_ERROR' },
    });
  }
});

/**
 * GET /auctions/:realmId/prices/:itemId
 * Get price statistics for a specific item
 */
router.get('/:realmId/prices/:itemId', async (req: Request, res: Response) => {
  try {
    const realmId = parseInt(req.params.realmId);
    const itemId = parseInt(req.params.itemId);

    if (isNaN(realmId) || isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid realm or item ID', code: 'INVALID_PARAMS' },
      });
    }

    // Check cache for price stats
    const cacheKey = CacheKeys.priceStats(realmId, itemId);
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      logger.debug('Returning cached price stats', { realmId, itemId });
      return res.json({
        success: true,
        data: cached,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Get auctions (from cache or API)
    const auctionsCacheKey = CacheKeys.auctions(realmId);
    let auctionData = await cacheService.get(auctionsCacheKey);

    if (!auctionData) {
      const response = await blizzardApiService.getAuctions(realmId);
      auctionData = response;
      await cacheService.set(auctionsCacheKey, response, config.CACHE_AH_SNAPSHOT_TTL);
    }

    // Analyze prices
    const priceStats = analyzePrices(auctionData.auctions, itemId, realmId);

    if (!priceStats) {
      return res.status(404).json({
        success: false,
        error: { message: 'No auction data found for this item', code: 'NO_DATA' },
      });
    }

    // Cache price stats (shorter TTL than raw auctions)
    await cacheService.set(cacheKey, priceStats, 600); // 10 minutes

    res.json({
      success: true,
      data: priceStats,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching price stats', { error });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch price statistics', code: 'FETCH_ERROR' },
    });
  }
});

/**
 * POST /auctions/:realmId/prices/bulk
 * Get price statistics for multiple items
 */
router.post('/:realmId/prices/bulk', async (req: Request, res: Response) => {
  try {
    const realmId = parseInt(req.params.realmId);
    const { itemIds } = req.body;

    if (isNaN(realmId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid realm ID', code: 'INVALID_REALM_ID' },
      });
    }

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'itemIds must be a non-empty array', code: 'INVALID_ITEM_IDS' },
      });
    }

    // Limit to 100 items per request
    if (itemIds.length > 100) {
      return res.status(400).json({
        success: false,
        error: { message: 'Maximum 100 items per request', code: 'TOO_MANY_ITEMS' },
      });
    }

    // Get auctions
    const auctionsCacheKey = CacheKeys.auctions(realmId);
    let auctionData = await cacheService.get(auctionsCacheKey);

    if (!auctionData) {
      const response = await blizzardApiService.getAuctions(realmId);
      auctionData = response;
      await cacheService.set(auctionsCacheKey, response, config.CACHE_AH_SNAPSHOT_TTL);
    }

    // Analyze prices for all items
    const priceStatsMap = analyzeBulkPrices(auctionData.auctions, itemIds, realmId);

    // Convert Map to array
    const results = Array.from(priceStatsMap.values());

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching bulk price stats', { error });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch bulk price statistics', code: 'FETCH_ERROR' },
    });
  }
});

export default router;
