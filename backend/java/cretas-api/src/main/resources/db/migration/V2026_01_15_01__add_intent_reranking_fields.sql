-- ============================================================
-- LLM Reranking 功能支持 - 新增意图配置字段
-- 用于中置信度区间 (0.58-0.85) 的二次确认机制
-- ============================================================

-- 1. 升级 description 字段为 TEXT 类型 (支持更长的描述)
ALTER TABLE ai_intent_configs
MODIFY COLUMN description TEXT COMMENT '意图描述，用于 LLM Reranking 时提供语义理解上下文';

-- 2. 添加示例查询字段 (用于 Few-shot 学习)
ALTER TABLE ai_intent_configs
ADD COLUMN IF NOT EXISTS example_queries JSON COMMENT '示例查询列表，用于 LLM Reranking 时提供 Few-shot 示例';

-- 3. 添加反例字段 (明确不应匹配的表达)
ALTER TABLE ai_intent_configs
ADD COLUMN IF NOT EXISTS negative_examples JSON COMMENT '反例列表，明确不应该匹配到此意图的表达';

-- 4. 为常用意图填充初始示例数据 (高优先级意图)
-- COST_QUERY: 成本查询
UPDATE ai_intent_configs
SET example_queries = '["查看今天的成本", "这周成本多少", "帮我看看成本情况", "成本是多少"]',
    negative_examples = '["分析成本变化原因", "为什么成本上升了"]'
WHERE intent_code = 'COST_QUERY' AND example_queries IS NULL;

-- COST_ANALYSIS: 成本分析
UPDATE ai_intent_configs
SET example_queries = '["分析一下成本", "为什么成本上升了", "成本变化原因", "成本趋势分析"]',
    negative_examples = '["查看成本数据", "成本多少钱"]'
WHERE intent_code = 'COST_ANALYSIS' AND example_queries IS NULL;

-- BATCH_QUERY: 批次查询
UPDATE ai_intent_configs
SET example_queries = '["查看批次信息", "批次详情", "这个批次怎么样", "批次状态是什么"]',
    negative_examples = '["创建新批次", "开始生产", "删除批次"]'
WHERE intent_code = 'BATCH_QUERY' AND example_queries IS NULL;

-- INVENTORY_QUERY: 库存查询
UPDATE ai_intent_configs
SET example_queries = '["看看库存", "库存还有多少", "原料够不够", "库存情况"]',
    negative_examples = '["入库", "出库", "调拨库存"]'
WHERE intent_code = 'INVENTORY_QUERY' AND example_queries IS NULL;

-- MATERIAL_BATCH_QUERY: 原料批次查询
UPDATE ai_intent_configs
SET example_queries = '["查看原料批次", "原材料信息", "物料批次详情", "原料情况"]',
    negative_examples = '["领用原料", "使用物料", "入库原材料"]'
WHERE intent_code = 'MATERIAL_BATCH_QUERY' AND example_queries IS NULL;

-- QUALITY_CHECK_QUERY: 质检查询
UPDATE ai_intent_configs
SET example_queries = '["查看质检记录", "QC结果", "质检情况", "检测报告"]',
    negative_examples = '["做质检", "开始QC", "执行检测"]'
WHERE intent_code = 'QUALITY_CHECK_QUERY' AND example_queries IS NULL;

-- QUALITY_CHECK_EXECUTE: 执行质检
UPDATE ai_intent_configs
SET example_queries = '["做一下质检", "开始QC", "执行检测", "进行质量检查"]',
    negative_examples = '["查看质检记录", "质检结果"]'
WHERE intent_code = 'QUALITY_CHECK_EXECUTE' AND example_queries IS NULL;

-- ALERT_LIST: 告警列表
UPDATE ai_intent_configs
SET example_queries = '["有什么告警", "警报列表", "查看所有告警", "有没有警报"]',
    negative_examples = '["处理告警", "解决警报", "分析告警原因"]'
WHERE intent_code = 'ALERT_LIST' AND example_queries IS NULL;

-- ALERT_RESOLVE: 处理告警
UPDATE ai_intent_configs
SET example_queries = '["处理这个告警", "关闭警报", "解决这个问题", "处置告警"]',
    negative_examples = '["查看告警", "告警列表", "有什么警报"]'
WHERE intent_code = 'ALERT_RESOLVE' AND example_queries IS NULL;

-- EQUIPMENT_LIST: 设备列表
UPDATE ai_intent_configs
SET example_queries = '["查看设备", "设备列表", "有哪些设备", "设备情况"]',
    negative_examples = '["设备故障", "维修设备", "设备告警"]'
WHERE intent_code = 'EQUIPMENT_LIST' AND example_queries IS NULL;

-- CLOCK_IN: 打卡签到
UPDATE ai_intent_configs
SET example_queries = '["打个卡", "签到", "上班打卡", "我要打卡"]',
    negative_examples = '["查看考勤", "考勤记录", "下班打卡"]'
WHERE intent_code = 'CLOCK_IN' AND example_queries IS NULL;

-- CLOCK_OUT: 签退
UPDATE ai_intent_configs
SET example_queries = '["下班打卡", "签退", "下班了", "我要下班"]',
    negative_examples = '["上班打卡", "签到", "考勤记录"]'
WHERE intent_code = 'CLOCK_OUT' AND example_queries IS NULL;

-- ATTENDANCE_STATUS: 考勤状态
UPDATE ai_intent_configs
SET example_queries = '["我打卡了没", "今天出勤了吗", "考勤状态", "签到情况"]',
    negative_examples = '["打卡", "签到", "签退"]'
WHERE intent_code = 'ATTENDANCE_STATUS' AND example_queries IS NULL;

-- REPORT_PRODUCTION: 生产报表
UPDATE ai_intent_configs
SET example_queries = '["今天生产了多少", "产量报告", "生产数据", "产出情况"]',
    negative_examples = '["开始生产", "创建批次", "生产计划"]'
WHERE intent_code = 'REPORT_PRODUCTION' AND example_queries IS NULL;

-- SCALE_LIST_DEVICES: 电子秤列表
UPDATE ai_intent_configs
SET example_queries = '["有哪些电子秤", "秤的列表", "称重设备", "查看电子秤"]',
    negative_examples = '["添加电子秤", "删除秤", "秤读数"]'
WHERE intent_code = 'SCALE_LIST_DEVICES' AND example_queries IS NULL;

-- 5. 添加索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_intent_example_queries
ON ai_intent_configs ((CAST(example_queries AS CHAR(255))));
