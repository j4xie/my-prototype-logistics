package com.joolun.mall.entity.aps;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 换型矩阵实体
 * 定义从一个产品切换到另一个产品所需的时间
 *
 * 支持场景:
 * 1. 混批优化 (最小化换型时间)
 * 2. 智能排序 (相似品类连续生产)
 *
 * 矩阵逻辑:
 * - 同类产品换型快 (如 A→A' 10分钟)
 * - 不同类产品换型慢 (如 A→B 45分钟)
 * - 需清洁换型 (如 荤→素 120分钟)
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Data
@TableName("aps_changeover_matrix")
public class ChangeoverMatrix {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 产线ID (空表示通用)
     */
    private String lineId;

    /**
     * 来源产品类别
     */
    private String fromCategory;

    /**
     * 来源产品规格 (可为空表示类别级别)
     */
    private String fromSpec;

    /**
     * 目标产品类别
     */
    private String toCategory;

    /**
     * 目标产品规格 (可为空表示类别级别)
     */
    private String toSpec;

    /**
     * 换型时间(分钟)
     */
    private Integer changeoverMinutes;

    /**
     * 是否需要清洁
     */
    private Boolean requiresCleaning;

    /**
     * 清洁时间(分钟)
     */
    private Integer cleaningMinutes;

    /**
     * 是否需要更换模具
     */
    private Boolean requiresMoldChange;

    /**
     * 模具更换时间(分钟)
     */
    private Integer moldChangeMinutes;

    /**
     * 是否需要调试
     */
    private Boolean requiresCalibration;

    /**
     * 调试时间(分钟)
     */
    private Integer calibrationMinutes;

    /**
     * 需要的人员数
     */
    private Integer requiredWorkers;

    /**
     * 换型成本(元)
     */
    private Integer changeoverCost;

    /**
     * 备注
     */
    private String remark;

    /**
     * 是否模拟数据
     */
    private Boolean isSimulated;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
}
