package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.DeliveryVehicle;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 配送车辆Mapper
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
@Mapper
public interface DeliveryVehicleMapper extends BaseMapper<DeliveryVehicle> {

    /**
     * 获取可用车辆列表
     */
    @Select("SELECT * FROM delivery_vehicle WHERE status = 'available' ORDER BY on_time_rate DESC")
    List<DeliveryVehicle> selectAvailableVehicles();

    /**
     * 获取指定类型的可用车辆
     */
    @Select("SELECT * FROM delivery_vehicle WHERE status = 'available' AND vehicle_type = #{type} ORDER BY on_time_rate DESC")
    List<DeliveryVehicle> selectAvailableByType(@Param("type") String type);

    /**
     * 获取支持冷链的可用车辆
     */
    @Select("SELECT * FROM delivery_vehicle WHERE status = 'available' AND vehicle_type = 'cold_chain' ORDER BY on_time_rate DESC")
    List<DeliveryVehicle> selectColdChainVehicles();

    /**
     * 获取模拟数据数量
     */
    @Select("SELECT COUNT(*) FROM delivery_vehicle WHERE is_simulated = 1")
    int countSimulatedVehicles();
}
