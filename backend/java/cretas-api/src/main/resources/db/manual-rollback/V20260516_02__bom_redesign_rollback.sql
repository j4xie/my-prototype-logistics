-- ROLLBACK for V20260516_02__bom_redesign.sql
--
-- 触发条件 (何时手动跑这个):
--   - prod 部署 V20260516_02 后发现重大问题 (BomController /recipes/* 端点崩溃 / 数据迁移产生脏数据)
--   - 需要紧急回到 V20260516_01 的状态
--
-- 注意:
--   - 这只是 SCHEMA 回滚 — drop 2 张新表
--   - 旧 bom_items 表不动 (本来 V20260516_02 也没 drop 它), 应用代码仍能用旧 endpoint
--   - 这不是 Flyway 自动执行的 (Flyway free edition 不支持 undo), 需要手动执行:
--       psql -U cretas_user -d cretas_prod_db -f V20260516_02__bom_redesign_rollback.sql
--   - 跑完后还需要手动从 flyway_schema_history 删除 V20260516_02 行:
--       DELETE FROM flyway_schema_history WHERE version = '20260516.02';
--   - 否则下次 Flyway 启动会以为 V20260516_02 已应用, 跳过重跑
--
-- 数据丢失警告:
--   - bom_recipes / bom_recipe_items 表里所有新建/编辑过的数据**全部丢失**
--   - 仅适用于"刚部署不久, 还没真实用户数据"的早期回滚场景
--   - 如果已经有用户数据进入新表, 需要先 EXPORT 再 drop
--
-- 来源: Track D1 / M-BOM-1 / 2026-05-14

\echo '=== ROLLBACK V20260516_02__bom_redesign.sql ==='

\echo '--- Pre-rollback row counts ---'
SELECT 'bom_recipes' AS table_name, COUNT(*) AS rows FROM bom_recipes
UNION ALL
SELECT 'bom_recipe_items', COUNT(*) FROM bom_recipe_items;

\echo ''
\echo '--- Dropping tables (CASCADE removes FK + indexes + constraints) ---'
DROP TABLE IF EXISTS bom_recipe_items CASCADE;
DROP TABLE IF EXISTS bom_recipes CASCADE;

\echo ''
\echo '--- Confirm dropped ---'
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('bom_recipes', 'bom_recipe_items');

\echo ''
\echo '--- NEXT MANUAL STEP: rerun Flyway tracker cleanup ---'
\echo '   DELETE FROM flyway_schema_history WHERE version = ''20260516.02'';'
