-- ============================================================
-- PostgreSQL pg_cron 定时任务配置
-- 转换自 MySQL EVENTs
-- 创建日期: 2026-01-26
--
-- 原始文件:
--   - V2025_12_30_4__factory_capacity_config.sql (cleanup_expired_slot_locks)
--   - V2026_01_18_20__behavior_calibration_tables.sql (cleanup_tool_call_cache)
-- ============================================================

-- -----------------------------------------------------
-- 1. 安装 pg_cron 扩展
-- 注意: pg_cron 需要在 postgresql.conf 中配置:
--   shared_preload_libraries = 'pg_cron'
--   cron.database_name = 'your_database_name'
-- -----------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- -----------------------------------------------------
-- 2. 清理过期时段锁定的函数
-- 原始 MySQL EVENT: cleanup_expired_slot_locks
-- 执行间隔: 每 1 分钟
-- 功能: 自动将过期的插单时段锁标记为无效
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_expired_slot_locks()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE insert_slot_locks
    SET
        is_active = FALSE,
        released_at = NOW(),
        released_reason = 'AUTO_EXPIRED',
        updated_at = NOW()
    WHERE
        is_active = TRUE
        AND expire_at < NOW();

    -- 可选: 记录清理数量到日志
    -- RAISE NOTICE 'Cleaned up % expired slot locks', (SELECT COUNT(*) FROM insert_slot_locks WHERE released_reason = 'AUTO_EXPIRED' AND released_at >= NOW() - INTERVAL '1 minute');
END;
$$;

COMMENT ON FUNCTION cleanup_expired_slot_locks() IS '清理过期的插单时段锁定记录 - 每分钟执行';


-- -----------------------------------------------------
-- 3. 清理工具调用缓存的函数
-- 原始 MySQL EVENT: cleanup_tool_call_cache
-- 执行间隔: 每 10 分钟
-- 功能: 删除过期的工具调用缓存记录
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_tool_call_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM tool_call_cache
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- 可选: 记录清理数量到日志
    -- RAISE NOTICE 'Cleaned up % expired tool call cache entries', deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_tool_call_cache() IS '清理过期的工具调用缓存 - 每10分钟执行';


-- -----------------------------------------------------
-- 4. 注册 pg_cron 定时任务
--
-- Cron 表达式格式: 分 时 日 月 周
-- * * * * *     = 每分钟
-- */10 * * * *  = 每10分钟
-- 0 * * * *     = 每小时整点
-- 0 0 * * *     = 每天午夜
-- -----------------------------------------------------

-- 先删除已存在的任务 (幂等性)
DO $$
BEGIN
    -- 尝试删除已存在的任务，忽略不存在的情况
    PERFORM cron.unschedule('cleanup_expired_slot_locks');
EXCEPTION WHEN OTHERS THEN
    -- 任务不存在时忽略错误
    NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('cleanup_tool_call_cache');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 注册定时任务

-- 4.1 清理过期时段锁 - 每分钟执行
SELECT cron.schedule(
    'cleanup_expired_slot_locks',  -- job name
    '* * * * *',                   -- cron expression: 每分钟
    $$SELECT cleanup_expired_slot_locks()$$
);

-- 4.2 清理工具调用缓存 - 每10分钟执行
SELECT cron.schedule(
    'cleanup_tool_call_cache',     -- job name
    '*/10 * * * *',                -- cron expression: 每10分钟
    $$SELECT cleanup_tool_call_cache()$$
);


-- -----------------------------------------------------
-- 5. 验证任务已注册
-- -----------------------------------------------------
-- 查看已注册的定时任务:
-- SELECT * FROM cron.job;

-- 查看任务执行历史:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;


-- -----------------------------------------------------
-- 6. 手动执行测试 (可选)
-- -----------------------------------------------------
-- SELECT cleanup_expired_slot_locks();
-- SELECT cleanup_tool_call_cache();


-- ============================================================
-- 维护说明:
--
-- 1. 查看所有定时任务:
--    SELECT jobid, jobname, schedule, command FROM cron.job;
--
-- 2. 查看任务执行日志:
--    SELECT * FROM cron.job_run_details
--    WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'cleanup%')
--    ORDER BY start_time DESC LIMIT 50;
--
-- 3. 暂停任务:
--    UPDATE cron.job SET active = FALSE WHERE jobname = 'cleanup_expired_slot_locks';
--
-- 4. 恢复任务:
--    UPDATE cron.job SET active = TRUE WHERE jobname = 'cleanup_expired_slot_locks';
--
-- 5. 删除任务:
--    SELECT cron.unschedule('cleanup_expired_slot_locks');
--
-- 6. 修改执行间隔:
--    SELECT cron.schedule('cleanup_expired_slot_locks', '*/5 * * * *', 'SELECT cleanup_expired_slot_locks()');
-- ============================================================
