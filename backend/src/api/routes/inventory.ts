import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/v1/inventory/:characterName
 * Get player inventory
 */
router.get('/:characterName', async (req: Request, res: Response) => {
  try {
    const { characterName } = req.params;
    const { realm } = req.query;

    const client = await pool.connect();

    try {
      let query = `
        SELECT
          pi.item_id,
          pi.quantity,
          pi.last_seen,
          ic.name,
          ic.quality,
          ic.icon_url,
          ip.median_price,
          ip.market_value
        FROM player_inventory pi
        LEFT JOIN item_cache ic ON ic.item_id = pi.item_id
        LEFT JOIN item_prices ip ON ip.item_id = pi.item_id AND ip.realm_id = pi.realm_id
        WHERE pi.character_name = $1
      `;

      const params: any[] = [characterName];

      if (realm) {
        query += ` AND EXISTS (SELECT 1 FROM realms r WHERE r.id = pi.realm_id AND r.slug = $2)`;
        params.push(realm);
      }

      query += ` ORDER BY pi.last_seen DESC`;

      const result = await client.query(query, params);

      res.json({
        success: true,
        data: {
          character: characterName,
          items: result.rows,
          totalItems: result.rows.length
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to get inventory', { error, character: req.params.characterName });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve inventory'
    });
  }
});

/**
 * GET /api/v1/inventory/:characterName/value
 * Get total inventory value
 */
router.get('/:characterName/value', async (req: Request, res: Response) => {
  try {
    const { characterName } = req.params;

    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT
          SUM(pi.quantity * COALESCE(ip.market_value, 0)) as total_value,
          COUNT(*) as items_count,
          COUNT(ip.market_value) as items_with_price
         FROM player_inventory pi
         LEFT JOIN item_prices ip ON ip.item_id = pi.item_id AND ip.realm_id = pi.realm_id
         WHERE pi.character_name = $1`,
        [characterName]
      );

      res.json({
        success: true,
        data: {
          character: characterName,
          totalValue: parseInt(result.rows[0].total_value) || 0,
          itemsCount: parseInt(result.rows[0].items_count),
          itemsWithPrice: parseInt(result.rows[0].items_with_price)
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to calculate inventory value', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to calculate inventory value'
    });
  }
});

export default router;
