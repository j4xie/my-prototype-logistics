package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.DeliveryOrder;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 配送订单Mapper
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
@Mapper
public interface DeliveryOrderMapper extends BaseMapper<DeliveryOrder> {

    /**
     * 获取指定日期待调度的订单
     */
    @Select("SELECT * FROM delivery_order WHERE status = 'pending' AND DATE(expected_start) = #{date} AND deleted_at IS NULL ORDER BY priority DESC, expected_start ASC")
    List<DeliveryOrder> selectPendingOrdersByDate(@Param("date") LocalDate date);

    /**
     * 获取车辆当日已分配的订单
     */
    @Select("SELECT * FROM delivery_order WHERE vehicle_id = #{vehicleId} AND DATE(scheduled_time) = #{date} AND status IN ('scheduled', 'delivering') ORDER BY sequence_in_route ASC")
    List<DeliveryOrder> selectVehicleOrders(@Param("vehicleId") String vehicleId, @Param("date") LocalDate date);

    /**
     * 统计区域订单密度
     */
    @Select("SELECT district, COUNT(*) as count FROM delivery_order WHERE created_at >= #{startTime} AND deleted_at IS NULL GROUP BY district")
    List<Map<String, Object>> countByDistrict(@Param("startTime") LocalDateTime startTime);

    /**
     * 获取模拟数据数量
     */
    @Select("SELECT COUNT(*) FROM delivery_order WHERE is_simulated = 1")
    int countSimulatedOrders();
}
