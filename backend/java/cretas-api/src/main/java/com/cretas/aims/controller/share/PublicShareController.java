package com.cretas.aims.controller.share;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.service.share.ShareLinkService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 公开分享访问端点 (PR #872 follow-up to #860).
 *
 * <p><b>NO AUTH</b> — anyone with the token URL sees the payload. This path is
 * registered in {@code WebMvcConfig.addInterceptors} as an excludePathPattern
 * so {@code JwtAuthInterceptor} doesn't reject anonymous requests.
 *
 * <p>The token itself IS the secret (32-char base62 ≈ 190 bits of entropy);
 * no other authentication is required.
 *
 * <p>Returns 404 when token is unknown, 410 when expired / revoked.
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/public/share")
@RequiredArgsConstructor
@Tag(name = "公开分享", description = "匿名读取分享链接 — 无需登录")
public class PublicShareController {

    private final ShareLinkService shareLinkService;

    @GetMapping("/{token}")
    @Operation(summary = "通过 token 读取分享内容",
            description = "返回 entityType / entityLabel / expiresAt / includePrice / payload (PO 或 SO)")
    public ApiResponse<Map<String, Object>> view(@PathVariable @NotBlank String token) {
        Map<String, Object> data = shareLinkService.resolveShareLink(token);
        return ApiResponse.success("查询成功", data);
    }
}
