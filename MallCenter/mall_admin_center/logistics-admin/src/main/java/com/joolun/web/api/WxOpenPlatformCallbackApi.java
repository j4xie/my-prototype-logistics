package com.joolun.web.api;

import com.joolun.mall.service.WxOpenPlatformService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 微信开放平台回调接口（公开，不需要登录）
 *
 * 微信服务器会推送以下消息到此接口：
 * 1. component_verify_ticket — 每10分钟推送一次
 * 2. 授权变更通知 — 商户授权/取消授权
 * 3. 审核结果通知 — 小程序审核通过/拒绝
 */
@Slf4j
@RestController
@RequestMapping("/weixin/api/open-platform")
@RequiredArgsConstructor
public class WxOpenPlatformCallbackApi {

    private final WxOpenPlatformService wxOpenPlatformService;

    private static final Pattern XML_TAG_PATTERN = Pattern.compile("<(\\w+)><!\\[CDATA\\[(.+?)]]></\\1>|<(\\w+)>(.+?)</\\3>");

    /**
     * 微信推送事件接收（XML 格式）
     */
    @PostMapping("/event")
    public String handleEvent(@RequestBody String xmlBody) {
        try {
            log.info("收到微信开放平台推送: {}", xmlBody);

            Map<String, String> data = parseXml(xmlBody);
            String infoType = data.getOrDefault("InfoType", "");

            switch (infoType) {
                case "component_verify_ticket":
                    wxOpenPlatformService.handleVerifyTicket(data.get("ComponentVerifyTicket"));
                    break;

                case "authorized":
                    log.info("商户授权成功: appid={}", data.get("AuthorizerAppid"));
                    break;

                case "unauthorized":
                    log.warn("商户取消授权: appid={}", data.get("AuthorizerAppid"));
                    break;

                case "updateauthorized":
                    log.info("商户更新授权: appid={}", data.get("AuthorizerAppid"));
                    break;

                default:
                    log.info("未处理的事件类型: {}", infoType);
            }
        } catch (Exception e) {
            log.error("处理微信推送失败", e);
        }

        return "success";
    }

    /**
     * 微信消息验证（GET 请求）
     */
    @GetMapping("/event")
    public String verify(@RequestParam(value = "echostr", required = false) String echostr) {
        return echostr != null ? echostr : "ok";
    }

    /**
     * 代商户接收消息
     * URL 格式: /weixin/api/open-platform/{appId}/callback
     */
    @PostMapping("/{appId}/callback")
    public String handleMiniProgramEvent(@PathVariable String appId,
                                          @RequestBody String xmlBody) {
        try {
            log.info("收到小程序 {} 消息推送: {}", appId, xmlBody);

            Map<String, String> data = parseXml(xmlBody);
            String event = data.getOrDefault("Event", "");

            if ("weapp_audit_success".equals(event)) {
                log.info("小程序 {} 审核通过", appId);
            } else if ("weapp_audit_fail".equals(event)) {
                String reason = data.getOrDefault("Reason", "未知原因");
                log.warn("小程序 {} 审核失败: {}", appId, reason);
            }
        } catch (Exception e) {
            log.error("处理小程序消息失败", e);
        }

        return "success";
    }

    /**
     * 简单 XML 解析（避免引入 jackson-dataformat-xml 依赖）
     */
    private Map<String, String> parseXml(String xml) {
        Map<String, String> map = new HashMap<>();
        Matcher matcher = XML_TAG_PATTERN.matcher(xml);
        while (matcher.find()) {
            String key = matcher.group(1) != null ? matcher.group(1) : matcher.group(3);
            String value = matcher.group(2) != null ? matcher.group(2) : matcher.group(4);
            map.put(key, value);
        }
        return map;
    }
}
