-- SmartBI Tables for Dynamic BI + AI Analysis System
-- Version: 1.0
-- Date: 2026-01-18

-- ============================================
-- 1. Excel Upload Records Table
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_excel_uploads (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT 'Factory ID',
    file_name VARCHAR(255) NOT NULL COMMENT 'Original file name',
    file_url VARCHAR(500) COMMENT 'OSS storage URL',
    file_size BIGINT COMMENT 'File size in bytes',
    row_count INT COMMENT 'Number of data rows',
    column_count INT COMMENT 'Number of columns',
    sheet_name VARCHAR(100) COMMENT 'Sheet name',
    upload_status ENUM('PENDING', 'PARSING', 'MAPPED', 'COMPLETED', 'FAILED') DEFAULT 'PENDING' COMMENT 'Upload processing status',
    error_message TEXT COMMENT 'Error message if failed',
    field_mappings JSON COMMENT 'Resolved field mappings JSON',
    data_features JSON COMMENT 'Analyzed data features JSON',
    uploaded_by BIGINT COMMENT 'User ID who uploaded',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    INDEX idx_factory_id (factory_id),
    INDEX idx_upload_status (upload_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI Excel upload records';

-- ============================================
-- 2. Analysis Cache Table
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_analysis_cache (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT 'Factory ID',
    analysis_type VARCHAR(50) NOT NULL COMMENT 'Type: DASHBOARD, SALES, DEPARTMENT, REGION, FINANCE',
    cache_key VARCHAR(255) NOT NULL COMMENT 'Unique cache key (hash of params)',
    analysis_date DATE NOT NULL COMMENT 'Analysis date',
    chart_data JSON COMMENT 'Chart configuration and data JSON',
    kpi_data JSON COMMENT 'KPI metrics JSON',
    ai_insights TEXT COMMENT 'AI generated insights text',
    prompt_used TEXT COMMENT 'Prompt template used for AI',
    token_count INT DEFAULT 0 COMMENT 'LLM tokens consumed',
    expires_at DATETIME COMMENT 'Cache expiration time',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    UNIQUE KEY uk_cache_key (factory_id, cache_key),
    INDEX idx_factory_type (factory_id, analysis_type),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI analysis cache';

-- ============================================
-- 3. Usage Records Table (Billing)
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_usage_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT 'Factory ID',
    user_id BIGINT COMMENT 'User who triggered the action',
    action_type ENUM('UPLOAD', 'DASHBOARD', 'QUERY', 'DRILLDOWN', 'EXPORT') NOT NULL COMMENT 'Action type',
    analysis_type VARCHAR(50) COMMENT 'Analysis type if applicable',
    query_text TEXT COMMENT 'Natural language query if QUERY type',
    intent_detected VARCHAR(100) COMMENT 'Detected intent for query',
    token_count INT DEFAULT 0 COMMENT 'LLM tokens consumed',
    cost_amount DECIMAL(10, 4) DEFAULT 0 COMMENT 'Cost in CNY',
    cache_hit BOOLEAN DEFAULT FALSE COMMENT 'Whether cache was used',
    response_time_ms INT COMMENT 'Response time in milliseconds',
    success BOOLEAN DEFAULT TRUE COMMENT 'Whether action succeeded',
    error_message TEXT COMMENT 'Error message if failed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_factory_date (factory_id, created_at),
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI usage records for billing';

-- ============================================
-- 4. Natural Language Query History Table
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_query_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT 'Factory ID',
    user_id BIGINT COMMENT 'User who asked',
    session_id VARCHAR(100) COMMENT 'Conversation session ID',
    query_text TEXT NOT NULL COMMENT 'User natural language query',
    intent VARCHAR(100) COMMENT 'Detected intent',
    parameters JSON COMMENT 'Extracted parameters JSON',
    context JSON COMMENT 'Conversation context JSON',
    response_text TEXT COMMENT 'AI response text',
    chart_config JSON COMMENT 'Generated chart config if any',
    feedback_rating INT COMMENT 'User feedback: 1-5',
    feedback_text TEXT COMMENT 'User feedback text',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_factory_session (factory_id, session_id),
    INDEX idx_intent (intent),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI natural language query history';

-- ============================================
-- 5. Sales Data Table (Parsed from Excel)
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_sales_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT 'Factory ID',
    upload_id BIGINT COMMENT 'Reference to excel upload record',
    order_date DATE NOT NULL COMMENT 'Order date',
    salesperson_id VARCHAR(100) COMMENT 'Salesperson ID',
    salesperson_name VARCHAR(100) COMMENT 'Salesperson name',
    department VARCHAR(100) COMMENT 'Department name',
    region VARCHAR(100) COMMENT 'Sales region',
    province VARCHAR(100) COMMENT 'Province',
    city VARCHAR(100) COMMENT 'City',
    customer_name VARCHAR(200) COMMENT 'Customer name',
    customer_type VARCHAR(100) COMMENT 'Customer type',
    product_id VARCHAR(100) COMMENT 'Product ID',
    product_name VARCHAR(200) COMMENT 'Product name',
    product_category VARCHAR(100) COMMENT 'Product category',
    quantity DECIMAL(15, 4) DEFAULT 0 COMMENT 'Quantity sold',
    amount DECIMAL(15, 2) DEFAULT 0 COMMENT 'Sales amount',
    unit_price DECIMAL(15, 4) DEFAULT 0 COMMENT 'Unit price',
    cost DECIMAL(15, 2) DEFAULT 0 COMMENT 'Cost amount',
    profit DECIMAL(15, 2) DEFAULT 0 COMMENT 'Profit amount',
    gross_margin DECIMAL(10, 4) DEFAULT 0 COMMENT 'Gross margin rate',
    monthly_target DECIMAL(15, 2) DEFAULT 0 COMMENT 'Monthly sales target',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    INDEX idx_factory_date (factory_id, order_date),
    INDEX idx_salesperson (factory_id, salesperson_name),
    INDEX idx_department (factory_id, department),
    INDEX idx_region (factory_id, region),
    INDEX idx_product (factory_id, product_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI sales data parsed from Excel';

-- ============================================
-- 6. Financial Data Table (Parsed from Excel)
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_finance_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT 'Factory ID',
    upload_id BIGINT COMMENT 'Reference to excel upload record',
    record_date DATE NOT NULL COMMENT 'Record date',
    record_type ENUM('COST', 'AR', 'AP', 'BUDGET') NOT NULL COMMENT 'Record type',
    department VARCHAR(100) COMMENT 'Department name',
    category VARCHAR(100) COMMENT 'Cost/Budget category',
    customer_name VARCHAR(200) COMMENT 'Customer name (for AR)',
    supplier_name VARCHAR(200) COMMENT 'Supplier name (for AP)',
    material_cost DECIMAL(15, 2) DEFAULT 0 COMMENT 'Material cost',
    labor_cost DECIMAL(15, 2) DEFAULT 0 COMMENT 'Labor cost',
    overhead_cost DECIMAL(15, 2) DEFAULT 0 COMMENT 'Overhead cost',
    total_cost DECIMAL(15, 2) DEFAULT 0 COMMENT 'Total cost',
    receivable_amount DECIMAL(15, 2) DEFAULT 0 COMMENT 'AR amount',
    collection_amount DECIMAL(15, 2) DEFAULT 0 COMMENT 'Collection amount',
    aging_days INT DEFAULT 0 COMMENT 'Aging days',
    payable_amount DECIMAL(15, 2) DEFAULT 0 COMMENT 'AP amount',
    payment_amount DECIMAL(15, 2) DEFAULT 0 COMMENT 'Payment amount',
    budget_amount DECIMAL(15, 2) DEFAULT 0 COMMENT 'Budget amount',
    actual_amount DECIMAL(15, 2) DEFAULT 0 COMMENT 'Actual amount',
    variance_amount DECIMAL(15, 2) DEFAULT 0 COMMENT 'Variance amount',
    due_date DATE COMMENT 'Due date',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    INDEX idx_factory_date (factory_id, record_date),
    INDEX idx_record_type (factory_id, record_type),
    INDEX idx_department (factory_id, department),
    INDEX idx_aging (factory_id, aging_days)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI financial data parsed from Excel';

-- ============================================
-- 7. Department Data Table
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_department_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT 'Factory ID',
    upload_id BIGINT COMMENT 'Reference to excel upload record',
    record_date DATE NOT NULL COMMENT 'Record date',
    department VARCHAR(100) NOT NULL COMMENT 'Department name',
    department_id VARCHAR(100) COMMENT 'Department ID',
    manager_name VARCHAR(100) COMMENT 'Manager name',
    headcount INT DEFAULT 0 COMMENT 'Number of employees',
    sales_amount DECIMAL(15, 2) DEFAULT 0 COMMENT 'Department sales',
    sales_target DECIMAL(15, 2) DEFAULT 0 COMMENT 'Department target',
    cost_amount DECIMAL(15, 2) DEFAULT 0 COMMENT 'Department cost',
    per_capita_sales DECIMAL(15, 2) DEFAULT 0 COMMENT 'Per capita sales',
    per_capita_cost DECIMAL(15, 2) DEFAULT 0 COMMENT 'Per capita cost',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    INDEX idx_factory_date (factory_id, record_date),
    INDEX idx_department (factory_id, department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI department data';

-- ============================================
-- 8. Billing Configuration Table
-- ============================================
CREATE TABLE IF NOT EXISTS smart_bi_billing_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL COMMENT 'Factory ID',
    billing_mode ENUM('QUOTA', 'PAY_AS_YOU_GO', 'UNLIMITED') DEFAULT 'QUOTA' COMMENT 'Billing mode',
    daily_quota INT DEFAULT 50 COMMENT 'Daily free quota for QUOTA mode',
    price_per_query DECIMAL(10, 4) DEFAULT 0.10 COMMENT 'Price per query for PAY_AS_YOU_GO',
    monthly_limit DECIMAL(15, 2) DEFAULT 1000 COMMENT 'Monthly spending limit',
    alert_threshold INT DEFAULT 80 COMMENT 'Alert when quota reaches this percentage',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether billing is active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    UNIQUE KEY uk_factory_id (factory_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI billing configuration';

-- ============================================
-- 9. Insert default billing config for existing factories
-- ============================================
INSERT IGNORE INTO smart_bi_billing_config (factory_id, billing_mode, daily_quota, price_per_query)
SELECT factory_id, 'QUOTA', 50, 0.10
FROM factories
WHERE deleted_at IS NULL;
