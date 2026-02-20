-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_30_8__quality_disposition_configs.sql
-- Conversion date: 2026-01-26 18:46:21
-- ============================================

-- =====================================================
-- 质检处置审批链配置
-- Q1/Q2: 质检放行决策点
-- V2025_12_30_8
-- =====================================================

-- 清除旧配置（如有需要）
-- DELETE FROM approval_chain_configs WHERE factory_id = 'F001' AND decision_type IN ('QUALITY_RELEASE', 'QUALITY_EXCEPTION');

-- =====================================================
-- QUALITY_RELEASE 配置 - 常规质检放行
-- =====================================================

INSERT INTO approval_chain_configs (
    id, factory_id, decision_type, name, description,
    trigger_condition, approval_level, required_approvers,
    approver_roles, timeout_minutes, priority, enabled, version
) VALUES

-- 场景1: 条件放行需要审批
(UUID(), 'F001', 'QUALITY_RELEASE', '条件放行审批',
 '合格率85-95%的条件放行需要质检主管审批',
 '{"passRate": ">=85", "passRate": "<95"}', 1, 1,
 '["quality_supervisor", "department_admin"]', 60, 100, true, 1),

-- 场景2: 低合格率放行需要更高级别审批
(UUID(), 'F001', 'QUALITY_RELEASE', '低合格率放行审批',
 '合格率70-85%的放行需要部门管理员审批',
 '{"passRate": ">=70", "passRate": "<85"}', 1, 1,
 '["department_admin", "factory_super_admin"]', 45, 150, true, 1),

-- 场景3: D级质量等级需要审批
(UUID(), 'F001', 'QUALITY_RELEASE', 'D级质量放行审批',
 '质量等级为D的批次放行需要审批',
 '{"qualityGrade": "D"}', 1, 1,
 '["factory_super_admin"]', 30, 180, true, 1),

-- 场景4: 报废处理需要审批
(UUID(), 'F001', 'QUALITY_RELEASE', '报废处理审批',
 '报废处理需要管理层审批',
 '{"dispositionType": "SCRAP"}', 1, 1,
 '["factory_super_admin"]', 60, 200, true, 1),

-- 场景5: 高缺陷率批次
(UUID(), 'F001', 'QUALITY_RELEASE', '高缺陷率批次审批',
 '缺陷率超过30%的批次需要审批',
 '{"defectRate": ">=30"}', 1, 1,
 '["department_admin", "factory_super_admin"]', 45, 160, true, 1);

-- =====================================================
-- QUALITY_EXCEPTION 配置 - 质检特批
-- =====================================================

INSERT INTO approval_chain_configs (
    id, factory_id, decision_type, name, description,
    trigger_condition, approval_level, required_approvers,
    approver_roles, timeout_minutes, priority, enabled, version
) VALUES

-- 特批场景1: 不合格但请求放行
(UUID(), 'F001', 'QUALITY_EXCEPTION', '特批-不合格请求放行',
 '检验不合格但请求放行的特批申请',
 '{"result": "FAIL", "requestedAction": "RELEASE"}', 1, 2,
 '["factory_super_admin"]', 30, 300, true, 1),

-- 特批场景2: 严重缺陷但不报废
(UUID(), 'F001', 'QUALITY_EXCEPTION', '特批-严重缺陷不报废',
 '缺陷率超过50%但不选择报废的特批申请',
 '{"defectRate": ">=50", "requestedAction": "REWORK"}', 1, 2,
 '["factory_super_admin"]', 30, 350, true, 1),

-- 特批场景3: 超低合格率条件放行
(UUID(), 'F001', 'QUALITY_EXCEPTION', '特批-超低合格率条件放行',
 '合格率低于70%但请求条件放行',
 '{"passRate": "<70", "requestedAction": "CONDITIONAL_RELEASE"}', 1, 2,
 '["factory_super_admin"]', 30, 320, true, 1),

-- 特批场景4: 已报废批次重新评估
(UUID(), 'F001', 'QUALITY_EXCEPTION', '特批-报废批次复核',
 '已报废批次申请重新评估',
 '{"currentStatus": "SCRAPPED", "requestedAction": "REWORK"}', 1, 2,
 '["factory_super_admin"]', 45, 280, true, 1);

-- =====================================================
-- 上下文字段参考 (来自 buildEvaluationContext)
-- =====================================================
--
-- 质检结果信息:
--   - inspectionId: 质检记录ID
--   - productionBatchId: 生产批次ID
--   - passRate: 合格率 (0-100)
--   - defectRate: 缺陷率 (0-100)
--   - result: 质检结果 (PASS/FAIL/CONDITIONAL)
--   - qualityGrade: 质量等级 (A/B/C/D)
--
-- 样本信息:
--   - sampleSize: 样本数量
--   - passCount: 合格数量
--   - failCount: 不合格数量
--   - inspectionDate: 检验日期
--
-- 请求信息 (执行时添加):
--   - requestedAction: 请求的处置动作
--   - dispositionType: 处置类型
--   - currentStatus: 当前批次状态
--
-- =====================================================
