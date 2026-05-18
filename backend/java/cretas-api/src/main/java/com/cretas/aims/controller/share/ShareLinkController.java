package com.cretas.aims.controller.share;

import com.cretas.aims.config.RequireRole;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.share.CreateShareLinkRequest;
import com.cretas.aims.dto.share.ShareLinkResponse;
import com.cretas.aims.entity.share.ShareLink;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.service.share.ShareLinkService;
import com.cretas.aims.utils.FactoryAccessValidator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

/**
 * 转发 / 分享链接 创建端点 (PR #872 follow-up to #860).
 *
 * <p>RBAC: roles below mirror the union of {@code createPurchaseOrder} and
 * {@code createSalesOrder} writers — anyone who can write a PO or SO should
 * be able to share one. Platform admins included for cross-factory ops.
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/share-links")
@RequiredArgsConstructor
@Tag(name = "分享链接", description = "生成 / 管理 PO/SO 的只读分享链接 (#872)")
public class ShareLinkController {

    private final ShareLinkService shareLinkService;
    private final FactoryAccessValidator factoryAccessValidator;

    @Value("${cretas.share.base-url:https://admin.cretaceousfuture.com}")
    private String shareBaseUrl;

    @PostMapping
    @Operation(summary = "创建分享链接", description = "生成 token + 返回完整 share URL")
    @RequireRole({
            "factory_super_admin",
            "platform_admin",
            "permission_admin",
            "department_admin",
            "procurement_manager",
            "sales_manager",
            "finance_manager",
            "dispatcher"
    })
    public ApiResponse<ShareLinkResponse> create(
            @PathVariable @NotBlank String factoryId,
            @Valid @RequestBody CreateShareLinkRequest req,
            HttpServletRequest request) {
        factoryAccessValidator.validateAccess(factoryId);

        Long userId = extractUserId(request);
        if (userId == null) {
            throw new BusinessException(401, "未认证用户");
        }

        ShareLink link = shareLinkService.createShareLink(
                factoryId,
                req.getEntityType(),
                req.getEntityId(),
                req.getExpiresDays(),
                req.isIncludePrice(),
                userId
        );

        String base = shareBaseUrl == null ? "" : shareBaseUrl.replaceAll("/+$", "");
        ShareLinkResponse resp = new ShareLinkResponse(
                link.getToken(),
                base + "/share/" + link.getToken(),
                link.getExpiresAt(),
                link.getExpiresAt() == null
        );
        log.info("创建分享链接成功: factoryId={}, entityType={}, entityId={}, expiresDays={}, includePrice={}, userId={}",
                factoryId, req.getEntityType(), req.getEntityId(),
                req.getExpiresDays(), req.isIncludePrice(), userId);
        return ApiResponse.success("分享链接已生成", resp);
    }

    /**
     * Read userId from the request attribute set by {@code JwtAuthInterceptor}.
     * Returns {@code null} when the value is missing or wrong-typed.
     */
    private static Long extractUserId(HttpServletRequest request) {
        Object v = request.getAttribute("userId");
        if (v instanceof Long) {
            return (Long) v;
        }
        if (v instanceof Integer) {
            return ((Integer) v).longValue();
        }
        if (v instanceof String) {
            try {
                return Long.parseLong((String) v);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
