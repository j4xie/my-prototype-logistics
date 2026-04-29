-- R32 P5 (I9 fix from reviewer): seed F001 scheduling.auto_trigger_enabled rule
-- 之前 R31 是手动 INSERT (test+prod), 没留 migration 痕迹.
-- 如果 prod 重置 drools_rules 或新启 replica/灾备恢复, F001 这条 rule 会丢
-- → isAutoSchedulingEnabled() fallback 到 @Value default true (碰巧一样, 但隐式不可控).
-- 本 migration 显式补回, idempotent (ON CONFLICT 跳过已存在的).

INSERT INTO drools_rules (
    id, factory_id, rule_group, rule_name, rule_content, rule_description,
    enabled, priority, version, created_at, updated_at
)
SELECT
    gen_random_uuid()::text,
    'F001',
    'scheduling',
    'auto_trigger_enabled',
    'true',
    '自动排产总开关 (R31): 控制 PP 创建后是否进入排程链, 是 isAutoSchedulingEnabled() 的实际 gate',
    true,
    0,
    1,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM drools_rules
    WHERE factory_id = 'F001'
      AND rule_group = 'scheduling'
      AND rule_name = 'auto_trigger_enabled'
);
