import { blizzardApiService } from '../services/blizzardApi';
import { pool } from '../db';
import { logger } from '../utils/logger';

async function testIconUpdate() {
  const testItems = [2589, 8846, 13466]; // Linen Cloth, Gromsang, Fleur de peste
  const client = await pool.connect();

  logger.info('Testing icon retrieval and update...');

  for (const itemId of testItems) {
    try {
      const iconUrl = await blizzardApiService.getItemMedia(itemId);
      logger.info(`Item ${itemId}: ${iconUrl ? '✓' : '✗'} ${iconUrl || 'No icon'}`);

      if (iconUrl) {
        await client.query('UPDATE item_cache SET icon_url = $1 WHERE item_id = $2', [iconUrl, itemId]);
        logger.info(`  Updated in database`);
      }
    } catch (error) {
      logger.error(`Failed for item ${itemId}`, { error });
    }
  }

  client.release();
  await pool.end();
  logger.info('Test complete!');
}

testIconUpdate().catch(console.error);
