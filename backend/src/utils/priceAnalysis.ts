import { BlizzardAuction, PriceStatistics } from '../types';

/**
 * Calculate quartiles (Q1, Q3) and Interquartile Range (IQR)
 */
function calculateQuartiles(sortedPrices: number[]): {
  q1: number;
  q3: number;
  iqr: number;
} {
  const n = sortedPrices.length;

  if (n === 0) {
    return { q1: 0, q3: 0, iqr: 0 };
  }

  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);

  const q1 = sortedPrices[q1Index];
  const q3 = sortedPrices[q3Index];
  const iqr = q3 - q1;

  return { q1, q3, iqr };
}

/**
 * Filter outliers using IQR method
 * Outliers are values < Q1 - 1.5*IQR or > Q3 + 1.5*IQR
 */
function filterOutliers(
  prices: number[],
  q1: number,
  q3: number,
  iqr: number
): {
  filtered: number[];
  outliersRemoved: number;
} {
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const filtered = prices.filter((price) => price >= lowerBound && price <= upperBound);

  return {
    filtered,
    outliersRemoved: prices.length - filtered.length,
  };
}

/**
 * Calculate median from sorted array
 */
function calculateMedian(sortedPrices: number[]): number {
  const n = sortedPrices.length;
  if (n === 0) return 0;

  const mid = Math.floor(n / 2);
  if (n % 2 === 0) {
    return (sortedPrices[mid - 1] + sortedPrices[mid]) / 2;
  }
  return sortedPrices[mid];
}

/**
 * Calculate mean (average)
 */
function calculateMean(prices: number[]): number {
  if (prices.length === 0) return 0;
  return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

/**
 * Analyze auction prices and return statistics with outliers removed
 */
export function analyzePrices(
  auctions: BlizzardAuction[],
  itemId: number,
  realmId: number
): PriceStatistics | null {
  // Filter auctions for specific item and get prices per unit
  const itemAuctions = auctions.filter((auction) => auction.item.id === itemId);

  if (itemAuctions.length === 0) {
    return null;
  }

  // Calculate price per unit (buyout / quantity)
  const prices = itemAuctions
    .filter((auction) => auction.buyout && auction.buyout > 0)
    .map((auction) => auction.buyout! / auction.quantity)
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return null;
  }

  const totalQuantity = itemAuctions.reduce((sum, auction) => sum + auction.quantity, 0);

  // Calculate quartiles and IQR
  const { q1, q3, iqr } = calculateQuartiles(prices);

  // Filter outliers
  const { filtered: filteredPrices, outliersRemoved } = filterOutliers(prices, q1, q3, iqr);

  // If all prices are outliers (shouldn't happen with IQR), use original data
  const finalPrices = filteredPrices.length > 0 ? filteredPrices : prices;

  // Calculate statistics on filtered data
  const median = calculateMedian(finalPrices);
  const mean = calculateMean(finalPrices);
  const min = Math.min(...finalPrices);
  const max = Math.max(...finalPrices);

  // Market value: weighted average of median (70%) and mean (30%)
  const marketValue = Math.round(median * 0.7 + mean * 0.3);

  // Minimum buyout from all auctions (not filtered)
  const minBuyout = Math.min(...prices);

  return {
    itemId,
    realmId,
    timestamp: new Date(),
    totalAuctions: itemAuctions.length,
    totalQuantity,
    median: Math.round(median),
    mean: Math.round(mean),
    min: Math.round(min),
    max: Math.round(max),
    marketValue,
    minBuyout: Math.round(minBuyout),
    q1: Math.round(q1),
    q3: Math.round(q3),
    iqr: Math.round(iqr),
    outliersRemoved,
    outlierPercentage: Math.round((outliersRemoved / prices.length) * 100),
  };
}

/**
 * Analyze multiple items at once
 */
export function analyzeBulkPrices(
  auctions: BlizzardAuction[],
  itemIds: number[],
  realmId: number
): Map<number, PriceStatistics> {
  const results = new Map<number, PriceStatistics>();

  for (const itemId of itemIds) {
    const stats = analyzePrices(auctions, itemId, realmId);
    if (stats) {
      results.set(itemId, stats);
    }
  }

  return results;
}

/**
 * Format price in gold/silver/copper
 */
export function formatPrice(copper: number): string {
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const copperRemainder = copper % 100;

  const parts: string[] = [];
  if (gold > 0) parts.push(`${gold}g`);
  if (silver > 0) parts.push(`${silver}s`);
  if (copperRemainder > 0 || parts.length === 0) parts.push(`${copperRemainder}c`);

  return parts.join(' ');
}
