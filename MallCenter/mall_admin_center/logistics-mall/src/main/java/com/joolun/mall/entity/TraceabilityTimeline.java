package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 溯源时间线
 */
@Data
@TableName(value = "traceability_timeline", autoResultMap = true)
@EqualsAndHashCode(callSuper = true)
public class TraceabilityTimeline extends Model<TraceabilityTimeline> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 批次ID
     */
    private Long batchId;

    /**
     * 阶段代码
     */
    private String stage;

    /**
     * 标题
     */
    private String title;

    /**
     * 描述
     */
    private String description;

    /**
     * 操作员
     */
    private String operator;

    /**
     * 操作员ID
     */
    private Long operatorId;

    /**
     * 车间
     */
    private String workshop;

    /**
     * 设备
     */
    private String equipment;

    /**
     * 状态：0待处理 1进行中 2已完成
     */
    private Integer status;

    /**
     * 排序
     */
    private Integer sortOrder;

    /**
     * 发生时间
     */
    private LocalDateTime timestamp;

    /**
     * 扩展数据（JSON）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> extraData;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;
}
