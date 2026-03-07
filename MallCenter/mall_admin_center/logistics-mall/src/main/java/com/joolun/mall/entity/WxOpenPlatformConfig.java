package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 微信开放平台第三方平台配置
 */
@Data
@TableName("wx_open_platform_config")
@EqualsAndHashCode(callSuper = true)
public class WxOpenPlatformConfig extends Model<WxOpenPlatformConfig> {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String componentAppid;
    private String componentAppsecret;
    private String componentVerifyTicket;
    private String componentAccessToken;
    private LocalDateTime componentAccessTokenExpires;
    private String msgVerifyToken;
    private String msgEncryptKey;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
