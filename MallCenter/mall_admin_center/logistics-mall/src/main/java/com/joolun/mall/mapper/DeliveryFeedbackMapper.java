package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.DeliveryFeedback;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 配送反馈Mapper
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
@Mapper
public interface DeliveryFeedbackMapper extends BaseMapper<DeliveryFeedback> {

    /**
     * 获取最近的反馈数据用于训练
     */
    @Select("SELECT * FROM delivery_feedback WHERE created_at >= #{startTime} ORDER BY created_at DESC LIMIT #{limit}")
    List<DeliveryFeedback> selectRecentFeedback(@Param("startTime") LocalDateTime startTime, @Param("limit") int limit);

    /**
     * 统计准时率
     */
    @Select("SELECT COUNT(*) as total, SUM(CASE WHEN is_on_time = 1 THEN 1 ELSE 0 END) as on_time FROM delivery_feedback WHERE created_at >= #{startTime}")
    Map<String, Object> calculateOnTimeStats(@Param("startTime") LocalDateTime startTime);

    /**
     * 获取车辆的历史准时率
     */
    @Select("SELECT AVG(CASE WHEN is_on_time = 1 THEN 1 ELSE 0 END) as rate FROM delivery_feedback WHERE vehicle_id = #{vehicleId}")
    Double getVehicleOnTimeRate(@Param("vehicleId") String vehicleId);
}
