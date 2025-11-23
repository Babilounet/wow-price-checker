-- WoW Price Checker Database Schema (SavedVariables version)

-- Realms table
CREATE TABLE IF NOT EXISTS realms (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    region VARCHAR(10) NOT NULL DEFAULT 'eu',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (slug, region)
);

CREATE INDEX IF NOT EXISTS idx_realms_slug ON realms(slug);
CREATE INDEX IF NOT EXISTS idx_realms_region ON realms(region);

-- Auctions table (individual auction listings)
CREATE TABLE IF NOT EXISTS auctions (
    id BIGSERIAL PRIMARY KEY,
    realm_id INTEGER NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL,
    unit_price BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    buyout BIGINT NOT NULL,
    time_left VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auctions_realm_item ON auctions(realm_id, item_id);
CREATE INDEX IF NOT EXISTS idx_auctions_item ON auctions(item_id);
CREATE INDEX IF NOT EXISTS idx_auctions_created_at ON auctions(created_at);

-- Item prices table (aggregated statistics)
CREATE TABLE IF NOT EXISTS item_prices (
    id BIGSERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL,
    realm_id INTEGER NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    min_price BIGINT NOT NULL,
    max_price BIGINT NOT NULL,
    median_price BIGINT NOT NULL,
    mean_price BIGINT NOT NULL,
    market_value BIGINT NOT NULL,
    sample_size INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (item_id, realm_id)
);

CREATE INDEX IF NOT EXISTS idx_item_prices_item ON item_prices(item_id);
CREATE INDEX IF NOT EXISTS idx_item_prices_realm ON item_prices(realm_id);
CREATE INDEX IF NOT EXISTS idx_item_prices_updated ON item_prices(last_updated);

-- Item cache table (from Blizzard API)
CREATE TABLE IF NOT EXISTS item_cache (
    item_id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    quality VARCHAR(50),
    item_class VARCHAR(100),
    item_subclass VARCHAR(100),
    icon_url TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player inventory table
CREATE TABLE IF NOT EXISTS player_inventory (
    id BIGSERIAL PRIMARY KEY,
    character_name VARCHAR(50) NOT NULL,
    realm_id INTEGER NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (character_name, realm_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_character ON player_inventory(character_name, realm_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item ON player_inventory(item_id);

COMMENT ON TABLE realms IS 'WoW server realms';
COMMENT ON TABLE auctions IS 'Individual auction listings from SavedVariables';
COMMENT ON TABLE item_prices IS 'Aggregated price statistics per item per realm';
COMMENT ON TABLE item_cache IS 'Cached item metadata from Blizzard API';
COMMENT ON TABLE player_inventory IS 'Player inventory snapshots from addon';
