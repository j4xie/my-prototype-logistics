package com.cretas.aims.service.purchase;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.purchase.AddSupplierPriceRequest;
import com.cretas.aims.dto.purchase.CreateInquiryQuoteRequest;
import com.cretas.aims.dto.purchase.SelectAndConvertRequest;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.entity.purchase.InquiryQuote;
import com.cretas.aims.entity.purchase.InquiryQuoteSupplierPrice;

import java.util.List;

/**
 * 核价单服务 (P-NUCLEAR-1, 28-Backlog #30).
 *
 * <p>三阶段 pipeline:
 * <pre>
 *   create()           DRAFT
 *     ↓ submit         INQUIRING
 *   addSupplierPrice() QUOTED (有 ≥1 报价后自动转)
 *     ↓
 *   selectAndConvertToPurchaseOrder() → CONVERTED + PO 生成
 * </pre>
 *
 * <p>所有写操作满足防呆规范 (fool-proof-design.md):
 * <ul>
 *   <li>R2: 异常 message 含 inquiryNumber + supplierName context</li>
 *   <li>R4: selectAndConvert 幂等 — 已转化拒绝重复</li>
 * </ul>
 */
public interface InquiryQuoteService {

    /** 创建核价单 (DRAFT 状态). */
    InquiryQuote create(String factoryId, CreateInquiryQuoteRequest request, Long userId);

    /** 提交询价 (DRAFT → INQUIRING). */
    InquiryQuote submit(String factoryId, String inquiryId);

    /** 取消核价单 (任何非 CONVERTED 状态 → CANCELLED). */
    InquiryQuote cancel(String factoryId, String inquiryId);

    InquiryQuote getById(String factoryId, String inquiryId);

    PageResponse<InquiryQuote> list(String factoryId, int page, int size);

    /**
     * 添加 / 更新供应商报价. 若 (inquiry, supplier) 已存在报价则 UPDATE 否则 INSERT.
     * 第一条报价加入后 status: INQUIRING → QUOTED.
     */
    InquiryQuoteSupplierPrice addOrUpdateSupplierPrice(
            String factoryId, String inquiryId, AddSupplierPriceRequest request);

    List<InquiryQuoteSupplierPrice> listSupplierPrices(String factoryId, String inquiryId);

    /**
     * 选定中标供应商 + 转化为采购单 (idempotent).
     *
     * <p>防呆 R4: 若 inquiry.purchaseOrderId 已存在 → 抛 409 BusinessException 携带
     * existingPurchaseOrderId, 不重复创建 PO. 前端 catch 409 跳转到已有 PO.
     */
    PurchaseOrder selectAndConvertToPurchaseOrder(
            String factoryId, String inquiryId, SelectAndConvertRequest request, Long userId);
}
