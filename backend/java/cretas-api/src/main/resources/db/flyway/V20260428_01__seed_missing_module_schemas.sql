-- R37 BUG-2 fix: 多个 @RequireModule 引用的 module_code 不在 module_schemas 表里
-- 后果: ModuleEnabledAspect.getEffectiveConfig 走 LEGACY enabled=true fallback,
-- 这意味着 R23-R34 加的所有 @RequireModule("scheduling")/("restaurant")/("warehouse") 都是 silent no-op.
-- 客户即便在 factory_module_configs 显式 disable 也不生效. R37 audit 通过 disable scheduling 真窗发现 200 而非 400.
--
-- 受影响模块:
-- - scheduling (38 endpoints across SchedulingController/Optimization/Metrics/LinUCB/MixedBatch/APS x2/UrgentInsert)
-- - restaurant (4 controllers: MaterialRequisition/Recipe/Stocktaking/Wastage)
-- - warehouse (2 controllers: TransferController, MaterialBatchController)
--
-- Idempotent: ON CONFLICT DO NOTHING 防重 (module_code unique constraint).

INSERT INTO module_schemas (module_code, module_name, module_category, module_version, field_schema, default_config, description, is_active)
VALUES
  ('scheduling', '智能调度', 'SCHEDULING', 1, '{}'::jsonb, '{"fields":{},"workflow":{}}'::jsonb, '智能调度模块 - R37 BUG-2 fix (之前缺 schema 导致 38 个 @RequireModule no-op)', true),
  ('restaurant', '餐饮运营', 'RESTAURANT', 1, '{}'::jsonb, '{"fields":{},"workflow":{}}'::jsonb, '餐饮运营模块 - R37 BUG-2 fix (4 controllers 之前 no-op)', true),
  ('warehouse', '仓储管理', 'INVENTORY', 1, '{}'::jsonb, '{"fields":{},"workflow":{}}'::jsonb, '仓储管理模块 - R37 BUG-2 fix (TransferController + MaterialBatchController)', true)
ON CONFLICT (module_code) DO NOTHING;
