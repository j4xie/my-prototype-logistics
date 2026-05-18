-- V20260607_03: Seed F006 default PURCHASE_ORDER_APPROVAL workflow
--
-- Phase 1 Canvas-Workflow (Step B.6). Idempotent (ON CONFLICT DO NOTHING).
-- Default workflow:
--   Start → Condition[amount>30000] → Approval[finance_manager] → End(APPROVED)
--                                  ↘ End(APPROVED) (auto, low-amount)
--
-- F006 ops can edit via Canvas → 审批工作流 Tab; this seed only ensures
-- one default exists on Day 0 for the customer's initial use.
--
-- SpEL refresher: edges 的 condition 字段是字符串, 通过 SandboxedSpelEvaluator
-- 求值. context 由 PurchaseServiceImpl 构造, 包含 amount / totalAmount / orderId /
-- supplierId / priceVarianceItemCount / decision. 在 SQL 文本里 SpEL 的字符串字面量
-- 'APPROVE' 通过 PG 单引号转义写成 ''APPROVE''.
--
-- 设计文档: PR #862 Steve B.1-B.6 决断 / .claude/worktrees/canvas-workflow-phase1

INSERT INTO approval_workflows (
    id, factory_id, decision_type, name, description,
    nodes_json, edges_json, start_node_id,
    version, publish_status, enabled, priority,
    created_at, updated_at
)
VALUES (
    'awf-f006-po-default',
    'F006',
    'PURCHASE_ORDER_APPROVAL',
    '采购订单默认审批 (¥30000 阈值)',
    'F006 Phase 1 默认工作流: 金额>30000 触发财务审批, 否则自动通过',
    '[
      {"id":"start_1","type":"start","label":"开始","position":{"x":50,"y":150},"config":{}},
      {"id":"cond_1","type":"condition","label":"金额判断","position":{"x":250,"y":150},"config":{"description":"金额阈值"}},
      {"id":"approval_finance","type":"approval","label":"财务审批","position":{"x":500,"y":80},"config":{"approverRoles":["finance_manager"],"requiredApprovers":1,"timeoutMinutes":1440}},
      {"id":"end_approved","type":"end","label":"通过","position":{"x":750,"y":80},"config":{"outcome":"APPROVED"}},
      {"id":"end_auto","type":"end","label":"自动通过","position":{"x":750,"y":220},"config":{"outcome":"APPROVED"}}
    ]'::jsonb,
    '[
      {"id":"e_start_cond","source":"start_1","target":"cond_1","condition":null,"label":null,"priority":0},
      {"id":"e_cond_finance","source":"cond_1","target":"approval_finance","condition":"#context.amount > 30000","label":">30000","priority":0},
      {"id":"e_cond_auto","source":"cond_1","target":"end_auto","condition":null,"label":"DEFAULT","priority":99},
      {"id":"e_finance_approved","source":"approval_finance","target":"end_approved","condition":"#decision == ''APPROVE''","label":"通过","priority":0}
    ]'::jsonb,
    'start_1',
    1, 'published', TRUE, 0,
    NOW(), NOW()
)
ON CONFLICT (factory_id, decision_type, name) DO NOTHING;

COMMENT ON TABLE approval_workflows IS 'Graph-native 审批工作流配置 — F006 默认 PO 审批由 V20260607_03 种子写入. Sprint 3 Track-I + Phase 1 Canvas-Workflow B.6.';
