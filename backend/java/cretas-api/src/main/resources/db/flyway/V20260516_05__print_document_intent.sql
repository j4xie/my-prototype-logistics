-- V20260516_02: Register PRINT_DOCUMENT intent for C-PRT-1.
--
-- Pairs with PrintDocumentTool.java (@Component, getToolName() returns
-- 'print_document'). The IntentExecutor reads `tool_name` from this row
-- to dispatch.
--
-- 触发: "打印这张采购单 PO-XXX" / "下载销售订单 PDF" / "发给供应商 PO-XXX" /
--      "生产任务单打印" / "领料单 PDF".
--
-- 5 documentType: SALES_ORDER / PURCHASE_ORDER / QUOTATION /
--                 PRODUCTION_TASK / MATERIAL_REQUISITION.
--
-- spec: 宏见竞品分析/01-客户档案/六扇门第三次-May7-part2.md 行 537-550 (PDF 打印闭环).
-- Pattern mirrors V20260513_02__revenue_report_intent.sql (proven).

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'PRINT_DOCUMENT',
    '打印单据 PDF',
    'DOCUMENT_OPERATION',
    'print_document',
    'LOW',
    '["打印", "PDF", "下载单子", "发给供应商", "打印这张单", "下载 PDF", "打印单子", "导出 PDF", "采购单 PDF", "销售单 PDF", "报价单 PDF", "生产任务单", "领料单"]',
    '打印 5 类业务单据 PDF (销售订单 / 采购订单 / 报价单 / 生产任务单 / 领料单). ' ||
    '采购订单含二维码 (供仓管员扫码入库). 返回前端可直接打开的 download URL.',
    80,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    intent_name = EXCLUDED.intent_name,
    intent_category = EXCLUDED.intent_category,
    sensitivity_level = EXCLUDED.sensitivity_level,
    keywords = EXCLUDED.keywords,
    description = EXCLUDED.description,
    priority = EXCLUDED.priority,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
