package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 商家通知表
 * 用于站内消息和短信通知管理
 */
@Data
@TableName("merchant_notification")
@EqualsAndHashCode(callSuper = true)
public class MerchantNotification extends Model<MerchantNotification> {
    private static final long serialVersionUID = 1L;

    /**
     * 通知ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 商户ID
     */
    private Long merchantId;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 接收手机号
     */
    private String phone;

    /**
     * 通知标题
     */
    private String title;

    /**
     * 通知内容
     */
    private String content;

    /**
     * 内容摘要(用于列表显示)
     */
    private String summary;

    /**
     * 通知类型: product_found/promotion/system/order
     */
    private String category;

    /**
     * 子类型
     */
    private String subCategory;

    /**
     * 优先级: 0=普通 1=重要 2=紧急
     */
    private Integer priority;

    /**
     * 关联的搜索关键词
     */
    private String relatedKeyword;

    /**
     * 关联的商品ID列表 (JSON)
     */
    private String relatedProductIds;

    /**
     * 关联的订单ID
     */
    private Long relatedOrderId;

    /**
     * 跳转链接
     */
    private String relatedLink;

    /**
     * 站内消息状态: 0=待发 1=已发 2=已读 3=已删除
     */
    private Integer inAppStatus;

    /**
     * 站内消息发送时间
     */
    private LocalDateTime inAppSentTime;

    /**
     * 站内消息阅读时间
     */
    private LocalDateTime inAppReadTime;

    /**
     * 是否启用短信: 0=否 1=是
     */
    private Integer smsEnabled;

    /**
     * 短信状态: 0=未发 1=待发 2=已发 3=发送失败
     */
    private Integer smsStatus;

    /**
     * 短信发送时间
     */
    private LocalDateTime smsSentTime;

    /**
     * 短信发送结果
     */
    private String smsResult;

    /**
     * 短信模板ID
     */
    private String smsTemplateId;

    /**
     * 创建人ID
     */
    private Long createdBy;

    /**
     * 创建人姓名
     */
    private String createdByName;

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
