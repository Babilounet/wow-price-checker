# Plan de migration : Frontend vers BDD + Inventaire + Pricing intelligent

## Vue d'ensemble

Ce plan détaille la migration complète du projet WoW Price Checker pour :
- ✅ Utiliser uniquement notre base de données PostgreSQL (plus d'appels directs aux API Blizzard)
- ✅ Ajouter une page Inventaire affichant les items du joueur
- ✅ Créer une page détail d'item avec lien Wowhead et prix intelligents
- ✅ Implémenter un graphique d'évolution des prix dans le temps
- ✅ Stocker l'historique des scans de manière optimisée
- ✅ Algorithme de clustering pour détecter prix normaux vs deals vs aberrations

## Décisions architecturales (validées par l'utilisateur)

1. **Recherche d'items** : Recherche par nom avec autocomplete
2. **Fréquence des snapshots** : Un snapshot par scan complet (à chaque /reload après scan AH)
3. **Affichage des prix** : Afficher à la fois le prix "normal" et les "deals" détectés
4. **Algorithme de pricing** : Clustering (détection automatique des groupes de prix)

---

# 📊 Phase 1: Backend - Système d'historique des scans

## 1.1 Nouvelles tables PostgreSQL

### Créer `backend/sql/migrations/001_price_history.sql`

```sql
-- Table pour les sessions de scan (métadonnées de chaque scan)
CREATE TABLE IF NOT EXISTS scan_sessions (
    id BIGSERIAL PRIMARY KEY,
    realm_id INTEGER NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    character_name VARCHAR(50) NOT NULL,
    scan_timestamp TIMESTAMP NOT NULL,
    items_scanned INTEGER NOT NULL DEFAULT 0,
    auctions_scanned INTEGER NOT NULL DEFAULT 0,
    scan_duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (realm_id, scan_timestamp)
);

CREATE INDEX idx_scan_sessions_realm_timestamp ON scan_sessions(realm_id, scan_timestamp DESC);
CREATE INDEX idx_scan_sessions_timestamp ON scan_sessions(scan_timestamp DESC);

-- Table pour les snapshots de prix (historique optimisé)
CREATE TABLE IF NOT EXISTS price_snapshots (
    id BIGSERIAL PRIMARY KEY,
    scan_id BIGINT NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL,
    normal_price BIGINT NOT NULL,           -- Prix du cluster dominant
    deal_price BIGINT,                      -- Prix du cluster "deal" (si existe)
    min_price BIGINT NOT NULL,
    max_price BIGINT NOT NULL,
    median_price BIGINT NOT NULL,
    mean_price BIGINT NOT NULL,
    sample_size INTEGER NOT NULL,
    cluster_info JSONB,                      -- Détails des clusters détectés
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (scan_id, item_id)
);

CREATE INDEX idx_price_snapshots_scan ON price_snapshots(scan_id);
CREATE INDEX idx_price_snapshots_item ON price_snapshots(item_id);
CREATE INDEX idx_price_snapshots_item_scan ON price_snapshots(item_id, scan_id DESC);

-- Modifier la table auctions pour ajouter scan_id
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS scan_id BIGINT REFERENCES scan_sessions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_auctions_scan ON auctions(scan_id);

COMMENT ON TABLE scan_sessions IS 'Métadonnées de chaque session de scan AH';
COMMENT ON TABLE price_snapshots IS 'Historique optimisé des prix avec clustering';
```

## 1.2 Service de clustering des prix

### Créer `backend/src/services/priceClusteringService.ts`

```typescript
interface PriceCluster {
  centerPrice: number;
  minPrice: number;
  maxPrice: number;
  auctionCount: number;
  type: 'normal' | 'deal' | 'aberrant';
  confidence: number;
}

interface ClusteringResult {
  normalPrice: number;
  dealPrice: number | null;
  clusters: PriceCluster[];
  aberrants: number[];
  metadata: {
    totalAuctions: number;
    clustersFound: number;
    aberrantsCount: number;
  };
}

export class PriceClusteringService {
  /**
   * Algorithme DBSCAN adapté pour le clustering de prix
   * - epsilon: distance maximale entre deux points du même cluster (en % du prix)
   * - minPoints: nombre minimum de points pour former un cluster
   */
  private dbscan(
    prices: number[],
    epsilon: number = 0.15, // 15% de variation
    minPoints: number = 3
  ): number[][] {
    // Implémentation DBSCAN simplifiée
    const sorted = [...prices].sort((a, b) => a - b);
    const clusters: number[][] = [];
    const visited = new Set<number>();

    for (let i = 0; i < sorted.length; i++) {
      if (visited.has(i)) continue;

      const neighbors = this.getNeighbors(sorted, i, epsilon);

      if (neighbors.length < minPoints) {
        continue; // Bruit/aberrant
      }

      // Nouveau cluster
      const cluster: number[] = [];
      const queue = [...neighbors];

      while (queue.length > 0) {
        const idx = queue.shift()!;
        if (visited.has(idx)) continue;

        visited.add(idx);
        cluster.push(sorted[idx]);

        const newNeighbors = this.getNeighbors(sorted, idx, epsilon);
        if (newNeighbors.length >= minPoints) {
          queue.push(...newNeighbors);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  private getNeighbors(prices: number[], index: number, epsilon: number): number[] {
    const price = prices[index];
    const neighbors: number[] = [];

    for (let i = 0; i < prices.length; i++) {
      const diff = Math.abs(prices[i] - price) / price;
      if (diff <= epsilon) {
        neighbors.push(i);
      }
    }

    return neighbors;
  }

  /**
   * Analyse les prix et détecte les clusters
   */
  public analyzePrices(prices: number[]): ClusteringResult {
    if (prices.length === 0) {
      return {
        normalPrice: 0,
        dealPrice: null,
        clusters: [],
        aberrants: [],
        metadata: { totalAuctions: 0, clustersFound: 0, aberrantsCount: 0 }
      };
    }

    // Détecter les clusters
    const clusterArrays = this.dbscan(prices);

    // Convertir en PriceCluster avec métadonnées
    const clusters: PriceCluster[] = clusterArrays.map((cluster, idx) => {
      const sorted = cluster.sort((a, b) => a - b);
      return {
        centerPrice: this.median(cluster),
        minPrice: sorted[0],
        maxPrice: sorted[sorted.length - 1],
        auctionCount: cluster.length,
        type: 'normal' as const,
        confidence: cluster.length / prices.length
      };
    });

    // Trier par taille (le plus gros cluster = "normal")
    clusters.sort((a, b) => b.auctionCount - a.auctionCount);

    // Identifier le type de chaque cluster
    if (clusters.length > 0) {
      clusters[0].type = 'normal'; // Le plus gros = prix normal

      // Les clusters plus bas que le normal = deals
      for (let i = 1; i < clusters.length; i++) {
        if (clusters[i].centerPrice < clusters[0].centerPrice * 0.8) {
          clusters[i].type = 'deal';
        } else if (clusters[i].centerPrice > clusters[0].centerPrice * 1.2) {
          clusters[i].type = 'aberrant';
        }
      }
    }

    // Trouver les prix aberrants (non clustérisés)
    const clusteredPrices = new Set(clusterArrays.flat());
    const aberrants = prices.filter(p => !clusteredPrices.has(p));

    // Résultat final
    const normalPrice = clusters.length > 0 ? clusters[0].centerPrice : this.median(prices);
    const dealCluster = clusters.find(c => c.type === 'deal');
    const dealPrice = dealCluster ? dealCluster.centerPrice : null;

    return {
      normalPrice: Math.floor(normalPrice),
      dealPrice: dealPrice ? Math.floor(dealPrice) : null,
      clusters,
      aberrants,
      metadata: {
        totalAuctions: prices.length,
        clustersFound: clusters.length,
        aberrantsCount: aberrants.length
      }
    };
  }

  private median(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}

export const priceClusteringService = new PriceClusteringService();
```

## 1.3 Modification du processus d'ingestion

### Modifier `backend/src/api/routes/ingest.ts`

Ajouter la création de scan_session et price_snapshots :

```typescript
// Après l'import
import { priceClusteringService } from '../../services/priceClusteringService';

// Au début de la transaction, créer la session de scan
const scanSessionResult = await client.query(
  `INSERT INTO scan_sessions (realm_id, character_name, scan_timestamp, items_scanned, auctions_scanned)
   VALUES ($1, $2, $3, $4, $5)
   RETURNING id`,
  [realmId, data.characterName, new Date(lastScan * 1000), itemCount, 0]
);
const scanId = scanSessionResult.rows[0].id;

// Lors de l'insertion des auctions, ajouter scan_id
await client.query(
  `INSERT INTO auctions (realm_id, item_id, unit_price, quantity, buyout, time_left, auction_timestamp, scan_id)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
   ON CONFLICT DO NOTHING`,
  [realmId, itemId, price.unitPrice, price.quantity, price.totalPrice, null, price.timestamp, scanId]
);

// Après avoir calculé les stats, faire le clustering et créer le snapshot
const prices = itemData.prices.map(p => p.unitPrice);
const clusterResult = priceClusteringService.analyzePrices(prices);

await client.query(
  `INSERT INTO price_snapshots (scan_id, item_id, normal_price, deal_price, min_price, max_price, median_price, mean_price, sample_size, cluster_info)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
  [
    scanId,
    itemId,
    clusterResult.normalPrice,
    clusterResult.dealPrice,
    stats.min,
    stats.max,
    stats.median,
    stats.mean,
    stats.count,
    JSON.stringify(clusterResult)
  ]
);

