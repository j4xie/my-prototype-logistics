package com.cretas.aims.controller;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.security.PriceMaskResolver;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * C-PRT-1 — 单据打印 PDF Java 入口.
 *
 * <p>5 单据 GET endpoint, 每个端点:
 * <ol>
 *   <li>校验访问权限 (跟随实体权限, factoryId 隔离, RBAC defense-in-depth)</li>
 *   <li>组装打印 payload (entity → flat dict)</li>
 *   <li>RBAC: 无 {@code procurement:price:view} 权限的角色, 单价/小计/合计 等敏感字段
 *       在 payload 阶段 strip 为 "—" (PR #423 PriceFieldResponseAdvice 只 walk JSON,
 *       不 walk byte[] PDF — 必须在交给 Python 渲染之前 mask)</li>
 *   <li>POST 到 Python {@code /api/printing/{type}} 取 PDF bytes</li>
 *   <li>流回客户端 (Content-Disposition: attachment)</li>
 * </ol>
 *
 * <p><b>Sprint1-Fix-K2 (2026-05-15)</b>: PR #659 merge 时 5 endpoint 0 @RequirePermission +
 * 0 价格脱敏. 仓库管理员可以拉销售/采购订单 PDF 看到完整单价 — 绕开 PR #423 框架. 本 follow-up:
 * <ul>
 *   <li>每个 endpoint 加 module:read 网关 ({@code sales/procurement/production})</li>
 *   <li>{@link PriceMaskResolver#shouldMaskPrice(String)} 决定是否脱敏 payload 的金额字段</li>
 *   <li>{@code production-task} + {@code material-requisition} 不含金额, 仅做 RBAC 门禁</li>
 * </ul>
 *
 * @author Cretas Team — Track C
 * @since 2026-05-15 (C-PRT-1)
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/print")
@CrossOrigin(origins = {"https://www.cretaceousfuture.com", "http://139.196.165.140:8086", "http://localhost:5173"})
public class PrintController {

    /** Sentinel value used in printed PDFs for users without procurement:price:view permission. */
    private static final String PRICE_MASK = "—";

    /** Top-level payload keys whose value is a price/total — replace with {@link #PRICE_MASK} when masked. */
    private static final Set<String> PRICE_TOPLEVEL_KEYS = Set.of(
            "totalAmount",
            "subtotal",
            "taxAmount",
            "discountAmount",
            "payableAmount",
            "paidAmount",
            "balance"
    );

    /** Per-line-item keys inside {@code items[]} that are price-bearing. */
    private static final Set<String> PRICE_ITEM_KEYS = Set.of(
            "unitPrice",
            "subtotal",
            "totalAmount",
            "amount",
            "price",
            "discount",
            "discountAmount",
            "tax",
            "taxAmount"
    );

    private final RestTemplate pythonRestTemplate;
    private final String pythonBaseUrl;
    private final PriceMaskResolver priceMaskResolver;

    @Autowired
    public PrintController(
            @Qualifier("pythonAiRestTemplate") RestTemplate pythonRestTemplate,
            @Qualifier("pythonAiBaseUrl") String pythonBaseUrl,
            PriceMaskResolver priceMaskResolver) {
        this.pythonRestTemplate = pythonRestTemplate;
        this.pythonBaseUrl = pythonBaseUrl;
        this.priceMaskResolver = priceMaskResolver;
    }

    // ==================== 5 单据 endpoint ====================

    @GetMapping("/sales-order/{id}")
    @RequirePermission({"sales:read", "sales:read_write"})
    public ResponseEntity<byte[]> printSalesOrder(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestParam(required = false) Map<String, String> overrides,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Map<String, Object> payload = buildSalesOrderPayload(factoryId, id, overrides);
        applyPriceMask(payload, authorization, "sales-order", true);
        return proxyToPython("sales-order", payload, "sales-order-" + id, authorization);
    }

    @GetMapping("/purchase-order/{id}")
    @RequirePermission({"procurement:read", "procurement:read_write"})
    public ResponseEntity<byte[]> printPurchaseOrder(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestParam(required = false) Map<String, String> overrides,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Map<String, Object> payload = buildPurchaseOrderPayload(factoryId, id, overrides);
        applyPriceMask(payload, authorization, "purchase-order", true);
        return proxyToPython("purchase-order", payload, "purchase-order-" + id, authorization);
    }

    @GetMapping("/quotation/{id}")
    @RequirePermission({"sales:read", "sales:read_write"})
    public ResponseEntity<byte[]> printQuotation(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestParam(required = false) Map<String, String> overrides,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Map<String, Object> payload = buildQuotationPayload(factoryId, id, overrides);
        applyPriceMask(payload, authorization, "quotation", true);
        return proxyToPython("quotation", payload, "quotation-" + id, authorization);
    }

    @GetMapping("/production-task/{id}")
    @RequirePermission({"production:read", "production:read_write"})
    public ResponseEntity<byte[]> printProductionTask(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestParam(required = false) Map<String, String> overrides,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        // 生产任务单不含金额字段, 仅 RBAC 门禁即可.
        Map<String, Object> payload = buildProductionTaskPayload(factoryId, id, overrides);
        return proxyToPython("production-task", payload, "production-task-" + id, authorization);
    }

    @GetMapping("/material-requisition/{id}")
    @RequirePermission({"procurement:read", "procurement:read_write",
            "warehouse:read", "warehouse:read_write"})
    public ResponseEntity<byte[]> printMaterialRequisition(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestParam(required = false) Map<String, String> overrides,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        // 领料单不含金额字段, 仅 RBAC 门禁即可.
        Map<String, Object> payload = buildMaterialRequisitionPayload(factoryId, id, overrides);
        return proxyToPython("material-requisition", payload, "material-requisition-" + id, authorization);
    }

    // ==================== C-PRT-EDITOR-1 (Sprint 3 Track-J) ====================

    /**
     * Schema-driven PDF preview.
     *
     * <p>Co-exists with the 5 hardcoded endpoints above (which keep serving
     * the legacy fixed-layout PDFs); this endpoint renders whatever schema
     * the print template designer has saved (or an inline schema for live
     * editor preview without persistence).
     *
     * <p>Day 4 MVP scope:
     * <ul>
     *   <li>Body shape: {@code {templateId?, inlineSchemaJson?, entityType, entityId?, mockData?}}</li>
     *   <li>One of {@code templateId} or {@code inlineSchemaJson} required.</li>
     *   <li>{@code mockData} (sample entity payload from editor) is used as
     *       {@code entityData} when {@code entityId} is absent. Day 5+ will
     *       fetch real entity rows when {@code entityId} is supplied.</li>
     *   <li>Java masks price fields in the data dict via {@link PriceMaskResolver}
     *       BEFORE proxying to Python — Python does not know about RBAC.</li>
     * </ul>
     *
     * <p>RBAC: {@code system:read} is enough — any authenticated user can
     * preview templates for their own factory. The mutation endpoint that
     * saves templates (FormTemplateController) keeps its existing
     * {@code system:read_write} gate.
     *
     * @since 2026-05-16 (Sprint 3 Track-J Day 4)
     */
    @PostMapping("/preview-template")
    @RequirePermission({"system:read", "system:read_write"})
    public ResponseEntity<byte[]> printPreviewTemplate(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        // ── validate body ─────────────────────────────────────────────────
        Object templateIdObj = body.get("templateId");
        Object inlineSchemaJsonObj = body.get("inlineSchemaJson");
        Object entityTypeObj = body.get("entityType");

        String templateId = (templateIdObj instanceof String s) ? s : null;
        String inlineSchemaJson = (inlineSchemaJsonObj instanceof String s) ? s : null;
        String entityType = (entityTypeObj instanceof String s) ? s : null;

        if ((templateId == null || templateId.isBlank())
                && (inlineSchemaJson == null || inlineSchemaJson.isBlank())) {
            throw new BusinessException(400, "templateId 或 inlineSchemaJson 至少一项");
        }
        if (entityType == null || entityType.isBlank()) {
            throw new BusinessException(400, "entityType 必填");
        }
        if (!entityType.startsWith("PRINT_")) {
            throw new BusinessException(400, "entityType 必须以 PRINT_ 前缀 (e.g. PRINT_SALES_ORDER)");
        }

        // ── resolve entity data (mockData for editor / TODO: real entity for entityId) ─
        Object mockDataObj = body.get("mockData");
        Map<String, Object> entityData;
        if (mockDataObj instanceof Map<?, ?> m) {
            @SuppressWarnings("unchecked")
            Map<String, Object> typed = (Map<String, Object>) m;
            entityData = new HashMap<>(typed);
        } else {
            entityData = new HashMap<>();
        }
        // Day 5+: when entityId present, fetch real entity via the corresponding
        // service (SalesOrderService.getById etc.) and overwrite entityData.

        // ── price masking — same pattern as the 5 hardcoded endpoints ────
        boolean hasMonetary = !entityType.equals("PRINT_PRODUCTION_TASK")
                && !entityType.equals("PRINT_MATERIAL_REQUISITION");
        applyPriceMask(entityData, authorization, entityType, hasMonetary);

        // ── proxy to Python /api/printing/preview-template ───────────────
        Map<String, Object> pythonBody = new HashMap<>();
        pythonBody.put("factoryId", factoryId);
        pythonBody.put("templateId", templateId);
        pythonBody.put("inlineSchemaJson", inlineSchemaJson);
        pythonBody.put("entityType", entityType);
        pythonBody.put("entityData", entityData);

        String url = pythonBaseUrl + "/api/printing/preview-template";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        // Forward inbound Authorization so Python auth_middleware accepts
        // the request (mirrors PR #692 fix to proxyToPython, 2026-05-16).
        if (authorization != null && !authorization.isEmpty()) {
            headers.set("Authorization", authorization);
        }
        HttpEntity<Map<String, Object>> req = new HttpEntity<>(pythonBody, headers);

        try {
            ResponseEntity<byte[]> resp = pythonRestTemplate.exchange(
                    url, HttpMethod.POST, req, byte[].class);
            byte[] pdf = resp.getBody();
            if (pdf == null || pdf.length == 0) {
                throw new BusinessException(502, "Python 打印服务返空 PDF");
            }
            HttpHeaders out = new HttpHeaders();
            out.setContentType(MediaType.APPLICATION_PDF);
            String filename = "preview-" + entityType + "-" + (templateId != null ? templateId : "inline");
            out.setContentDisposition(org.springframework.http.ContentDisposition
                    .attachment().filename(filename + ".pdf").build());
            out.setContentLength(pdf.length);
            return new ResponseEntity<>(pdf, out, org.springframework.http.HttpStatus.OK);
        } catch (RestClientException e) {
            log.error("preview-template 代理失败 factory={} template={} url={}: {}",
                    factoryId, templateId, url, e.getMessage());
            throw new BusinessException(502, "打印服务暂不可用 — 请稍后重试");
        }
    }

    // ==================== Price masking ====================

    /**
     * Replace price-bearing payload fields with {@link #PRICE_MASK} when the caller
     * lacks {@code procurement:price:view}. Skipped entirely for doc types with no
     * monetary fields (production-task, material-requisition).
     *
     * <p>RBAC defense-in-depth: {@link com.cretas.aims.security.PriceFieldResponseAdvice}
     * (PR #423) only walks JSON response bodies — binary PDF byte[] returned by Python
     * bypasses it, so we MUST strip on the input payload before proxying.
     *
     * @param hasMonetaryFields false for production-task / material-requisition
     */
    void applyPriceMask(Map<String, Object> payload, String authorization, String docType, boolean hasMonetaryFields) {
        if (!hasMonetaryFields) {
            return;
        }
        boolean mask = priceMaskResolver.shouldMaskPrice(authorization);
        log.info("Print {} payload masking decision: docType={}, mask={}", docType, docType, mask);
        if (!mask) {
            return;
        }
        for (String key : PRICE_TOPLEVEL_KEYS) {
            if (payload.containsKey(key)) {
                payload.put(key, PRICE_MASK);
            }
        }
        Object items = payload.get("items");
        if (items instanceof List<?>) {
            for (Object item : (List<?>) items) {
                if (item instanceof Map<?, ?>) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> row = (Map<String, Object>) item;
                    for (String key : PRICE_ITEM_KEYS) {
                        if (row.containsKey(key)) {
                            row.put(key, PRICE_MASK);
                        }
                    }
                }
            }
        }
    }

    // ==================== Internal proxy ====================

    private ResponseEntity<byte[]> proxyToPython(String docType, Map<String, Object> payload, String filename, String authorization) {
        String url = pythonBaseUrl + "/api/printing/" + docType;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        // Smoke v2 P0 fix (2026-05-16): Python /api/printing/* requires auth.
        // Forward inbound Authorization so Python middleware accepts.
        if (authorization != null && !authorization.isEmpty()) {
            headers.set("Authorization", authorization);
        }
        HttpEntity<Map<String, Object>> req = new HttpEntity<>(payload, headers);

        try {
            ResponseEntity<byte[]> resp = pythonRestTemplate.exchange(url, HttpMethod.POST, req, byte[].class);
            byte[] pdf = resp.getBody();
            if (pdf == null || pdf.length == 0) {
                throw new BusinessException(502, "Python 打印服务返空");
            }
            HttpHeaders out = new HttpHeaders();
            out.setContentType(MediaType.APPLICATION_PDF);
            out.setContentDisposition(org.springframework.http.ContentDisposition
                    .attachment().filename(filename + ".pdf").build());
            out.setContentLength(pdf.length);
            return new ResponseEntity<>(pdf, out, org.springframework.http.HttpStatus.OK);
        } catch (RestClientException e) {
            log.error("PDF 代理失败 docType={} url={}: {}", docType, url, e.getMessage());
            throw new BusinessException(502, "打印服务暂不可用 — 请稍后重试");
        }
    }

    // ==================== Payload builders (Day 6 MVP — stub, 后续 PR 填实体 fetch) ====================
    //
    // TODO 后续 PR 把以下 stub 替换为真实 Service 调用:
    //   - SalesOrderService.getById(factoryId, id) → DTO → Map
    //   - PurchaseOrderService.getById(factoryId, id) → DTO → Map
    //   - QuotationService / ProductionTaskService / MaterialRequisitionService
    // 当前 MVP 接受 query overrides 作为占位数据, 适合 demo + AIChat smoke 测.

    private Map<String, Object> buildSalesOrderPayload(String factoryId, String id, Map<String, String> overrides) {
        Map<String, Object> p = new HashMap<>();
        p.put("factoryName", or(overrides, "factoryName", "白垩纪食品 — " + factoryId));
        p.put("orderNumber", or(overrides, "orderNumber", id));
        p.put("orderDate", or(overrides, "orderDate", java.time.LocalDate.now().toString()));
        p.put("customerName", or(overrides, "customerName", "(客户名)"));
        p.put("salesperson", or(overrides, "salesperson", "(销售员)"));
        p.put("totalAmount", or(overrides, "totalAmount", "0"));
        p.put("remark", or(overrides, "remark", null));
        p.put("items", java.util.List.of());  // 后续 PR: SalesOrderService 拉明细
        return p;
    }

    private Map<String, Object> buildPurchaseOrderPayload(String factoryId, String id, Map<String, String> overrides) {
        Map<String, Object> p = new HashMap<>();
        p.put("factoryName", or(overrides, "factoryName", "白垩纪食品 — " + factoryId));
        p.put("orderNumber", or(overrides, "orderNumber", id));
        p.put("orderDate", or(overrides, "orderDate", java.time.LocalDate.now().toString()));
        p.put("supplierName", or(overrides, "supplierName", "(供应商)"));
        p.put("expectedDeliveryDate", or(overrides, "expectedDeliveryDate", "-"));
        p.put("totalAmount", or(overrides, "totalAmount", "0"));
        p.put("remark", or(overrides, "remark", null));
        // 二维码: 仓管员扫码进入入库流程 (客户原话 May7 part2 行 156-160)
        p.put("qrPayload", "PO:" + factoryId + ":" + id);
        p.put("items", java.util.List.of());
        return p;
    }

    private Map<String, Object> buildQuotationPayload(String factoryId, String id, Map<String, String> overrides) {
        Map<String, Object> p = new HashMap<>();
        p.put("factoryName", or(overrides, "factoryName", "白垩纪食品 — " + factoryId));
        p.put("quotationNumber", or(overrides, "quotationNumber", id));
        p.put("quotationDate", or(overrides, "quotationDate", java.time.LocalDate.now().toString()));
        p.put("customerName", or(overrides, "customerName", "(客户)"));
        p.put("validUntil", or(overrides, "validUntil", "-"));
        p.put("salesperson", or(overrides, "salesperson", "-"));
        p.put("totalAmount", or(overrides, "totalAmount", "0"));
        p.put("remark", or(overrides, "remark", null));
        p.put("items", java.util.List.of());
        return p;
    }

    private Map<String, Object> buildProductionTaskPayload(String factoryId, String id, Map<String, String> overrides) {
        Map<String, Object> p = new HashMap<>();
        p.put("factoryName", or(overrides, "factoryName", "白垩纪食品 — " + factoryId));
        p.put("taskNumber", or(overrides, "taskNumber", id));
        p.put("productName", or(overrides, "productName", "(产品)"));
        p.put("plannedQuantity", or(overrides, "plannedQuantity", "0"));
        p.put("unit", or(overrides, "unit", "kg"));
        p.put("startDate", or(overrides, "startDate", "-"));
        p.put("endDate", or(overrides, "endDate", "-"));
        p.put("workshopName", or(overrides, "workshopName", "(车间)"));
        p.put("supervisor", or(overrides, "supervisor", "-"));
        p.put("processes", java.util.List.of());
        return p;
    }

    private Map<String, Object> buildMaterialRequisitionPayload(String factoryId, String id, Map<String, String> overrides) {
        Map<String, Object> p = new HashMap<>();
        p.put("factoryName", or(overrides, "factoryName", "白垩纪食品 — " + factoryId));
        p.put("requisitionNumber", or(overrides, "requisitionNumber", id));
        p.put("productName", or(overrides, "productName", "(产品)"));
        p.put("plannedQuantity", or(overrides, "plannedQuantity", "0"));
        p.put("unit", or(overrides, "unit", "kg"));
        p.put("requestDate", or(overrides, "requestDate", java.time.LocalDate.now().toString()));
        p.put("workshop", or(overrides, "workshop", "-"));
        p.put("requester", or(overrides, "requester", "-"));
        p.put("items", java.util.List.of());
        return p;
    }

    private Object or(Map<String, String> overrides, String key, Object fallback) {
        if (overrides == null) return fallback;
        String v = overrides.get(key);
        return (v == null || v.isBlank()) ? fallback : v;
    }
}
