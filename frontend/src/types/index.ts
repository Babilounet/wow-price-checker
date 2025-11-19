// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
  timestamp: string;
  cached?: boolean;
}

// Blizzard Types
export interface BlizzardItem {
  id: number;
  name: string;
  quality: {
    type: string;
    name: string;
  };
  level: number;
  required_level: number;
  item_class: {
    id: number;
    name: string;
  };
  item_subclass: {
    id: number;
    name: string;
  };
  purchase_price: number;
  sell_price: number;
  is_stackable: boolean;
}

export interface PriceStatistics {
  itemId: number;
  itemName?: string;
  realmId: number;
  timestamp: string;
  totalAuctions: number;
  totalQuantity: number;
  median: number;
  mean: number;
  min: number;
  max: number;
  marketValue: number;
  minBuyout: number;
  q1: number;
  q3: number;
  iqr: number;
  outliersRemoved: number;
  outlierPercentage: number;
}

export interface InventoryItem {
  itemId: number;
  quantity: number;
  bagSlot?: number;
  bagIndex?: number;
  name?: string;
  icon?: string;
  quality?: string;
  priceStats?: PriceStatistics;
}

export interface PlayerInventory {
  characterName: string;
  realmId: number;
  timestamp: string;
  items: InventoryItem[];
}

// UI State Types
export interface AppSettings {
  defaultRealm: number;
  autoRefresh: boolean;
  refreshInterval: number; // seconds
  theme: 'light' | 'dark';
}

export type QualityColor = {
  [key: string]: string;
};

export const QUALITY_COLORS: QualityColor = {
  POOR: '#9d9d9d',
  COMMON: '#ffffff',
  UNCOMMON: '#1eff00',
  RARE: '#0070dd',
  EPIC: '#a335ee',
  LEGENDARY: '#ff8000',
  ARTIFACT: '#e6cc80',
  HEIRLOOM: '#00ccff',
};
