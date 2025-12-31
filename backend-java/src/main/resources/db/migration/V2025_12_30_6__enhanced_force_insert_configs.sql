-- =====================================================
-- 增强的强制插单审批配置
-- 基于 buildForceInsertApprovalContext() 提供的上下文字段
-- V2025_12_30_6
-- =====================================================

-- 删除旧的 FORCE_INSERT 配置 (可选，按需启用)
-- DELETE FROM approval_chain_configs WHERE factory_id = 'F001' AND decision_type = 'FORCE_INSERT';

-- 强制插单审批链 - 多维度条件配置
INSERT INTO approval_chain_configs (
    id, factory_id, decision_type, name, description,
    trigger_condition, approval_level, required_approvers,
    approver_roles, timeout_minutes, priority, enabled, version
) VALUES

-- 场景1: VIP客户受影响 - 最高优先级
(UUID(), 'F001', 'FORCE_INSERT', '紧急插单-VIP客户影响',
 '有VIP客户订单受影响的紧急插单，需要总经理审批',
 '{"vipCustomerCount": ">=1"}', 1, 1,
 '["factory_super_admin"]', 30, 200, true, 1),

-- 场景2: 高影响分数 - 综合评估
(UUID(), 'F001', 'FORCE_INSERT', '紧急插单-高影响评分',
 '影响评分超过80分的紧急插单，需要管理层审批',
 '{"impactScore": ">=80"}', 1, 1,
 '["factory_super_admin"]', 45, 180, true, 1),

-- 场景3: 产生级联延误 - 链式影响
(UUID(), 'F001', 'FORCE_INSERT', '紧急插单-级联延误',
 '会导致后续计划连锁延误的紧急插单',
 '{"cascadeDelays": ">=3"}', 1, 1,
 '["factory_super_admin", "production_manager"]', 60, 160, true, 1),

-- 场景4: 直接冲突多 - 资源竞争
(UUID(), 'F001', 'FORCE_INSERT', '紧急插单-多计划冲突',
 '与多个现有计划产生直接冲突',
 '{"directConflicts": ">=2"}', 1, 1,
 '["production_manager", "department_admin"]', 60, 140, true, 1),

-- 场景5: 超长延误时间
(UUID(), 'F001', 'FORCE_INSERT', '紧急插单-超长延误',
 '最大延误时间超过2小时',
 '{"maxDelayMinutes": ">=120"}', 1, 1,
 '["factory_super_admin"]', 45, 150, true, 1),

-- 场景6: 超临界计划受影响
(UUID(), 'F001', 'FORCE_INSERT', '紧急插单-影响临界计划',
 '有CR值较高的临界计划受影响',
 '{"criticalCrPlans": ">=1"}', 1, 1,
 '["factory_super_admin"]', 30, 170, true, 1),

-- 场景7: 导致交期逾期
(UUID(), 'F001', 'FORCE_INSERT', '紧急插单-导致交期逾期',
 '会导致其他订单交期逾期',
 '{"exceedingDeadlinePlans": ">=1"}', 1, 1,
 '["factory_super_admin"]', 30, 190, true, 1),

-- 场景8: 紧急插单 (4小时内)
(UUID(), 'F001', 'FORCE_INSERT', '紧急插单-极度紧急',
 '4小时内需要开始生产的紧急插单',
 '{"isUrgent": true}', 1, 1,
 '["factory_super_admin"]', 15, 210, true, 1),

-- 场景9: 大批量插单
(UUID(), 'F001', 'FORCE_INSERT', '紧急插单-大批量',
 '计划数量超过500的大批量插单',
 '{"plannedQuantity": ">=500"}', 1, 1,
 '["production_manager"]', 60, 120, true, 1);

-- =====================================================
-- 上下文字段参考 (来自 buildForceInsertApprovalContext)
-- =====================================================
--
-- 基础影响信息:
--   - impactLevel: 影响级别 (LOW/MEDIUM/HIGH/CRITICAL)
--   - affectedPlanCount: 受影响计划数量
--   - affectedLines: 受影响产线数 (近似值 = totalAffectedPlans)
--
-- 链式影响分析 (ChainImpactResult):
--   - directConflicts: 直接冲突的计划数
--   - cascadeDelays: 级联延误的计划数
--   - maxDelayMinutes: 最大延误时间 (分钟)
--   - totalDelayMinutes: 累计延误时间 (分钟)
--   - vipCustomerCount: 受影响的VIP客户数
--   - criticalCrPlans: 临界CR值计划数
--   - exceedingDeadlinePlans: 超期计划数
--   - impactScore: 综合影响评分 (0-100)
--
-- 请求信息:
--   - priority: 优先级
--   - plannedQuantity: 计划数量
--   - hasCustomerOrder: 是否有客户订单
--
-- 时间紧迫性:
--   - hoursFromNow: 距离开始时间的小时数
--   - isUrgent: 是否紧急 (4小时内)
--
-- =====================================================
