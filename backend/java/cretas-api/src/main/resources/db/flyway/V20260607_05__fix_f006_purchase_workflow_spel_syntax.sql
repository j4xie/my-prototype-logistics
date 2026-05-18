-- V20260607_05: 修 F006 PURCHASE_ORDER_APPROVAL workflow 的 SpEL 语法
--
-- Phase 1 Canvas-Workflow PR #862 follow-up — V20260607_03 seed 用
-- `#context.amount > 30000` 但 Spring SpEL 默认 PropertyAccessor 不支持
-- Map 上的 dot syntax (需 `#context['amount']` 或 `#amount`).
-- 实际现象: 评估失败 → fallback false → PO 全部走 DEFAULT (end_auto) 自动通过,
-- 阈值逻辑完全失效. E2E 2026-05-19 01:33 抓到.
--
-- 此 migration idempotent: 只在 condition 仍是有问题的旧值时更新.
-- 改用 `#amount > 30000` (top-level spread, WorkflowEngineServiceImpl line 284-286
-- 把 context map 的 entries 也 putIfAbsent 到 variables, 所以 #amount 直接可用).
--
-- Phase 2 follow-up issue: WorkflowEngineServiceImpl.evaluateCondition 注册
-- MapAccessor 让 `#context.foo` 也工作, 客户在 Canvas UI 写自然 SpEL 也通.
-- 但本 migration 不依赖那个 fix, 用 top-level 写法 prod-safe.

UPDATE approval_workflows
SET edges_json = jsonb_set(
        edges_json,
        '{1,condition}',
        '"#amount > 30000"'::jsonb
    )
WHERE id = 'awf-f006-po-default'
  AND edges_json->1->>'condition' = '#context.amount > 30000';
