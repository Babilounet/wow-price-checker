-- WoW Price Checker Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Auction snapshots table
CREATE TABLE IF NOT EXISTS auction_snapshots (
    id BIGSERIAL PRIMARY KEY,
    realm_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    buyout BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    time_left VARCHAR(20) NOT NULL,
    snapshot_timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_realm_item (realm_id, item_id),
    INDEX idx_snapshot_timestamp (snapshot_timestamp),
    INDEX idx_created_at (created_at)
);

-- Item cache table
CREATE TABLE IF NOT EXISTS item_cache (
    item_id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    quality VARCHAR(50),
    item_class VARCHAR(100),
    item_subclass VARCHAR(100),
    icon_url TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Price history table (aggregated statistics)
CREATE TABLE IF NOT EXISTS price_history (
    id BIGSERIAL PRIMARY KEY,
    realm_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    median_price BIGINT NOT NULL,
    mean_price BIGINT NOT NULL,
    min_price BIGINT NOT NULL,
    max_price BIGINT NOT NULL,
    total_auctions INTEGER NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_realm_item_timestamp (realm_id, item_id, timestamp),
    UNIQUE (realm_id, item_id, timestamp)
);

-- User alerts table (future feature)
CREATE TABLE IF NOT EXISTS price_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(100),
    item_id INTEGER NOT NULL,
    target_price BIGINT NOT NULL,
    condition VARCHAR(10) CHECK (condition IN ('below', 'above')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    triggered_at TIMESTAMP,

    INDEX idx_user_id (user_id),
    INDEX idx_item_id (item_id),
    INDEX idx_is_active (is_active)
);

-- Player inventory table
CREATE TABLE IF NOT EXISTS player_inventory (
    id BIGSERIAL PRIMARY KEY,
    character_name VARCHAR(50) NOT NULL,
    realm_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_character_realm (character_name, realm_id),
    INDEX idx_last_seen (last_seen),
    UNIQUE (character_name, realm_id, item_id)
);

-- Create views for common queries

-- Latest price statistics per item per realm
CREATE OR REPLACE VIEW latest_prices AS
SELECT DISTINCT ON (realm_id, item_id)
    realm_id,
    item_id,
    median_price,
    mean_price,
    min_price,
    max_price,
    total_auctions,
    timestamp
FROM price_history
ORDER BY realm_id, item_id, timestamp DESC;

-- Item popularity (most traded items)
CREATE OR REPLACE VIEW item_popularity AS
SELECT
    item_id,
    COUNT(*) as total_auctions,
    SUM(quantity) as total_quantity,
    COUNT(DISTINCT realm_id) as realm_count
FROM auction_snapshots
WHERE snapshot_timestamp > NOW() - INTERVAL '7 days'
GROUP BY item_id
ORDER BY total_auctions DESC;

COMMENT ON TABLE auction_snapshots IS 'Raw auction house snapshot data from Blizzard API';
COMMENT ON TABLE item_cache IS 'Cached item metadata from Blizzard API';
COMMENT ON TABLE price_history IS 'Aggregated price statistics over time';
COMMENT ON TABLE price_alerts IS 'User-configured price alerts';
COMMENT ON TABLE player_inventory IS 'Player inventory snapshots from addon';
