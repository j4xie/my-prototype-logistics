-- Test Data for AI Tool E2E Validation
-- Generates data for all empty tables that AI tools depend on
-- Idempotent: safe to run multiple times
-- Factory: F001

BEGIN;

-- ============================================================
-- 1. TIME_CLOCK_RECORDS — 9 HR attendance tools
-- ============================================================

INSERT INTO time_clock_records (id, factory_id, user_id, clock_date, clock_in_time, clock_out_time, status, attendance_status, work_duration, device, location, created_at, updated_at)
SELECT
    nextval('time_clock_records_id_seq'),
    'F001',
    u.uid,
    d.dt::date,
    d.dt + (CASE
        WHEN random() < 0.15 THEN interval '9 hours 15 minutes'
        ELSE interval '8 hours' + (random() * interval '30 minutes')
    END),
    CASE
        WHEN random() < 0.08 THEN NULL
        ELSE d.dt + interval '17 hours' + (random() * interval '1 hour')
    END,
    CASE WHEN random() < 0.08 THEN 'INCOMPLETE' ELSE 'COMPLETE' END,
    CASE
        WHEN random() < 0.15 THEN 'LATE'
        WHEN random() < 0.05 THEN 'EARLY_LEAVE'
        ELSE 'NORMAL'
    END,
    CASE WHEN random() < 0.08 THEN NULL ELSE (480 + floor(random() * 60))::int END,
    'Mobile App',
    '工厂车间',
    NOW(),
    NOW()
FROM
    (SELECT unnest(ARRAY[1,2,3,4,5]) AS uid) u,
    generate_series(CURRENT_DATE - interval '13 days', CURRENT_DATE, interval '1 day') AS d(dt)
WHERE extract(dow from d.dt) NOT IN (0, 6)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. WORK_ORDERS — TodoListTool
-- ============================================================

INSERT INTO work_orders (id, factory_id, title, description, status, priority, order_type, order_number, assigned_to, created_by, planned_start_time, planned_end_time, progress, created_at, updated_at)
VALUES
    (gen_random_uuid()::text, 'F001', '检查冷库温度异常', '3号冷库温度偏高需排查', 'PENDING', 'HIGH', 'MAINTENANCE', 'WO-20260401-001', 3, 1, NOW()-interval '1 day', NOW()+interval '1 day', 0, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', '原料验收-虾仁批次', '到货500kg虾仁需验收入库', 'IN_PROGRESS', 'HIGH', 'RECEIVING', 'WO-20260401-002', 5, 1, NOW()-interval '2 hours', NOW()+interval '4 hours', 30, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', '设备保养-切片机A3', '季度保养计划', 'PENDING', 'MEDIUM', 'MAINTENANCE', 'WO-20260401-003', 7, 3, NOW()+interval '1 day', NOW()+interval '2 days', 0, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', '质检报告整理-3月', '汇总3月所有质检数据', 'IN_PROGRESS', 'MEDIUM', 'QUALITY', 'WO-20260331-001', 4, 1, NOW()-interval '3 days', NOW()-interval '1 day', 60, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', '车间卫生大检查', '月末卫生标准检查', 'COMPLETED', 'LOW', 'INSPECTION', 'WO-20260330-001', 6, 3, NOW()-interval '5 days', NOW()-interval '3 days', 100, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', '新员工培训-食品安全', '4月新入职员工安全培训', 'PENDING', 'MEDIUM', 'TRAINING', 'WO-20260402-001', 3, 1, NOW()+interval '3 days', NOW()+interval '4 days', 0, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', '采购订单跟催-鳕鱼', '鳕鱼供应商延迟交货', 'IN_PROGRESS', 'HIGH', 'PROCUREMENT', 'WO-20260328-001', 8, 1, NOW()-interval '5 days', NOW()-interval '2 days', 40, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', '库存盘点-成品仓', '月度成品库存盘点', 'IN_PROGRESS', 'HIGH', 'INVENTORY', 'WO-20260401-004', 9, 1, NOW()-interval '1 day', NOW(), 70, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', '客诉处理-永辉超市', '产品外观投诉需回复', 'PENDING', 'HIGH', 'COMPLAINT', 'WO-20260402-003', 2, 1, NOW(), NOW()+interval '2 days', 0, NOW(), NOW());

