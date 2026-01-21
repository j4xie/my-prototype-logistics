package com.joolun.mall.mapper.aps;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.aps.ProductionEquipment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 生产设备Mapper
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Mapper
public interface ProductionEquipmentMapper extends BaseMapper<ProductionEquipment> {

    /**
     * 获取指定类型的可用设备
     *
     * @param equipmentType 设备类型
     * @return 可用设备列表
     */
    @Select("SELECT * FROM aps_production_equipment " +
            "WHERE equipment_type = #{equipmentType} " +
            "AND status = 'available' " +
            "AND deleted_at IS NULL " +
            "ORDER BY efficiency_rating DESC")
    List<ProductionEquipment> selectAvailableByType(@Param("equipmentType") String equipmentType);

    /**
     * 获取指定产线的设备
     *
     * @param lineId 产线ID
     * @return 设备列表
     */
    @Select("SELECT * FROM aps_production_equipment " +
            "WHERE line_id = #{lineId} " +
            "AND deleted_at IS NULL " +
            "ORDER BY equipment_type ASC")
    List<ProductionEquipment> selectByLineId(@Param("lineId") String lineId);

    /**
     * 获取需要维护的设备
     *
     * @return 需要维护的设备列表
     */
    @Select("SELECT * FROM aps_production_equipment " +
            "WHERE next_maintenance_time <= NOW() " +
            "AND deleted_at IS NULL")
    List<ProductionEquipment> selectEquipmentNeedingMaintenance();
}
