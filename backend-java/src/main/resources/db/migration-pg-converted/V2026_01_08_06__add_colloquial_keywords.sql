-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_08_06__add_colloquial_keywords.sql
-- Conversion date: 2026-01-26 18:48:00
-- ============================================

-- 添加口语化关键词，提高生产控制意图识别率
-- 修复问题：用户说"帮我停一下生产线"无法识别为 PROCESSING_BATCH_PAUSE

-- 1. 暂停生产 - 添加口语化表达
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '暂停生产', '生产暂停', '中断生产', '停生产', '停一下生产',
    '停生产线', '生产线停一下', '把生产停了', '停掉生产', '生产暂停一下',
    '暂停一下生产', '先停一下', '停下来', '暂停作业'
)
WHERE intent_code = 'PROCESSING_BATCH_PAUSE';

-- 2. 停止设备 - 添加口语化表达
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '停止设备', '设备停止', '关闭设备', '关设备', '停设备',
    '把设备停了', '设备关一下', '停一下设备', '关掉设备', '设备关闭'
)
WHERE intent_code = 'EQUIPMENT_STOP';

-- 3. 开始生产 - 添加口语化表达
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '开始生产', '生产开始', '启动生产', '开生产', '开始做',
    '开工', '开始干活', '开始作业', '启动生产线', '生产线开始',
    '开始生产线', '把生产开起来', '开始运行'
)
WHERE intent_code = 'PROCESSING_BATCH_START';

-- 4. 恢复生产 - 添加口语化表达
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '恢复生产', '生产恢复', '继续生产', '重新开始', '继续做',
    '恢复作业', '重启生产', '继续干', '接着生产', '把生产恢复'
)
WHERE intent_code = 'PROCESSING_BATCH_RESUME';

-- 5. 完成生产 - 添加口语化表达
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '完成生产', '生产完成', '结束生产', '生产结束', '完工',
    '收工', '做完了', '生产好了', '结束作业', '完成作业'
)
WHERE intent_code = 'PROCESSING_BATCH_COMPLETE';

-- 6. 创建生产批次 - 添加口语化表达
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '创建生产', '新建生产', '开新批次', '新生产批次', '创建批次',
    '建一个批次', '新建批次', '开一个新批次', '创建生产计划', '新生产任务'
)
WHERE intent_code = 'PROCESSING_BATCH_CREATE';

-- 7. 更新生产批次 - 添加口语化表达
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '更新生产', '修改生产', '改生产批次', '更新批次', '修改批次',
    '调整生产', '改一下生产', '修改生产计划', '调整批次', '更新生产任务'
)
WHERE intent_code = 'PROCESSING_BATCH_UPDATE';

-- 8. 查询生产批次 - 添加口语化表达
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '查询生产', '看生产', '生产情况', '查批次', '看批次',
    '生产进度', '生产状态', '查看生产', '生产怎么样', '生产到哪了'
)
WHERE intent_code = 'PROCESSING_BATCH_QUERY';

-- 9. 启动设备 - 添加口语化表达
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '启动设备', '开设备', '打开设备', '设备启动', '开启设备',
    '把设备开起来', '启动机器', '开机器', '设备开一下'
)
WHERE intent_code = 'EQUIPMENT_START';

-- 10. 设备维护 - 添加口语化表达
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '设备维护', '维护设备', '保养设备', '设备保养', '维修设备',
    '检修设备', '设备检修', '保养一下', '维护一下设备'
)
WHERE intent_code = 'EQUIPMENT_MAINTENANCE';
