package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import com.joolun.common.annotation.Excel;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 溯源批次
 */
@Data
@TableName("traceability_batch")
@EqualsAndHashCode(callSuper = true)
public class TraceabilityBatch extends Model<TraceabilityBatch> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 批次号
     */
    @Excel(name = "批次号")
    private String batchNo;

    /**
     * 关联商品SPU
     */
    private Long productId;

    /**
     * 关联商户
     */
    private Long merchantId;

    /**
     * 产品名称（冗余）
     */
    @Excel(name = "产品名称")
    private String productName;

    /**
     * 生产日期
     */
    @Excel(name = "生产日期")
    private LocalDate productionDate;

    /**
     * 过期日期
     */
    private LocalDate expiryDate;

    /**
     * 数量
     */
    @Excel(name = "数量")
    private BigDecimal quantity;

    /**
     * 单位
     */
    private String unit;

    /**
     * 生产车间
     */
    private String workshop;

    /**
     * 状态：0进行中 1已完成 2待处理
     */
    @Excel(name = "状态")
    private Integer status;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;

    // ========== 关联数据（非数据库字段）==========

    /**
     * 时间线列表
     */
    @TableField(exist = false)
    private List<TraceabilityTimeline> timeline;

    /**
     * 原料列表
     */
    @TableField(exist = false)
    private List<TraceabilityRawMaterial> rawMaterials;

    /**
     * 质检报告列表
     */
    @TableField(exist = false)
    private List<TraceabilityQualityReport> qualityReports;

    /**
     * 证据列表
     */
    @TableField(exist = false)
    private List<TraceabilityEvidence> evidences;

    /**
     * 商户信息
     */
    @TableField(exist = false)
    private Merchant merchant;
}
