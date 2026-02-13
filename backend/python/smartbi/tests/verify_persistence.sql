-- SQL Verification Script for SmartBI Analysis Persistence
-- Run this after uploading Excel and generating charts/insights

-- 1. Check analysis results table
SELECT
    'Analysis Results Summary' as section,
    factory_id,
    upload_id,
    analysis_type,
    jsonb_array_length(COALESCE(chart_configs, '[]'::jsonb)) as chart_count,
    jsonb_array_length(COALESCE(insights, '[]'::jsonb)) as insight_count,
    CASE
        WHEN kpi_values IS NOT NULL THEN jsonb_object_keys(kpi_values)::text
        ELSE 'none'
    END as has_kpis,
    created_at
FROM smart_bi_pg_analysis_results
WHERE factory_id = 'F001'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Count records per type
SELECT
    'Records by Analysis Type' as section,
    analysis_type,
    COUNT(*) as count
FROM smart_bi_pg_analysis_results
WHERE factory_id = 'F001'
GROUP BY analysis_type;

-- 3. Check chart configs detail (sample)
SELECT
    'Sample Chart Configs' as section,
    upload_id,
    jsonb_array_elements(chart_configs)->>'chartType' as chart_type,
    jsonb_array_elements(chart_configs)->>'title' as title,
    jsonb_array_elements(chart_configs)->>'reason' as reason
FROM smart_bi_pg_analysis_results
WHERE factory_id = 'F001'
  AND analysis_type = 'chart_recommendation'
  AND chart_configs IS NOT NULL
LIMIT 20;

-- 4. Check insights detail (sample)
SELECT
    'Sample Insights' as section,
    upload_id,
    jsonb_array_elements(insights)->>'type' as insight_type,
    LEFT(jsonb_array_elements(insights)->>'text', 100) as text_preview,
    jsonb_array_elements(insights)->>'sentiment' as sentiment,
    jsonb_array_elements(insights)->>'importance' as importance
FROM smart_bi_pg_analysis_results
WHERE factory_id = 'F001'
  AND analysis_type = 'insight_generation'
  AND insights IS NOT NULL
LIMIT 20;

-- 5. Check for empty analysis results (potential issues)
SELECT
    'Empty Analysis Results' as section,
    id,
    upload_id,
    analysis_type,
    created_at
FROM smart_bi_pg_analysis_results
WHERE factory_id = 'F001'
  AND (chart_configs IS NULL OR chart_configs = '[]'::jsonb)
  AND (insights IS NULL OR insights = '[]'::jsonb)
  AND (kpi_values IS NULL OR kpi_values = '{}'::jsonb);

-- 6. Cross-check with uploads
SELECT
    'Upload to Analysis Mapping' as section,
    u.id as upload_id,
    u.file_name,
    u.upload_status,
    u.row_count,
    COUNT(DISTINCT a.id) as analysis_count,
    SUM(jsonb_array_length(COALESCE(a.chart_configs, '[]'::jsonb))) as total_charts,
    SUM(jsonb_array_length(COALESCE(a.insights, '[]'::jsonb))) as total_insights
FROM smart_bi_pg_excel_uploads u
LEFT JOIN smart_bi_pg_analysis_results a ON u.id = a.upload_id AND u.factory_id = a.factory_id
WHERE u.factory_id = 'F001'
GROUP BY u.id, u.file_name, u.upload_status, u.row_count
ORDER BY u.id DESC
LIMIT 10;