-- ============================================================
-- 3. LABELS — TraceGenerateTool
-- ============================================================

INSERT INTO labels (id, factory_id, label_code, trace_code, batch_id, production_batch_id, product_name, label_type, batch_type, status, print_count, production_date, shelf_life_days, created_by, created_at, updated_at)
VALUES
    (gen_random_uuid()::text, 'F001', 'LBL-20260401-001', 'TC-F001-20260401-00001', 'MB-F001-202501-001', 2, '冰鲜大黄鱼500g', 'PRODUCT', 'PRODUCTION', 'PRINTED', 1, NOW()-interval '1 day', 7, 1, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'LBL-20260401-002', 'TC-F001-20260401-00002', 'MB-F001-202501-002', 4, '去骨鳕鱼片300g', 'PRODUCT', 'PRODUCTION', 'PRINTED', 2, NOW()-interval '2 days', 14, 1, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'LBL-20260401-003', 'TC-F001-20260401-00003', NULL, 11, '虾仁即食装200g', 'PRODUCT', 'PRODUCTION', 'PENDING', 0, NOW(), 30, 1, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'LBL-20260401-004', 'TC-F001-20260401-00004', 'MB-F001-202502-001', 12, '三文鱼刺身切片', 'PRODUCT', 'PRODUCTION', 'PRINTED', 1, NOW()-interval '3 days', 3, 1, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'LBL-20260401-005', 'TC-F001-20260401-00005', NULL, 13, '调味虾滑500g', 'PRODUCT', 'PRODUCTION', 'PENDING', 0, NOW(), 60, 1, NOW(), NOW());

-- ============================================================
-- 4. PROCESSING_STAGE_RECORDS — ProcessingStepQueryTool
-- ============================================================

