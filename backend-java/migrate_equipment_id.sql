-- 设备表ID迁移脚本：varchar UUID -> BIGINT AUTO_INCREMENT
-- 执行前请备份数据库！

SET FOREIGN_KEY_CHECKS = 0;

-- 1. 检查当前数据
SELECT 'Current factory_equipment IDs:' as info;
SELECT id, factory_id, equipment_name FROM factory_equipment;

-- 2. 添加新的numeric ID列
ALTER TABLE factory_equipment ADD COLUMN new_id BIGINT AUTO_INCREMENT UNIQUE FIRST;

-- 3. 创建旧ID到新ID的映射表
CREATE TEMPORARY TABLE equipment_id_map AS
SELECT id as old_id, new_id FROM factory_equipment;

-- 4. 更新关联表 batch_equipment_usage
ALTER TABLE batch_equipment_usage ADD COLUMN new_equipment_id BIGINT;
UPDATE batch_equipment_usage beu
JOIN equipment_id_map map ON beu.equipment_id = map.old_id
SET beu.new_equipment_id = map.new_id;

-- 5. 更新关联表 device_monitoring_data
ALTER TABLE device_monitoring_data ADD COLUMN new_equipment_id BIGINT;
UPDATE device_monitoring_data dmd
JOIN equipment_id_map map ON dmd.equipment_id = map.old_id
SET dmd.new_equipment_id = map.new_id;

-- 6. 删除旧外键约束
ALTER TABLE batch_equipment_usage DROP FOREIGN KEY IF EXISTS batch_equipment_usage_ibfk_2;
ALTER TABLE device_monitoring_data DROP FOREIGN KEY IF EXISTS device_monitoring_data_ibfk_1;

-- 7. 删除旧的equipment_id列，重命名新列
ALTER TABLE batch_equipment_usage DROP COLUMN equipment_id;
ALTER TABLE batch_equipment_usage CHANGE new_equipment_id equipment_id BIGINT;

ALTER TABLE device_monitoring_data DROP COLUMN equipment_id;
ALTER TABLE device_monitoring_data CHANGE new_equipment_id equipment_id BIGINT;

-- 8. factory_equipment：删除旧主键，设置新主键
ALTER TABLE factory_equipment DROP PRIMARY KEY;
ALTER TABLE factory_equipment DROP COLUMN id;
ALTER TABLE factory_equipment CHANGE new_id id BIGINT AUTO_INCREMENT PRIMARY KEY;

-- 9. 重新创建外键约束
ALTER TABLE batch_equipment_usage
ADD CONSTRAINT fk_beu_equipment FOREIGN KEY (equipment_id) REFERENCES factory_equipment(id);

ALTER TABLE device_monitoring_data
ADD CONSTRAINT fk_dmd_equipment FOREIGN KEY (equipment_id) REFERENCES factory_equipment(id);

SET FOREIGN_KEY_CHECKS = 1;

-- 10. 验证结果
SELECT 'New factory_equipment IDs:' as info;
SELECT id, factory_id, equipment_name FROM factory_equipment;
