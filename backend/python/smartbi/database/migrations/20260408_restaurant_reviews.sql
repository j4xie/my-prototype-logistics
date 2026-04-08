-- ═══════════════════════════════════════════════════════════════
-- W6: Restaurant Review Collection System
-- restaurant_review_sources: customer's registered stores for review collection
-- restaurant_reviews: collected reviews (from upload or scrape)
-- ═══════════════════════════════════════════════════════════════

-- restaurant_review_sources: customer's registered stores for review collection
CREATE TABLE IF NOT EXISTS restaurant_review_sources (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(64) NOT NULL,
    store_name VARCHAR(255) NOT NULL,
    city VARCHAR(64) NOT NULL DEFAULT '上海',
    platform VARCHAR(32) NOT NULL DEFAULT 'dianping',
    shop_id VARCHAR(128) NULL,
    scrape_schedule VARCHAR(32) DEFAULT 'weekly',
    last_scrape_at TIMESTAMP NULL,
    last_scrape_status VARCHAR(32) NULL,
    total_reviews_collected INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uk_review_source UNIQUE (factory_id, store_name, platform)
);

-- restaurant_reviews: collected reviews (from upload or scrape)
CREATE TABLE IF NOT EXISTS restaurant_reviews (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(64) NOT NULL,
    source_id BIGINT NULL REFERENCES restaurant_review_sources(id),
    store_name VARCHAR(255) NOT NULL,
    review_id VARCHAR(64) NULL,
    platform VARCHAR(32) DEFAULT 'dianping',
    rating NUMERIC(3,1) NOT NULL,
    content TEXT NOT NULL,
    taste_score NUMERIC(3,1) NULL,
    env_score NUMERIC(3,1) NULL,
    service_score NUMERIC(3,1) NULL,
    reviewer VARCHAR(128) NULL,
    review_time TIMESTAMP NULL,
    collection_source VARCHAR(32) NOT NULL,
    collected_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uk_review UNIQUE (factory_id, store_name, review_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_factory ON restaurant_reviews(factory_id);
CREATE INDEX IF NOT EXISTS idx_reviews_store ON restaurant_reviews(factory_id, store_name);
CREATE INDEX IF NOT EXISTS idx_reviews_time ON restaurant_reviews(review_time);
CREATE INDEX IF NOT EXISTS idx_review_sources_factory ON restaurant_review_sources(factory_id);