INSERT INTO processing_stage_records (id, factory_id, production_batch_id, stage_name, stage_type, stage_order, start_time, end_time, duration_minutes, operator_id, operator_name, input_weight, output_weight, loss_weight, loss_rate, pass_count, fail_count, pass_rate, product_temperature, notes, created_at, updated_at)
VALUES
    (nextval('processing_stage_records_id_seq'), 'F001', 2, '原料验收', 'RECEIVING', 1, NOW()-interval '3 days', NOW()-interval '3 days'+interval '90 min', 90, 5, '质检员小王', 500.0, 498.0, 2.0, 0.4, 98, 2, 98.0, 2.5, '正常', NOW(), NOW()),
    (nextval('processing_stage_records_id_seq'), 'F001', 2, '解冻处理', 'THAWING', 2, NOW()-interval '3 days'+interval '2 hours', NOW()-interval '3 days'+interval '3.5 hours', 90, 6, '操作工老张', 498.0, 490.0, 8.0, 1.6, 96, 4, 96.0, 4.0, '正常', NOW(), NOW()),
    (nextval('processing_stage_records_id_seq'), 'F001', 2, '切片加工', 'CUTTING', 3, NOW()-interval '3 days'+interval '4 hours', NOW()-interval '3 days'+interval '5.5 hours', 90, 7, '操作工小李', 490.0, 475.0, 15.0, 3.1, 95, 5, 95.0, 3.0, '正常', NOW(), NOW()),
    (nextval('processing_stage_records_id_seq'), 'F001', 2, '包装封装', 'PACKAGING', 4, NOW()-interval '3 days'+interval '6 hours', NOW()-interval '3 days'+interval '7.5 hours', 90, 8, '包装工小陈', 475.0, 470.0, 5.0, 1.1, 97, 3, 97.0, -1.0, '正常', NOW(), NOW()),
    (nextval('processing_stage_records_id_seq'), 'F001', 4, '原料验收', 'RECEIVING', 1, NOW()-interval '2 days', NOW()-interval '2 days'+interval '60 min', 60, 5, '质检员小王', 300.0, 298.0, 2.0, 0.7, 99, 1, 99.0, 1.5, '正常', NOW(), NOW()),
    (nextval('processing_stage_records_id_seq'), 'F001', 4, '去骨处理', 'DEBONING', 2, NOW()-interval '2 days'+interval '2 hours', NOW()-interval '2 days'+interval '4 hours', 120, 6, '操作工老张', 298.0, 260.0, 38.0, 12.8, 90, 10, 90.0, 3.5, '损耗率偏高', NOW(), NOW()),
    (nextval('processing_stage_records_id_seq'), 'F001', 4, '速冻', 'FREEZING', 3, NOW()-interval '2 days'+interval '5 hours', NOW()-interval '2 days'+interval '8 hours', 180, 9, '操作工小赵', 260.0, 258.0, 2.0, 0.8, 100, 0, 100.0, -18.0, '正常', NOW(), NOW()),
    (nextval('processing_stage_records_id_seq'), 'F001', 11, '原料验收', 'RECEIVING', 1, NOW()-interval '1 day', NOW()-interval '1 day'+interval '45 min', 45, 5, '质检员小王', 200.0, 199.0, 1.0, 0.5, 99, 1, 99.0, 2.0, '正常', NOW(), NOW()),
    (nextval('processing_stage_records_id_seq'), 'F001', 11, '蒸煮加工', 'COOKING', 2, NOW()-interval '1 day'+interval '2 hours', NOW()-interval '1 day'+interval '3.5 hours', 90, 7, '操作工小李', 199.0, 180.0, 19.0, 9.5, NULL, NULL, NULL, 85.0, '蒸煮温度正常', NOW(), NOW()),
    (nextval('processing_stage_records_id_seq'), 'F001', 11, '调味混合', 'SEASONING', 3, NOW()-interval '1 day'+interval '4 hours', NOW()-interval '1 day'+interval '5 hours', 60, 6, '操作工老张', 180.0, 195.0, -15.0, -8.3, NULL, NULL, NULL, 25.0, '添加调味料增重', NOW(), NOW());

-- ============================================================
-- 5. INVOICE_RECORDS — Finance tools
-- ============================================================

INSERT INTO invoice_records (id, factory_id, invoice_number, sales_order_id, customer_id, customer_name, amount, tax_amount, total_amount, invoice_type, status, requested_by, requested_at, reviewed_by, reviewed_at, review_notes, issued_at, remark, created_at, updated_at)
VALUES
    (gen_random_uuid()::text, 'F001', 'INV-20260401-0001', 'SO-F001-202501-001', 'CUS-F001-001', '上海盒马鲜生', 15000.00, 1950.00, 16950.00, 'SPECIAL', 'ISSUED', 2, NOW()-interval '5 days', 1, NOW()-interval '4 days', '金额核实无误', NOW()-interval '3 days', NULL, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'INV-20260401-0002', 'SO-F001-202501-002', 'CUS-F001-002', '永辉超市华东区', 28000.00, 3640.00, 31640.00, 'SPECIAL', 'APPROVED', 2, NOW()-interval '3 days', 1, NOW()-interval '2 days', '审核通过', NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'INV-20260401-0003', 'SO-F001-202501-003', 'CUS-F001-001', '上海盒马鲜生', 8500.00, 1105.00, 9605.00, 'NORMAL', 'REQUESTED', 2, NOW()-interval '1 day', NULL, NULL, NULL, NULL, '3月追加订单发票', NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'INV-20260401-0004', 'SO-F001-202501-004', 'CUS-F001-002', '永辉超市华东区', 12000.00, 1560.00, 13560.00, 'NORMAL', 'REQUESTED', 8, NOW(), NULL, NULL, NULL, NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'INV-20260330-0001', 'SO-F001-202502-001', 'CUS-F001-001', '上海盒马鲜生', 5000.00, 650.00, 5650.00, 'NORMAL', 'CANCELLED', 2, NOW()-interval '7 days', 1, NOW()-interval '6 days', '客户取消订单', NULL, '已退货', NOW(), NOW());

