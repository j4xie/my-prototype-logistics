-- SmartBI 数据清除脚本
-- 在宝塔面板 phpMyAdmin 中执行

-- 设置数据库
USE cretas_db;

-- 清除销售数据
TRUNCATE TABLE smart_bi_sales_data;

-- 清除财务数据
TRUNCATE TABLE smart_bi_finance_data;

-- 清除部门数据
TRUNCATE TABLE smart_bi_department_data;

-- 清除 Excel 上传记录
TRUNCATE TABLE smart_bi_excel_uploads;

-- 清除分析缓存
TRUNCATE TABLE smart_bi_analysis_cache;

-- 清除使用记录
TRUNCATE TABLE smart_bi_usage_records;

-- 验证清除结果
SELECT 'smart_bi_sales_data' as table_name, COUNT(*) as count FROM smart_bi_sales_data
UNION ALL
SELECT 'smart_bi_finance_data', COUNT(*) FROM smart_bi_finance_data
UNION ALL
SELECT 'smart_bi_department_data', COUNT(*) FROM smart_bi_department_data
UNION ALL
SELECT 'smart_bi_excel_uploads', COUNT(*) FROM smart_bi_excel_uploads;
