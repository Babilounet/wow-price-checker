/**
 * Format price in gold/silver/copper
 */
export function formatPrice(copper: number): string {
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const copperRemainder = copper % 100;

  const parts: string[] = [];
  if (gold > 0) parts.push(`${gold.toLocaleString()}g`);
  if (silver > 0) parts.push(`${silver}s`);
  if (copperRemainder > 0 || parts.length === 0) parts.push(`${copperRemainder}c`);

  return parts.join(' ');
}

/**
 * Format number with separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Calculate percentage difference
 */
export function calculateDifference(price: number, marketValue: number): number {
  if (marketValue === 0) return 0;
  return ((price - marketValue) / marketValue) * 100;
}
