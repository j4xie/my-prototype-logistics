package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 溯源原料
 */
@Data
@TableName("traceability_raw_material")
@EqualsAndHashCode(callSuper = true)
public class TraceabilityRawMaterial extends Model<TraceabilityRawMaterial> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 批次ID
     */
    private Long batchId;

    /**
     * 原料名称
     */
    private String materialName;

    /**
     * 供应商
     */
    private String supplier;

    /**
     * 供应商ID
     */
    private Long supplierId;

    /**
     * 产地
     */
    private String origin;

    /**
     * 原料批次号
     */
    private String materialBatchNo;

    /**
     * 生产日期
     */
    private LocalDate productionDate;

    /**
     * 过期日期
     */
    private LocalDate expiryDate;

    /**
     * 数量
     */
    private BigDecimal quantity;

    /**
     * 单位
     */
    private String unit;

    /**
     * 是否已验证
     */
    private Integer verified;

    /**
     * 验证时间
     */
    private LocalDateTime verifyTime;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;
}
