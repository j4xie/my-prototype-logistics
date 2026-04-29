-- R33 P1 (closing R31 audit C3 deferred): backfill 全 active factory 显式 auto_trigger_enabled=true rule.
-- 之前 fallback 到 @Value default=true, 但隐式. 客户接收新工厂时无 rule → silent default true → "我没设置怎么自动建排程".
-- R33 同时把 @Value default 改 false (在代码中), 旧工厂靠这条 migration 保留行为, 新工厂 (创建 in 应用层) 默认安全 OFF.
--
-- Idempotent: ON CONFLICT 不存在 unique constraint 时, 用 NOT EXISTS 防重.

INSERT INTO drools_rules (
    id, factory_id, rule_group, rule_name, rule_content, rule_description,
    enabled, priority, version, created_at, updated_at
)
SELECT
    gen_random_uuid()::text,
    f.id,
    'scheduling',
    'auto_trigger_enabled',
    'true',
    '自动排产总开关 (R33 backfill): 保留旧工厂的 fallback=true 隐式行为, 显式落地避免 @Value default 改 false 后 surprise',
    true,
    0,
    1,
    NOW(),
    NOW()
FROM factories f
WHERE f.deleted_at IS NULL
  AND f.is_active = true
  AND NOT EXISTS (
      SELECT 1 FROM drools_rules dr
      WHERE dr.factory_id = f.id
        AND dr.rule_group = 'scheduling'
        AND dr.rule_name = 'auto_trigger_enabled'
  );
