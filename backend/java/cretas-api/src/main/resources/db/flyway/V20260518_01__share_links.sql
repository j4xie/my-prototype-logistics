-- PR #872 follow-up to #860 — 转发 / 分享链接 (Forward Share Link) feature.
--
-- Steve 2026-05-18 decision: NO email service. Generate shareable URL, copy
-- to clipboard. Admin chooses per-share whether prices are included; default ON.
-- Expiry options: 7 / 30 (default) / 90 days, or permanent (NULL).
--
-- Public read-only page (/share/{token}) renders entity payload server-side
-- filtered (price fields stripped when include_price=FALSE).
--
-- Standalone entity (NOT extending BaseEntity) — revoked_at differs from
-- soft-delete pattern and shares are immutable after creation (no updated_at
-- needed; PK is the token itself).

CREATE TABLE share_links (
    token VARCHAR(64) PRIMARY KEY,
    factory_id VARCHAR(64) NOT NULL,
    entity_type VARCHAR(32) NOT NULL,            -- 'PurchaseOrder' | 'SalesOrder'
    entity_id VARCHAR(191) NOT NULL,
    include_price BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP,                         -- NULL = permanent
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP,                         -- soft revoke (admin invalidates link)
    view_count INT NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMP
);

CREATE INDEX idx_share_links_factory ON share_links(factory_id);
CREATE INDEX idx_share_links_entity ON share_links(entity_type, entity_id);
CREATE INDEX idx_share_links_expires ON share_links(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE share_links IS 'Forward / share-link tokens for read-only public viewing of PO/SO (#872 follow-up to #860).';
COMMENT ON COLUMN share_links.token IS 'Secure-random base62 (~32 chars), URL-safe, primary key (no separate id).';
COMMENT ON COLUMN share_links.include_price IS 'Whether the public viewer sees price fields (unitPrice, totalAmount, ...).';
COMMENT ON COLUMN share_links.expires_at IS 'Expiry timestamp; NULL = permanent. Indexed only when non-null.';
COMMENT ON COLUMN share_links.revoked_at IS 'Manual revocation by admin (vs natural expiry via expires_at).';
