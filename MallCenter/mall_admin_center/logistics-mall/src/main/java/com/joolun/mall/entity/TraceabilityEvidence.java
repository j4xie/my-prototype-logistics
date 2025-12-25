package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 溯源证据（照片/视频）
 */
@Data
@TableName("traceability_evidence")
@EqualsAndHashCode(callSuper = true)
public class TraceabilityEvidence extends Model<TraceabilityEvidence> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 批次ID
     */
    private Long batchId;

    /**
     * 类型：video/photo
     */
    private String type;

    /**
     * 标题
     */
    private String title;

    /**
     * 描述
     */
    private String description;

    /**
     * 文件URL
     */
    private String url;

    /**
     * 缩略图
     */
    private String thumbnailUrl;

    /**
     * 排序
     */
    private Integer sortOrder;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;
}
