package com.cretas.aims.controller.rd;

import com.cretas.aims.service.rd.ProductSampleService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/mobile/{factoryId}/rd")
@RequiredArgsConstructor
public class RdController {

    private final ProductSampleService sampleService;

    // ==================== 研发需求 ====================

    @PostMapping("/requests")
    public ResponseEntity<?> createRequest(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        var req = sampleService.createRequest(factoryId,
                (String) body.get("customerName"), (String) body.get("customerContact"),
                (String) body.get("requirements"), (String) body.get("urgency"), userId);
        return ResponseEntity.ok(Map.of("success", true, "data", req, "message", "研发需求已创建"));
    }

    @PostMapping("/requests/{requestId}/assign")
    public ResponseEntity<?> assignRequest(@PathVariable String requestId, @RequestBody Map<String, Object> body) {
        var req = sampleService.assignRequest(requestId, Long.valueOf(body.get("assignedTo").toString()));
        return ResponseEntity.ok(Map.of("success", true, "data", req));
    }

    @GetMapping("/requests")
    public ResponseEntity<?> listRequests(@PathVariable String factoryId,
                                           @RequestParam(required = false) String status,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(Map.of("success", true, "data",
                sampleService.listRequests(factoryId, status, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))));
    }

    // ==================== 样品管理 ====================

    @PostMapping("/samples")
    public ResponseEntity<?> createSample(
            @PathVariable String factoryId, @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        var sample = sampleService.createSample(factoryId,
                (String) body.get("rdRequestId"), (String) body.get("name"),
                (String) body.get("specification"), (String) body.get("grade"),
                (String) body.get("mainMaterial"),
                body.get("assignedTo") != null ? Long.valueOf(body.get("assignedTo").toString()) : userId);
        // 新增字段: productLevel, storageMethod, customerName, salesperson
        boolean needSave = false;
        if (body.get("productLevel") != null) { sample.setProductLevel((String) body.get("productLevel")); needSave = true; }
        if (body.get("storageMethod") != null) { sample.setStorageMethod((String) body.get("storageMethod")); needSave = true; }
        if (body.get("customerName") != null) { sample.setCustomerName((String) body.get("customerName")); needSave = true; }
        if (body.get("salesperson") != null) { sample.setSalesperson((String) body.get("salesperson")); needSave = true; }
        if (needSave) sample = sampleService.updateSampleFields(sample);
        return ResponseEntity.ok(Map.of("success", true, "data", sample, "message", "样品已创建"));
    }

    @PostMapping("/samples/{sampleId}/progress")
    public ResponseEntity<?> updateProgress(@PathVariable String factoryId, @PathVariable String sampleId,
                                             @RequestBody Map<String, String> body) {
        var sample = sampleService.updateProgress(factoryId, sampleId, body.get("note"), body.get("photoUrl"));
        return ResponseEntity.ok(Map.of("success", true, "data", sample));
    }

    @PostMapping("/samples/{sampleId}/submit")
    public ResponseEntity<?> submitForApproval(@PathVariable String factoryId, @PathVariable String sampleId,
                                                @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(Map.of("success", true, "data", sampleService.submitForApproval(factoryId, sampleId, userId)));
    }

    @PostMapping("/samples/{sampleId}/approve")
    public ResponseEntity<?> approve(@PathVariable String factoryId, @PathVariable String sampleId,
                                      @RequestBody(required = false) Map<String, String> body,
                                      @RequestAttribute(value = "userId", required = false) Long userId) {
        var sample = sampleService.approveSample(factoryId, sampleId, userId, body != null ? body.get("notes") : null);
        return ResponseEntity.ok(Map.of("success", true, "data", sample, "message", "样品审核通过，报价任务已自动创建"));
    }

    @PostMapping("/samples/{sampleId}/reject")
    public ResponseEntity<?> reject(@PathVariable String factoryId, @PathVariable String sampleId,
                                     @RequestBody Map<String, String> body,
                                     @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(Map.of("success", true, "data",
                sampleService.rejectSample(factoryId, sampleId, userId, body.get("notes"))));
    }

    @GetMapping("/samples")
    public ResponseEntity<?> listSamples(@PathVariable String factoryId,
                                          @RequestParam(required = false) String status,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(Map.of("success", true, "data",
                sampleService.listSamples(factoryId, status, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))));
    }

    @GetMapping("/samples/{sampleId}")
    public ResponseEntity<?> getSample(@PathVariable String factoryId, @PathVariable String sampleId) {
        return ResponseEntity.ok(Map.of("success", true, "data", sampleService.getSample(factoryId, sampleId)));
    }

    // ==================== 报价任务 ====================

    @PostMapping("/quotations/{taskId}/submit")
    public ResponseEntity<?> submitQuotation(@PathVariable String taskId, @RequestBody Map<String, Object> body,
                                              @RequestAttribute(value = "userId", required = false) Long userId) {
        var task = sampleService.submitQuotation(taskId,
                new BigDecimal(body.get("materialCost").toString()),
                new BigDecimal(body.get("laborCost").toString()),
                new BigDecimal(body.get("overheadCost").toString()),
                new BigDecimal(body.get("suggestedPrice").toString()), userId);
        return ResponseEntity.ok(Map.of("success", true, "data", task, "message", "报价已提交"));
    }

    @PostMapping("/quotations/{taskId}/confirm")
    public ResponseEntity<?> confirmQuotation(@PathVariable String taskId, @RequestBody Map<String, Object> body,
                                               @RequestAttribute(value = "userId", required = false) Long userId) {
        var task = sampleService.confirmQuotation(taskId, new BigDecimal(body.get("finalPrice").toString()), userId);
        return ResponseEntity.ok(Map.of("success", true, "data", task, "message", "报价已确认"));
    }

    @GetMapping("/quotations")
    public ResponseEntity<?> listQuotations(@PathVariable String factoryId,
                                             @RequestParam(required = false) String status,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(Map.of("success", true, "data",
                sampleService.listQuotations(factoryId, status, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))));
    }
}
