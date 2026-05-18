package com.cretas.aims.dto.share;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Response DTO for {@code POST /api/mobile/{factoryId}/share-links} (PR #872).
 *
 * <p>Returns the token, full shareable URL (so frontend can copy directly to
 * clipboard without reconstructing the base URL), and the expiry timestamp.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ShareLinkResponse {
    /** The token alone (in case caller wants to construct a different URL). */
    private String token;

    /** Full URL ready for clipboard copy, e.g. https://admin.cretaceousfuture.com/share/{token}. */
    private String url;

    /** ISO-8601 expiry; null = permanent. */
    private LocalDateTime expiresAt;

    /** True if {@code expiresAt} is null (convenience for frontend UI). */
    private boolean permanent;
}
