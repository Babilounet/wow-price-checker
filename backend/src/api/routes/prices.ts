import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/v1/prices
 * Get all items with their price stats
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { realm, limit = 100, offset = 0 } = req.query;

    const client = await pool.connect();

    try {
      let query = `
        SELECT
          ip.item_id,
          ip.min_price,
          ip.max_price,
          ip.median_price,
          ip.mean_price,
          ip.market_value,
          ip.sample_size,
          ip.last_updated,
          r.name as realm_name
        FROM item_prices ip
        JOIN realms r ON r.id = ip.realm_id
      `;

      const params: any[] = [];

      if (realm) {
        query += ` WHERE r.slug = $1`;
        params.push(realm);
      }

      query += ` ORDER BY ip.last_updated DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await client.query(query, params);

      res.json({
        success: true,
        data: {
          items: result.rows,
          count: result.rows.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to get prices', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve price data'
    });
  }
});

/**
 * GET /api/v1/prices/:itemId/history?days=30
 * Get price history for an item
 */
router.get('/:itemId/history', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { days = 30, realm } = req.query;

    const client = await pool.connect();

    try {
      let query = `
        SELECT
          ps.normal_price,
          ps.deal_price,
          ps.min_price,
          ps.max_price,
          ps.median_price,
          ps.sample_size,
          ss.scan_timestamp,
          ss.id as scan_id
        FROM price_snapshots ps
        JOIN scan_sessions ss ON ss.id = ps.scan_id
        WHERE ps.item_id = $1
          AND ss.scan_timestamp > NOW() - INTERVAL '${parseInt(days as string)} days'
      `;

      const params: any[] = [itemId];

      if (realm) {
        query += ` AND EXISTS (SELECT 1 FROM realms r WHERE r.id = ss.realm_id AND r.slug = $2)`;
        params.push(realm);
      }

      query += ` ORDER BY ss.scan_timestamp DESC`;

      const result = await client.query(query, params);

      res.json({
        success: true,
        data: {
          itemId: parseInt(itemId),
          history: result.rows,
          count: result.rows.length
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to get price history', { error, itemId: req.params.itemId });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve price history'
    });
  }
});

/**
 * GET /api/v1/prices/:itemId
 * Get current price stats with clustering info
 */
router.get('/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { realm } = req.query;

    const client = await pool.connect();

    try {
      // Get item metadata
      const itemResult = await client.query(
        `SELECT item_id, name, quality, item_class, icon_url
         FROM item_cache
         WHERE item_id = $1`,
        [itemId]
      );

      // Get latest price snapshot with clustering
      let priceQuery = `
        SELECT
          ps.*,
          ss.scan_timestamp,
          r.name as realm_name,
          r.slug as realm_slug
        FROM price_snapshots ps
        JOIN scan_sessions ss ON ss.id = ps.scan_id
        JOIN realms r ON r.id = ss.realm_id
        WHERE ps.item_id = $1
      `;

      const priceParams: any[] = [itemId];

      if (realm) {
        priceQuery += ` AND r.slug = $2`;
        priceParams.push(realm);
      }

      priceQuery += ` ORDER BY ss.scan_timestamp DESC LIMIT 1`;

      const priceResult = await client.query(priceQuery, priceParams);

      if (priceResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No price data found for this item'
        });
      }

      // Get recent auctions
      const auctionsQuery = `
        SELECT
          a.unit_price,
          a.quantity,
          a.buyout,
          a.created_at
        FROM auctions a
        JOIN scan_sessions ss ON ss.id = a.scan_id
        JOIN realms r ON r.id = a.realm_id
        WHERE a.item_id = $1
        ${realm ? 'AND r.slug = $2' : ''}
        ORDER BY a.created_at DESC
        LIMIT 20
      `;

      const auctionsResult = await client.query(auctionsQuery, priceParams);

      res.json({
        success: true,
        data: {
          item: itemResult.rows[0] || { item_id: parseInt(itemId) },
          pricing: {
            normalPrice: priceResult.rows[0].normal_price,
            dealPrice: priceResult.rows[0].deal_price,
            minPrice: priceResult.rows[0].min_price,
            maxPrice: priceResult.rows[0].max_price,
            medianPrice: priceResult.rows[0].median_price,
            meanPrice: priceResult.rows[0].mean_price,
            sampleSize: priceResult.rows[0].sample_size,
            clusterInfo: priceResult.rows[0].cluster_info,
            lastUpdate: priceResult.rows[0].scan_timestamp
          },
          recentAuctions: auctionsResult.rows
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to get item price', { error, itemId: req.params.itemId });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve item price data'
    });
  }
});

export default router;
