package com.cretas.aims.service.share;

import com.cretas.aims.entity.share.ShareLink;

import java.util.Map;

/**
 * Share-link service (PR #872 follow-up to #860).
 *
 * <p>Two responsibilities:
 * <ol>
 *   <li>{@link #createShareLink} — admin generates a token bound to a PO/SO,
 *       with expiry + price-visibility flag.</li>
 *   <li>{@link #resolveShareLink} — anonymous public viewer fetches the
 *       entity payload (price-filtered when needed).</li>
 * </ol>
 */
public interface ShareLinkService {

    /**
     * Generate a share token + persist the row.
     *
     * @param factoryId    target factory (entity must belong to this factory)
     * @param entityType   'PurchaseOrder' | 'SalesOrder'
     * @param entityId     PK of the entity
     * @param expiresDays  0 = permanent; 7 / 30 / 90 are the UI presets
     * @param includePrice whether viewers see price fields
     * @param userId       authenticated user that created the share
     */
    ShareLink createShareLink(String factoryId, String entityType, String entityId,
                              int expiresDays, boolean includePrice, Long userId);

    /**
     * Resolve a public token to its read-only payload.
     *
     * @return map with keys: {@code entityType} (string), {@code entityLabel}
     *         (string), {@code includePrice} (boolean), {@code expiresAt}
     *         (ISO-8601 string or null), {@code payload} (the actual data).
     * @throws com.cretas.aims.exception.ResourceNotFoundException if the token
     *         is unknown.
     * @throws com.cretas.aims.exception.BusinessException with code 410 if the
     *         token has expired or been revoked.
     */
    Map<String, Object> resolveShareLink(String token);
}
