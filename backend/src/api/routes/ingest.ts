import { Router, Request, Response } from 'express';
import { simpleLuaParser } from '../../services/simpleLuaParser';
import { savedVariablesParser } from '../../services/savedVariablesParser';
import { priceClusteringService } from '../../services/priceClusteringService';
import { pool } from '../../db';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * POST /api/v1/ingest
 * Manually trigger ingestion of SavedVariables data
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const SAVEDVARS_PATH = process.env.WOW_PATH
      ? `${process.env.WOW_PATH}/WTF/Account/${process.env.WOW_ACCOUNT_NAME}/SavedVariables/WowPriceChecker.lua`
      : '/wow/WTF/Account/121802126#2/SavedVariables/WowPriceChecker.lua';

    logger.info('Manual ingestion triggered', { path: SAVEDVARS_PATH });

    const data = await simpleLuaParser.parseWowPriceCheckerFile(SAVEDVARS_PATH);

    if (!data || !data.auctionData || !data.auctionData.items) {
      return res.status(400).json({
        success: false,
        error: 'No auction data found in SavedVariables file'
      });
    }

    const itemCount = Object.keys(data.auctionData.items).length;
    logger.info(`Found ${itemCount} items to ingest`);

    const { realm, faction, items, lastScan } = data.auctionData;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get or create realm
      const realmResult = await client.query(
        `INSERT INTO realms (slug, name, region)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug, region) DO UPDATE SET name = $2
         RETURNING id`,
        [realm.toLowerCase().replace(/\s+/g, '-'), realm, 'eu']
      );
      const realmId = realmResult.rows[0].id;

      // Create scan session
      const scanTimestamp = new Date(lastScan * 1000);
      const scanSessionResult = await client.query(
        `INSERT INTO scan_sessions (realm_id, character_name, scan_timestamp, items_scanned, auctions_scanned)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (realm_id, scan_timestamp)
         DO UPDATE SET items_scanned = $4, auctions_scanned = $5
         RETURNING id`,
        [realmId, data.characterName || 'Unknown', scanTimestamp, itemCount, 0]
      );
      const scanId = scanSessionResult.rows[0].id;

      logger.info('Scan session created', { scanId, timestamp: scanTimestamp });

      let itemsIngested = 0;
      let auctionsIngested = 0;

      // Process items in batches to avoid memory issues
      const itemEntries = Object.entries(items);
      const batchSize = 100;

      for (let i = 0; i < itemEntries.length; i += batchSize) {
        const batch = itemEntries.slice(i, i + batchSize);

        for (const [itemIdStr, itemData] of batch) {
          const itemId = parseInt(itemIdStr);

          if (!itemData.prices || itemData.prices.length === 0) {
            continue;
          }

          // Calculate statistics
          const stats = savedVariablesParser.calculateItemStats(itemData);

          // Run clustering algorithm on unit prices
          const unitPrices = itemData.prices.map((p: any) => p.unitPrice);
          const clusterResult = priceClusteringService.analyzePrices(unitPrices);

          // Insert ALL auctions (no limit - we need complete data for accurate pricing)
          for (const price of itemData.prices) {
            await client.query(
              `INSERT INTO auctions (realm_id, item_id, unit_price, quantity, buyout, time_left, auction_timestamp, scan_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT DO NOTHING`,
              [realmId, itemId, price.unitPrice, price.quantity, price.totalPrice, null, price.timestamp, scanId]
            );
            auctionsIngested++;
          }

          // Create price snapshot with clustering data
          await client.query(
            `INSERT INTO price_snapshots (scan_id, item_id, normal_price, deal_price, min_price, max_price, median_price, mean_price, sample_size, cluster_info)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (scan_id, item_id) DO UPDATE SET
               normal_price = $3,
               deal_price = $4,
               min_price = $5,
               max_price = $6,
               median_price = $7,
               mean_price = $8,
               sample_size = $9,
               cluster_info = $10`,
            [
              scanId,
              itemId,
              clusterResult.normalPrice,
              clusterResult.dealPrice,
              Math.floor(stats.min),
              Math.floor(stats.max),
              Math.floor(stats.median),
              Math.floor(stats.mean),
              stats.count,
              JSON.stringify(clusterResult)
            ]
          );

          // Update item price stats (for backward compatibility)
          await client.query(
            `INSERT INTO item_prices (item_id, realm_id, min_price, max_price, median_price, mean_price, market_value, sample_size, last_updated)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (item_id, realm_id) DO UPDATE SET
               min_price = $3,
               max_price = $4,
               median_price = $5,
               mean_price = $6,
               market_value = $7,
               sample_size = $8,
               last_updated = NOW()`,
            [itemId, realmId, Math.floor(stats.min), Math.floor(stats.max), Math.floor(stats.median), Math.floor(stats.mean), clusterResult.normalPrice, stats.count]
          );
          itemsIngested++;
        }

        logger.info(`Processed ${Math.min(i + batchSize, itemEntries.length)}/${itemEntries.length} items...`);
      }

      // Update scan session with final counts
      await client.query(
        `UPDATE scan_sessions SET auctions_scanned = $1, items_scanned = $2 WHERE id = $3`,
        [auctionsIngested, itemsIngested, scanId]
      );

      // Ingest player inventory
      let inventoryIngested = 0;
      if (data.inventory && data.characterName) {
        for (const [itemIdStr, quantity] of Object.entries(data.inventory)) {
          const itemId = parseInt(itemIdStr);
          const qty = quantity as number;

          await client.query(
            `INSERT INTO player_inventory (character_name, realm_id, item_id, quantity, last_seen)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (character_name, realm_id, item_id)
             DO UPDATE SET quantity = $4, last_seen = NOW()`,
            [data.characterName, realmId, itemId, qty]
          );
          inventoryIngested++;
        }
        logger.info(`Ingested inventory for ${data.characterName}`, { items: inventoryIngested });
      }

      await client.query('COMMIT');

      logger.info('Manual ingestion complete', {
        realm,
        faction,
        itemsIngested,
        auctionsIngested
      });

      res.json({
        success: true,
        data: {
          realm,
          faction,
          itemsIngested,
          auctionsIngested,
          lastScan: new Date(lastScan * 1000).toISOString()
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to ingest data', { error });
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Ingestion failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to ingest SavedVariables data'
    });
  }
});

