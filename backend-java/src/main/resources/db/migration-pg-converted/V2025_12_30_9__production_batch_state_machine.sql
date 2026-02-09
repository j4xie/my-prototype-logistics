-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_30_9__production_batch_state_machine.sql
-- Conversion date: 2026-01-26 18:46:23
-- ============================================

-- =====================================================
-- 生产批次状态机配置
-- Q1/Q2: 质检放行门禁
-- V2025_12_30_9
-- =====================================================

-- 检查状态机表是否存在
-- 如果表不存在，此脚本可以跳过或由应用程序创建

-- =====================================================
-- 生产批次状态机配置 - ProductionBatch
-- =====================================================

INSERT INTO state_machines (
    id, factory_id, entity_type, name, description,
    states_json, transitions_json, enabled, version
) VALUES (
    UUID(),
    'F001',
    'ProductionBatch',
    '生产批次状态机',
    '管理生产批次从计划到完成的状态流转，包含质检放行门禁',
    -- states_json
    '[
        {"code": "PLANNED", "name": "计划中", "description": "批次已创建，等待开始生产", "initial": true},
        {"code": "IN_PROGRESS", "name": "生产中", "description": "批次正在生产"},
        {"code": "PAUSED", "name": "已暂停", "description": "生产临时暂停"},
        {"code": "PENDING_QC", "name": "待质检", "description": "生产完成，等待质量检验"},
        {"code": "QC_IN_PROGRESS", "name": "质检中", "description": "正在进行质量检验"},
        {"code": "QC_PASSED", "name": "质检通过", "description": "质量检验通过，可以放行"},
        {"code": "QC_CONDITIONAL", "name": "条件放行", "description": "质检有条件通过，需审批后放行"},
        {"code": "QC_FAILED", "name": "质检不通过", "description": "质量检验不通过，需要处理"},
        {"code": "REWORK", "name": "返工中", "description": "正在进行返工处理"},
        {"code": "COMPLETED", "name": "已完成", "description": "批次已完成并放行", "final": true},
        {"code": "SCRAPPED", "name": "已报废", "description": "批次已报废", "final": true},
        {"code": "CANCELLED", "name": "已取消", "description": "批次已取消", "final": true}
    ]',
    -- transitions_json with quality guards
    '[
        {
            "from": "PLANNED",
            "to": "IN_PROGRESS",
            "event": "START_PRODUCTION",
            "name": "开始生产",
            "guard": null,
            "action": "startProduction"
        },
        {
            "from": "PLANNED",
            "to": "CANCELLED",
            "event": "CANCEL",
            "name": "取消批次",
            "guard": null,
            "action": "cancelBatch"
        },
        {
            "from": "IN_PROGRESS",
            "to": "PAUSED",
            "event": "PAUSE",
            "name": "暂停生产",
            "guard": null,
            "action": "pauseProduction"
        },
        {
            "from": "PAUSED",
            "to": "IN_PROGRESS",
            "event": "RESUME",
            "name": "恢复生产",
            "guard": null,
            "action": "resumeProduction"
        },
        {
            "from": "IN_PROGRESS",
            "to": "PENDING_QC",
            "event": "COMPLETE_PRODUCTION",
            "name": "完成生产",
            "guard": "completedQuantity >= plannedQuantity * 0.95",
            "action": "completeProduction"
        },
        {
            "from": "PENDING_QC",
            "to": "QC_IN_PROGRESS",
            "event": "START_QC",
            "name": "开始质检",
            "guard": null,
            "action": "startQualityCheck"
        },
        {
            "from": "QC_IN_PROGRESS",
            "to": "QC_PASSED",
            "event": "QC_PASS",
            "name": "质检通过",
            "guard": "#isQualityPassed(qualityStatus)",
            "action": "passQualityCheck"
        },
        {
            "from": "QC_IN_PROGRESS",
            "to": "QC_CONDITIONAL",
            "event": "QC_CONDITIONAL_PASS",
            "name": "条件放行",
            "guard": "#getQualityDisposition(#factoryId, id) == ''CONDITIONAL_RELEASE''",
            "action": "conditionalPass"
        },
        {
            "from": "QC_IN_PROGRESS",
            "to": "QC_FAILED",
            "event": "QC_FAIL",
            "name": "质检不通过",
            "guard": null,
            "action": "failQualityCheck"
        },
        {
            "from": "QC_PASSED",
            "to": "COMPLETED",
            "event": "RELEASE",
            "name": "放行",
            "guard": "#canReleaseWithQuality(#factoryId, id)",
            "action": "releaseBatch"
        },
        {
            "from": "QC_CONDITIONAL",
            "to": "COMPLETED",
            "event": "APPROVE_RELEASE",
            "name": "审批放行",
            "guard": "#hasPermission(#factoryId, ''quality_supervisor'') || #hasPermission(#factoryId, ''factory_super_admin'')",
            "action": "approveRelease"
        },
        {
            "from": "QC_FAILED",
            "to": "REWORK",
            "event": "START_REWORK",
            "name": "开始返工",
            "guard": "#getQualityDisposition(#factoryId, id) == ''REWORK''",
            "action": "startRework"
        },
        {
            "from": "QC_FAILED",
            "to": "SCRAPPED",
            "event": "SCRAP",
            "name": "报废",
            "guard": "#getQualityDisposition(#factoryId, id) == ''SCRAP'' && #hasPermission(#factoryId, ''factory_super_admin'')",
            "action": "scrapBatch"
        },
        {
            "from": "REWORK",
            "to": "QC_IN_PROGRESS",
            "event": "REWORK_COMPLETE",
            "name": "返工完成",
            "guard": null,
            "action": "completeRework"
        },
        {
            "from": "IN_PROGRESS",
            "to": "CANCELLED",
            "event": "CANCEL",
            "name": "取消生产",
            "guard": "completedQuantity == 0",
            "action": "cancelBatch"
        }
    ]',
    true,
    1
);

