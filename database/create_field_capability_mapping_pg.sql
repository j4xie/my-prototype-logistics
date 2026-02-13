-- =====================================================
-- Field Capability Mapping & Data Completeness for PostgreSQL
-- Creates: field_capability_mapping, factory_field_visibility,
--          data_completeness_snapshots
-- Alters: factories (add survey_company_id)
-- Includes seed data for field_capability_mapping
-- =====================================================

-- 1. field_capability_mapping - Maps survey fields to entity fields
--    Links factory capability survey responses to the data model,
--    enabling dynamic form generation and analysis dimension discovery.
CREATE TABLE IF NOT EXISTS field_capability_mapping (
    id SERIAL PRIMARY KEY,
    survey_section VARCHAR(50) NOT NULL,
    survey_row_index INTEGER NOT NULL,
    survey_field_name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_field VARCHAR(100) NOT NULL,
    form_schema_key VARCHAR(100),
    analysis_dimension VARCHAR(100),
    is_required_for_entity BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Each survey row maps to exactly one entity field
DO $$ BEGIN
    ALTER TABLE field_capability_mapping
        ADD CONSTRAINT uk_field_mapping_survey_row
        UNIQUE (survey_section, survey_row_index);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_field_mapping_entity ON field_capability_mapping(entity_type);
CREATE INDEX IF NOT EXISTS idx_field_mapping_dimension ON field_capability_mapping(analysis_dimension);


-- 2. factory_field_visibility - Cached per-factory field visibility
--    Computed from survey responses; tells the frontend which fields
--    to hide for a given factory and entity type.
CREATE TABLE IF NOT EXISTS factory_field_visibility (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    hidden_fields JSONB DEFAULT '[]',
    last_computed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
    ALTER TABLE factory_field_visibility
        ADD CONSTRAINT uk_field_visibility_factory_entity
        UNIQUE (factory_id, entity_type);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_field_visibility_factory ON factory_field_visibility(factory_id);


-- 3. data_completeness_snapshots - Daily snapshots of data completeness
--    Used by the analytics dashboard to show data quality trends
--    and identify which fields need more attention.
CREATE TABLE IF NOT EXISTS data_completeness_snapshots (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    snapshot_date DATE NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    total_records INTEGER DEFAULT 0,
    field_completeness JSONB DEFAULT '{}',
    overall_completeness DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
    ALTER TABLE data_completeness_snapshots
        ADD CONSTRAINT uk_completeness_factory_date_entity
        UNIQUE (factory_id, snapshot_date, entity_type);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_completeness_factory ON data_completeness_snapshots(factory_id);
CREATE INDEX IF NOT EXISTS idx_completeness_date ON data_completeness_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_completeness_factory_date ON data_completeness_snapshots(factory_id, snapshot_date);


-- 4. ALTER factories - Add survey_company_id column
--    Links a factory to its capability survey submission.
ALTER TABLE factories ADD COLUMN IF NOT EXISTS survey_company_id VARCHAR(100);


-- =====================================================
-- 5. Seed data for field_capability_mapping
--    Covers 5 entity types with representative fields.
-- =====================================================

-- -------------------------------------------------------
-- PROCESSING_BATCH fields (rows 1-18)
-- Core production batch tracking fields
-- -------------------------------------------------------
INSERT INTO field_capability_mapping (survey_section, survey_row_index, survey_field_name, entity_type, entity_field, form_schema_key, analysis_dimension, is_required_for_entity)
VALUES
    ('production', 1, '批次编号', 'PROCESSING_BATCH', 'batchNumber', 'batch_number', NULL, true),
    ('production', 2, '产品名称', 'PROCESSING_BATCH', 'productName', 'product_name', NULL, true),
    ('production', 3, '计划产量', 'PROCESSING_BATCH', 'plannedQuantity', 'planned_quantity', 'yield_rate', true),
    ('production', 4, '实际产量', 'PROCESSING_BATCH', 'actualQuantity', 'actual_quantity', 'yield_rate', true),
    ('production', 5, '良品数量', 'PROCESSING_BATCH', 'goodQuantity', 'good_quantity', 'yield_rate', false),
    ('production', 6, '不良品数量', 'PROCESSING_BATCH', 'defectQuantity', 'defect_quantity', 'yield_rate', false),
    ('production', 7, '良品率', 'PROCESSING_BATCH', 'yieldRate', 'yield_rate', 'yield_rate', false),
    ('production', 8, '原料成本', 'PROCESSING_BATCH', 'materialCost', 'material_cost', 'production_cost', false),
    ('production', 9, '人工成本', 'PROCESSING_BATCH', 'laborCost', 'labor_cost', 'production_cost', false),
    ('production', 10, '设备成本', 'PROCESSING_BATCH', 'equipmentCost', 'equipment_cost', 'production_cost', false),
    ('production', 11, '总成本', 'PROCESSING_BATCH', 'totalCost', 'total_cost', 'production_cost', false),
    ('production', 12, '单位成本', 'PROCESSING_BATCH', 'unitCost', 'unit_cost', 'production_cost', false),
    ('production', 13, '使用设备', 'PROCESSING_BATCH', 'equipmentId', 'equipment_id', 'oee', false),
    ('production', 14, '负责主管', 'PROCESSING_BATCH', 'supervisorId', 'supervisor_id', 'labor_efficiency', false),
    ('production', 15, '作业人数', 'PROCESSING_BATCH', 'workerCount', 'worker_count', 'labor_efficiency', false),
    ('production', 16, '开始时间', 'PROCESSING_BATCH', 'startTime', 'start_time', 'oee', true),
    ('production', 17, '完成时间', 'PROCESSING_BATCH', 'completedTime', 'completed_time', 'oee', false),
    ('production', 18, '批次状态', 'PROCESSING_BATCH', 'status', 'status', NULL, true)
ON CONFLICT (survey_section, survey_row_index) DO NOTHING;

-- -------------------------------------------------------
-- WORK_SESSION fields (rows 19-26)
-- Labor tracking and work session management
-- -------------------------------------------------------
INSERT INTO field_capability_mapping (survey_section, survey_row_index, survey_field_name, entity_type, entity_field, form_schema_key, analysis_dimension, is_required_for_entity)
VALUES
    ('labor', 19, '员工ID', 'WORK_SESSION', 'userId', 'user_id', 'labor_efficiency', true),
    ('labor', 20, '工种', 'WORK_SESSION', 'workTypeId', 'work_type_id', 'labor_efficiency', true),
    ('labor', 21, '上班时间', 'WORK_SESSION', 'startTime', 'start_time', 'labor_efficiency', true),
    ('labor', 22, '下班时间', 'WORK_SESSION', 'endTime', 'end_time', 'labor_efficiency', true),
    ('labor', 23, '休息时长(分钟)', 'WORK_SESSION', 'breakMinutes', 'break_minutes', 'labor_efficiency', false),
    ('labor', 24, '实际工作时长(分钟)', 'WORK_SESSION', 'actualWorkMinutes', 'actual_work_minutes', 'labor_efficiency', false),
    ('labor', 25, '时薪', 'WORK_SESSION', 'hourlyRate', 'hourly_rate', 'production_cost', false),
    ('labor', 26, '人工费用', 'WORK_SESSION', 'laborCost', 'labor_cost', 'production_cost', false)
ON CONFLICT (survey_section, survey_row_index) DO NOTHING;

-- -------------------------------------------------------
-- MATERIAL_BATCH fields (rows 27-33)
-- Raw material and inventory tracking
-- -------------------------------------------------------
INSERT INTO field_capability_mapping (survey_section, survey_row_index, survey_field_name, entity_type, entity_field, form_schema_key, analysis_dimension, is_required_for_entity)
VALUES
    ('material', 27, '物料批次号', 'MATERIAL_BATCH', 'batchNumber', 'batch_number', NULL, true),
    ('material', 28, '物料类型', 'MATERIAL_BATCH', 'materialType', 'material_type', NULL, true),
    ('material', 29, '数量', 'MATERIAL_BATCH', 'quantity', 'quantity', 'production_cost', true),
    ('material', 30, '单价', 'MATERIAL_BATCH', 'unitPrice', 'unit_price', 'production_cost', false),
    ('material', 31, '供应商', 'MATERIAL_BATCH', 'supplier', 'supplier', NULL, false),
    ('material', 32, '保质期', 'MATERIAL_BATCH', 'expiryDate', 'expiry_date', 'quality_rate', false),
    ('material', 33, '存储位置', 'MATERIAL_BATCH', 'storageLocation', 'storage_location', NULL, false)
ON CONFLICT (survey_section, survey_row_index) DO NOTHING;

-- -------------------------------------------------------
-- QUALITY_INSPECTION fields (rows 34-38)
-- Quality control and inspection records
-- -------------------------------------------------------
INSERT INTO field_capability_mapping (survey_section, survey_row_index, survey_field_name, entity_type, entity_field, form_schema_key, analysis_dimension, is_required_for_entity)
VALUES
    ('quality', 34, '关联批次', 'QUALITY_INSPECTION', 'batchId', 'batch_id', 'quality_rate', true),
    ('quality', 35, '检验员', 'QUALITY_INSPECTION', 'inspectorId', 'inspector_id', 'quality_rate', true),
    ('quality', 36, '检验类型', 'QUALITY_INSPECTION', 'inspectionType', 'inspection_type', 'quality_rate', true),
    ('quality', 37, '检验结果', 'QUALITY_INSPECTION', 'result', 'result', 'quality_rate', true),
    ('quality', 38, '缺陷数量', 'QUALITY_INSPECTION', 'defectCount', 'defect_count', 'quality_rate', false),
    ('quality', 39, '缺陷类型', 'QUALITY_INSPECTION', 'defectType', 'defect_type', 'quality_rate', false)
ON CONFLICT (survey_section, survey_row_index) DO NOTHING;

-- -------------------------------------------------------
-- EQUIPMENT fields (rows 40-44)
-- Equipment performance and maintenance tracking
-- -------------------------------------------------------
INSERT INTO field_capability_mapping (survey_section, survey_row_index, survey_field_name, entity_type, entity_field, form_schema_key, analysis_dimension, is_required_for_entity)
VALUES
    ('equipment', 40, '设备编号', 'EQUIPMENT', 'equipmentId', 'equipment_id', 'oee', true),
    ('equipment', 41, '设备名称', 'EQUIPMENT', 'equipmentName', 'equipment_name', NULL, true),
    ('equipment', 42, '运行时长(小时)', 'EQUIPMENT', 'operatingHours', 'operating_hours', 'oee', false),
    ('equipment', 43, '上次维护日期', 'EQUIPMENT', 'maintenanceDate', 'maintenance_date', 'oee', false),
    ('equipment', 44, 'OEE评分', 'EQUIPMENT', 'oeeScore', 'oee_score', 'oee', false)
ON CONFLICT (survey_section, survey_row_index) DO NOTHING;


-- =====================================================
-- 6. HTML Section Bridge Columns
--    Maps field_capability_mapping rows to the actual
--    survey HTML section IDs (s4-3, s5-2, etc.) and
--    their field index within that section.
-- =====================================================

ALTER TABLE field_capability_mapping
    ADD COLUMN IF NOT EXISTS survey_section_html VARCHAR(50),
    ADD COLUMN IF NOT EXISTS survey_row_index_html INTEGER;

CREATE INDEX IF NOT EXISTS idx_field_mapping_html_section
    ON field_capability_mapping(survey_section_html, survey_row_index_html);

-- PROCESSING_BATCH → s4-3 "4.3 生产批次（生产执行）"
-- s4-3 fields: [0:批次号,1:关联计划,2:产品类型,3:计划产量,4:投入量,5:计量单位,
--  6:实际产量,7:良品数量,8:不良品数量,9:得率,10:生产效率,11:批次状态,
--  12:质量状态,13:开始时间,14:结束时间,15:使用设备,16:生产负责人,17:工人数量,
--  18:材料成本,19:人工成本,20:设备成本,21:总成本,22:单位成本,23:备注]
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=0  WHERE survey_section='production' AND survey_row_index=1;  -- 批次编号→批次号
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=2  WHERE survey_section='production' AND survey_row_index=2;  -- 产品名称→产品类型
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=3  WHERE survey_section='production' AND survey_row_index=3;  -- 计划产量
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=6  WHERE survey_section='production' AND survey_row_index=4;  -- 实际产量
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=7  WHERE survey_section='production' AND survey_row_index=5;  -- 良品数量
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=8  WHERE survey_section='production' AND survey_row_index=6;  -- 不良品数量
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=9  WHERE survey_section='production' AND survey_row_index=7;  -- 良品率→得率
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=18 WHERE survey_section='production' AND survey_row_index=8;  -- 原料成本→材料成本
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=19 WHERE survey_section='production' AND survey_row_index=9;  -- 人工成本
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=20 WHERE survey_section='production' AND survey_row_index=10; -- 设备成本
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=21 WHERE survey_section='production' AND survey_row_index=11; -- 总成本
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=22 WHERE survey_section='production' AND survey_row_index=12; -- 单位成本
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=15 WHERE survey_section='production' AND survey_row_index=13; -- 使用设备
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=16 WHERE survey_section='production' AND survey_row_index=14; -- 负责主管→生产负责人
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=17 WHERE survey_section='production' AND survey_row_index=15; -- 作业人数→工人数量
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=13 WHERE survey_section='production' AND survey_row_index=16; -- 开始时间
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=14 WHERE survey_section='production' AND survey_row_index=17; -- 完成时间→结束时间
UPDATE field_capability_mapping SET survey_section_html='s4-3', survey_row_index_html=11 WHERE survey_section='production' AND survey_row_index=18; -- 批次状态

-- WORK_SESSION → s5-2 "5.2 生产批次工时记录"
-- s5-2 fields: [0:生产批次,1:员工,2:签入时间,3:签出时间,4:工作时长,5:人工成本,6:分配人,7:状态,8:备注]
UPDATE field_capability_mapping SET survey_section_html='s5-2', survey_row_index_html=1  WHERE survey_section='labor' AND survey_row_index=19; -- 员工ID→员工
UPDATE field_capability_mapping SET survey_section_html=NULL,   survey_row_index_html=NULL WHERE survey_section='labor' AND survey_row_index=20; -- 工种 (no HTML match)
UPDATE field_capability_mapping SET survey_section_html='s5-2', survey_row_index_html=2  WHERE survey_section='labor' AND survey_row_index=21; -- 上班时间→签入时间
UPDATE field_capability_mapping SET survey_section_html='s5-2', survey_row_index_html=3  WHERE survey_section='labor' AND survey_row_index=22; -- 下班时间→签出时间
UPDATE field_capability_mapping SET survey_section_html=NULL,   survey_row_index_html=NULL WHERE survey_section='labor' AND survey_row_index=23; -- 休息时长 (no HTML match)
UPDATE field_capability_mapping SET survey_section_html='s5-2', survey_row_index_html=4  WHERE survey_section='labor' AND survey_row_index=24; -- 实际工作时长→工作时长
UPDATE field_capability_mapping SET survey_section_html=NULL,   survey_row_index_html=NULL WHERE survey_section='labor' AND survey_row_index=25; -- 时薪 (no HTML match)
UPDATE field_capability_mapping SET survey_section_html='s5-2', survey_row_index_html=5  WHERE survey_section='labor' AND survey_row_index=26; -- 人工费用→人工成本

-- MATERIAL_BATCH → s4-1 "4.1 原材料入库"
-- s4-1 fields: [0:批次号,1:原材料类型,2:供应商,3:入库数量,4:计量单位,5:单件重量,
--  6:进货单价,7:入库日期,8:生产日期,9:到期日期,10:存储位置,11:质检证书,12:入库状态,13:备注]
UPDATE field_capability_mapping SET survey_section_html='s4-1', survey_row_index_html=0  WHERE survey_section='material' AND survey_row_index=27; -- 物料批次号→批次号
UPDATE field_capability_mapping SET survey_section_html='s4-1', survey_row_index_html=1  WHERE survey_section='material' AND survey_row_index=28; -- 物料类型→原材料类型
UPDATE field_capability_mapping SET survey_section_html='s4-1', survey_row_index_html=3  WHERE survey_section='material' AND survey_row_index=29; -- 数量→入库数量
UPDATE field_capability_mapping SET survey_section_html='s4-1', survey_row_index_html=6  WHERE survey_section='material' AND survey_row_index=30; -- 单价→进货单价
UPDATE field_capability_mapping SET survey_section_html='s4-1', survey_row_index_html=2  WHERE survey_section='material' AND survey_row_index=31; -- 供应商
UPDATE field_capability_mapping SET survey_section_html='s4-1', survey_row_index_html=9  WHERE survey_section='material' AND survey_row_index=32; -- 保质期→到期日期
UPDATE field_capability_mapping SET survey_section_html='s4-1', survey_row_index_html=10 WHERE survey_section='material' AND survey_row_index=33; -- 存储位置

-- QUALITY_INSPECTION → s4-6 "4.6 质量检验记录"
-- s4-6 fields: [0:关联生产批次,1:质检员,2:检验日期,3:抽样数量,4:合格数量,5:不合格数量,6:合格率,7:检验结论,8:检验详情]
UPDATE field_capability_mapping SET survey_section_html='s4-6', survey_row_index_html=0  WHERE survey_section='quality' AND survey_row_index=34; -- 关联批次→关联生产批次
UPDATE field_capability_mapping SET survey_section_html='s4-6', survey_row_index_html=1  WHERE survey_section='quality' AND survey_row_index=35; -- 检验员→质检员
UPDATE field_capability_mapping SET survey_section_html=NULL,   survey_row_index_html=NULL WHERE survey_section='quality' AND survey_row_index=36; -- 检验类型 (no exact match)
UPDATE field_capability_mapping SET survey_section_html='s4-6', survey_row_index_html=7  WHERE survey_section='quality' AND survey_row_index=37; -- 检验结果→检验结论
UPDATE field_capability_mapping SET survey_section_html='s4-6', survey_row_index_html=5  WHERE survey_section='quality' AND survey_row_index=38; -- 缺陷数量→不合格数量
UPDATE field_capability_mapping SET survey_section_html='s4-6', survey_row_index_html=8  WHERE survey_section='quality' AND survey_row_index=39; -- 缺陷类型→检验详情

-- EQUIPMENT → s3-5 "3.5 设备信息"
-- s3-5 fields: [0:设备编码,1:设备名称,2:设备类型,3:型号,4:制造商,5:序列号,
--  6:购入日期,7:购入价格,8:折旧年限,9:每小时成本,10:功率,11:安装位置,12:保养周期,13:保修到期]
UPDATE field_capability_mapping SET survey_section_html='s3-5', survey_row_index_html=0  WHERE survey_section='equipment' AND survey_row_index=40; -- 设备编号→设备编码
UPDATE field_capability_mapping SET survey_section_html='s3-5', survey_row_index_html=1  WHERE survey_section='equipment' AND survey_row_index=41; -- 设备名称
UPDATE field_capability_mapping SET survey_section_html=NULL,   survey_row_index_html=NULL WHERE survey_section='equipment' AND survey_row_index=42; -- 运行时长 (no HTML match)
UPDATE field_capability_mapping SET survey_section_html='s3-5', survey_row_index_html=12 WHERE survey_section='equipment' AND survey_row_index=43; -- 上次维护日期→保养周期
UPDATE field_capability_mapping SET survey_section_html=NULL,   survey_row_index_html=NULL WHERE survey_section='equipment' AND survey_row_index=44; -- OEE评分 (no HTML match)


-- =====================================================
-- 7. Add factory_id to client_requirement_companies
--    Bridges survey company to Cretas factory entity.
-- =====================================================

ALTER TABLE client_requirement_companies
    ADD COLUMN IF NOT EXISTS factory_id VARCHAR(50);