/**
 * GET /api/v1/ingest/status
 * Get ingestion status and stats
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();

    try {
      const itemsResult = await client.query('SELECT COUNT(*) as count FROM item_prices');
      const auctionsResult = await client.query('SELECT COUNT(*) as count FROM auctions');
      const realmsResult = await client.query('SELECT * FROM realms ORDER BY id');
      const latestUpdate = await client.query(
        'SELECT MAX(last_updated) as latest FROM item_prices'
      );

      res.json({
        success: true,
        data: {
          itemsTracked: parseInt(itemsResult.rows[0].count),
          totalAuctions: parseInt(auctionsResult.rows[0].count),
          realms: realmsResult.rows,
          lastUpdate: latestUpdate.rows[0].latest
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to get status', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get ingestion status'
    });
  }
});

/**
 * DELETE /api/v1/ingest/old-scans
 * Delete old scan sessions, keeping only the most recent N scans
 */
router.delete('/old-scans', async (req: Request, res: Response) => {
  try {
    const keepCount = parseInt(req.query.keep as string) || 3;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get the IDs of scans to delete (all except the most recent N)
      const toDeleteResult = await client.query(
        `SELECT id FROM scan_sessions
         ORDER BY scan_timestamp DESC
         OFFSET $1`,
        [keepCount]
      );

      const idsToDelete = toDeleteResult.rows.map(row => row.id);

      if (idsToDelete.length === 0) {
        await client.query('ROLLBACK');
        return res.json({
          success: true,
          message: 'No old scans to delete',
          deleted: 0
        });
      }

      // Delete price_snapshots for these scans
      const snapshotsResult = await client.query(
        `DELETE FROM price_snapshots WHERE scan_id = ANY($1)`,
        [idsToDelete]
      );

      // Delete auctions for these scans
      const auctionsResult = await client.query(
        `DELETE FROM auctions WHERE scan_id = ANY($1)`,
        [idsToDelete]
      );

      // Delete the scan sessions themselves
      const scansResult = await client.query(
        `DELETE FROM scan_sessions WHERE id = ANY($1)`,
        [idsToDelete]
      );

      await client.query('COMMIT');

      logger.info('Deleted old scan sessions', {
        deleted: scansResult.rowCount,
        keptMostRecent: keepCount
      });

      res.json({
        success: true,
        deleted: scansResult.rowCount,
        deletedSnapshots: snapshotsResult.rowCount,
        deletedAuctions: auctionsResult.rowCount,
        keptMostRecent: keepCount
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to delete old scans', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to delete old scan sessions'
    });
  }
});

export default router;
