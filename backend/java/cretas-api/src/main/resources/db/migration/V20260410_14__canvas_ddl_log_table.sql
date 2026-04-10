CREATE TABLE IF NOT EXISTS canvas_ddl_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_id      VARCHAR(50),
    config_version  INT,
    ddl_statement   TEXT NOT NULL,
    target_table    VARCHAR(100),
    status          VARCHAR(20) DEFAULT 'PENDING',
    executed_at     TIMESTAMP,
    error_message   TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cdl_factory_version ON canvas_ddl_log(factory_id, config_version);
