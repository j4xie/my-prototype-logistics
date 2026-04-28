-- Migration: V20260502_07__get_global_kpi_stats_fn.sql
-- Purpose: Phase B-1 outlier filter — SECURITY DEFINER function for global baseline stats
--
-- Reviewer R4: round n 到 bucket 防止规模反推, header doc 明确唯一调用方
--
-- 唯一调用方: backend/python/smartbi/services/outlier_service.py
-- 用途: 当本工厂样本不足 (N<10) 时, 提供全网基线让新工厂也能看到信号
-- 返回: q1, q3, median, n_bucket (NOT 精确 n)
-- 安全: SECURITY DEFINER bypass RLS, 仅暴露聚合数, 不暴露任何明细 row

CREATE OR REPLACE FUNCTION get_global_kpi_stats(
    p_kpi_kind VARCHAR,
    p_window_days INT DEFAULT 30
)
RETURNS TABLE (
    q1 NUMERIC,
    q3 NUMERIC,
    median NUMERIC,
    n_bucket VARCHAR    -- '<10' | '10-49' | '50-99' | '100-499' | '500+'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_n INT;
    v_value_col TEXT;
BEGIN
    -- 校验 kpi_kind 防 SQL injection
    IF p_kpi_kind NOT IN (
        'requisition_cost_total',
        'wastage_cost_total',
        'stocktaking_shortage_total',
        'stocktaking_surplus_total'
    ) THEN
        RAISE EXCEPTION 'Invalid kpi_kind: %', p_kpi_kind;
    END IF;

    IF p_window_days < 1 OR p_window_days > 365 THEN
        RAISE EXCEPTION 'window_days out of range: %', p_window_days;
    END IF;

    -- 动态拼列名 (kpi_kind 已校验白名单)
    v_value_col := p_kpi_kind;

    RETURN QUERY EXECUTE format(
        'SELECT
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY %I)::NUMERIC AS q1,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY %I)::NUMERIC AS q3,
            PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY %I)::NUMERIC AS median,
            CASE
                WHEN COUNT(*) FILTER (WHERE %I IS NOT NULL) < 10 THEN ''<10''::VARCHAR
                WHEN COUNT(*) FILTER (WHERE %I IS NOT NULL) < 50 THEN ''10-49''::VARCHAR
                WHEN COUNT(*) FILTER (WHERE %I IS NOT NULL) < 100 THEN ''50-99''::VARCHAR
                WHEN COUNT(*) FILTER (WHERE %I IS NOT NULL) < 500 THEN ''100-499''::VARCHAR
                ELSE ''500+''::VARCHAR
            END AS n_bucket
         FROM agg_restaurant_daily_totals
         WHERE date >= CURRENT_DATE - ($1 || '' days'')::interval
           AND %I IS NOT NULL',
        v_value_col, v_value_col, v_value_col,
        v_value_col, v_value_col, v_value_col, v_value_col,
        v_value_col
    ) USING p_window_days;
END;
$$;

COMMENT ON FUNCTION get_global_kpi_stats(VARCHAR, INT) IS
    'Phase B-1 outlier fallback: 全网聚合基线. SECURITY DEFINER bypass RLS. 唯一调用方: smartbi/services/outlier_service.py. n_bucket 而非精确 n 防止规模反推.';

-- 撤销 PUBLIC 权限, 仅特定 role 可调
REVOKE ALL ON FUNCTION get_global_kpi_stats(VARCHAR, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_global_kpi_stats(VARCHAR, INT) TO smartbi_user;
