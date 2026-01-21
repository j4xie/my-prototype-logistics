package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.DeliveryRoute;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

/**
 * 配送路线Mapper
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
@Mapper
public interface DeliveryRouteMapper extends BaseMapper<DeliveryRoute> {

    /**
     * 获取车辆指定日期的路线
     */
    @Select("SELECT * FROM delivery_route WHERE vehicle_id = #{vehicleId} AND route_date = #{date}")
    DeliveryRoute selectByVehicleAndDate(@Param("vehicleId") String vehicleId, @Param("date") LocalDate date);

    /**
     * 获取指定日期的所有路线
     */
    @Select("SELECT * FROM delivery_route WHERE route_date = #{date} ORDER BY vehicle_id")
    List<DeliveryRoute> selectByDate(@Param("date") LocalDate date);
}
