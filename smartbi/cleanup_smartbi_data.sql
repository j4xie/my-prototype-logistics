-- SmartBI 数据清理脚本
-- 使用说明: 连接到 PostgreSQL SmartBI 数据库后执行此脚本
-- 数据库: smartbi_db 或主数据库 (取决于配置)

-- ============================================
-- 1. 清理动态数据 (最大的表，包含 Excel 行数据)
-- ============================================
TRUNCATE TABLE smart_bi_dynamic_data CASCADE;
SELECT 'smart_bi_dynamic_data 已清空' AS status;

-- ============================================
-- 2. 清理字段定义
-- ============================================
TRUNCATE TABLE smart_bi_pg_field_definitions CASCADE;
SELECT 'smart_bi_pg_field_definitions 已清空' AS status;

-- ============================================
-- 3. 清理分析结果缓存
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'smart_bi_pg_analysis_results') THEN
        TRUNCATE TABLE smart_bi_pg_analysis_results CASCADE;
        RAISE NOTICE 'smart_bi_pg_analysis_results 已清空';
    ELSE
        RAISE NOTICE 'smart_bi_pg_analysis_results 表不存在，跳过';
    END IF;
END $$;

-- ============================================
-- 4. 清理上传记录
-- ============================================
TRUNCATE TABLE smart_bi_pg_excel_uploads CASCADE;
SELECT 'smart_bi_pg_excel_uploads 已清空' AS status;

-- ============================================
-- 5. 清理固定 schema 表 (如果存在且有数据)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'smart_bi_sales_data') THEN
        TRUNCATE TABLE smart_bi_sales_data CASCADE;
        RAISE NOTICE 'smart_bi_sales_data 已清空';
    ELSE
        RAISE NOTICE 'smart_bi_sales_data 表不存在，跳过';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'smart_bi_finance_data') THEN
        TRUNCATE TABLE smart_bi_finance_data CASCADE;
        RAISE NOTICE 'smart_bi_finance_data 已清空';
    ELSE
        RAISE NOTICE 'smart_bi_finance_data 表不存在，跳过';
    END IF;
END $$;

-- ============================================
-- 6. 验证清理结果
-- ============================================
SELECT '========== 验证清理结果 ==========' AS section;

SELECT 'smart_bi_dynamic_data' AS table_name, COUNT(*) AS count FROM smart_bi_dynamic_data
UNION ALL
SELECT 'smart_bi_pg_excel_uploads', COUNT(*) FROM smart_bi_pg_excel_uploads
UNION ALL
SELECT 'smart_bi_pg_field_definitions', COUNT(*) FROM smart_bi_pg_field_definitions;

SELECT '========== 清理完成 ==========' AS section;