-- =====================================================
-- 质量状态子状态机配置 - QualityStatus
-- =====================================================

INSERT INTO state_machines (
    id, factory_id, entity_type, name, description,
    states_json, transitions_json, enabled, version
) VALUES (
    UUID(),
    'F001',
    'QualityStatus',
    '质量状态子状态机',
    '管理质量检验状态流转，配合生产批次状态机使用',
    -- states_json
    '[
        {"code": "PENDING_INSPECTION", "name": "待质检", "initial": true},
        {"code": "INSPECTING", "name": "质检中"},
        {"code": "PASSED", "name": "已通过", "final": true},
        {"code": "FAILED", "name": "未通过"},
        {"code": "PARTIAL_PASS", "name": "部分通过"},
        {"code": "REWORK_REQUIRED", "name": "需返工"},
        {"code": "REWORKING", "name": "返工中"},
        {"code": "REWORK_COMPLETED", "name": "返工完成"},
        {"code": "SCRAPPED", "name": "已报废", "final": true}
    ]',
    -- transitions_json
    '[
        {
            "from": "PENDING_INSPECTION",
            "to": "INSPECTING",
            "event": "START_INSPECTION",
            "name": "开始检验"
        },
        {
            "from": "INSPECTING",
            "to": "PASSED",
            "event": "PASS",
            "name": "检验通过",
            "guard": "#isQualityPassed(qualityStatus)"
        },
        {
            "from": "INSPECTING",
            "to": "FAILED",
            "event": "FAIL",
            "name": "检验不通过"
        },
        {
            "from": "INSPECTING",
            "to": "PARTIAL_PASS",
            "event": "PARTIAL",
            "name": "部分通过"
        },
        {
            "from": "FAILED",
            "to": "REWORK_REQUIRED",
            "event": "REQUIRE_REWORK",
            "name": "需要返工"
        },
        {
            "from": "FAILED",
            "to": "SCRAPPED",
            "event": "SCRAP",
            "name": "报废处理",
            "guard": "#hasPermission(#factoryId, ''factory_super_admin'')"
        },
        {
            "from": "REWORK_REQUIRED",
            "to": "REWORKING",
            "event": "START_REWORK",
            "name": "开始返工"
        },
        {
            "from": "REWORKING",
            "to": "REWORK_COMPLETED",
            "event": "COMPLETE_REWORK",
            "name": "完成返工"
        },
        {
            "from": "REWORK_COMPLETED",
            "to": "INSPECTING",
            "event": "REINSPECT",
            "name": "复检"
        },
        {
            "from": "PARTIAL_PASS",
            "to": "PASSED",
            "event": "APPROVE",
            "name": "审批通过",
            "guard": "#hasPermission(#factoryId, ''quality_supervisor'')"
        }
    ]',
    true,
    1
);

-- =====================================================
-- 守卫函数使用说明
-- =====================================================
--
-- 可用的质检相关守卫函数:
--
-- 1. #isQualityPassed(qualityStatus)
--    检查质量状态是否通过
--    参数: qualityStatus - 质量状态字符串
--    返回: boolean
--
-- 2. #canReleaseWithQuality(factoryId, batchId)
--    检查是否可以直接放行（无需审批）
--    参数: factoryId - 工厂ID, batchId - 批次ID
--    返回: boolean
--
-- 3. #requiresQualityApproval(factoryId, batchId)
--    检查是否需要质检审批
--    参数: factoryId - 工厂ID, batchId - 批次ID
--    返回: boolean
--
-- 4. #getQualityDisposition(factoryId, batchId)
--    获取推荐的质检处置动作
--    参数: factoryId - 工厂ID, batchId - 批次ID
--    返回: String (RELEASE, CONDITIONAL_RELEASE, REWORK, SCRAP, SPECIAL_APPROVAL, HOLD)
--
-- 5. #hasPermission(factoryId, requiredRole)
--    检查角色权限
--    参数: factoryId - 工厂ID, requiredRole - 需要的角色
--    返回: boolean
--
-- =====================================================
