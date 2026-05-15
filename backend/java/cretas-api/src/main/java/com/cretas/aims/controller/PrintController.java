package com.cretas.aims.controller;

import com.cretas.aims.exception.BusinessException;
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
import java.util.Map;

/**
 * C-PRT-1 — 单据打印 PDF Java 入口.
 *
 * <p>5 单据 GET endpoint, 每个端点:
 * <ol>
 *   <li>校验访问权限 (跟随实体权限, factoryId 隔离)</li>
 *   <li>组装打印 payload (entity → flat dict)</li>
 *   <li>POST 到 Python {@code /api/printing/{type}} 取 PDF bytes</li>
 *   <li>流回客户端 (Content-Disposition: attachment)</li>
 * </ol>
 *
 * <p><b>当前实现状态</b>: Day 6 MVP — 5 endpoint 全通, payload 组装为 stub
 * (返客户提供的 query string 即可生成 PDF, 适合 demo + 客户验收). 后续 PR
 * 把 stub 替换为 SalesOrderService / PurchaseOrderService 等真实 fetch.
 *
 * @author Cretas Team — Track C
 * @since 2026-05-15 (C-PRT-1)
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/print")
@CrossOrigin(origins = {"https://www.cretaceousfuture.com", "http://139.196.165.140:8086", "http://localhost:5173"})
public class PrintController {

    private final RestTemplate pythonRestTemplate;
    private final String pythonBaseUrl;

    @Autowired
    public PrintController(
            @Qualifier("pythonAiRestTemplate") RestTemplate pythonRestTemplate,
            @Qualifier("pythonAiBaseUrl") String pythonBaseUrl) {
        this.pythonRestTemplate = pythonRestTemplate;
        this.pythonBaseUrl = pythonBaseUrl;
    }

    // ==================== 5 单据 endpoint ====================

    @GetMapping("/sales-order/{id}")
    public ResponseEntity<byte[]> printSalesOrder(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestParam(required = false) Map<String, String> overrides) {
        Map<String, Object> payload = buildSalesOrderPayload(factoryId, id, overrides);
        return proxyToPython("sales-order", payload, "sales-order-" + id);
    }

    @GetMapping("/purchase-order/{id}")
    public ResponseEntity<byte[]> printPurchaseOrder(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestParam(required = false) Map<String, String> overrides) {
        Map<String, Object> payload = buildPurchaseOrderPayload(factoryId, id, overrides);
        return proxyToPython("purchase-order", payload, "purchase-order-" + id);
    }

    @GetMapping("/quotation/{id}")
    public ResponseEntity<byte[]> printQuotation(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestParam(required = false) Map<String, String> overrides) {
        Map<String, Object> payload = buildQuotationPayload(factoryId, id, overrides);
        return proxyToPython("quotation", payload, "quotation-" + id);
    }

    @GetMapping("/production-task/{id}")
    public ResponseEntity<byte[]> printProductionTask(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestParam(required = false) Map<String, String> overrides) {
        Map<String, Object> payload = buildProductionTaskPayload(factoryId, id, overrides);
        return proxyToPython("production-task", payload, "production-task-" + id);
    }

    @GetMapping("/material-requisition/{id}")
    public ResponseEntity<byte[]> printMaterialRequisition(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestParam(required = false) Map<String, String> overrides) {
        Map<String, Object> payload = buildMaterialRequisitionPayload(factoryId, id, overrides);
        return proxyToPython("material-requisition", payload, "material-requisition-" + id);
    }

    // ==================== Internal proxy ====================

    private ResponseEntity<byte[]> proxyToPython(String docType, Map<String, Object> payload, String filename) {
        String url = pythonBaseUrl + "/api/printing/" + docType;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
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
