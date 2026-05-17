package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.QualityReturnOrder;
import com.cretas.aims.entity.enums.QualityReturnStatus;
import com.cretas.aims.entity.enums.QualityReturnTargetType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Sprint4-H Q-RETURN-1: 质检退回单业务接口.
 *
 * <p>状态机: createDraft (DRAFT) → confirm (DRAFT→CONFIRMED) → ship (CONFIRMED→SHIPPED).
 */
public interface QualityReturnOrderService {

    /**
     * 创建退回单草稿. 自动生成 returnNumber.
     *
     * @return DRAFT 状态新单
     */
    QualityReturnOrder createDraft(String factoryId, String qualityInspectionId,
                                    QualityReturnTargetType targetType, String targetId,
                                    String targetName, String materialId,
                                    BigDecimal quantity, String unit, String reason,
                                    Long createdBy);

    /** 更新草稿. 仅 DRAFT 可改, 否则抛 409. */
    QualityReturnOrder updateDraft(String factoryId, String id,
                                    QualityReturnTargetType targetType, String targetId,
                                    String targetName, String materialId,
                                    BigDecimal quantity, String unit, String reason);

    /** 确认: DRAFT → CONFIRMED. */
    QualityReturnOrder confirm(String factoryId, String id, Long operatorId);

    /** 发出: CONFIRMED → SHIPPED. 物流单号必填. */
    QualityReturnOrder ship(String factoryId, String id, String shippingTrackingNo, Long operatorId);

    /** 撤销: DRAFT → 软删 (CONFIRMED/SHIPPED 不可撤销). */
    void cancelDraft(String factoryId, String id);

    QualityReturnOrder get(String factoryId, String id);

    PageResponse<QualityReturnOrder> list(String factoryId,
                                           QualityReturnStatus status,
                                           QualityReturnTargetType targetType,
                                           String qualityInspectionId,
                                           String targetId,
                                           LocalDateTime fromDate,
                                           LocalDateTime toDate,
                                           int page, int size);
}
