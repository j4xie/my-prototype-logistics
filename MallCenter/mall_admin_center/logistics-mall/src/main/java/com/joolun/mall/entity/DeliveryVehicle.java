package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 配送车辆实体
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
@Data
@TableName("delivery_vehicle")
public class DeliveryVehicle {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 车牌号
     */
    private String plateNumber;

    /**
     * 车辆类型: small/medium/large/cold_chain
     */
    private String vehicleType;

    /**
     * 最大载重(kg)
     */
    private BigDecimal maxWeight;

    /**
     * 最大容积(m³)
     */
    private BigDecimal maxVolume;

    /**
     * 司机ID
     */
    private String driverId;

    /**
     * 司机姓名
     */
    private String driverName;

    /**
     * 司机电话
     */
    private String driverPhone;

    /**
     * 驾龄(年)
     */
    private Integer driverExperienceYears;

    /**
     * 司机评分
     */
    private BigDecimal driverRating;

    /**
     * 当前纬度
     */
    private BigDecimal currentLat;

    /**
     * 当前经度
     */
    private BigDecimal currentLng;

    /**
     * 当前装载重量
     */
    private BigDecimal currentLoadWeight;

    /**
     * 当前装载体积
     */
    private BigDecimal currentLoadVolume;

    /**
     * 今日单量
     */
    private Integer dailyOrderCount;

    /**
     * 准时率
     */
    private BigDecimal onTimeRate;

    /**
     * 状态: available/busy/offline/maintenance
     */
    private String status;

    /**
     * 是否模拟数据
     */
    private Boolean isSimulated;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
