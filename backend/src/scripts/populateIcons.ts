import { pool } from '../db';
import { logger } from '../utils/logger';
import { blizzardApiService } from '../services/blizzardApi';

/**
 * Script pour récupérer les icônes de tous les items en cache
 * Plus rapide que populate-items car on ne récupère que les icônes
 */

async function populateAllIcons() {
  const client = await pool.connect();

  try {
    logger.info('Starting icon population for all cached items...');

    // Récupérer tous les items sans icône
    const result = await client.query(`
      SELECT item_id, name
      FROM item_cache
      WHERE icon_url IS NULL
      ORDER BY item_id
    `);

    const itemsToProcess = result.rows;
    logger.info(`Found ${itemsToProcess.length} items without icons`);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    // Traiter par lots de 10 pour optimiser
    const batchSize = 10;

    for (let i = 0; i < itemsToProcess.length; i += batchSize) {
      const batch = itemsToProcess.slice(i, i + batchSize);

      await Promise.all(batch.map(async (item) => {
        try {
          const iconUrl = await blizzardApiService.getItemMedia(item.item_id);

          if (iconUrl) {
            await client.query(
              'UPDATE item_cache SET icon_url = $1 WHERE item_id = $2',
              [iconUrl, item.item_id]
            );
            succeeded++;
            logger.info(`✓ ${item.item_id}: ${item.name}`);
          } else {
            failed++;
            logger.warn(`✗ ${item.item_id}: No icon available`);
          }
        } catch (error: any) {
          failed++;
          logger.error(`Failed to fetch icon for item ${item.item_id}`, { error: error?.message });
        }
      }));

      processed += batch.length;
      const progress = Math.min(i + batchSize, itemsToProcess.length);
      logger.info(`Progress: ${progress}/${itemsToProcess.length} (${succeeded} succeeded, ${failed} failed)`);

      // Small delay to avoid rate limiting (1 second between batches)
      if (i + batchSize < itemsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info('Icon population complete', {
      total: itemsToProcess.length,
      succeeded,
      failed
    });

  } catch (error) {
    logger.error('Failed to populate icons', { error });
    throw error;
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  populateAllIcons().catch(err => {
    logger.error('Script failed', { error: err });
    process.exit(1);
  });
}

export { populateAllIcons };
