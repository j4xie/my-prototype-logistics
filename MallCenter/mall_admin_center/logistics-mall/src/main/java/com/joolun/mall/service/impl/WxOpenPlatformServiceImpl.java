package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.Merchant;
import com.joolun.mall.entity.WxOpenPlatformConfig;
import com.joolun.mall.mapper.MerchantMapper;
import com.joolun.mall.mapper.WxOpenPlatformConfigMapper;
import com.joolun.mall.service.WxOpenPlatformService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 微信开放平台第三方平台服务实现
 *
 * 微信第三方平台核心流程：
 * 1. 微信每10分钟推送 component_verify_ticket → handleVerifyTicket()
 * 2. 用 ticket 换 component_access_token → getComponentAccessToken()
 * 3. 获取 pre_auth_code → 生成授权链接 → 商户扫码
 * 4. 授权回调拿到 authorization_code → 换 authorizer_access_token + refresh_token
 * 5. 用 authorizer_access_token 代商户操作（上传代码、提交审核、发布）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WxOpenPlatformServiceImpl implements WxOpenPlatformService {

    private final WxOpenPlatformConfigMapper configMapper;
    private final MerchantMapper merchantMapper;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private static final String WX_API = "https://api.weixin.qq.com";

    // ==================== Token 管理 ====================

    @Override
    public void handleVerifyTicket(String ticket) {
        WxOpenPlatformConfig config = getConfig();
        if (config == null) {
            log.warn("第三方平台配置不存在，忽略 verify_ticket");
            return;
        }
        config.setComponentVerifyTicket(ticket);
        config.setUpdateTime(LocalDateTime.now());
        configMapper.updateById(config);
        log.info("已更新 component_verify_ticket");
    }

    @Override
    public String getComponentAccessToken() {
        WxOpenPlatformConfig config = getConfig();
        if (config == null) {
            throw new RuntimeException("第三方平台未配置");
        }

        // 检查 token 是否过期（提前5分钟刷新）
        if (config.getComponentAccessToken() != null
                && config.getComponentAccessTokenExpires() != null
                && config.getComponentAccessTokenExpires().isAfter(LocalDateTime.now().plusMinutes(5))) {
            return config.getComponentAccessToken();
        }

        // 刷新 token
        String url = WX_API + "/cgi-bin/component/api_component_token";
        Map<String, String> body = new HashMap<>();
        body.put("component_appid", config.getComponentAppid());
        body.put("component_appsecret", config.getComponentAppsecret());
        body.put("component_verify_ticket", config.getComponentVerifyTicket());

        JsonNode resp = postJson(url, body);
        String token = resp.get("component_access_token").asText();
        int expiresIn = resp.get("expires_in").asInt();

        config.setComponentAccessToken(token);
        config.setComponentAccessTokenExpires(LocalDateTime.now().plusSeconds(expiresIn));
        config.setUpdateTime(LocalDateTime.now());
        configMapper.updateById(config);

        log.info("已刷新 component_access_token，有效期 {}s", expiresIn);
        return token;
    }

    // ==================== 商户授权 ====================

    @Override
    public String getPreAuthCode() {
        String componentToken = getComponentAccessToken();
        WxOpenPlatformConfig config = getConfig();

        String url = WX_API + "/cgi-bin/component/api_create_preauthcode?component_access_token=" + componentToken;
        Map<String, String> body = new HashMap<>();
        body.put("component_appid", config.getComponentAppid());

        JsonNode resp = postJson(url, body);
        return resp.get("pre_auth_code").asText();
    }

    @Override
    public String buildAuthUrl(Long merchantId, String redirectUri) {
        WxOpenPlatformConfig config = getConfig();
        String preAuthCode = getPreAuthCode();

        // auth_type=2 表示仅展示小程序授权
        return "https://mp.weixin.qq.com/cgi-bin/componentloginpage"
                + "?component_appid=" + config.getComponentAppid()
                + "&pre_auth_code=" + preAuthCode
                + "&redirect_uri=" + redirectUri + "?merchantId=" + merchantId
                + "&auth_type=2";
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void handleAuthCallback(String authorizationCode, Long merchantId) {
        String componentToken = getComponentAccessToken();
        WxOpenPlatformConfig config = getConfig();

        String url = WX_API + "/cgi-bin/component/api_query_auth?component_access_token=" + componentToken;
        Map<String, String> body = new HashMap<>();
        body.put("component_appid", config.getComponentAppid());
        body.put("authorization_code", authorizationCode);

        JsonNode resp = postJson(url, body);
        JsonNode authInfo = resp.get("authorization_info");

        String authorizerAppid = authInfo.get("authorizer_appid").asText();
        String authorizerRefreshToken = authInfo.get("authorizer_refresh_token").asText();

        // 保存到 merchant 表
        LambdaUpdateWrapper<Merchant> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(Merchant::getId, merchantId)
                .set(Merchant::getWxAuthorizerAppid, authorizerAppid)
                .set(Merchant::getWxAuthorizerRefreshToken, authorizerRefreshToken)
                .set(Merchant::getWxAuthorizationStatus, 1)
                .set(Merchant::getUpdateTime, LocalDateTime.now());
        merchantMapper.update(null, wrapper);

        log.info("商户 {} 授权成功，appid={}", merchantId, authorizerAppid);
    }

    @Override
    public String getAuthorizerAccessToken(Long merchantId) {
        Merchant merchant = merchantMapper.selectById(merchantId);
        if (merchant == null || merchant.getWxAuthorizerRefreshToken() == null) {
            throw new RuntimeException("商户未授权小程序");
        }

        String componentToken = getComponentAccessToken();
        WxOpenPlatformConfig config = getConfig();

        String url = WX_API + "/cgi-bin/component/api_authorizer_token?component_access_token=" + componentToken;
        Map<String, String> body = new HashMap<>();
        body.put("component_appid", config.getComponentAppid());
        body.put("authorizer_appid", merchant.getWxAuthorizerAppid());
        body.put("authorizer_refresh_token", merchant.getWxAuthorizerRefreshToken());

        JsonNode resp = postJson(url, body);
        String newRefreshToken = resp.get("authorizer_refresh_token").asText();

        // 更新 refresh_token（微信可能会更新）
        if (!newRefreshToken.equals(merchant.getWxAuthorizerRefreshToken())) {
            LambdaUpdateWrapper<Merchant> wrapper = new LambdaUpdateWrapper<>();
            wrapper.eq(Merchant::getId, merchantId)
                    .set(Merchant::getWxAuthorizerRefreshToken, newRefreshToken);
            merchantMapper.update(null, wrapper);
        }

        return resp.get("authorizer_access_token").asText();
    }

    // ==================== 代码管理 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void uploadCode(Long merchantId, long templateId, String userVersion, String userDesc) {
        String token = getAuthorizerAccessToken(merchantId);
        Merchant merchant = merchantMapper.selectById(merchantId);

        String url = WX_API + "/wxa/commit?access_token=" + token;

        // ext_json 用于注入商户特定配置（如 merchantId）
        Map<String, Object> extJson = new HashMap<>();
        Map<String, Object> extAppid = new HashMap<>();
        extAppid.put("merchantId", merchantId);
        extJson.put("ext", extAppid);

        Map<String, Object> body = new HashMap<>();
        body.put("template_id", templateId);
        body.put("user_version", userVersion);
        body.put("user_desc", userDesc);
        try {
            body.put("ext_json", objectMapper.writeValueAsString(extJson));
        } catch (Exception e) {
            throw new RuntimeException("序列化 ext_json 失败", e);
        }

        JsonNode resp = postJson(url, body);
        checkWxError(resp, "上传代码");

        // 更新商户状态
        LambdaUpdateWrapper<Merchant> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(Merchant::getId, merchantId)
                .set(Merchant::getWxMiniVersion, userVersion)
                .set(Merchant::getWxMiniStatus, 1) // 已上传
                .set(Merchant::getUpdateTime, LocalDateTime.now());
        merchantMapper.update(null, wrapper);

        log.info("商户 {} 小程序代码上传成功，版本: {}", merchantId, userVersion);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public long submitAudit(Long merchantId) {
        String token = getAuthorizerAccessToken(merchantId);

        String url = WX_API + "/wxa/submit_audit?access_token=" + token;
        // 空 body 提交全部页面审核
        Map<String, Object> body = new HashMap<>();

        JsonNode resp = postJson(url, body);
        checkWxError(resp, "提交审核");

        long auditId = resp.get("auditid").asLong();

        LambdaUpdateWrapper<Merchant> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(Merchant::getId, merchantId)
                .set(Merchant::getWxMiniStatus, 2) // 审核中
                .set(Merchant::getWxMiniAuditId, auditId)
                .set(Merchant::getUpdateTime, LocalDateTime.now());
        merchantMapper.update(null, wrapper);

        log.info("商户 {} 小程序提交审核，auditId={}", merchantId, auditId);
        return auditId;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void release(Long merchantId) {
        String token = getAuthorizerAccessToken(merchantId);

        String url = WX_API + "/wxa/release?access_token=" + token;
        JsonNode resp = postJson(url, new HashMap<>());
        checkWxError(resp, "发布小程序");

        LambdaUpdateWrapper<Merchant> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(Merchant::getId, merchantId)
                .set(Merchant::getWxMiniStatus, 3) // 已发布
                .set(Merchant::getUpdateTime, LocalDateTime.now());
        merchantMapper.update(null, wrapper);

        log.info("商户 {} 小程序发布成功", merchantId);
    }

    @Override
    public Map<String, Object> getAuditStatus(Long merchantId, long auditId) {
        String token = getAuthorizerAccessToken(merchantId);

        String url = WX_API + "/wxa/get_auditstatus?access_token=" + token;
        Map<String, Object> body = new HashMap<>();
        body.put("auditid", auditId);

        JsonNode resp = postJson(url, body);
        checkWxError(resp, "查询审核状态");

        Map<String, Object> result = new HashMap<>();
        result.put("status", resp.get("status").asInt()); // 0审核成功 1审核被拒绝 2审核中 3已撤回
        if (resp.has("reason")) {
            result.put("reason", resp.get("reason").asText());
        }
        return result;
    }

    @Override
    public Object getTemplateList() {
        String componentToken = getComponentAccessToken();
        String url = WX_API + "/wxa/gettemplatelist?access_token=" + componentToken;

        JsonNode resp = postJson(url, new HashMap<>());
        checkWxError(resp, "获取模板列表");
        return resp.get("template_list");
    }

    // ==================== 工具方法 ====================

    private WxOpenPlatformConfig getConfig() {
        LambdaQueryWrapper<WxOpenPlatformConfig> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(WxOpenPlatformConfig::getStatus, 1)
                .last("LIMIT 1");
        return configMapper.selectOne(wrapper);
    }

    private JsonNode postJson(String url, Object body) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            String json = objectMapper.writeValueAsString(body);
            HttpEntity<String> entity = new HttpEntity<>(json, headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            return objectMapper.readTree(response.getBody());
        } catch (Exception e) {
            throw new RuntimeException("微信API调用失败: " + e.getMessage(), e);
        }
    }

    private void checkWxError(JsonNode resp, String action) {
        if (resp.has("errcode") && resp.get("errcode").asInt() != 0) {
            String errMsg = resp.has("errmsg") ? resp.get("errmsg").asText() : "未知错误";
            throw new RuntimeException(action + "失败: " + resp.get("errcode").asInt() + " - " + errMsg);
        }
    }
}
