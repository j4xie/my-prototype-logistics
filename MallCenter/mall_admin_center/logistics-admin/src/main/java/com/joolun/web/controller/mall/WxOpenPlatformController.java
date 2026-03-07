package com.joolun.web.controller.mall;

import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.service.WxOpenPlatformService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 微信开放平台第三方平台 — Admin 管理接口
 */
@Slf4j
@RestController
@RequestMapping("/mall/wx-open-platform")
@RequiredArgsConstructor
public class WxOpenPlatformController {

    private final WxOpenPlatformService wxOpenPlatformService;

    /**
     * 生成商户授权链接
     * 商户在管理后台点击「授权小程序」→ 跳转此链接 → 扫码授权
     */
    @GetMapping("/auth-url")
    public AjaxResult getAuthUrl(@RequestParam Long merchantId,
                                  @RequestParam(defaultValue = "") String redirectUri) {
        if (redirectUri.isEmpty()) {
            // 默认回调地址
            redirectUri = "https://your-domain.com/mall/wx-open-platform/auth-callback";
        }
        String url = wxOpenPlatformService.buildAuthUrl(merchantId, redirectUri);
        return AjaxResult.success("授权链接生成成功", url);
    }

    /**
     * 授权回调（微信重定向到此地址）
     */
    @GetMapping("/auth-callback")
    public AjaxResult handleAuthCallback(@RequestParam("auth_code") String authCode,
                                          @RequestParam Long merchantId) {
        wxOpenPlatformService.handleAuthCallback(authCode, merchantId);
        return AjaxResult.success("授权成功");
    }

    /**
     * 代商户上传小程序代码
     */
    @PostMapping("/upload-code")
    public AjaxResult uploadCode(@RequestBody Map<String, Object> params) {
        Long merchantId = Long.valueOf(params.get("merchantId").toString());
        long templateId = Long.parseLong(params.get("templateId").toString());
        String version = params.getOrDefault("version", "1.0.0").toString();
        String desc = params.getOrDefault("desc", "商城小程序").toString();

        wxOpenPlatformService.uploadCode(merchantId, templateId, version, desc);
        return AjaxResult.success("代码上传成功");
    }

    /**
     * 代商户提交审核
     */
    @PostMapping("/submit-audit")
    public AjaxResult submitAudit(@RequestParam Long merchantId) {
        long auditId = wxOpenPlatformService.submitAudit(merchantId);
        return AjaxResult.success("已提交审核", auditId);
    }

    /**
     * 查询审核状态
     */
    @GetMapping("/audit-status")
    public AjaxResult getAuditStatus(@RequestParam Long merchantId,
                                      @RequestParam long auditId) {
        Map<String, Object> status = wxOpenPlatformService.getAuditStatus(merchantId, auditId);
        return AjaxResult.success(status);
    }

    /**
     * 代商户发布小程序
     */
    @PostMapping("/release")
    public AjaxResult release(@RequestParam Long merchantId) {
        wxOpenPlatformService.release(merchantId);
        return AjaxResult.success("发布成功");
    }

    /**
     * 获取可用代码模板列表
     */
    @GetMapping("/templates")
    public AjaxResult getTemplates() {
        return AjaxResult.success(wxOpenPlatformService.getTemplateList());
    }
}
