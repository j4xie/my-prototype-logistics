package com.cretas.aims.service.inventory;

/**
 * 采购订单 PDF (供货单) 导出服务
 *
 * <p>
 * 客户原始诉求 (六扇门 May 7 2026 part 2 transcript):
 * <ul>
 *   <li>"采购订单要有打印功能" — 客户需要把采购订单当作"供货单"打印出来,发给供应商。</li>
 *   <li>"扫一下上面的拳运码" (条码) — 送货员把货送到时,仓管员扫码,自动调出采购订单进入入库流程。</li>
 *   <li>"双方签字拍张照" — 签收后让仓管员拍张照,作为附件存档。</li>
 * </ul>
 *
 * <p>
 * MVP scope (本 PR):
 * <ul>
 *   <li>生成 PDF 带 Code128 条码 (内容 = 采购订单号),供应商打印后送货员带过来。</li>
 *   <li>同时附 QR 码,方便 RN App v2 扫码识别 (扫描端实现作为 follow-up issue)。</li>
 * </ul>
 *
 * @author Cretas Team
 * @since 2026-05-11 (PR P0)
 */
public interface PurchaseOrderPdfService {

    /**
     * 生成采购订单 PDF (供货单) 字节流.
     *
     * @param factoryId 工厂 ID (path)
     * @param orderId   采购订单 ID (path)
     * @return PDF 字节内容
     * @throws com.cretas.aims.exception.BusinessException 订单不存在 / 跨工厂访问
     */
    byte[] generatePurchaseOrderPdf(String factoryId, String orderId);
}
