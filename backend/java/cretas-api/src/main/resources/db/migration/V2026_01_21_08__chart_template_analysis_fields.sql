-- ============================================================================
-- SmartBI 图表模板 AI 分析字段扩展
--
-- 为图表模板添加 AI 分析相关配置字段，支持：
--   - 自定义 AI 分析提示词模板
--   - 控制是否启用 AI 分析功能
--   - 配置 AI 分析结果缓存时间
--
-- @author Cretas Team
-- @version 1.0.0
-- @since 2026-01-21
-- ============================================================================

-- 1. 添加 AI 分析提示词模板字段
-- 用于配置针对特定图表的 AI 分析提示词，支持变量替换
ALTER TABLE smart_bi_chart_templates
ADD COLUMN IF NOT EXISTS analysis_prompt TEXT COMMENT 'AI分析提示词模板';

-- 2. 添加 AI 分析开关字段
-- 控制是否为该图表模板启用 AI 智能分析功能
ALTER TABLE smart_bi_chart_templates
ADD COLUMN IF NOT EXISTS analysis_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用AI分析';

-- 3. 添加 AI 分析缓存时间字段
-- 配置 AI 分析结果的缓存有效期（秒），减少重复调用
ALTER TABLE smart_bi_chart_templates
ADD COLUMN IF NOT EXISTS analysis_cache_ttl INT DEFAULT 300 COMMENT 'AI分析缓存时间(秒)';

-- ============================================================================
-- 为现有模板设置默认的 AI 分析提示词
-- ============================================================================

-- 财务健康度雷达图 (详细版)
UPDATE smart_bi_chart_templates
SET analysis_prompt = '你是一位专业的财务分析师。请根据以下企业财务健康度雷达图数据进行分析：

**数据：**
{{dataJson}}

**分析要求：**
1. 给出综合评分（百分制）和评级（优秀/良好/一般/较差）
2. 分析五个维度：盈利能力、流动性、偿债能力、成长能力、运营效率
3. 指出最强和最弱的维度
4. 与行业平均水平对比（如有）
5. 给出2-3条具体改进建议

**输出格式：**
以简洁的要点形式输出，适合在图表下方展示。'
WHERE template_code = 'finance_health_radar' AND analysis_prompt IS NULL;

-- 杜邦分析图 (详细版)
UPDATE smart_bi_chart_templates
SET analysis_prompt = '你是一位专业的财务分析师。请根据以下杜邦分析数据进行ROE分解分析：

**数据：**
{{dataJson}}

**杜邦公式：** ROE = 净利率 × 资产周转率 × 权益乘数

**分析要求：**
1. 计算并验证 ROE 值
2. 识别 ROE 的主要驱动因素
3. 与上期/去年同期对比变化
4. 分析每个因子的贡献度
5. 给出提升 ROE 的具体建议

**输出格式：**
以简洁的要点形式输出，包含公式验证和因子分析。'
WHERE template_code = 'dupont_analysis' AND analysis_prompt IS NULL;

-- 现金流量瀑布图 (详细版)
UPDATE smart_bi_chart_templates
SET analysis_prompt = '你是一位专业的财务分析师。请根据以下现金流量数据进行分析：

**数据：**
{{dataJson}}

**分析要求：**
1. 总结现金净变化情况
2. 分析三大活动（经营/投资/融资）的贡献
3. 评估经营现金流健康度
4. 识别异常或需关注的项目
5. 给出现金流管理建议

**输出格式：**
以简洁的要点形式输出，突出关键数字和趋势。'
WHERE template_code = 'cashflow_waterfall' AND analysis_prompt IS NULL;

-- 盈亏平衡分析图 (详细版)
UPDATE smart_bi_chart_templates
SET analysis_prompt = '你是一位专业的财务分析师。请根据以下CVP（成本-量-利）分析数据：

**数据：**
{{dataJson}}

**分析要求：**
1. 计算盈亏平衡点（销量和销售额）
2. 计算安全边际和安全边际率
3. 分析边际贡献率
4. 评估经营杠杆
5. 给出定价或成本控制建议

**输出格式：**
以简洁的要点形式输出，包含关键指标计算结果。'
WHERE template_code = 'breakeven_analysis' AND analysis_prompt IS NULL;

-- 成本结构分析图 (详细版)
UPDATE smart_bi_chart_templates
SET analysis_prompt = '你是一位专业的财务分析师。请根据以下成本结构数据进行分析：

**数据：**
{{dataJson}}

**分析要求：**
1. 识别主要成本项及占比
2. 分析成本结构是否合理
3. 与行业标准对比（如有）
4. 识别成本优化空间
5. 给出具体的降本建议

**输出格式：**
以简洁的要点形式输出，突出成本占比和优化方向。'
WHERE template_code = 'cost_structure_pie' AND analysis_prompt IS NULL;

-- 财务比率趋势图 (详细版)
UPDATE smart_bi_chart_templates
SET analysis_prompt = '你是一位专业的财务分析师。请根据以下财务比率趋势数据进行分析：

**数据：**
{{dataJson}}

**分析要求：**
1. 描述各指标的趋势（上升/下降/稳定）
2. 识别关键拐点及原因
3. 分析指标间的关联性
4. 预测未来趋势
5. 给出风险提示和建议

**输出格式：**
以简洁的要点形式输出，突出趋势变化和预测。'
WHERE template_code = 'finance_ratio_trend' AND analysis_prompt IS NULL;

-- 周转率对比分析 (详细版)
UPDATE smart_bi_chart_templates
SET analysis_prompt = '你是一位专业的财务分析师。请根据以下周转率数据进行分析：

**数据：**
{{dataJson}}

**分析要求：**
1. 分析各周转率的表现
2. 与上期和行业平均对比
3. 计算现金周转周期
4. 识别运营效率瓶颈
5. 给出提升周转效率的建议

**输出格式：**
以表格形式展示对比，加上简洁的分析结论。'
WHERE template_code = 'turnover_comparison' AND analysis_prompt IS NULL;

-- KPI 仪表盘 (详细版)
UPDATE smart_bi_chart_templates
SET analysis_prompt = '你是一位专业的业务分析师。请根据以下KPI达成情况进行分析：

**数据：**
{{dataJson}}

**分析要求：**
1. 评估总体目标达成进度
2. 分析各项KPI的完成情况
3. 识别完成率最高和最低的指标
4. 预测年度目标完成概率
5. 给出追赶目标的具体行动建议

**输出格式：**
以简洁的要点形式输出，使用表情符号标记状态（🟢完成/🟡进行中/🔴落后）。'
WHERE template_code = 'kpi_gauge' AND analysis_prompt IS NULL;

-- ============================================================================
-- 日志记录
-- ============================================================================
SELECT CONCAT('V2026_01_21_08: AI分析字段添加完成，已更新 ',
    (SELECT COUNT(*) FROM smart_bi_chart_templates WHERE analysis_prompt IS NOT NULL),
    ' 条模板的默认提示词') AS migration_info;
