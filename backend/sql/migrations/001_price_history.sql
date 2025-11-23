-- Migration 001: Price History and Clustering
-- Adds support for scan sessions tracking and optimized price snapshots

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
COMMENT ON COLUMN price_snapshots.normal_price IS 'Prix du cluster dominant (prix normal du marché)';
COMMENT ON COLUMN price_snapshots.deal_price IS 'Prix du cluster "deal" si détecté';
COMMENT ON COLUMN price_snapshots.cluster_info IS 'Détails JSON des clusters: {clusters: [], aberrants: [], metadata: {}}';
