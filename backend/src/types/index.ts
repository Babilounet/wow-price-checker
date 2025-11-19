// Blizzard API Types

export interface BlizzardOAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  sub?: string;
  expires_at?: number;
}

export interface BlizzardAuction {
  id: number;
  item: {
    id: number;
    context?: number;
    bonus_lists?: number[];
    modifiers?: Array<{
      type: number;
      value: number;
    }>;
  };
  buyout?: number;
  quantity: number;
  time_left: 'SHORT' | 'MEDIUM' | 'LONG' | 'VERY_LONG';
}

export interface BlizzardAuctionHouseResponse {
  _links: {
    self: {
      href: string;
    };
  };
  connected_realm: {
    href: string;
  };
  auctions: BlizzardAuction[];
}

export interface BlizzardItem {
  id: number;
  name: string;
  quality: {
    type: string;
    name: string;
  };
  level: number;
  required_level: number;
  media: {
    id: number;
  };
  item_class: {
    id: number;
    name: string;
  };
  item_subclass: {
    id: number;
    name: string;
  };
  inventory_type: {
    type: string;
    name: string;
  };
  purchase_price: number;
  sell_price: number;
  max_count: number;
  is_equippable: boolean;
  is_stackable: boolean;
}

// Application Types

export interface PriceStatistics {
  itemId: number;
  itemName?: string;
  realmId: number;
  timestamp: Date;

  // Raw data
  totalAuctions: number;
  totalQuantity: number;

  // Filtered statistics (outliers removed)
  median: number;
  mean: number;
  min: number;
  max: number;

  // Market info
  marketValue: number; // Recommended price for selling
  minBuyout: number; // Cheapest available

  // Distribution
  q1: number;
  q3: number;
  iqr: number;

  // Outliers info
  outliersRemoved: number;
  outlierPercentage: number;
}

export interface InventoryItem {
  itemId: number;
  quantity: number;
  bagSlot?: number;
  bagIndex?: number;
}

export interface PlayerInventory {
  characterName: string;
  realmId: number;
  timestamp: Date;
  items: InventoryItem[];
}

export interface PriceAlert {
  id: string;
  userId: string;
  itemId: number;
  targetPrice: number;
  condition: 'below' | 'above';
  isActive: boolean;
  createdAt: Date;
}

// Database Models

export interface AuctionSnapshot {
  id: number;
  realm_id: number;
  item_id: number;
  buyout: number;
  quantity: number;
  time_left: string;
  snapshot_timestamp: Date;
  created_at: Date;
}

export interface ItemCache {
  item_id: number;
  name: string;
  quality: string;
  item_class: string;
  item_subclass: string;
  icon_url?: string;
  last_updated: Date;
}

export interface PriceHistory {
  id: number;
  realm_id: number;
  item_id: number;
  median_price: number;
  mean_price: number;
  min_price: number;
  max_price: number;
  total_auctions: number;
  timestamp: Date;
}

// API Response Types

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// WebSocket Message Types

export type WebSocketMessageType =
  | 'inventory_update'
  | 'price_update'
  | 'price_alert'
  | 'error';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: unknown;
  timestamp: string;
}

// Utility Types

export type Region = 'us' | 'eu' | 'kr' | 'tw' | 'cn';

export interface ConnectedRealm {
  id: number;
  name: string;
  slug: string;
  region: Region;
}
