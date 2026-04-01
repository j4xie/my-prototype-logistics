-- ============================================================
-- Phase 5: 研发需求 + 样品档案 + 报价任务
-- ============================================================

CREATE TABLE IF NOT EXISTS rd_requests (
    id VARCHAR(191) PRIMARY KEY,
    factory_id VARCHAR(191) NOT NULL,
    request_number VARCHAR(50) NOT NULL,
    customer_name VARCHAR(200),
    customer_contact VARCHAR(200),
    requirements TEXT,
    urgency VARCHAR(20),
    assigned_to BIGINT,
    status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
    submitted_by BIGINT,
    submitted_at TIMESTAMP,
    completed_at TIMESTAMP,
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rdr_factory ON rd_requests(factory_id);
CREATE INDEX IF NOT EXISTS idx_rdr_status ON rd_requests(status);

CREATE TABLE IF NOT EXISTS product_samples (
    id VARCHAR(191) PRIMARY KEY,
    factory_id VARCHAR(191) NOT NULL,
    sample_code VARCHAR(50) NOT NULL,
    rd_request_id VARCHAR(191),
    name VARCHAR(200) NOT NULL,
    specification VARCHAR(200),
    grade VARCHAR(50),
    main_material VARCHAR(200),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    progress_notes TEXT,
    photo_urls TEXT,
    assigned_to BIGINT,
    submitted_by BIGINT,
    approved_by BIGINT,
    approved_at TIMESTAMP,
    approval_notes TEXT,
    product_type_id VARCHAR(191),
    bom_product_type_id VARCHAR(191),
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ps_factory ON product_samples(factory_id);
CREATE INDEX IF NOT EXISTS idx_ps_request ON product_samples(rd_request_id);
CREATE INDEX IF NOT EXISTS idx_ps_status ON product_samples(status);

CREATE TABLE IF NOT EXISTS quotation_tasks (
    id VARCHAR(191) PRIMARY KEY,
    factory_id VARCHAR(191) NOT NULL,
    task_number VARCHAR(50) NOT NULL,
    sample_id VARCHAR(191),
    product_type_id VARCHAR(191),
    assigned_to BIGINT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    material_cost DECIMAL(15,2),
    labor_cost DECIMAL(15,2),
    overhead_cost DECIMAL(15,2),
    total_cost DECIMAL(15,2),
    suggested_price DECIMAL(15,2),
    final_price DECIMAL(15,2),
    profit_margin DECIMAL(5,2),
    quoted_by BIGINT,
    quoted_at TIMESTAMP,
    confirmed_by BIGINT,
    confirmed_at TIMESTAMP,
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_qt_factory ON quotation_tasks(factory_id);
CREATE INDEX IF NOT EXISTS idx_qt_sample ON quotation_tasks(sample_id);
CREATE INDEX IF NOT EXISTS idx_qt_status ON quotation_tasks(status);