-- ============================================================
-- 6. PAYMENT_RECORDS — Finance tools
-- ============================================================

INSERT INTO payment_records (id, factory_id, payment_number, sales_order_id, customer_id, customer_name, amount, payment_method, payment_date, payment_reference, status, recorded_by, verified_by, verified_at, remark, created_at, updated_at)
VALUES
    (gen_random_uuid()::text, 'F001', 'PAY-20260401-0001', 'SO-F001-202501-001', 'CUS-F001-001', '上海盒马鲜生', 16950.00, 'BANK_TRANSFER', CURRENT_DATE-2, 'TRF-2026040100123', 'VERIFIED', 2, 1, NOW()-interval '1 day', '银行到账确认', NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'PAY-20260401-0002', 'SO-F001-202501-002', 'CUS-F001-002', '永辉超市华东区', 20000.00, 'BANK_TRANSFER', CURRENT_DATE-1, 'TRF-2026040100456', 'VERIFIED', 8, 1, NOW()-interval '12 hours', '首期款', NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'PAY-20260402-0001', 'SO-F001-202501-002', 'CUS-F001-002', '永辉超市华东区', 11640.00, 'BANK_TRANSFER', CURRENT_DATE, 'TRF-2026040200789', 'PENDING', 8, NULL, NULL, '尾款', NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'PAY-20260402-0002', 'SO-F001-202501-003', 'CUS-F001-001', '上海盒马鲜生', 9605.00, 'CHECK', CURRENT_DATE, 'CHK-20260402-001', 'PENDING', 2, NULL, NULL, '支票收款', NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'PAY-20260330-0001', 'SO-F001-202501-004', 'CUS-F001-002', '永辉超市华东区', 5000.00, 'CASH', CURRENT_DATE-5, NULL, 'REJECTED', 8, 1, NOW()-interval '4 days', '金额不符退回重录', NOW(), NOW());

-- ============================================================
-- 7. RD_REQUESTS — R&D tools
-- ============================================================

INSERT INTO rd_requests (id, factory_id, request_number, customer_name, customer_contact, requirements, urgency, assigned_to, status, submitted_by, submitted_at, completed_at, remark, created_at, updated_at)
VALUES
    (gen_random_uuid()::text, 'F001', 'RD-REQ-20260401-0001', '上海盒马鲜生', '李经理 13900001111', '开发即食麻辣小龙虾200g袋装，要求常温保存6个月', 'HIGH', 3, 'IN_PROGRESS', 2, NOW()-interval '5 days', NULL, '盒马新品项目', NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'RD-REQ-20260401-0002', '永辉超市华东区', '张采购 13900002222', '调味鳕鱼片150g蒜香和黑椒两种口味', 'MEDIUM', 3, 'ASSIGNED', 8, NOW()-interval '3 days', NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'RD-REQ-20260330-0001', '宁波大润发', '王总 13900003333', '速冻虾饺500g家庭装', 'LOW', 3, 'COMPLETED', 2, NOW()-interval '15 days', NOW()-interval '2 days', '已完成样品制作', NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'RD-REQ-20260402-0001', '杭州联华超市', '赵经理 13900004444', '低盐健康鱼丸系列100g/200g/500g', 'HIGH', NULL, 'SUBMITTED', 8, NOW(), NULL, '健康食品新趋势', NOW(), NOW());

-- ============================================================
-- 8. QUOTATION_TASKS — R&D tools
-- ============================================================

