-- SmartBI Share Tokens table
-- Stores share link tokens for public access to SmartBI analysis reports.

CREATE TABLE IF NOT EXISTS smart_bi_share_tokens (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    upload_id BIGINT NOT NULL,
    factory_id VARCHAR(50) NOT NULL,
    title VARCHAR(200),
    sheet_index INTEGER,
    file_name VARCHAR(200),
    sheet_name VARCHAR(200),
    ttl_days INTEGER,
    expires_at TIMESTAMP,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_share_token ON smart_bi_share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_share_factory_upload ON smart_bi_share_tokens(factory_id, upload_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_share_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_share_tokens_updated_at ON smart_bi_share_tokens;
CREATE TRIGGER trigger_share_tokens_updated_at
BEFORE UPDATE ON smart_bi_share_tokens
FOR EACH ROW EXECUTE FUNCTION update_share_tokens_updated_at();
