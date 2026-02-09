-- SmartBI Upload Reliability + Retry Migration
-- Run on smartbi_db (both local and remote)

-- Step 1: Add new columns to smart_bi_pg_excel_uploads
ALTER TABLE smart_bi_pg_excel_uploads
  ADD COLUMN IF NOT EXISTS stored_file_path VARCHAR(500),
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Step 2: Drop problematic unique constraint (causes duplicate column name failures)
ALTER TABLE smart_bi_pg_field_definitions DROP CONSTRAINT IF EXISTS uk_pg_field_upload_name;

-- Step 3: Fix stuck PARSING records that have 0 data rows
UPDATE smart_bi_pg_excel_uploads
SET upload_status = 'FAILED',
    last_error = 'Stuck in PARSING with 0 data rows (auto-fixed by migration)',
    updated_at = NOW()
WHERE upload_status = 'PARSING'
  AND id NOT IN (SELECT DISTINCT upload_id FROM smart_bi_dynamic_data);
