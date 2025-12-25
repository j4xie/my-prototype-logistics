package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 商户审核记录
 */
@Data
@TableName("merchant_review")
@EqualsAndHashCode(callSuper = true)
public class MerchantReview extends Model<MerchantReview> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 商户ID
     */
    private Long merchantId;

    /**
     * 审核人ID
     */
    private Long reviewerId;

    /**
     * 审核人姓名
     */
    private String reviewerName;

    /**
     * 操作：1通过 2拒绝
     */
    private Integer action;

    /**
     * 审核备注
     */
    private String remark;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;
}
