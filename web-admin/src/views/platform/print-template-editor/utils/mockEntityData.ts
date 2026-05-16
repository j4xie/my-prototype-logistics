/**
 * Per-entityType mock data used solely for editor-side preview rendering.
 * Mirrors the shape that PrintController.buildXxxPayload() currently produces
 * (Day 6 MVP stubs). Day 4 backend will pull real entity data on Preview PDF.
 */

import type { PrintEntityType } from './printSchemaTypes'

export const MOCK_DATA: Record<PrintEntityType, Record<string, unknown>> = {
  PRINT_SALES_ORDER: {
    factoryName: '白垩纪食品 — F001',
    factoryId: 'F001',
    order: {
      id: 'SO-001',
      orderNumber: 'SO-20260516-001',
      orderDate: '2026-05-16',
      customerName: '示例餐饮连锁',
      salesperson: '张三',
      totalAmount: 12345.67,
      remark: '加急',
      items: [
        { materialName: '酱牛肉', quantity: 30, unit: 'kg', unitPrice: 88, subtotal: 2640 },
        { materialName: '盐水鸭', quantity: 25, unit: '只', unitPrice: 45, subtotal: 1125 },
        { materialName: '卤豆干', quantity: 100, unit: 'kg', unitPrice: 18, subtotal: 1800 },
      ],
    },
  },
  PRINT_PURCHASE_ORDER: {
    factoryName: '白垩纪食品 — F001',
    factoryId: 'F001',
    order: {
      id: 'PO-20260516-001',
      orderNumber: 'PO-20260516-001',
      orderDate: '2026-05-16',
      supplierName: '示例肉类供应商',
      expectedDeliveryDate: '2026-05-20',
      totalAmount: 8520.0,
      qrPayload: 'PO:F001:PO-20260516-001',
      items: [
        { materialName: '牛后腿', spec: '冷冻', quantity: 50, unit: 'kg', unitPrice: 72 },
        { materialName: '鸭子', spec: '白条', quantity: 60, unit: '只', unitPrice: 42 },
      ],
    },
  },
  PRINT_QUOTATION: {
    factoryName: '白垩纪食品 — F001',
    quotation: {
      quotationNumber: 'Q-20260516-002',
      quotationDate: '2026-05-16',
      customerName: '示例采购方',
      validUntil: '2026-06-15',
      salesperson: '李四',
      totalAmount: 28800.0,
      items: [],
    },
  },
  PRINT_PRODUCTION_TASK: {
    factoryName: '白垩纪食品 — F001',
    task: {
      taskNumber: 'PT-20260516-001',
      productName: '盐水鸭',
      plannedQuantity: 500,
      unit: '只',
      startDate: '2026-05-17',
      endDate: '2026-05-19',
      workshopName: '一号车间',
      supervisor: '王五',
      processes: [],
    },
  },
  PRINT_MATERIAL_REQUISITION: {
    factoryName: '白垩纪食品 — F001',
    requisition: {
      requisitionNumber: 'MR-20260516-001',
      productName: '盐水鸭',
      workshop: '一号车间',
      requester: '赵六',
      requestDate: '2026-05-16',
      items: [],
    },
  },
  PRINT_WEIGHING_SLIP: {
    factoryName: '白垩纪食品 — F001',
    slip: {
      slipNumber: 'WS-20260516-001',
      productName: '卤鸭货',
      partnerName: '示例配送站',
      weighDate: '2026-05-16',
      operator: '钱七',
      grossWeight: 158.6,
      tareWeight: 23.4,
      netWeight: 135.2,
      items: [
        { boxNo: 'B001', grossWeight: 26.5, tareWeight: 3.9, netWeight: 22.6 },
        { boxNo: 'B002', grossWeight: 27.1, tareWeight: 3.9, netWeight: 23.2 },
        { boxNo: 'B003', grossWeight: 25.8, tareWeight: 3.9, netWeight: 21.9 },
        { boxNo: 'B004', grossWeight: 26.3, tareWeight: 3.9, netWeight: 22.4 },
        { boxNo: 'B005', grossWeight: 26.4, tareWeight: 3.9, netWeight: 22.5 },
        { boxNo: 'B006', grossWeight: 26.5, tareWeight: 3.9, netWeight: 22.6 },
      ],
    },
  },
}
