package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 短信发送记录表
 * 记录短信发送历史
 */
@Data
@TableName("sms_send_record")
@EqualsAndHashCode(callSuper = true)
public class SmsSendRecord extends Model<SmsSendRecord> {
    private static final long serialVersionUID = 1L;

    /**
     * 记录ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 接收手机号
     */
    private String phone;

    /**
     * 短信模板ID
     */
    private String templateId;

    /**
     * 模板参数 (JSON)
     */
    private String templateParams;

    /**
     * 实际发送内容
     */
    private String content;

    /**
     * 验证码
     */
    private String code;

    /**
     * 状态: 0=待发 1=发送中 2=成功 3=失败
     */
    private Integer status;

    /**
     * 验证码过期时间
     */
    private LocalDateTime expireTime;

    /**
     * 发送时间
     */
    private LocalDateTime sendTime;

    /**
     * 发送结果码
     */
    private String resultCode;

    /**
     * 发送结果消息
     */
    private String resultMessage;

    /**
     * 阿里云业务ID
     */
    private String bizId;

    /**
     * 关联通知ID
     */
    private Long notificationId;

    /**
     * 商户ID
     */
    private Long merchantId;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 计费条数
     */
    private Integer feeCount;

    /**
     * 创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
