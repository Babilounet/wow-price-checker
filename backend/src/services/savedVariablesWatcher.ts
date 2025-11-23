import chokidar from 'chokidar';
import path from 'path';
import { logger } from '../utils/logger';
import { savedVariablesParser } from './savedVariablesParser';
import { pool } from '../db';

export interface WatcherConfig {
  wowPath?: string;
  accountName?: string;
  enabled: boolean;
}

/**
 * Watches WoW SavedVariables file for changes and ingests data
 */
export class SavedVariablesWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private config: WatcherConfig;
  private isProcessing = false;

  constructor(config: WatcherConfig) {
    this.config = config;
  }

  /**
   * Start watching the SavedVariables file
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('SavedVariables watcher is disabled');
      return;
    }

    if (!this.config.wowPath || !this.config.accountName) {
      logger.warn('WoW path or account name not configured, watcher disabled');
      return;
    }

    // Construct path to SavedVariables
    // Example: F:\World of Warcraft\_classic_era_\WTF\Account\121802126#2\SavedVariables\WowPriceChecker.lua
    const savedVarsPath = path.join(
      this.config.wowPath,
      'WTF',
      'Account',
      this.config.accountName,
      'SavedVariables',
      'WowPriceChecker.lua'
    );

    logger.info('Starting SavedVariables watcher', { path: savedVarsPath });

    this.watcher = chokidar.watch(savedVarsPath, {
      persistent: true,
      ignoreInitial: false, // Process file on startup
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', (filePath) => this.onFileChanged(filePath, 'added'))
      .on('change', (filePath) => this.onFileChanged(filePath, 'changed'))
      .on('error', (error) => logger.error('Watcher error', { error }));

    logger.info('SavedVariables watcher started successfully');
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      logger.info('SavedVariables watcher stopped');
    }
  }

  /**
   * Handle file change event
   */
  private async onFileChanged(filePath: string, event: string): Promise<void> {
    if (this.isProcessing) {
      logger.debug('Already processing file, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      logger.info('SavedVariables file changed', { filePath, event });

      // Parse the file
      const data = await savedVariablesParser.parseFile(filePath);

      if (!data) {
        logger.warn('Failed to parse SavedVariables file');
        return;
      }

      // Ingest auction data
      if (data.auctionData && data.auctionData.items) {
        await this.ingestAuctionData(data.auctionData);
      }

      logger.info('SavedVariables data ingested successfully', {
        itemCount: Object.keys(data.auctionData?.items || {}).length,
        lastScan: data.auctionData?.lastScan,
      });
    } catch (error) {
      logger.error('Failed to process SavedVariables file', { error });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Ingest auction data into database
   */
  private async ingestAuctionData(auctionData: any): Promise<void> {
    const { realm, faction, items, lastScan } = auctionData;

    if (!realm || !faction || !items) {
      logger.warn('Incomplete auction data, skipping ingest');
      return;
    }

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

      // Process each item
      for (const [itemIdStr, itemData] of Object.entries(items)) {
        const itemId = parseInt(itemIdStr);

        if (!itemData.prices || itemData.prices.length === 0) {
          continue;
        }

        // Calculate statistics
        const stats = savedVariablesParser.calculateItemStats(itemData);

        // Prepare auction entries
        const auctions = itemData.prices.map((price: any) => ({
          item_id: itemId,
          unit_price: price.unitPrice,
          quantity: price.quantity,
          buyout: price.totalPrice,
          time_left: null, // We don't have this info from SavedVariables
          auction_timestamp: price.timestamp,
        }));

        // Insert auctions in batch
        if (auctions.length > 0) {
          const values: any[] = [];
          const placeholders: string[] = [];

          auctions.forEach((auction, index) => {
            const offset = index * 7;
            placeholders.push(
              `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
            );
            values.push(
              realmId,
              auction.item_id,
              auction.unit_price,
              auction.quantity,
              auction.buyout,
              auction.time_left,
              auction.auction_timestamp
            );
          });

          await client.query(
            `INSERT INTO auctions (realm_id, item_id, unit_price, quantity, buyout, time_left, auction_timestamp)
             VALUES ${placeholders.join(', ')}
             ON CONFLICT DO NOTHING`,
            values
          );
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
          [
            itemId,
            realmId,
            Math.floor(stats.min),
            Math.floor(stats.max),
            Math.floor(stats.median),
            Math.floor(stats.mean),
            Math.floor(stats.median), // Use median as market value
            stats.count,
          ]
        );
      }

      await client.query('COMMIT');

      logger.info('Auction data ingested successfully', {
        realm,
        faction,
        itemCount: Object.keys(items).length,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to ingest auction data', { error });
      throw error;
    } finally {
      client.release();
    }
  }
}

// Singleton instance
let watcherInstance: SavedVariablesWatcher | null = null;

/**
 * Initialize and start the watcher
 */
export async function startWatcher(config: WatcherConfig): Promise<void> {
  if (watcherInstance) {
    await watcherInstance.stop();
  }

  watcherInstance = new SavedVariablesWatcher(config);
  await watcherInstance.start();
}

/**
 * Stop the watcher
 */
export async function stopWatcher(): Promise<void> {
  if (watcherInstance) {
    await watcherInstance.stop();
    watcherInstance = null;
  }
}
