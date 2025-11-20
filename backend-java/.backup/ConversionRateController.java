package com.cretas.aims.controller;

import com.cretas.aims.entity.MaterialProductConversion;
import com.cretas.aims.service.ConversionRateService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.persistence.EntityNotFoundException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 转化率管理控制器
 *
 * 路径: /api/mobile/{factoryId}/conversions
 *
 * 提供15个MVP核心API端点:
 * 1. GET    /conversions                           - 获取转化率列表（分页）
 * 2. POST   /conversions                           - 创建转化率
 * 3. GET    /conversions/{id}                      - 获取转化率详情
 * 4. PUT    /conversions/{id}                      - 更新转化率
 * 5. DELETE /conversions/{id}                      - 删除转化率
 * 6. GET    /conversions/material/{materialTypeId} - 按原材料类型查询
 * 7. GET    /conversions/product/{productTypeId}   - 按产品类型查询
 * 8. GET    /conversions/rate                      - 获取特定转化率
 * 9. POST   /conversions/calculate/material-requirement - 计算原材料需求
 * 10. POST  /conversions/calculate/product-output  - 计算产品产出
 * 11. POST  /conversions/validate                  - 验证转化率配置
 * 12. PUT   /conversions/batch/activate            - 批量激活/停用
 * 13. GET   /conversions/statistics                - 获取统计信息
 * 14. GET   /conversions/export                    - 导出转化率
 * 15. POST  /conversions/import                    - 批量导入
 *
 * @author Claude (AI Assistant)
 * @date 2025-11-19
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/conversions")
@CrossOrigin(origins = "*", maxAge = 3600)
public class ConversionRateController {

    @Autowired
    private ConversionRateService service;

    // ========================================
    // 1. GET - 获取转化率列表（分页）
    // ========================================

