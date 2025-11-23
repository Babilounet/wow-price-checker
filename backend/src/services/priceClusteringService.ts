import { logger } from '../utils/logger';

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

/**
 * Service de clustering des prix pour détecter automatiquement:
 * - Les prix "normaux" (cluster dominant)
 * - Les "deals" (cluster significatif mais plus bas)
 * - Les prix aberrants (outliers isolés)
 */
export class PriceClusteringService {
  /**
   * Algorithme DBSCAN adapté pour le clustering de prix
   * @param prices Liste des prix à analyser
   * @param epsilon Distance maximale entre deux points du même cluster (en % du prix)
   * @param minPoints Nombre minimum de points pour former un cluster
   */
  private dbscan(
    prices: number[],
    epsilon: number = 0.15, // 15% de variation
    minPoints: number = 3
  ): number[][] {
    if (prices.length === 0) return [];

    const sorted = [...prices].sort((a, b) => a - b);
    const clusters: number[][] = [];
    const visited = new Set<number>();
    const noise = new Set<number>();

    for (let i = 0; i < sorted.length; i++) {
      if (visited.has(i)) continue;

      const neighbors = this.getNeighbors(sorted, i, epsilon);

      if (neighbors.length < minPoints) {
        noise.add(i);
        continue;
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
          queue.push(...newNeighbors.filter(n => !visited.has(n)));
        }
      }

      if (cluster.length > 0) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Trouve les voisins d'un point dans un rayon epsilon (en %)
   */
  private getNeighbors(prices: number[], index: number, epsilon: number): number[] {
    const price = prices[index];
    const neighbors: number[] = [];

    for (let i = 0; i < prices.length; i++) {
      const diff = Math.abs(prices[i] - price) / Math.max(price, 1);
      if (diff <= epsilon) {
        neighbors.push(i);
      }
    }

    return neighbors;
  }

  /**
   * Calcule la médiane d'un tableau
   */
  private median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Analyse les prix et détecte les clusters
   * Retourne le prix normal, les deals potentiels, et les aberrations
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

    // Cas simple : très peu d'enchères
    if (prices.length < 3) {
      const medianPrice = this.median(prices);
      return {
        normalPrice: Math.floor(medianPrice),
        dealPrice: null,
        clusters: [{
          centerPrice: medianPrice,
          minPrice: Math.min(...prices),
          maxPrice: Math.max(...prices),
          auctionCount: prices.length,
          type: 'normal',
          confidence: 1.0
        }],
        aberrants: [],
        metadata: { totalAuctions: prices.length, clustersFound: 1, aberrantsCount: 0 }
      };
    }

    // Détecter les clusters avec DBSCAN
    const clusterArrays = this.dbscan(prices);

    if (clusterArrays.length === 0) {
      // Aucun cluster détecté, tous les prix sont aberrants ou trop dispersés
      const medianPrice = this.median(prices);
      logger.warn('No clusters detected, using median as fallback', { priceCount: prices.length });

      return {
        normalPrice: Math.floor(medianPrice),
        dealPrice: null,
        clusters: [],
        aberrants: prices,
        metadata: { totalAuctions: prices.length, clustersFound: 0, aberrantsCount: prices.length }
      };
    }

    // Convertir en PriceCluster avec métadonnées
    const clusters: PriceCluster[] = clusterArrays.map((cluster) => {
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

    // Le plus gros cluster est le prix "normal"
    clusters[0].type = 'normal';

    // Identifier les deals et aberrations parmi les autres clusters
    const normalPrice = clusters[0].centerPrice;

    for (let i = 1; i < clusters.length; i++) {
      const ratio = clusters[i].centerPrice / normalPrice;

      if (ratio < 0.8) {
        // Cluster significativement plus bas = deal
        clusters[i].type = 'deal';
      } else if (ratio > 1.2) {
        // Cluster significativement plus haut = aberrant
        clusters[i].type = 'aberrant';
      }
      // Sinon, reste "normal" (variation proche du cluster principal)
    }

    // Trouver les prix aberrants (non clustérisés)
    const clusteredPrices = new Set(clusterArrays.flat());
    const aberrants = prices.filter(p => !clusteredPrices.has(p));

    // Déterminer le deal price (meilleur cluster type "deal")
    const dealClusters = clusters.filter(c => c.type === 'deal');
    const dealPrice = dealClusters.length > 0
      ? Math.min(...dealClusters.map(c => c.centerPrice))
      : null;

    logger.info('Price clustering complete', {
      totalAuctions: prices.length,
      clustersFound: clusters.length,
      normalPrice: Math.floor(normalPrice),
      dealPrice: dealPrice ? Math.floor(dealPrice) : null,
      aberrantsCount: aberrants.length
    });

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
}

export const priceClusteringService = new PriceClusteringService();
