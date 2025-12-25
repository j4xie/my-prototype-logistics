package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * AI需求记录表
 * 记录AI对话中识别的用户需求
 */
@Data
@TableName("ai_demand_record")
@EqualsAndHashCode(callSuper = true)
public class AiDemandRecord extends Model<AiDemandRecord> {
    private static final long serialVersionUID = 1L;

    /**
     * 记录ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * AI会话ID
     */
    private String sessionId;

    /**
     * 消息ID
     */
    private String messageId;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 商户ID
     */
    private Long merchantId;

    /**
     * 微信openid
     */
    private String openid;

    /**
     * 用户原始消息
     */
    private String userMessage;

    /**
     * AI回复内容
     */
    private String aiResponse;

    /**
     * 提取的关键词列表 (JSON)
     */
    private String extractedKeywords;

    /**
     * 识别的用户意图
     */
    private String extractedIntent;

    /**
     * 置信度(0-1)
     */
    private BigDecimal confidenceScore;

    /**
     * 匹配到的商品ID列表 (JSON)
     */
    private String matchedProductIds;

    /**
     * 推荐的商品ID列表 (JSON)
     */
    private String recommendedProductIds;

    /**
     * 匹配商品数量
     */
    private Integer matchCount;

    /**
     * 需求类型: product_inquiry/price_inquiry/stock_inquiry/other
     */
    private String demandType;

    /**
     * 需求紧急度: 0=一般 1=较急 2=紧急
     */
    private Integer demandUrgency;

    /**
     * 状态: 0=待处理 1=已处理 2=已转人工
     */
    private Integer status;

    /**
     * 处理时间
     */
    private LocalDateTime processedTime;

    /**
     * 处理人ID
     */
    private Long processedBy;

    /**
     * 用户反馈: 1=有帮助 0=无帮助
     */
    private Integer userFeedback;

    /**
     * 反馈时间
     */
    private LocalDateTime feedbackTime;

    /**
     * 创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
