-- SmartBI Query Templates table
-- Run on both local and remote PostgreSQL

CREATE TABLE IF NOT EXISTS smart_bi_query_templates (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(32) NOT NULL,
    description VARCHAR(500),
    query_template TEXT NOT NULL,
    parameters TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qt_factory ON smart_bi_query_templates(factory_id);
CREATE INDEX IF NOT EXISTS idx_qt_category ON smart_bi_query_templates(category);

-- Default templates for factory F001
INSERT INTO smart_bi_query_templates (factory_id, name, category, description, query_template, parameters) VALUES
('F001', '销售趋势分析', '销售分析', '按月度/季度展示销售额变化趋势', '分析销售额的月度变化趋势，标注增长和下降的关键月份', '[]'),
('F001', '产品销售排名', '销售分析', '各产品/品类的销售额排名对比', '按产品或品类统计销售额排名，找出TOP5和末位产品', '[]'),
('F001', '区域销售对比', '销售分析', '不同区域的销售业绩对比', '对比各区域的销售业绩，分析区域差异的原因', '[]'),
('F001', '毛利率分析', '财务分析', '各产品/业务线的毛利率对比', '计算并对比各产品线的毛利率，识别高利润和低利润业务', '[]'),
('F001', '费用结构分析', '财务分析', '各项费用的占比和趋势', '分析各项费用（管理费用、销售费用、财务费用）的占比和变化趋势', '[]'),
('F001', '收入利润对比', '财务分析', '收入与利润的变化关系', '对比分析收入和利润的变化趋势，计算利润率变动', '[]'),
('F001', '成本构成分析', '生产分析', '各项成本的占比分布', '分析成本构成，找出占比最大的成本项目和优化空间', '[]'),
('F001', '异常值检测', '生产分析', '检测数据中的异常波动', '检测数据中的异常值和突变点，分析可能的原因', '[]'),
('F001', '同比环比分析', '财务分析', '与去年同期/上期的对比', '进行同比和环比分析，识别增长和下降趋势', '[]'),
('F001', '预算达成分析', '财务分析', '实际值与预算目标的对比', '对比实际业绩与预算目标，计算达成率和差异', '[]'),
('F001', '综合经营分析', '财务分析', '多维度经营指标综合分析', '综合分析收入、成本、利润、费用等关键经营指标，给出经营建议', '[]'),
('F001', '行业对标分析', '财务分析', '与行业平均水平对比', '将关键指标与食品加工行业平均水平对比，评估竞争力和改进方向', '[]')
ON CONFLICT DO NOTHING;
