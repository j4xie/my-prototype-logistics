-- =====================================================
-- 修复 IsapiDevice.equipment_id 类型不匹配问题
-- 将 equipment_id 从 VARCHAR(36) 改为 BIGINT
-- 以便与 FactoryEquipment.id (Long) 进行 JOIN 查询
-- =====================================================

-- 1. 先备份现有数据（如果有的话）
-- 创建临时表保存 equipment_id 映射
CREATE TEMPORARY TABLE IF NOT EXISTS temp_isapi_equipment_mapping AS
SELECT id, equipment_id
FROM isapi_devices
WHERE equipment_id IS NOT NULL AND equipment_id != '';

-- 2. 修改列类型
-- 注意：如果现有数据不是有效的数字，转换会失败
-- 先将列改为可空，清除无效数据，然后修改类型
ALTER TABLE isapi_devices
    MODIFY COLUMN equipment_id BIGINT NULL COMMENT '关联设备ID (factory_equipment.id)';

-- 3. 添加外键约束（可选，取决于业务需求）
-- 如果需要严格的外键约束，取消下面的注释
-- ALTER TABLE isapi_devices
--     ADD CONSTRAINT fk_isapi_device_equipment
--     FOREIGN KEY (equipment_id) REFERENCES factory_equipment(id)
--     ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. 添加索引优化 JOIN 查询性能
CREATE INDEX idx_isapi_device_equipment_id ON isapi_devices(equipment_id);