INSERT INTO quotation_tasks (id, factory_id, task_number, sample_id, product_type_id, assigned_to, status, material_cost, labor_cost, overhead_cost, total_cost, suggested_price, final_price, profit_margin, quoted_by, quoted_at, remark, created_at, updated_at)
VALUES
    (gen_random_uuid()::text, 'F001', 'QT-20260401-0001', '4ea76134-dfdc-4182-a45d-0cdfb5d86db8', 'PT-F001-001', 8, 'QUOTED', 12.50, 3.00, 2.50, 18.00, 28.00, NULL, 35.7, 8, NOW()-interval '1 day', '参考同类产品定价', NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'QT-20260401-0002', '3ae0d9f5-529c-42f8-a7d4-85e8c6b55e31', 'PT-F001-002', 8, 'CONFIRMED', 8.00, 2.00, 1.50, 11.50, 18.00, 16.80, 31.5, 8, NOW()-interval '3 days', '客户议价后确认', NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', 'QT-20260402-0001', '96bcf301-e0b6-408c-bb6b-5a5115d37a3c', 'PT-F001-003', NULL, 'PENDING', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '待分配报价人员', NOW(), NOW());

-- ============================================================
-- 9. APPROVAL_CHAIN_CONFIGS — ApprovalConfigTool
-- ============================================================

INSERT INTO approval_chain_configs (id, factory_id, name, decision_type, approval_level, required_approvers, approver_roles, enabled, priority, description, timeout_minutes, created_at, updated_at)
VALUES
    (gen_random_uuid()::text, 'F001', '采购订单审批链', 'CUSTOM', 1, 1, '["factory_super_admin","procurement_manager"]', true, 10, '采购金额>5000需审批', 1440, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', '生产计划变更审批', 'PRODUCTION_PLAN_CHANGE', 1, 1, '["factory_super_admin","production_manager"]', true, 20, '排产计划变更需审批', 720, NOW(), NOW()),
    (gen_random_uuid()::text, 'F001', '质检异常处置审批', 'QUALITY_DISPOSITION', 1, 2, '["quality_manager","factory_super_admin"]', true, 30, '质检不合格品处置需双人审批', 480, NOW(), NOW());

-- ============================================================
-- 10. WORKER_ASSIGNMENTS — WorkerRealtimeCountTool
-- ============================================================

INSERT INTO worker_assignments (id, user_id, status, assigned_at, actual_start_time, is_temporary, performance_score)
VALUES
    (gen_random_uuid()::text, 3, 'CHECKED_IN', NOW()-interval '2 hours', NOW()-interval '1.5 hours', false, 85),
    (gen_random_uuid()::text, 5, 'CHECKED_IN', NOW()-interval '3 hours', NOW()-interval '2.5 hours', false, 90),
    (gen_random_uuid()::text, 6, 'CHECKED_IN', NOW()-interval '1 hour', NOW()-interval '45 minutes', false, NULL),
    (gen_random_uuid()::text, 7, 'ASSIGNED', NOW()-interval '30 minutes', NULL, false, NULL),
    (gen_random_uuid()::text, 8, 'CHECKED_IN', NOW()-interval '4 hours', NOW()-interval '3.5 hours', true, 78),
    (gen_random_uuid()::text, 9, 'COMPLETED', NOW()-interval '8 hours', NOW()-interval '7 hours', false, 92),
    (gen_random_uuid()::text, 10, 'CHECKED_IN', NOW()-interval '2 hours', NOW()-interval '1.5 hours', false, 88);

COMMIT;

-- ============================================================
-- VERIFY: Show all table counts
-- ============================================================
SELECT 'time_clock_records' AS tbl, count(*) AS cnt FROM time_clock_records
UNION ALL SELECT 'work_orders', count(*) FROM work_orders
UNION ALL SELECT 'labels', count(*) FROM labels
UNION ALL SELECT 'processing_stage_records', count(*) FROM processing_stage_records
UNION ALL SELECT 'invoice_records', count(*) FROM invoice_records
UNION ALL SELECT 'payment_records', count(*) FROM payment_records
UNION ALL SELECT 'rd_requests', count(*) FROM rd_requests
UNION ALL SELECT 'quotation_tasks', count(*) FROM quotation_tasks
UNION ALL SELECT 'approval_chain_configs', count(*) FROM approval_chain_configs
UNION ALL SELECT 'worker_assignments', count(*) FROM worker_assignments
ORDER BY 1;
