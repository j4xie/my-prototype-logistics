package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 内容审核表 - 对齐 V4.0 SQL: content_review
 */
@Data
@TableName("content_review")
@EqualsAndHashCode(callSuper = true)
public class ContentReview extends Model<ContentReview> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 内容类型：1商品 2评论 3广告 4商户资料
     */
    @TableField("content_type")
    private Integer contentType;

    /**
     * 内容ID
     */
    @TableField("content_id")
    private Long contentId;

    /**
     * 内容标题/摘要
     */
    @TableField("content_title")
    private String contentTitle;

    /**
     * 内容详情（JSON格式）
     */
    @TableField("content_detail")
    private String contentDetail;

    /**
     * 提交人ID
     */
    @TableField("submitter_id")
    private Long submitterId;

    /**
     * 提交人名称
     */
    @TableField("submitter_name")
    private String submitterName;

    /**
     * 商户ID
     */
    @TableField("merchant_id")
    private Long merchantId;

    /**
     * 商户名称
     */
    @TableField("merchant_name")
    private String merchantName;

    /**
     * 状态：0待审核 1已通过 2已拒绝 3需修改
     */
    private Integer status;

    /**
     * 优先级：1普通 2重要 3紧急
     */
    private Integer priority;

    /**
     * 审核人ID
     */
    @TableField("reviewer_id")
    private Long reviewerId;

    /**
     * 审核人名称
     */
    @TableField("reviewer_name")
    private String reviewerName;

    /**
     * 审核时间
     */
    @TableField("review_time")
    private LocalDateTime reviewTime;

    /**
     * 审核意见
     */
    @TableField("review_remark")
    private String reviewRemark;

    /**
     * 拒绝原因
     */
    @TableField("reject_reason")
    private String rejectReason;

    /**
     * AI审核结果（JSON格式）
     */
    @TableField("ai_result")
    private String aiResult;

    /**
     * AI审核分数（0-100）
     */
    @TableField("ai_score")
    private Integer aiScore;

    /**
     * 是否跳过AI审核
     */
    @TableField("skip_ai")
    private Integer skipAi;

    /**
     * 创建时间
     */
    @TableField("create_time")
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    @TableField("update_time")
    private LocalDateTime updateTime;

    /**
     * 删除标记
     */
    @TableLogic
    @TableField("del_flag")
    private Integer delFlag;
}
