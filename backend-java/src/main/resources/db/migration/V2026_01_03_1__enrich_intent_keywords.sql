-- =====================================================
-- 意图关键词丰富化迁移脚本
-- 为每个意图增加 5-10 个同义词、口语表达、行业术语
-- 目标: 提升自然语言识别准确率
-- =====================================================

-- =====================================================
-- ANALYSIS 分析类意图 - 关键词丰富
-- =====================================================

-- COST_ANALYSIS 成本分析
UPDATE ai_intent_config
SET keywords = '["成本","费用","预算","开支","分析","cost","花费","支出","经费","成本核算","费用分析","多少钱","花了多少","资金","价格","单价","总价","利润","毛利","耗费","消耗","投入","成本统计","费用统计","成本报告","财务分析","经济分析","核算","算账"]',
    updated_at = NOW()
WHERE intent_name = 'COST_ANALYSIS' AND scope = 'GLOBAL';

-- QUALITY_ANALYSIS 质量分析
UPDATE ai_intent_config
SET keywords = '["质量","合格率","不良率","质检","检验","quality","品质","品控","良品率","次品率","废品率","返工率","一次通过率","检测","抽检","全检","质量报告","品质报告","质量统计","检验结果","合格","不合格","瑕疵","缺陷","异常","问题","质量问题","品质问题"]',
    updated_at = NOW()
WHERE intent_name = 'QUALITY_ANALYSIS' AND scope = 'GLOBAL';

-- PRODUCTION_ANALYSIS 生产分析
UPDATE ai_intent_config
SET keywords = '["产量","产能","效率","生产","统计","production","产出","出货量","完成量","日产量","月产量","年产量","生产效率","产能利用率","OEE","设备效率","人均产量","班产量","生产进度","完成率","达成率","产量统计","生产统计","生产报表","产能分析","效能","绩效"]',
    updated_at = NOW()
WHERE intent_name = 'PRODUCTION_ANALYSIS' AND scope = 'GLOBAL';

-- INVENTORY_ANALYSIS 库存分析
UPDATE ai_intent_config
SET keywords = '["库存","存量","盘点","inventory","仓库","仓储","储存","存货","余量","剩余","积压","周转","周转率","库龄","呆滞","滞销","安全库存","最低库存","库存预警","入库","出库","在库","库存统计","库存报表","物料库存","原料库存","成品库存"]',
    updated_at = NOW()
WHERE intent_name = 'INVENTORY_ANALYSIS' AND scope = 'GLOBAL';

-- TREND_PREDICTION 趋势预测
UPDATE ai_intent_config
SET keywords = '["预测","趋势","预计","展望","forecast","走势","变化趋势","发展趋势","未来","下周","下月","下季度","明天","预判","估计","推算","预估","增长趋势","下降趋势","波动","同比","环比","对比分析","趋势分析","预测分析","智能预测","AI预测"]',
    updated_at = NOW()
WHERE intent_name = 'TREND_PREDICTION' AND scope = 'GLOBAL';

-- =====================================================
-- DATA_OP 数据操作类意图 - 关键词丰富
-- =====================================================

-- BATCH_UPDATE 批次更新
UPDATE ai_intent_config
SET keywords = '["批次","生产批次","批量","更新","修改","调整","改成","改为","update","把","的","batch","批号","编号","改批次","更改","变更","设置为","替换","改一下","帮我改","修改批次","更新批次","批次信息","批次号"]',
    updated_at = NOW()
WHERE intent_name = 'BATCH_UPDATE' AND scope = 'GLOBAL';

-- DATA_CORRECTION 数据修正
UPDATE ai_intent_config
SET keywords = '["修正","纠正","更正","fix","correct","改正","订正","校正","纠错","修错","改错","错误修复","数据修正","信息修正","记录修正","纠偏","矫正","勘误"]',
    updated_at = NOW()
WHERE intent_name = 'DATA_CORRECTION' AND scope = 'GLOBAL';