// Mettre à jour le nombre d'auctions dans la session
await client.query(
  `UPDATE scan_sessions SET auctions_scanned = $1 WHERE id = $2`,
  [auctionsIngested, scanId]
);
```

---

# 🔍 Phase 2: Backend - Recherche par nom

## 2.1 Script de population du cache

### Créer `backend/src/scripts/populateItemCache.ts`

```typescript
import { pool } from '../db';
import { logger } from '../utils/logger';
import { blizzardApiService } from '../services/blizzardApi';

/**
 * Script pour peupler le cache d'items depuis l'API Blizzard
 * Charge tous les items Classic Anniversary
 */
async function populateItemCache() {
  const client = await pool.connect();

  try {
    // Liste des IDs d'items Classic Anniversary (1-25000 environ)
    // On peut filtrer pour n'inclure que ceux qui existent
    logger.info('Fetching item data from Blizzard API...');

    let itemsAdded = 0;
    let errors = 0;

    // Batch processing par groupes de 100
    for (let i = 1; i <= 25000; i += 100) {
      const batch = [];

      for (let itemId = i; itemId < i + 100 && itemId <= 25000; itemId++) {
        batch.push(itemId);
      }

      // Fetch items en parallèle
      const results = await Promise.allSettled(
        batch.map(async (itemId) => {
          try {
            const itemData = await blizzardApiService.getItem(itemId);
            const mediaData = await blizzardApiService.getItemMedia(itemId);

            return {
              itemId,
              name: itemData.name,
              quality: itemData.quality?.type || 'COMMON',
              itemClass: itemData.item_class?.name || null,
              itemSubclass: itemData.item_subclass?.name || null,
              iconUrl: mediaData?.assets?.[0]?.value || null
            };
          } catch (error) {
            return null;
          }
        })
      );

      // Insérer les items valides
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const item = result.value;

          await client.query(
            `INSERT INTO item_cache (item_id, name, quality, item_class, item_subclass, icon_url, last_updated)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (item_id) DO UPDATE SET
               name = $2,
               quality = $3,
               item_class = $4,
               item_subclass = $5,
               icon_url = $6,
               last_updated = NOW()`,
            [item.itemId, item.name, item.quality, item.itemClass, item.itemSubclass, item.iconUrl]
          );

          itemsAdded++;
        } else {
          errors++;
        }
      }

      logger.info(`Processed ${i + 100}/${25000} items (${itemsAdded} added, ${errors} errors)`);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info(`Item cache population complete: ${itemsAdded} items added`);

  } catch (error) {
    logger.error('Failed to populate item cache', { error });
  } finally {
    client.release();
    process.exit(0);
  }
}

