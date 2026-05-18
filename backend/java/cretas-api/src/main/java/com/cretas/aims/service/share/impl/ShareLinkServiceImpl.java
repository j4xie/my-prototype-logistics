package com.cretas.aims.service.share.impl;

import com.cretas.aims.annotation.Loggable;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.entity.inventory.PurchaseOrderItem;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.inventory.SalesOrderItem;
import com.cretas.aims.entity.share.ShareLink;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.inventory.PurchaseOrderRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.repository.share.ShareLinkRepository;
import com.cretas.aims.service.share.ShareLinkService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Share-link service impl (PR #872 follow-up to #860).
 *
 * <p>Token entropy: 32-char base62 from {@link SecureRandom} → ~190 bits, well
 * above the 128-bit guidance for unguessable URL tokens. Sufficient for the
 * "anyone with the URL can read" model (no need for HMAC since the token IS
 * the secret).
 *
 * <p>Price filtering: when {@code includePrice=false}, the payload omits the
 * total/unitPrice/tax fields entirely (they're not emitted as null) so the
 * public viewer can't tell the entity has prices at all.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShareLinkServiceImpl implements ShareLinkService {

    static final String ENTITY_TYPE_PO = "PurchaseOrder";
    static final String ENTITY_TYPE_SO = "SalesOrder";

    private static final SecureRandom RNG = new SecureRandom();
    private static final char[] BASE62 = (
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    ).toCharArray();
    private static final int TOKEN_LENGTH = 32;

    private final ShareLinkRepository shareLinkRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final SalesOrderRepository salesOrderRepository;

    @Override
    @Transactional
    @Loggable(module = "SHARE", action = "CREATE", entityType = "ShareLink",
            entityIdParam = "entityId")
    public ShareLink createShareLink(String factoryId, String entityType, String entityId,
                                     int expiresDays, boolean includePrice, Long userId) {
        if (userId == null) {
            throw new BusinessException(401, "未认证用户不能创建分享链接");
        }
        validateEntityType(entityType);

        // Validate entity exists + belongs to factory (防呆 R4: 不允许伪造跨工厂链接).
        verifyEntityOwnership(factoryId, entityType, entityId);

        LocalDateTime expiresAt = computeExpiresAt(expiresDays);

        ShareLink link = ShareLink.builder()
                .token(generateToken())
                .factoryId(factoryId)
                .entityType(entityType)
                .entityId(entityId)
                .includePrice(includePrice)
                .expiresAt(expiresAt)
                .createdBy(userId)
                .createdAt(LocalDateTime.now())
                .viewCount(0)
                .build();

        return shareLinkRepository.save(link);
    }

    @Override
    @Transactional
    public Map<String, Object> resolveShareLink(String token) {
        if (token == null || token.isBlank()) {
            throw new ResourceNotFoundException("ShareLink", "token", token);
        }
        ShareLink link = shareLinkRepository.findByToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("ShareLink", "token", token));

        if (link.isExpiredOrRevoked()) {
            throw new BusinessException(410, "分享链接已过期或已被撤销");
        }

        // Hydrate the entity payload, filtering prices when needed.
        Map<String, Object> payload;
        String entityLabel;
        if (ENTITY_TYPE_PO.equals(link.getEntityType())) {
            PurchaseOrder po = purchaseOrderRepository.findById(link.getEntityId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "PurchaseOrder", "id", link.getEntityId()));
            payload = buildPurchaseOrderPayload(po, link.getIncludePrice());
            entityLabel = po.getOrderNumber();
        } else if (ENTITY_TYPE_SO.equals(link.getEntityType())) {
            SalesOrder so = salesOrderRepository.findById(link.getEntityId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "SalesOrder", "id", link.getEntityId()));
            payload = buildSalesOrderPayload(so, link.getIncludePrice());
            entityLabel = so.getOrderNumber();
        } else {
            // Defensive: schema/code drift safeguard.
            throw new BusinessException(500, "不支持的实体类型: " + link.getEntityType());
        }

        // Best-effort view counter (failure here must not break the read).
        try {
            shareLinkRepository.recordView(link.getToken(), LocalDateTime.now());
        } catch (Exception e) {
            log.warn("[ShareLink] recordView failed for token={}, ignoring: {}",
                    token, e.getMessage());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("entityType", link.getEntityType());
        result.put("entityLabel", entityLabel);
        result.put("includePrice", link.getIncludePrice());
        result.put("expiresAt", link.getExpiresAt());
        result.put("payload", payload);
        return result;
    }

    // ==================== private helpers ====================

    static void validateEntityType(String entityType) {
        if (!ENTITY_TYPE_PO.equals(entityType) && !ENTITY_TYPE_SO.equals(entityType)) {
            throw new BusinessException(400,
                    "entityType 必须是 PurchaseOrder 或 SalesOrder, 实际收到: " + entityType);
        }
    }

    private void verifyEntityOwnership(String factoryId, String entityType, String entityId) {
        if (ENTITY_TYPE_PO.equals(entityType)) {
            PurchaseOrder po = purchaseOrderRepository.findById(entityId)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "PurchaseOrder", "id", entityId));
            if (!factoryId.equals(po.getFactoryId())) {
                throw new BusinessException(403, "采购单不属于当前工厂");
            }
        } else {
            SalesOrder so = salesOrderRepository.findById(entityId)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "SalesOrder", "id", entityId));
            if (!factoryId.equals(so.getFactoryId())) {
                throw new BusinessException(403, "销售单不属于当前工厂");
            }
        }
    }

    static LocalDateTime computeExpiresAt(int expiresDays) {
        if (expiresDays <= 0) {
            // 0 (or negative as defensive) means permanent.
            return null;
        }
        if (expiresDays > 3650) {
            // Defensive cap at ~10 years.
            expiresDays = 3650;
        }
        return LocalDateTime.now().plusDays(expiresDays);
    }

    static String generateToken() {
        char[] buf = new char[TOKEN_LENGTH];
        for (int i = 0; i < TOKEN_LENGTH; i++) {
            buf[i] = BASE62[RNG.nextInt(BASE62.length)];
        }
        return new String(buf);
    }

    /**
     * Build a read-only PO payload. When {@code includePrice=false}, omit
     * unitPrice / taxRate / boxQuantity-price / totalAmount / taxAmount.
     */
    static Map<String, Object> buildPurchaseOrderPayload(PurchaseOrder po, boolean includePrice) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", po.getId());
        data.put("orderNumber", po.getOrderNumber());
        data.put("supplierId", po.getSupplierId());
        data.put("supplierName", po.getSupplierName());
        data.put("purchaseType", po.getPurchaseType() == null ? null : po.getPurchaseType().name());
        data.put("orderDate", po.getOrderDate());
        data.put("expectedDeliveryDate", po.getExpectedDeliveryDate());
        data.put("status", po.getStatus() == null ? null : po.getStatus().name());
        data.put("remark", po.getRemark());
        data.put("createdAt", po.getCreatedAt());
        if (includePrice) {
            data.put("totalAmount", po.getTotalAmount());
            data.put("taxAmount", po.getTaxAmount());
        }

        List<Map<String, Object>> items = new ArrayList<>();
        List<PurchaseOrderItem> rawItems = Optional.ofNullable(po.getItems()).orElse(new ArrayList<>());
        for (PurchaseOrderItem item : rawItems) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", item.getId());
            row.put("materialTypeId", item.getMaterialTypeId());
            row.put("materialName", item.getMaterialName());
            row.put("specification", item.getSpecification());
            row.put("quantity", item.getQuantity());
            row.put("unit", item.getUnit());
            row.put("receivedQuantity", item.getReceivedQuantity());
            row.put("remark", item.getRemark());
            if (includePrice) {
                row.put("unitPrice", item.getUnitPrice());
                row.put("taxRate", item.getTaxRate());
            }
            items.add(row);
        }
        data.put("items", items);
        return data;
    }

    /**
     * Build a read-only SO payload. When {@code includePrice=false}, omit
     * unitPrice / discountRate / totalAmount fields.
     */
    static Map<String, Object> buildSalesOrderPayload(SalesOrder so, boolean includePrice) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", so.getId());
        data.put("orderNumber", so.getOrderNumber());
        data.put("customerId", so.getCustomerId());
        data.put("customerName", so.getCustomerName());
        data.put("orderDate", so.getOrderDate());
        data.put("requiredDeliveryDate", so.getRequiredDeliveryDate());
        data.put("deliveryAddress", so.getDeliveryAddress());
        data.put("status", so.getStatus() == null ? null : so.getStatus().name());
        data.put("remark", so.getRemark());
        data.put("createdAt", so.getCreatedAt());
        if (includePrice) {
            data.put("totalAmount", so.getTotalAmount());
        }

        List<Map<String, Object>> items = new ArrayList<>();
        List<SalesOrderItem> rawItems = Optional.ofNullable(so.getItems()).orElse(new ArrayList<>());
        for (SalesOrderItem item : rawItems) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", item.getId());
            row.put("productTypeId", item.getProductTypeId());
            row.put("productName", item.getProductName());
            row.put("quantity", item.getQuantity());
            row.put("unit", item.getUnit());
            row.put("deliveredQuantity", item.getDeliveredQuantity());
            if (includePrice) {
                row.put("unitPrice", item.getUnitPrice());
                row.put("discountRate", item.getDiscountRate());
            }
            items.add(row);
        }
        data.put("items", items);
        return data;
    }
}
