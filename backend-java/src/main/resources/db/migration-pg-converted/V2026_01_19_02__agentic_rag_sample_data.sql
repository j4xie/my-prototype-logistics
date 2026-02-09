-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_19_02__agentic_rag_sample_data.sql
-- Conversion date: 2026-01-26 18:48:48
-- ============================================

-- ====================================================================
-- Agentic RAG 系统示例数据
-- 版本: v7.0
-- 创建日期: 2026-01-19
-- 描述: 插入行业知识、测试数据
-- ====================================================================

-- ====================================================================
-- 1. 插入行业知识条目 (食品行业)
-- ====================================================================
INSERT INTO industry_knowledge_entry (id, topic_code, topic_name, knowledge_content, source_type, is_active, version) VALUES

-- 产品状态知识
('ik-product-001', 'PRODUCT_STATUS', '产品状态分析',
'食品生产行业关键指标：
- 良品率：行业标准 ≥95%，优秀 ≥98%，低于90%需要立即改进
- 库存周转：建议 7-14 天，超过21天需要关注
- 质检合格率：法规要求 100%，实际生产中 ≥98% 为合格
- 保质期预警：建议提前 30% 时间预警
- 产能利用率：正常范围 70-90%，低于60%需要优化排产',
'SYSTEM', TRUE, 1),

-- 质检分析知识
('ik-quality-001', 'QUALITY_ANALYSIS', '质检分析要点',
'质检分析要点：
- 微生物指标：大肠杆菌 ≤ 10 CFU/g，沙门氏菌不得检出，菌落总数 ≤ 10000 CFU/g
- 理化指标：水分 ≤ 14%，灰分 ≤ 5%，重金属(铅) ≤ 0.5 mg/kg
- 感官指标：色泽均匀，无异味，口感正常，无杂质
- 检测频率：每批次必检，关键控制点增加抽检频率
- 质量等级：A级(≥98%)、B级(95-98%)、C级(90-95%)、D级(<90%不合格)',
'SYSTEM', TRUE, 1),

-- 库存管理知识
('ik-inventory-001', 'INVENTORY_STATUS', '库存管理标准',
'库存管理要点：
- 先进先出原则：严格执行 FIFO，确保先入库的先出库
- 安全库存：维持 3-5 天用量，关键原料需要 7 天
- 周转率监控：月周转率 ≥ 2 次为健康，< 1 次需要优化
- 临期预警：保质期剩余 30% 时黄色预警，剩余 10% 红色预警
- 存储条件：常温 15-25°C，冷藏 2-8°C，冷冻 -18°C 以下
- 库存准确率：目标 ≥ 99%，每月盘点一次',
'SYSTEM', TRUE, 1),

-- 出货管理知识
('ik-shipment-001', 'SHIPMENT_STATUS', '出货管理标准',
'出货管理要点：
- 准时交付率：目标 ≥ 98%，低于95%需要改进物流
- 订单完成周期：标准 24-48 小时，紧急订单 12 小时内
- 包装完好率：要求 100%，破损率 > 0.1% 需要改进包装
- 温控要求：冷链产品全程 2-8°C，偏差 ≤ 2°C
- 装车顺序：按照配送路线逆序装载
- 单据完整性：出库单、质检报告、温控记录缺一不可',
'SYSTEM', TRUE, 1),

-- 人员管理知识
('ik-personnel-001', 'PERSONNEL_ANALYSIS', '人员管理标准',
'人员管理要点：
- 出勤率：目标 ≥ 95%，低于90%影响产能
- 培训覆盖：新员工 100% 培训，老员工年度复训
- 技能认证：关键岗位必须持证上岗（食品安全管理员、叉车证等）
- 健康检查：每年至少一次，传染病携带者不得从事生产
- 工作效率：人均产出应达到标准工时的 85% 以上
- 安全记录：工伤事故率 < 0.1%',
'SYSTEM', TRUE, 1),

-- 整体业务知识
('ik-business-001', 'OVERALL_BUSINESS', '整体业务分析',
'整体业务分析要点：
- 综合效率 OEE：目标 ≥ 85%，计算公式 = 可用率 × 性能率 × 良品率
- 成本控制：原料损耗率 ≤ 2%，能耗成本占比 ≤ 5%
- 客户满意度：目标 ≥ 90%，投诉率 < 0.5%
- 环保合规：废弃物处理 100% 合规，污水排放达标
- 食品安全：HACCP 体系有效运行，无重大食品安全事故
- 追溯能力：从原料到成品全程可追溯，追溯时间 < 4 小时',
'SYSTEM', TRUE, 1),

