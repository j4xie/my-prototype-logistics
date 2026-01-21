package com.joolun.mall.mapper.aps;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.aps.ProductionOrder;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

/**
 * 生产订单Mapper
 * APS (Advanced Planning and Scheduling) 系统核心Mapper
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Mapper
public interface ProductionOrderMapper extends BaseMapper<ProductionOrder> {

    /**
     * 获取指定日期待排程的生产订单
     * 筛选条件:
     * 1. 状态为pending
     * 2. 最晚完成时间在指定日期或之后
     * 3. 未被删除
     *
     * @param date 排程日期
     * @return 待排程的订单列表
     */
    @Select("SELECT * FROM aps_production_order " +
            "WHERE status = 'pending' " +
            "AND DATE(latest_end) >= #{date} " +
            "AND deleted_at IS NULL " +
            "ORDER BY priority DESC, is_urgent DESC, latest_end ASC")
    List<ProductionOrder> selectPendingOrdersByDate(@Param("date") LocalDate date);

    /**
     * 获取指定产线的排程订单
     *
     * @param lineId 产线ID
     * @param date 日期
     * @return 订单列表
     */
    @Select("SELECT * FROM aps_production_order " +
            "WHERE scheduled_line_id = #{lineId} " +
            "AND DATE(planned_start) = #{date} " +
            "AND status IN ('scheduled', 'in_progress') " +
            "AND deleted_at IS NULL " +
            "ORDER BY schedule_sequence ASC")
    List<ProductionOrder> selectScheduledOrdersByLineAndDate(@Param("lineId") String lineId, @Param("date") LocalDate date);

    /**
     * 统计各状态订单数量
     *
     * @return 状态统计
     */
    @Select("SELECT status, COUNT(*) as count FROM aps_production_order " +
            "WHERE deleted_at IS NULL " +
            "GROUP BY status")
    List<java.util.Map<String, Object>> countByStatus();
}