-- BATCH_DELETE 批量删除
UPDATE ai_intent_config
SET keywords = '["批量删除","清除","移除","delete all","删掉","删除","清空","清理","移走","去掉","全部删除","一键删除","批量清除","批量移除","全部清除","删光","清掉"]',
    updated_at = NOW()
WHERE intent_name = 'BATCH_DELETE' AND scope = 'GLOBAL';

-- PRODUCT_UPDATE 产品更新
UPDATE ai_intent_config
SET keywords = '["产品","修改产品","更新产品","产品信息","改产品","调整产品","product","产品类型","成品","改成品","产品名称","产品规格","产品编码","产品资料","产品数据","编辑产品","更改产品","产品配置"]',
    updated_at = NOW()
WHERE intent_name = 'PRODUCT_UPDATE' AND scope = 'GLOBAL';

-- PLAN_UPDATE 计划更新
UPDATE ai_intent_config
SET keywords = '["计划","修改计划","更新计划","生产计划","改计划","调整计划","计划数量","产量","plan","排产","排程计划","生产安排","计划产量","目标产量","计划调整","修改排产","更改计划","计划编辑","日计划","周计划","月计划"]',
    updated_at = NOW()
WHERE intent_name = 'PLAN_UPDATE' AND scope = 'GLOBAL';

-- MATERIAL_UPDATE 原材料更新
UPDATE ai_intent_config
SET keywords = '["原材料","原料","材料","修改原材料","更新材料","改原材料","material","物料","辅料","配料","改物料","材料信息","原料信息","物料数据","原材料规格","材料编码","编辑原料","更改材料"]',
    updated_at = NOW()
WHERE intent_name = 'MATERIAL_UPDATE' AND scope = 'GLOBAL';

-- STATUS_CHANGE 状态变更
UPDATE ai_intent_config
SET keywords = '["状态","改状态","更新状态","变更状态","完成","取消","暂停","恢复","启动","status","状态调整","状态修改","设为完成","标记完成","标记取消","开始","结束","中止","继续","重启","激活","停用","启用","禁用"]',
    updated_at = NOW()
WHERE intent_name = 'STATUS_CHANGE' AND scope = 'GLOBAL';

-- QUANTITY_ADJUST 数量调整
UPDATE ai_intent_config
SET keywords = '["数量","产量","改数量","调整数量","改产量","调产量","增加","减少","设为","quantity","调整为","改成","加","减","多少","加到","减到","增减","加量","减量","增量","调量","数量修改","产量修改","重量","调整重量"]',
    updated_at = NOW()
WHERE intent_name = 'QUANTITY_ADJUST' AND scope = 'GLOBAL';

-- =====================================================
-- FORM 表单类意图 - 关键词丰富
-- =====================================================

-- FORM_GENERATION 表单生成
UPDATE ai_intent_config
SET keywords = '["表单","添加字段","新增","form","field","创建表单","生成表单","设计表单","字段","属性","增加字段","新建字段","表单字段","输入框","选择框","下拉框","单选","多选","必填","可选","表单设计","字段配置"]',
    updated_at = NOW()
WHERE intent_name = 'FORM_GENERATION' AND scope = 'GLOBAL';

-- FORM_VALIDATION 表单校验
UPDATE ai_intent_config
SET keywords = '["校验","验证","规则","validate","检查","核验","必填验证","格式验证","范围验证","长度验证","正则","表单验证","字段验证","输入验证","数据验证","规则配置","验证规则","校验规则","错误提示","提示信息"]',
    updated_at = NOW()
WHERE intent_name = 'FORM_VALIDATION' AND scope = 'GLOBAL';

-- FORM_SUGGESTION 表单建议
UPDATE ai_intent_config
SET keywords = '["建议","推荐","优化","suggest","改进","提升","完善","智能建议","AI建议","自动填充","智能填充","推荐值","默认值","建议值","优化建议","改进建议","表单优化","字段推荐"]',
    updated_at = NOW()
WHERE intent_name = 'FORM_SUGGESTION' AND scope = 'GLOBAL';

-- =====================================================
-- SCHEDULE 排程类意图 - 关键词丰富
-- =====================================================

