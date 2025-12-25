package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 通知模板表
 * 管理站内消息和短信模板
 */
@Data
@TableName("notification_template")
@EqualsAndHashCode(callSuper = true)
public class NotificationTemplate extends Model<NotificationTemplate> {
    private static final long serialVersionUID = 1L;

    /**
     * 模板ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 模板代码
     */
    private String templateCode;

    /**
     * 模板名称
     */
    private String templateName;

    /**
     * 模板类型: in_app/sms/both
     */
    private String templateType;

    /**
     * 通知类型: product_found/promotion/system
     */
    private String category;

    /**
     * 标题模板(站内)
     */
    private String titleTemplate;

    /**
     * 内容模板(站内)
     */
    private String contentTemplate;

    /**
     * 短信模板内容
     */
    private String smsTemplate;

    /**
     * 阿里云短信模板ID
     */
    private String smsTemplateId;

    /**
     * 模板变量说明 (JSON)
     */
    private String variables;

    /**
     * 状态: 0=禁用 1=启用
     */
    private Integer status;

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
