package com.cretas.aims.service.sales;

import com.cretas.aims.dto.sales.SalesNeedCreateRequest;
import com.cretas.aims.dto.sales.SalesNeedUpdateRequest;
import com.cretas.aims.entity.enums.SalesNeedStatus;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.sales.SalesNeed;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * Sprint 4 W2 S-NEED-1 — 销售需求业务接口.
 */
public interface SalesNeedService {

    SalesNeed create(String factoryId, SalesNeedCreateRequest req, Long userId);

    SalesNeed update(String factoryId, String id, SalesNeedUpdateRequest req);

    SalesNeed getById(String factoryId, String id);

    Page<SalesNeed> list(String factoryId, List<SalesNeedStatus> statuses, String customerId,
                          Pageable pageable);

    /** DRAFT → CONFIRMED. */
    SalesNeed confirm(String factoryId, String id);

    /** CONFIRMED → CONVERTED_TO_SO + 自动创建 SalesOrder + 双向关联. */
    SalesOrder convertToSalesOrder(String factoryId, String id, Long userId);

    /** DRAFT/CONFIRMED → CANCELLED. */
    SalesNeed cancel(String factoryId, String id);
}
