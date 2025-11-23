/**
 * Script to manually ingest SavedVariables data
 * Usage: npm run tsx src/scripts/ingestSavedVars.ts
 */

import { savedVariablesParser } from '../services/savedVariablesParser';
import { pool } from '../db';
import { logger } from '../utils/logger';

const SAVEDVARS_PATH = process.env.WOW_PATH
  ? `${process.env.WOW_PATH}/WTF/Account/${process.env.WOW_ACCOUNT_NAME}/SavedVariables/WowPriceChecker.lua`
  : '/wow/WTF/Account/121802126#2/SavedVariables/WowPriceChecker.lua';

async function ingest() {
  try {
    logger.info('Reading SavedVariables file', { path: SAVEDVARS_PATH });

    const data = await savedVariablesParser.parseFile(SAVEDVARS_PATH);

    if (!data || !data.auctionData || !data.auctionData.items) {
      logger.error('No auction data found in file');
      process.exit(1);
    }

    const itemCount = Object.keys(data.auctionData.items).length;
    logger.info(`Found ${itemCount} items in auction data`);

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
      logger.info(`Realm ID: ${realmId}`);

      let itemsIngested = 0;
      let auctionsIngested = 0;

      // Process each item
      for (const [itemIdStr, itemData] of Object.entries(items)) {
        const itemId = parseInt(itemIdStr);

        if (!itemData.prices || itemData.prices.length === 0) {
          continue;
        }

        // Calculate statistics
        const stats = savedVariablesParser.calculateItemStats(itemData);

        // Insert auctions
        for (const price of itemData.prices) {
          await client.query(
            `INSERT INTO auctions (realm_id, item_id, unit_price, quantity, buyout, time_left, auction_timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT DO NOTHING`,
            [realmId, itemId, price.unitPrice, price.quantity, price.totalPrice, null, price.timestamp]
          );
          auctionsIngested++;
        }

        // Update item price stats
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
          [itemId, realmId, Math.floor(stats.min), Math.floor(stats.max), Math.floor(stats.median), Math.floor(stats.mean), Math.floor(stats.median), stats.count]
        );
        itemsIngested++;

        if (itemsIngested % 100 === 0) {
          logger.info(`Processed ${itemsIngested}/${itemCount} items...`);
        }
      }

      await client.query('COMMIT');

      logger.info('Ingestion complete!', {
        realm,
        faction,
        itemsIngested,
        auctionsIngested,
        lastScan: new Date(lastScan * 1000).toISOString()
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to ingest data', { error });
      throw error;
    } finally {
      client.release();
    }

    process.exit(0);
  } catch (error) {
    logger.error('Ingestion failed', { error });
    process.exit(1);
  }
}

ingest();