    /**
     * 获取转化率列表（支持分页）
     *
     * GET /api/mobile/{factoryId}/conversions?page=0&size=20
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<MaterialProductConversion>>> getConversionRates(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection) {
        try {
            Page<MaterialProductConversion> result = service.getConversionRates(factoryId, page, size, sortBy, sortDirection);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取成功", result));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 2. POST - 创建转化率
    // ========================================

    /**
     * 创建转化率
     *
     * POST /api/mobile/{factoryId}/conversions
     * Body: { "materialTypeId": "xxx", "productTypeId": "yyy", "conversionRate": 60, "wastageRate": 5 }
     */
    @PostMapping
    public ResponseEntity<ApiResponse<MaterialProductConversion>> createConversionRate(
            @PathVariable String factoryId,
            @RequestBody ConversionRateRequest request) {
        try {
            MaterialProductConversion conversion = new MaterialProductConversion(
                    factoryId,
                    request.getMaterialTypeId(),
                    request.getProductTypeId(),
                    request.getConversionRate()
            );
            conversion.setWastageRate(request.getWastageRate());
            conversion.setNotes(request.getNotes());
            conversion.setCreatedBy(request.getCreatedBy());

            MaterialProductConversion created = service.createConversionRate(conversion);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new ApiResponse<>(true, 201, "创建成功", created));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, 400, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "创建失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 3. GET - 获取转化率详情
    // ========================================

    /**
     * 获取转化率详情
     *
     * GET /api/mobile/{factoryId}/conversions/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MaterialProductConversion>> getConversionRateById(
            @PathVariable String factoryId,
            @PathVariable String id) {
        try {
            MaterialProductConversion conversion = service.getConversionRateById(factoryId, id);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取成功", conversion));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>(false, 404, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 4. PUT - 更新转化率
    // ========================================

    /**
     * 更新转化率
     *
     * PUT /api/mobile/{factoryId}/conversions/{id}
     * Body: { "conversionRate": 65, "wastageRate": 4, "notes": "更新备注" }
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<MaterialProductConversion>> updateConversionRate(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestBody ConversionRateRequest request) {
        try {
            MaterialProductConversion updateData = new MaterialProductConversion();
            updateData.setMaterialTypeId(request.getMaterialTypeId());
            updateData.setProductTypeId(request.getProductTypeId());
            updateData.setConversionRate(request.getConversionRate());
            updateData.setWastageRate(request.getWastageRate());
            updateData.setNotes(request.getNotes());
            updateData.setIsActive(request.getIsActive());

            MaterialProductConversion updated = service.updateConversionRate(factoryId, id, updateData);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "更新成功", updated));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>(false, 404, e.getMessage(), null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, 400, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "更新失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 5. DELETE - 删除转化率
    // ========================================

    /**
     * 删除转化率
     *
     * DELETE /api/mobile/{factoryId}/conversions/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteConversionRate(
            @PathVariable String factoryId,
            @PathVariable String id) {
        try {
            service.deleteConversionRate(factoryId, id);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "删除成功", null));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>(false, 404, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "删除失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 6. GET - 按原材料类型查询转化率
    // ========================================

    /**
     * 按原材料类型查询转化率
     *
     * GET /api/mobile/{factoryId}/conversions/material/{materialTypeId}
     */
    @GetMapping("/material/{materialTypeId}")
    public ResponseEntity<ApiResponse<List<MaterialProductConversion>>> getConversionsByMaterial(
            @PathVariable String factoryId,
            @PathVariable String materialTypeId) {
        try {
            List<MaterialProductConversion> conversions = service.getConversionsByMaterial(factoryId, materialTypeId);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取成功", conversions));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 7. GET - 按产品类型查询转化率
    // ========================================

    /**
     * 按产品类型查询转化率
     *
     * GET /api/mobile/{factoryId}/conversions/product/{productTypeId}
     */
    @GetMapping("/product/{productTypeId}")
    public ResponseEntity<ApiResponse<List<MaterialProductConversion>>> getConversionsByProduct(
            @PathVariable String factoryId,
            @PathVariable String productTypeId) {
        try {
            List<MaterialProductConversion> conversions = service.getConversionsByProduct(factoryId, productTypeId);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取成功", conversions));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 8. GET - 获取特定原材料和产品的转化率
    // ========================================

    /**
     * 获取特定原材料和产品的转化率
     *
     * GET /api/mobile/{factoryId}/conversions/rate?materialTypeId=xxx&productTypeId=yyy
     */
    @GetMapping("/rate")
    public ResponseEntity<ApiResponse<MaterialProductConversion>> getSpecificConversionRate(
            @PathVariable String factoryId,
            @RequestParam String materialTypeId,
            @RequestParam String productTypeId) {
        try {
            MaterialProductConversion conversion = service.getSpecificConversionRate(factoryId, materialTypeId, productTypeId);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取成功", conversion));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>(false, 404, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 9. POST - 计算原材料需求量
    // ========================================

    /**
     * 计算原材料需求量
     *
     * POST /api/mobile/{factoryId}/conversions/calculate/material-requirement
     * Body: { "productTypeId": "xxx", "productQuantity": 100 }
     */
    @PostMapping("/calculate/material-requirement")
    public ResponseEntity<ApiResponse<ConversionRateService.MaterialRequirementResult>> calculateMaterialRequirement(
            @PathVariable String factoryId,
            @RequestBody CalculateMaterialRequest request) {
        try {
            ConversionRateService.MaterialRequirementResult result = service.calculateMaterialRequirement(
                    factoryId,
                    request.getProductTypeId(),
                    request.getProductQuantity()
            );
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "计算成功", result));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>(false, 404, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "计算失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 10. POST - 计算产品产出量
    // ========================================

    /**
     * 计算产品产出量
     *
     * POST /api/mobile/{factoryId}/conversions/calculate/product-output
     * Body: { "materialTypeId": "xxx", "materialQuantity": 100 }
     */
    @PostMapping("/calculate/product-output")
    public ResponseEntity<ApiResponse<ConversionRateService.ProductOutputResult>> calculateProductOutput(
            @PathVariable String factoryId,
            @RequestBody CalculateProductRequest request) {
        try {
            ConversionRateService.ProductOutputResult result = service.calculateProductOutput(
                    factoryId,
                    request.getMaterialTypeId(),
                    request.getMaterialQuantity()
            );
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "计算成功", result));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>(false, 404, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "计算失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 11. POST - 验证转化率配置
    // ========================================

    /**
     * 验证转化率配置
     *
     * POST /api/mobile/{factoryId}/conversions/validate
     * Body: { "conversionRate": 60, "wastageRate": 5 }
     */
    @PostMapping("/validate")
    public ResponseEntity<ApiResponse<ValidationResponse>> validateConversionRate(
            @PathVariable String factoryId,
            @RequestBody ConversionRateRequest request) {
        try {
            // 验证转化率范围
            boolean isValid = true;
            String message = "验证通过";

            if (request.getConversionRate() == null ||
                request.getConversionRate().compareTo(BigDecimal.ZERO) <= 0 ||
                request.getConversionRate().compareTo(BigDecimal.valueOf(100)) > 0) {
                isValid = false;
                message = "转化率必须在0-100之间";
            }

            if (isValid && request.getWastageRate() != null &&
                (request.getWastageRate().compareTo(BigDecimal.ZERO) < 0 ||
                 request.getWastageRate().compareTo(BigDecimal.valueOf(100)) >= 0)) {
                isValid = false;
                message = "损耗率必须在0-100之间";
            }

            ValidationResponse response = new ValidationResponse(isValid, message);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "验证完成", response));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "验证失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 12. PUT - 批量激活/停用转化率
    // ========================================

    /**
     * 批量激活/停用转化率
     *
     * PUT /api/mobile/{factoryId}/conversions/batch/activate
     * Body: { "ids": ["id1", "id2"], "isActive": true }
     */
    @PutMapping("/batch/activate")
    public ResponseEntity<ApiResponse<ConversionRateService.BatchActivateResult>> batchActivate(
            @PathVariable String factoryId,
            @RequestBody BatchActivateRequest request) {
        try {
            ConversionRateService.BatchActivateResult result = service.batchActivate(
                    factoryId,
                    request.getIds(),
                    request.getIsActive()
            );
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "批量操作完成", result));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "批量操作失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 13. GET - 获取转化率统计信息
    // ========================================

    /**
     * 获取转化率统计信息
     *
     * GET /api/mobile/{factoryId}/conversions/statistics
     */
    @GetMapping("/statistics")
    public ResponseEntity<ApiResponse<ConversionRateService.ConversionStatistics>> getStatistics(
            @PathVariable String factoryId) {
        try {
            ConversionRateService.ConversionStatistics statistics = service.getStatistics(factoryId);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取成功", statistics));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 14. GET - 导出转化率列表
    // ========================================

    /**
     * 导出转化率列表
     *
     * GET /api/mobile/{factoryId}/conversions/export
     */
    @GetMapping("/export")
    public ResponseEntity<ApiResponse<List<MaterialProductConversion>>> exportConversionRates(
            @PathVariable String factoryId) {
        try {
            List<MaterialProductConversion> conversions = service.exportConversionRates(factoryId);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "导出成功", conversions));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "导出失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 15. POST - 批量导入转化率
    // ========================================

    /**
     * 批量导入转化率（简化版本，返回成功消息）
     *
     * POST /api/mobile/{factoryId}/conversions/import
     * Content-Type: multipart/form-data
     */
    @PostMapping("/import")
    public ResponseEntity<ApiResponse<String>> importConversionRates(
            @PathVariable String factoryId) {
        try {
            // 简化实现：返回成功消息
            // 完整实现需要解析CSV文件并批量创建
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "导入功能待实现", "导入功能将在后续版本中完善"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "导入失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 辅助类和响应包装器
    // ========================================

    /**
     * 统一API响应格式
     */
    public static class ApiResponse<T> {
        private boolean success;
        private int code;
        private String message;
        private T data;
        private LocalDateTime timestamp;

        public ApiResponse() {
            this.timestamp = LocalDateTime.now();
        }

        public ApiResponse(boolean success, int code, String message, T data) {
            this.success = success;
            this.code = code;
            this.message = message;
            this.data = data;
            this.timestamp = LocalDateTime.now();
        }

        public boolean isSuccess() {
            return success;
        }

        public void setSuccess(boolean success) {
            this.success = success;
        }

        public int getCode() {
            return code;
        }

        public void setCode(int code) {
            this.code = code;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public T getData() {
            return data;
        }

        public void setData(T data) {
            this.data = data;
        }

        public LocalDateTime getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(LocalDateTime timestamp) {
            this.timestamp = timestamp;
        }
    }

    /**
     * 转化率请求
     */
    public static class ConversionRateRequest {
        private String materialTypeId;
        private String productTypeId;
        private BigDecimal conversionRate;
        private BigDecimal wastageRate;
        private String notes;
        private Boolean isActive;
        private Integer createdBy;

        public String getMaterialTypeId() {
            return materialTypeId;
        }

        public void setMaterialTypeId(String materialTypeId) {
            this.materialTypeId = materialTypeId;
        }

        public String getProductTypeId() {
            return productTypeId;
        }

        public void setProductTypeId(String productTypeId) {
            this.productTypeId = productTypeId;
        }

        public BigDecimal getConversionRate() {
            return conversionRate;
        }

        public void setConversionRate(BigDecimal conversionRate) {
            this.conversionRate = conversionRate;
        }

        public BigDecimal getWastageRate() {
            return wastageRate;
        }

        public void setWastageRate(BigDecimal wastageRate) {
            this.wastageRate = wastageRate;
        }

        public String getNotes() {
            return notes;
        }

        public void setNotes(String notes) {
            this.notes = notes;
        }

        public Boolean getIsActive() {
            return isActive;
        }

        public void setIsActive(Boolean isActive) {
            this.isActive = isActive;
        }

        public Integer getCreatedBy() {
            return createdBy;
        }

        public void setCreatedBy(Integer createdBy) {
            this.createdBy = createdBy;
        }
    }

    /**
     * 计算原材料需求请求
     */
    public static class CalculateMaterialRequest {
        private String productTypeId;
        private BigDecimal productQuantity;

        public String getProductTypeId() {
            return productTypeId;
        }

        public void setProductTypeId(String productTypeId) {
            this.productTypeId = productTypeId;
        }

        public BigDecimal getProductQuantity() {
            return productQuantity;
        }

        public void setProductQuantity(BigDecimal productQuantity) {
            this.productQuantity = productQuantity;
        }
    }

    /**
     * 计算产品产出请求
     */
    public static class CalculateProductRequest {
        private String materialTypeId;
        private BigDecimal materialQuantity;

        public String getMaterialTypeId() {
            return materialTypeId;
        }

        public void setMaterialTypeId(String materialTypeId) {
            this.materialTypeId = materialTypeId;
        }

        public BigDecimal getMaterialQuantity() {
            return materialQuantity;
        }

        public void setMaterialQuantity(BigDecimal materialQuantity) {
            this.materialQuantity = materialQuantity;
        }
    }

    /**
     * 批量激活请求
     */
    public static class BatchActivateRequest {
        private List<String> ids;
        private Boolean isActive;

        public List<String> getIds() {
            return ids;
        }

        public void setIds(List<String> ids) {
            this.ids = ids;
        }

        public Boolean getIsActive() {
            return isActive;
        }

        public void setIsActive(Boolean isActive) {
            this.isActive = isActive;
        }
    }

    /**
     * 验证响应
     */
    public static class ValidationResponse {
        @com.fasterxml.jackson.annotation.JsonProperty("isValid")
        private boolean isValid;
        private String message;

        public ValidationResponse(boolean isValid, String message) {
            this.isValid = isValid;
            this.message = message;
        }

        @com.fasterxml.jackson.annotation.JsonProperty("isValid")
        public boolean isValid() {
            return isValid;
        }

        public void setValid(boolean valid) {
            isValid = valid;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }
    }
}