populateItemCache();
```

## 2.2 Endpoint de recherche

### Modifier `backend/src/api/routes/items.ts`

Ajouter l'endpoint de recherche :

```typescript
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
```

---

# 📦 Phase 3: Backend - Endpoints inventaire et historique

## 3.1 Routes inventaire

### Créer `backend/src/api/routes/inventory.ts`

```typescript
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
```

## 3.2 Amélioration des routes prix

### Modifier `backend/src/api/routes/prices.ts`

Ajouter l'endpoint d'historique et améliorer le endpoint de détail :

```typescript
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
 * (Amélioration de l'endpoint existant)
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
```

### Enregistrer la route inventaire dans `backend/src/index.ts`

```typescript
import inventoryRouter from './api/routes/inventory';

// ...
app.use(`${config.API_PREFIX}/inventory`, inventoryRouter);
```

---

# 🎨 Phase 4: Frontend - Composants réutilisables

## 4.1 ItemIcon Component

### Créer `frontend/src/components/ItemIcon.tsx`

```typescript
interface ItemIconProps {
  itemId?: number;
  name?: string;
  quality?: string;
  iconUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const qualityColors = {
  POOR: '#9d9d9d',
  COMMON: '#ffffff',
  UNCOMMON: '#1eff00',
  RARE: '#0070dd',
  EPIC: '#a335ee',
  LEGENDARY: '#ff8000',
};

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

export default function ItemIcon({
  itemId,
  name,
  quality = 'COMMON',
  iconUrl,
  size = 'md',
  showTooltip = true
}: ItemIconProps) {
  const borderColor = qualityColors[quality as keyof typeof qualityColors] || qualityColors.COMMON;

  return (
    <div
      className={`${sizeClasses[size]} relative rounded border-2 bg-gray-800 flex items-center justify-center overflow-hidden`}
      style={{ borderColor }}
      title={showTooltip && name ? name : undefined}
    >
      {iconUrl ? (
        <img src={iconUrl} alt={name || `Item ${itemId}`} className="w-full h-full object-cover" />
      ) : (
        <span className="text-gray-500 text-xs">?</span>
      )}
    </div>
  );
}
```

## 4.2 PriceClusterCard Component

### Créer `frontend/src/components/PriceClusterCard.tsx`

```typescript
import { formatPrice } from '../utils/formatters';

interface PriceClusterCardProps {
  type: 'normal' | 'deal' | 'aberrant';
  price: number;
  auctionCount: number;
  label: string;
  percentage?: number;
}

const typeStyles = {
  normal: {
    bg: 'bg-green-900/30',
    border: 'border-green-600/50',
    icon: '✓',
    badge: 'Prix Normal'
  },
  deal: {
    bg: 'bg-blue-900/30',
    border: 'border-blue-600/50',
    icon: '💰',
    badge: 'Deal!'
  },
  aberrant: {
    bg: 'bg-red-900/30',
    border: 'border-red-600/50',
    icon: '⚠️',
    badge: 'Suspect'
  }
};

export default function PriceClusterCard({
  type,
  price,
  auctionCount,
  label,
  percentage
}: PriceClusterCardProps) {
  const style = typeStyles[type];

  return (
    <div className={`card ${style.bg} ${style.border}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        <span className="text-xs px-2 py-1 rounded bg-gray-800/50">{style.badge}</span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl">{style.icon}</span>
        <span className="text-3xl font-bold">{formatPrice(price)}</span>
      </div>

      <div className="text-sm text-gray-400">
        {auctionCount} enchères{percentage && ` (${percentage.toFixed(1)}%)`}
      </div>
    </div>
  );
}
```

## 4.3 PriceHistoryChart Component

### Créer `frontend/src/components/PriceHistoryChart.tsx`

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatPrice } from '../utils/formatters';

interface PriceHistoryData {
  scan_timestamp: string;
  normal_price: number;
  deal_price: number | null;
  sample_size: number;
}

interface PriceHistoryChartProps {
  history: PriceHistoryData[];
  itemName?: string;
}

export default function PriceHistoryChart({ history, itemName }: PriceHistoryChartProps) {
  const chartData = history.map(h => ({
    date: new Date(h.scan_timestamp).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
    normalPrice: h.normal_price / 10000, // Convert to gold
    dealPrice: h.deal_price ? h.deal_price / 10000 : null,
    sampleSize: h.sample_size
  })).reverse(); // Chronological order

  return (
    <div className="card">
      <h3 className="text-xl font-bold mb-4">
        Évolution des prix {itemName && `- ${itemName}`}
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" label={{ value: 'Prix (or)', angle: -90, position: 'insideLeft' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
            formatter={(value: number) => `${value.toFixed(2)}g`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="normalPrice"
            stroke="#10b981"
            strokeWidth={2}
            name="Prix Normal"
            dot={{ fill: '#10b981' }}
          />
          <Line
            type="monotone"
            dataKey="dealPrice"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Deal"
            dot={{ fill: '#3b82f6' }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-sm text-gray-400">
        {history.length} scans enregistrés
      </div>
    </div>
  );
}
```

## 4.4 ItemSearchAutocomplete Component

### Créer `frontend/src/components/ItemSearchAutocomplete.tsx`

```typescript
import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import ItemIcon from './ItemIcon';

interface SearchResult {
  item_id: number;
  name: string;
  quality: string;
  icon_url: string;
}

interface ItemSearchAutocompleteProps {
  onSelect: (itemId: number) => void;
  placeholder?: string;
}

export default function ItemSearchAutocomplete({
  onSelect,
  placeholder = "Rechercher un item..."
}: ItemSearchAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await apiClient.searchItems(query);
        setResults(data.items);
        setShowDropdown(true);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (itemId: number) => {
    setQuery('');
    setShowDropdown(false);
    onSelect(itemId);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder={placeholder}
        className="input-field w-full"
      />

      {isLoading && (
        <div className="absolute right-3 top-3">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      )}

      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.item_id}
              onClick={() => handleSelect(item.item_id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-700 transition-colors text-left"
            >
              <ItemIcon
                itemId={item.item_id}
                name={item.name}
                quality={item.quality}
                iconUrl={item.icon_url}
                size="sm"
                showTooltip={false}
              />
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-gray-400">ID: {item.item_id}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showDropdown && results.length === 0 && query.length >= 2 && !isLoading && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg p-4 text-gray-400 text-center">
          Aucun résultat trouvé
        </div>
      )}
    </div>
  );
}
```

---

# 📄 Phase 5: Frontend - Pages et API Client

## 5.1 Mise à jour de l'API Client

### Modifier `frontend/src/services/api.ts`

Ajouter les nouvelles méthodes :

```typescript
// Ajouter les nouvelles méthodes à la classe ApiClient

  async searchItems(query: string, limit: number = 10) {
    const response = await this.client.get(`/items/search`, {
      params: { q: query, limit }
    });
    return response.data.data;
  }

  async getItemWithPricing(itemId: number, realm?: string) {
    const response = await this.client.get(`/prices/${itemId}`, {
      params: { realm }
    });
    return response.data.data;
  }

  async getItemHistory(itemId: number, days: number = 30, realm?: string) {
    const response = await this.client.get(`/prices/${itemId}/history`, {
      params: { days, realm }
    });
    return response.data.data;
  }

  async getInventory(characterName: string, realm?: string) {
    const response = await this.client.get(`/inventory/${characterName}`, {
      params: { realm }
    });
    return response.data.data;
  }

  async getInventoryValue(characterName: string) {
    const response = await this.client.get(`/inventory/${characterName}/value`);
    return response.data.data;
  }
```

## 5.2 Page de recherche améliorée

### Modifier `frontend/src/pages/SearchPage.tsx`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ItemSearchAutocomplete from '../components/ItemSearchAutocomplete';

export default function SearchPage() {
  const navigate = useNavigate();
  const [itemId, setItemId] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (itemId) {
      navigate(`/item/${itemId}`);
    }
  };

  const handleAutocompleteSelect = (selectedItemId: number) => {
    navigate(`/item/${selectedItemId}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Rechercher un Item</h1>
        <p className="text-gray-400">
          Recherchez par nom ou entrez directement l'ID d'un item
        </p>
      </div>

      {/* Recherche par nom */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-3">Recherche par nom</h2>
        <ItemSearchAutocomplete
          onSelect={handleAutocompleteSelect}
          placeholder="Ex: Thunderfury, Flask, Essence..."
        />
      </div>

      {/* Recherche par ID */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-3">Recherche par ID</h2>
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="number"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            placeholder="Ex: 19019"
            className="input-field flex-1"
          />
          <button type="submit" className="btn-primary">
            Rechercher
          </button>
        </form>
        <p className="text-sm text-gray-500 mt-2">
          Trouvez l'ID sur <a href="https://www.wowhead.com/classic" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Wowhead Classic</a>
        </p>
      </div>

      {/* Popular items - keep existing */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Items populaires</h2>
        {/* ... existing popular items grid ... */}
      </div>
    </div>
  );
}
```

## 5.3 Page détail item complète

### Modifier `frontend/src/pages/ItemDetailPage.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../services/api';
import ItemIcon from '../components/ItemIcon';
import PriceClusterCard from '../components/PriceClusterCard';
import PriceHistoryChart from '../components/PriceHistoryChart';

export default function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [itemData, historyData] = await Promise.all([
          apiClient.getItemWithPricing(parseInt(itemId!)),
          apiClient.getItemHistory(parseInt(itemId!), 30)
        ]);

        setData(itemData);
        setHistory(historyData.history);
      } catch (error) {
        console.error('Failed to fetch item data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [itemId]);

  if (isLoading) {
    return <div className="text-center py-20">Chargement...</div>;
  }

  if (!data) {
    return <div className="text-center py-20">Item non trouvé</div>;
  }

  const { item, pricing, recentAuctions } = data;
  const clusterInfo = pricing.clusterInfo;

  return (
    <div className="space-y-6">
      {/* Item Header */}
      <div className="card flex items-center gap-4">
        <ItemIcon
          itemId={item.item_id}
          name={item.name}
          quality={item.quality}
          iconUrl={item.icon_url}
          size="lg"
        />
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{item.name || `Item #${item.item_id}`}</h1>
          <div className="text-gray-400">{item.item_class}</div>
        </div>
        <a
          href={`https://www.wowhead.com/classic/item=${item.item_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
        >
          Voir sur Wowhead →
        </a>
      </div>

      {/* Price Clusters */}
      <div className="grid md:grid-cols-2 gap-4">
        <PriceClusterCard
          type="normal"
          price={pricing.normalPrice}
          auctionCount={clusterInfo.clusters[0]?.auctionCount || 0}
          label="Prix Normal du Marché"
          percentage={clusterInfo.clusters[0]?.confidence * 100}
        />

        {pricing.dealPrice && (
          <PriceClusterCard
            type="deal"
            price={pricing.dealPrice}
            auctionCount={clusterInfo.clusters.find((c: any) => c.type === 'deal')?.auctionCount || 0}
            label="Meilleur Deal Disponible"
          />
        )}
      </div>

      {/* Aberrations Warning */}
      {clusterInfo.aberrants && clusterInfo.aberrants.length > 0 && (
        <div className="card bg-red-900/20 border-red-600/50">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold mb-1">Prix suspects détectés</h3>
              <p className="text-sm text-gray-400">
                {clusterInfo.aberrants.length} enchères avec des prix aberrants (probablement des erreurs ou manipulations)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Price History Chart */}
      {history.length > 0 && (
        <PriceHistoryChart history={history} itemName={item.name} />
      )}

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Médiane</div>
          <div className="text-2xl font-bold">{formatPrice(pricing.medianPrice)}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Moyenne</div>
          <div className="text-2xl font-bold">{formatPrice(pricing.meanPrice)}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Min</div>
          <div className="text-2xl font-bold text-green-400">{formatPrice(pricing.minPrice)}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Max</div>
          <div className="text-2xl font-bold text-red-400">{formatPrice(pricing.maxPrice)}</div>
        </div>
      </div>

      {/* Recent Auctions */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4">Enchères récentes ({recentAuctions.length})</h3>
        <div className="space-y-2">
          {recentAuctions.map((auction: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center p-3 bg-gray-800/50 rounded">
              <div>
                <span className="font-mono">{formatPrice(auction.unit_price)}</span>
                <span className="text-gray-400 text-sm ml-2">x{auction.quantity}</span>
              </div>
              <div className="text-sm text-gray-400">
                {new Date(auction.created_at).toLocaleString('fr-FR')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cluster Details */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4">Détails du clustering</h3>
        <div className="space-y-3">
          {clusterInfo.clusters.map((cluster: any, idx: number) => (
            <div key={idx} className="p-3 bg-gray-800/50 rounded">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-semibold">Cluster {idx + 1}</span>
                  <span className="ml-2 text-sm text-gray-400">({cluster.type})</span>
                </div>
                <span className="font-mono">{formatPrice(cluster.centerPrice)}</span>
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {cluster.auctionCount} enchères ({(cluster.confidence * 100).toFixed(1)}% du marché)
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## 5.4 Nouvelle page Inventaire

### Créer `frontend/src/pages/InventoryPage.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import ItemIcon from '../components/ItemIcon';
import { formatPrice } from '../utils/formatters';

export default function InventoryPage() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'value' | 'name' | 'quantity'>('value');

  const CHARACTER_NAME = 'Babss'; // TODO: Get from settings

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setIsLoading(true);
        const [inventoryData, valueData] = await Promise.all([
          apiClient.getInventory(CHARACTER_NAME),
          apiClient.getInventoryValue(CHARACTER_NAME)
        ]);

        setInventory(inventoryData.items);
        setTotalValue(valueData.totalValue);
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInventory();
  }, []);

  const sortedInventory = [...inventory].sort((a, b) => {
    switch (sortBy) {
      case 'value':
        return (b.market_value * b.quantity) - (a.market_value * a.quantity);
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      case 'quantity':
        return b.quantity - a.quantity;
      default:
        return 0;
    }
  });

  if (isLoading) {
    return <div className="text-center py-20">Chargement de l'inventaire...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card bg-gradient-to-br from-purple-900/30 to-blue-900/30">
        <h1 className="text-3xl font-bold mb-4">Inventaire de {CHARACTER_NAME}</h1>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <div className="text-gray-400 text-sm">Valeur totale</div>
            <div className="text-3xl font-bold text-yellow-400">{formatPrice(totalValue)}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Items</div>
            <div className="text-3xl font-bold">{inventory.length}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Dernière mise à jour</div>
            <div className="text-sm font-mono">
              {inventory[0]?.last_seen ? new Date(inventory[0].last_seen).toLocaleString('fr-FR') : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex gap-3">
        <span className="text-gray-400">Trier par:</span>
        <button
          onClick={() => setSortBy('value')}
          className={`px-3 py-1 rounded ${sortBy === 'value' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          Valeur
        </button>
        <button
          onClick={() => setSortBy('name')}
          className={`px-3 py-1 rounded ${sortBy === 'name' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          Nom
        </button>
        <button
          onClick={() => setSortBy('quantity')}
          className={`px-3 py-1 rounded ${sortBy === 'quantity' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          Quantité
        </button>
      </div>

      {/* Inventory Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedInventory.map((item) => (
          <button
            key={item.item_id}
            onClick={() => navigate(`/item/${item.item_id}`)}
            className="card hover:border-blue-600/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <ItemIcon
                itemId={item.item_id}
                name={item.name}
                quality={item.quality}
                iconUrl={item.icon_url}
                size="md"
              />
              <div className="flex-1">
                <div className="font-semibold">{item.name || `Item #${item.item_id}`}</div>
                <div className="text-sm text-gray-400">x{item.quantity}</div>
              </div>
            </div>

            {item.market_value && (
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Prix unitaire:</span>
                  <span className="font-mono">{formatPrice(item.market_value)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-400">Total:</span>
                  <span className="font-mono text-yellow-400">
                    {formatPrice(item.market_value * item.quantity)}
                  </span>
                </div>
              </div>
            )}

            {!item.market_value && (
              <div className="text-sm text-gray-500 italic">Prix non disponible</div>
            )}
          </button>
        ))}
      </div>

      {inventory.length === 0 && (
        <div className="card text-center text-gray-400 py-12">
          Aucun item dans l'inventaire
        </div>
      )}
    </div>
  );
}
```

## 5.6 Mise à jour du routing

### Modifier `frontend/src/App.tsx`

```typescript
import InventoryPage from './pages/InventoryPage';

// Dans le Routes
<Route path="/inventory" element={<InventoryPage />} />
```

### Modifier `frontend/src/components/Layout.tsx`

Ajouter le lien Inventaire dans la navigation :

```typescript
<Link to="/inventory" className="nav-link">
  📦 Inventaire
</Link>
```

---

# 🔧 Phase 6: Configuration et Migration

## 6.1 Variables d'environnement

### Mettre à jour `backend/.env`

```env
# Ajout
CHARACTER_NAME=Babss
```

## 6.2 Installer dépendances

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
cd frontend
npm install recharts
```

## 6.3 Exécuter les migrations

```bash
# Appliquer la migration SQL
docker-compose exec -T postgres psql -U postgres -d wow_price_checker < backend/sql/migrations/001_price_history.sql

# Peupler le cache d'items (longue opération, peut prendre 1-2h)
docker-compose exec backend npm run populate-items
```

## 6.4 Réingestion des données

```bash
# Relancer l'ingestion pour créer le premier scan_session
curl -X POST http://localhost:3000/api/v1/ingest
```

---

# 📝 Résumé et ordre d'exécution

## Ordre recommandé :

1. **Backend - SQL** : Créer migration `001_price_history.sql`
2. **Backend - Service** : Créer `priceClusteringService.ts`
3. **Backend - Routes** : Modifier `ingest.ts`, créer `inventory.ts`, modifier `prices.ts`, modifier `items.ts`
4. **Backend - Script** : Créer `populateItemCache.ts`
5. **Backend - Config** : Enregistrer routes dans `index.ts`
6. **Exécuter migrations** : Appliquer SQL et peupler cache
7. **Frontend - Composants** : Créer les 4 composants (ItemIcon, etc.)
8. **Frontend - API** : Modifier `api.ts`
9. **Frontend - Pages** : Modifier SearchPage, ItemDetailPage, créer InventoryPage
10. **Frontend - Routing** : Modifier App.tsx et Layout.tsx
11. **Test complet** : Réingestion + navigation frontend

## Fichiers créés/modifiés :

### Backend (12 fichiers)
- ✅ **Créés** :
  - `sql/migrations/001_price_history.sql`
  - `src/services/priceClusteringService.ts`
  - `src/api/routes/inventory.ts`
  - `src/scripts/populateItemCache.ts`

- ✅ **Modifiés** :
  - `src/api/routes/ingest.ts`
  - `src/api/routes/prices.ts`
  - `src/api/routes/items.ts`
  - `src/index.ts`
  - `.env`

### Frontend (11 fichiers)
- ✅ **Créés** :
  - `src/components/ItemIcon.tsx`
  - `src/components/PriceClusterCard.tsx`
  - `src/components/PriceHistoryChart.tsx`
  - `src/components/ItemSearchAutocomplete.tsx`
  - `src/pages/InventoryPage.tsx`

- ✅ **Modifiés** :
  - `src/services/api.ts`
  - `src/pages/SearchPage.tsx`
  - `src/pages/ItemDetailPage.tsx`
  - `src/App.tsx`
  - `src/components/Layout.tsx`
  - `package.json` (recharts)

---

# 🎯 Fonctionnalités livrées

✅ Recherche d'items par nom avec autocomplete
✅ Affichage des icônes et qualités d'items
✅ Page détail avec lien Wowhead
✅ Algorithme de clustering intelligent (prix normal vs deals vs aberrants)
✅ Historique des prix avec graphique d'évolution
✅ Page inventaire avec valeur totale
✅ Stockage optimisé des scans (snapshots)
✅ Migration complète vers base de données locale
✅ Plus d'appels aux API Blizzard côté frontend

---

# 🚀 Prochaines étapes possibles (non incluses)

- [ ] Alertes de prix (notifier quand un item passe sous un seuil)
- [ ] Comparaison multi-realms
- [ ] Export CSV/Excel de l'inventaire
- [ ] Statistiques avancées (volume d'échanges, tendances)
- [ ] Mode sombre/clair
- [ ] Support multi-personnages
- [ ] API publique pour partager les données