-- 通用知识
('ik-general-001', 'GENERAL', '通用食品行业知识',
'食品行业通用知识：
- 法规要求：符合 GB 国标、SC 生产许可要求
- 追溯系统：全程可追溯，记录保存至少 2 年
- 标签要求：生产日期、保质期、配料表、营养成分必须标注
- 储存要求：分区存放，生熟分开，防止交叉污染
- 清洁消毒：每日清洁，每周深度消毒，记录完整
- 虫害控制：定期灭虫，设置挡鼠板、灭蝇灯',
'SYSTEM', TRUE, 1)

ON DUPLICATE KEY UPDATE
    knowledge_content = VALUES(knowledge_content),
    updated_at = CURRENT_TIMESTAMP;

-- ====================================================================
-- 2. 插入一些示例反馈数据 (用于测试知识库自学习)
-- ====================================================================
INSERT INTO knowledge_feedback (id, session_id, user_query, ai_response, feedback_type, created_at, processed) VALUES
('fb-sample-001', 'session-demo-001', '良品率多少算合格', '行业标准良品率≥95%为合格，≥98%为优秀', 'POSITIVE', NOW() - INTERVAL 1 DAY, FALSE),
('fb-sample-002', 'session-demo-002', '库存周转天数怎么算', '库存周转天数 = 平均库存 / 日均销量', 'POSITIVE', NOW() - INTERVAL 2 DAY, FALSE),
('fb-sample-003', 'session-demo-003', '质检不合格怎么处理', '质检不合格产品应隔离、评审、处置（返工/降级/报废）', 'POSITIVE', NOW() - INTERVAL 3 DAY, FALSE)
ON DUPLICATE KEY UPDATE session_id = VALUES(session_id);

-- ====================================================================
-- 3. 插入检索质量日志示例数据
-- ====================================================================
INSERT INTO retrieval_quality_log (id, factory_id, query, retrieval_score, quality_grade, fallback_triggered, result_count, latency_ms, created_at) VALUES
('rql-sample-001', 'F001', '产品状态怎么样', 0.8500, 'CORRECT', FALSE, 3, 120, NOW() - INTERVAL 1 HOUR),
('rql-sample-002', 'F001', '库存情况如何', 0.7200, 'AMBIGUOUS', FALSE, 2, 150, NOW() - INTERVAL 2 HOUR),
('rql-sample-003', 'F001', '质检标准是什么', 0.9100, 'CORRECT', FALSE, 5, 100, NOW() - INTERVAL 3 HOUR)
ON DUPLICATE KEY UPDATE retrieval_score = VALUES(retrieval_score);

-- ====================================================================
-- 4. 插入分析路由日志示例数据
-- ====================================================================
INSERT INTO analysis_routing_log (id, factory_id, user_input, analysis_topic, complexity_score, processing_mode, is_analysis_request, routing_latency_ms, created_at) VALUES
('arl-sample-001', 'F001', '查询今天库存', 'INVENTORY_STATUS', 0.3000, 'FAST', FALSE, 15, NOW() - INTERVAL 1 HOUR),
('arl-sample-002', 'F001', '分析本月质检趋势', 'QUALITY_ANALYSIS', 0.6500, 'MULTI_AGENT', TRUE, 25, NOW() - INTERVAL 2 HOUR),
('arl-sample-003', 'F001', '对比本周和上周销售并给出改进建议', 'OVERALL_BUSINESS', 0.8500, 'DEEP_REASONING', TRUE, 35, NOW() - INTERVAL 3 HOUR)
ON DUPLICATE KEY UPDATE complexity_score = VALUES(complexity_score);

-- ====================================================================
-- 5. 验证数据插入
-- ====================================================================
-- SELECT 'industry_knowledge_entry' as table_name, COUNT(*) as count FROM industry_knowledge_entry
-- UNION ALL
-- SELECT 'knowledge_feedback', COUNT(*) FROM knowledge_feedback
-- UNION ALL
-- SELECT 'retrieval_quality_log', COUNT(*) FROM retrieval_quality_log
-- UNION ALL
-- SELECT 'analysis_routing_log', COUNT(*) FROM analysis_routing_log;
