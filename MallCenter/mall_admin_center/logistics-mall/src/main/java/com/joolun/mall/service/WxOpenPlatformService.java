package com.joolun.mall.service;

import java.util.Map;

/**
 * 微信开放平台第三方平台服务
 * 核心职责：
 * 1. 管理 component_access_token
 * 2. 处理商户授权（获取 authorizer_access_token）
 * 3. 代商户上传/审核/发布小程序代码
 */
public interface WxOpenPlatformService {

    /**
     * 处理微信推送的 component_verify_ticket（每10分钟推送一次）
     */
    void handleVerifyTicket(String ticket);

    /**
     * 获取第三方平台 component_access_token
     */
    String getComponentAccessToken();

    /**
     * 获取预授权码（商户扫码授权前调用）
     */
    String getPreAuthCode();

    /**
     * 生成商户授权链接
     * @param merchantId 商户ID
     * @param redirectUri 授权完成后的回调地址
     */
    String buildAuthUrl(Long merchantId, String redirectUri);

    /**
     * 处理授权回调，获取并保存商户的授权信息
     * @param authorizationCode 授权码
     * @param merchantId 商户ID
     */
    void handleAuthCallback(String authorizationCode, Long merchantId);

    /**
     * 获取商户的 authorizer_access_token（自动刷新）
     * @param merchantId 商户ID
     */
    String getAuthorizerAccessToken(Long merchantId);

    /**
     * 代商户上传小程序代码
     * @param merchantId 商户ID
     * @param templateId 模板ID
     * @param userVersion 版本号
     * @param userDesc 版本描述
     */
    void uploadCode(Long merchantId, long templateId, String userVersion, String userDesc);

    /**
     * 代商户提交审核
     * @param merchantId 商户ID
     */
    long submitAudit(Long merchantId);

    /**
     * 代商户发布已审核通过的小程序
     * @param merchantId 商户ID
     */
    void release(Long merchantId);

    /**
     * 查询审核状态
     * @param merchantId 商户ID
     * @param auditId 审核ID
     */
    Map<String, Object> getAuditStatus(Long merchantId, long auditId);

    /**
     * 获取可用的代码模板列表
     */
    Object getTemplateList();
}
