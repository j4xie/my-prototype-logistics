package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 质检报告
 */
@Data
@TableName(value = "traceability_quality_report", autoResultMap = true)
@EqualsAndHashCode(callSuper = true)
public class TraceabilityQualityReport extends Model<TraceabilityQualityReport> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 批次ID
     */
    private Long batchId;

    /**
     * 检验阶段：raw_material/finished
     */
    private String stage;

    /**
     * 检验结果：pass/fail
     */
    private String result;

    /**
     * 检验员
     */
    private String inspector;

    /**
     * 检验员ID
     */
    private Long inspectorId;

    /**
     * 检验时间
     */
    private LocalDateTime inspectionTime;

    /**
     * 检验项目（JSON）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, String> testItems;

    /**
     * 证书图片
     */
    private String certificateImage;

    /**
     * 报告文件
     */
    private String reportFile;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;
}
