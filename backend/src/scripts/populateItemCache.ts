import { pool } from '../db';
import { logger } from '../utils/logger';
import axios from 'axios';
import { blizzardApiService } from '../services/blizzardApi';

/**
 * Script pour peupler le cache d'items depuis Wowhead
 * Récupère les noms en français et construit les URLs d'icônes
 *
 * Usage:
 * npm run populate-items
 */

interface WowheadItemData {
  name_frfr?: string;
  name?: string;
  icon?: string;
  quality?: number;
  description?: string;
  tooltip?: string;
}

async function getItemDataFromWowhead(itemId: number): Promise<WowheadItemData | null> {
  try {
    // Wowhead tooltip API for Classic (French locale)
    const response = await axios.get(`https://fr.wowhead.com/classic/item=${itemId}`, {
      params: { xml: true },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const xmlData = response.data;

    // Parse XML pour extraire les données
    const nameMatch = xmlData.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
    const iconMatch = xmlData.match(/<icon>(.*?)<\/icon>/);
    const qualityMatch = xmlData.match(/<quality id="(\d+)"/);
    const tooltipMatch = xmlData.match(/<htmlTooltip><!\[CDATA\[(.*?)\]\]><\/htmlTooltip>/s);

    // Extract description from tooltip HTML if available
    let description = null;
    if (tooltipMatch) {
      const tooltipHtml = tooltipMatch[1];
      // Look for item description in tooltip (usually in a specific div or after stats)
      const descMatch = tooltipHtml.match(/<span class="q2?">(.*?)<\/span>/);
      if (descMatch) {
        description = descMatch[1].replace(/<[^>]*>/g, '').trim();
      }
    }

    if (!nameMatch) {
      return null;
    }

    return {
      name_frfr: nameMatch[1],
      name: nameMatch[1],
      icon: iconMatch ? iconMatch[1] : null,
      quality: qualityMatch ? parseInt(qualityMatch[1]) : 1,
      description: description,
      tooltip: tooltipMatch ? tooltipMatch[1] : null
    };
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

function getQualityString(qualityId: number): string {
  const qualities: Record<number, string> = {
    0: 'POOR',
    1: 'COMMON',
    2: 'UNCOMMON',
    3: 'RARE',
    4: 'EPIC',
    5: 'LEGENDARY'
  };
  return qualities[qualityId] || 'COMMON';
}

function getIconUrl(iconName: string | null): string | null {
  if (!iconName) return null;
  return `https://wow.zamimg.com/images/wow/icons/large/${iconName}.jpg`;
}

async function populateItemCacheFromWowhead() {
  const client = await pool.connect();

  try {
    logger.info('Populating item cache from Wowhead...');

    // Récupérer tous les item_ids uniques depuis les auctions et l'inventaire
    const result = await client.query(`
      SELECT DISTINCT item_id FROM (
        SELECT DISTINCT item_id FROM auctions
        UNION
        SELECT DISTINCT item_id FROM player_inventory
      ) AS all_items
      ORDER BY item_id
    `);

    const itemIds = result.rows.map(row => row.item_id);
    logger.info(`Found ${itemIds.length} unique items to cache`);

    let cached = 0;
    let alreadyExists = 0;
    let errors = 0;

    // Traiter par lots
    const batchSize = 5; // Plus petit pour éviter de surcharger Wowhead

    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batch = itemIds.slice(i, i + batchSize);

      await Promise.all(batch.map(async (itemId) => {
        try {
          // Vérifier si l'item existe déjà dans le cache
          const existing = await client.query(
            'SELECT 1 FROM item_cache WHERE item_id = $1',
            [itemId]
          );

          if (existing.rows.length > 0) {
            alreadyExists++;
            return;
          }

          // Récupérer les données depuis Wowhead
          const itemData = await getItemDataFromWowhead(itemId);

          if (!itemData || !itemData.name) {
            errors++;
            return;
          }

          // Récupérer l'icône depuis Blizzard API
          const iconUrl = await blizzardApiService.getItemMedia(itemId);

          // Insérer dans le cache
          await client.query(
            `INSERT INTO item_cache (item_id, name, quality, item_class, item_subclass, icon_url, description, last_updated)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (item_id) DO UPDATE SET
               name = $2,
               quality = $3,
               icon_url = $6,
               description = $7,
               last_updated = NOW()`,
            [
              itemId,
              itemData.name_frfr || itemData.name,
              getQualityString(itemData.quality || 1),
              null, // item_class non disponible depuis Wowhead XML
              null, // item_subclass non disponible
              iconUrl, // From Blizzard API
              itemData.description
            ]
          );

          cached++;
          logger.info(`✓ Cached item ${itemId}: ${itemData.name_frfr || itemData.name}`);

        } catch (error: any) {
          logger.warn(`Failed to cache item ${itemId}`, { error: error?.message });
          errors++;
        }
      }));

      // Log de progression
      const progress = Math.min(i + batchSize, itemIds.length);
      logger.info(`Progress: ${progress}/${itemIds.length} items processed (${cached} cached, ${alreadyExists} already existed, ${errors} errors)`);

      // Rate limiting: attendre 3 secondes entre chaque batch pour éviter le blocage
      if (i + batchSize < itemIds.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    logger.info('Item cache population complete', {
      total: itemIds.length,
      newlyCached: cached,
      alreadyExists,
      errors
    });

  } catch (error) {
    logger.error('Failed to populate item cache', { error });
    throw error;
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  populateItemCacheFromWowhead().catch(err => {
    logger.error('Script failed', { error: err });
    process.exit(1);
  });
}

export { populateItemCacheFromWowhead };