-- SCHEDULE_OPTIMIZATION 排程优化
UPDATE ai_intent_config
SET keywords = '["排程","调度","优化","schedule","安排","排产","生产排程","排班","班次","工序安排","顺序调整","优先级","排程优化","调度优化","智能排程","自动排程","排产计划","日程","时间安排","工单排序"]',
    updated_at = NOW()
WHERE intent_name = 'SCHEDULE_OPTIMIZATION' AND scope = 'GLOBAL';

-- RESOURCE_ALLOCATION 资源分配
UPDATE ai_intent_config
SET keywords = '["资源","分配","人员","设备","allocate","调配","派遣","安排人","安排设备","人力","机器","工位","产线","资源调配","人员调配","设备调配","工人分配","机台分配","产能分配","配置资源","指派"]',
    updated_at = NOW()
WHERE intent_name = 'RESOURCE_ALLOCATION' AND scope = 'GLOBAL';

-- CAPACITY_PLANNING 产能规划
UPDATE ai_intent_config
SET keywords = '["产能","规划","容量","capacity","计划产能","产能计算","产能评估","产能分析","生产能力","最大产能","可用产能","产能利用","产能预测","产能管理","负载","负荷","产能规划","长期规划","短期规划"]',
    updated_at = NOW()
WHERE intent_name = 'CAPACITY_PLANNING' AND scope = 'GLOBAL';

-- URGENT_INSERT 紧急插单
UPDATE ai_intent_config
SET keywords = '["紧急","插单","加急","urgent","急单","加塞","优先","特急","火急","赶工","加班","急件","急活","紧急订单","临时插单","临时加单","优先处理","优先生产","插队","加急处理"]',
    updated_at = NOW()
WHERE intent_name = 'URGENT_INSERT' AND scope = 'GLOBAL';

-- =====================================================
-- SYSTEM 系统类意图 - 关键词丰富
-- =====================================================

-- SYSTEM_REPORT 系统报表
UPDATE ai_intent_config
SET keywords = '["报表","汇总","report","summary","统计表","日报","周报","月报","年报","报告","总结","导出","打印","生成报表","查看报表","数据汇总","数据统计","分析报表","统计报告","汇总表","明细表","清单"]',
    updated_at = NOW()
WHERE intent_name = 'SYSTEM_REPORT' AND scope = 'GLOBAL';

-- SYSTEM_CONFIG 系统配置
UPDATE ai_intent_config
SET keywords = '["配置","设置","参数","config","setting","系统设置","系统配置","参数配置","功能设置","选项","开关","启用","禁用","默认设置","初始化","配置项","设置项","偏好设置","高级设置"]',
    updated_at = NOW()
WHERE intent_name = 'SYSTEM_CONFIG' AND scope = 'GLOBAL';

-- USER_QUERY 用户查询
UPDATE ai_intent_config
SET keywords = '["怎么","如何","什么","帮助","help","怎样","哪里","为什么","能不能","可以吗","请问","告诉我","教我","指导","说明","解释","查询","查找","搜索","找","看看","显示","列出","查一下"]',
    updated_at = NOW()
WHERE intent_name = 'USER_QUERY' AND scope = 'GLOBAL';

-- =====================================================
-- 添加关键词统计审计日志
-- =====================================================
INSERT INTO ai_intent_config_changelog (
    config_id,
    change_type,
    field_changed,
    old_value,
    new_value,
    changed_by,
    change_reason,
    created_at
)
SELECT
    id,
    'KEYWORDS_ENRICHED',
    'keywords',
    NULL,
    CONCAT('Keywords enriched at ', NOW()),
    'SYSTEM_MIGRATION',
    '关键词丰富化迁移 V2026_01_03_1 - 每个意图增加5-10个同义词、口语表达、行业术语',
    NOW()
FROM ai_intent_config
WHERE scope = 'GLOBAL';

-- =====================================================
-- 更新版本号标记
-- =====================================================
UPDATE ai_intent_config
SET version = version + 1
WHERE scope = 'GLOBAL';
