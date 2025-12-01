package com.cretas.aims.controller;

import com.cretas.aims.entity.MaterialType;
import com.cretas.aims.service.MaterialTypeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.persistence.EntityNotFoundException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 原材料类型管理控制器
 *
 * 路径: /api/mobile/{factoryId}/materials/types
 *
 * 提供13个API端点:
 * 1. GET    /materials/types                     - 获取原材料类型列表（分页）
 * 2. POST   /materials/types                     - 创建原材料类型
 * 3. GET    /materials/types/{id}                - 获取单个原材料类型详情
 * 4. PUT    /materials/types/{id}                - 更新原材料类型
 * 5. DELETE /materials/types/{id}                - 删除原材料类型
 * 6. GET    /materials/types/active              - 获取激活的原材料类型列表
 * 7. GET    /materials/types/category/{category} - 按类别获取原材料类型
 * 8. GET    /materials/types/storage-type/{storageType} - 按存储方式获取原材料类型
 * 9. GET    /materials/types/search              - 搜索原材料类型
 * 10. GET   /materials/types/check-code          - 检查原材料编码是否存在
 * 11. GET   /materials/types/categories          - 获取所有类别列表
 * 12. GET   /materials/types/low-stock           - 获取低库存原材料
 * 13. PUT   /materials/types/batch/status        - 批量更新原材料类型状态
 *
 * @author Claude (AI Assistant)
 * @date 2025-11-19
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/materials/types")
@CrossOrigin(origins = "*", maxAge = 3600)
public class MaterialTypeController {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(MaterialTypeController.class);

    @Autowired
    private MaterialTypeService service;

    // ========================================
    // 1. GET - 获取原材料类型列表（分页）
    // ========================================

    /**
     * 获取原材料类型列表（支持分页和激活状态筛选）
     *
     * GET /api/mobile/{factoryId}/materials/types?isActive=true&page=0&size=20
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<MaterialType>>> getMaterialTypes(
            @PathVariable String factoryId,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection) {
        try {
            Page<MaterialType> result = service.getMaterialTypes(factoryId, isActive, page, size, sortBy, sortDirection);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取成功", result));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 2. POST - 创建原材料类型
    // ========================================

    /**
     * 创建新的原材料类型
     *
     * POST /api/mobile/{factoryId}/materials/types
     * Body: { "name": "三文鱼", "materialCode": "SWY", "category": "海水鱼", "unit": "kg", "storageType": "冷冻" }
     */
    @PostMapping
    public ResponseEntity<ApiResponse<MaterialType>> createMaterialType(
            @PathVariable String factoryId,
            @RequestBody MaterialType materialType) {
        try {
            materialType.setFactoryId(factoryId);
            MaterialType created = service.createMaterialType(materialType);
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
    // 3. GET - 获取单个原材料类型详情
    // ========================================

    /**
     * 获取指定ID的原材料类型详情
     *
     * GET /api/mobile/{factoryId}/materials/types/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MaterialType>> getMaterialTypeById(
            @PathVariable String factoryId,
            @PathVariable String id) {
        try {
            MaterialType materialType = service.getMaterialTypeById(factoryId, id);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取成功", materialType));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>(false, 404, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 4. PUT - 更新原材料类型
    // ========================================

    /**
     * 更新原材料类型信息
     *
     * PUT /api/mobile/{factoryId}/materials/types/{id}
     * Body: { "name": "更新的名称", "storageType": "冷藏" }
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<MaterialType>> updateMaterialType(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestBody MaterialType materialType) {
        try {
            MaterialType updated = service.updateMaterialType(factoryId, id, materialType);
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
    // 5. DELETE - 删除原材料类型
    // ========================================

    /**
     * 删除原材料类型
     *
     * DELETE /api/mobile/{factoryId}/materials/types/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteMaterialType(
            @PathVariable String factoryId,
            @PathVariable String id) {
        try {
            service.deleteMaterialType(factoryId, id);
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
    // 6. GET - 获取激活的原材料类型列表
    // ========================================

    /**
     * 获取所有激活状态的原材料类型（不分页）
     *
     * GET /api/mobile/{factoryId}/materials/types/active
     */
    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<MaterialType>>> getActiveMaterialTypes(
            @PathVariable String factoryId) {
        try {
            List<MaterialType> materials = service.getActiveMaterialTypes(factoryId);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取成功", materials));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 7. GET - 按类别获取原材料类型
    // ========================================

    /**
     * 按类别获取原材料类型列表
     *
     * GET /api/mobile/{factoryId}/materials/types/category/{category}
     * 示例: GET /api/mobile/F001/materials/types/category/海水鱼
     */
    @GetMapping("/category/{category}")
    public ResponseEntity<ApiResponse<List<MaterialType>>> getMaterialTypesByCategory(
            @PathVariable String factoryId,
            @PathVariable String category) {
        try {
            List<MaterialType> materials = service.getMaterialTypesByCategory(factoryId, category);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取成功", materials));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 8. GET - 按存储方式获取原材料类型
    // ========================================

    /**
     * 按存储方式获取原材料类型列表
     *
     * GET /api/mobile/{factoryId}/materials/types/storage-type/{storageType}
     * 示例: GET /api/mobile/F001/materials/types/storage-type/冷冻
     */
    @GetMapping("/storage-type/{storageType}")
    public ResponseEntity<ApiResponse<List<MaterialType>>> getMaterialTypesByStorageType(
            @PathVariable String factoryId,
            @PathVariable String storageType) {
        try {
            List<MaterialType> materials = service.getMaterialTypesByStorageType(factoryId, storageType);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取成功", materials));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 9. GET - 搜索原材料类型
    // ========================================

    /**
     * 搜索原材料类型（按名称或编码模糊匹配）
     *
     * GET /api/mobile/{factoryId}/materials/types/search?keyword=鱼&page=0&size=20
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<Page<MaterialType>>> searchMaterialTypes(
            @PathVariable String factoryId,
            @RequestParam String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Page<MaterialType> result = service.searchMaterialTypes(factoryId, keyword, page, size);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "搜索成功", result));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "搜索失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 10. GET - 检查原材料编码是否存在
    // ========================================

    /**
     * 检查原材料编码是否存在
     *
     * GET /api/mobile/{factoryId}/materials/types/check-code?materialCode=DY
     */
    @GetMapping("/check-code")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> checkMaterialCodeExists(
            @PathVariable String factoryId,
            @RequestParam String materialCode) {
        try {
            boolean exists = service.checkCodeExists(factoryId, materialCode);
            Map<String, Boolean> result = new HashMap<>();
            result.put("exists", exists);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "检查完成", result));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "检查失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 11. GET - 获取所有类别列表
    // ========================================

    /**
     * 获取所有唯一的原材料类别列表
     *
     * GET /api/mobile/{factoryId}/materials/types/categories
     */
    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<List<String>>> getCategories(
            @PathVariable String factoryId) {
        try {
            List<String> categories = service.getCategories(factoryId);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取成功", categories));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 12. GET - 获取低库存原材料
    // ========================================

    /**
     * 获取低库存原材料列表
     *
     * GET /api/mobile/{factoryId}/materials/types/low-stock
     */
    @GetMapping("/low-stock")
    public ResponseEntity<ApiResponse<List<MaterialType>>> getLowStockMaterials(
            @PathVariable String factoryId) {
        try {
            List<MaterialType> materials = service.getLowStockMaterials(factoryId);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "获取成功", materials));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "获取失败: " + e.getMessage(), null));
        }
    }

    // ========================================
    // 13. PUT - 批量更新原材料类型状态
    // ========================================

    /**
     * 批量更新原材料类型的激活状态
     *
     * PUT /api/mobile/{factoryId}/materials/types/batch/status
     * Body: { "ids": ["id1", "id2"], "isActive": true }
     */
    @PutMapping("/batch/status")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> batchUpdateStatus(
            @PathVariable String factoryId,
            @RequestBody BatchStatusRequest request) {
        try {
            int count = service.batchUpdateStatus(factoryId, request.getIds(), request.getIsActive());
            Map<String, Integer> result = new HashMap<>();
            result.put("count", count);
            return ResponseEntity.ok(new ApiResponse<>(true, 200, "批量更新成功，共更新 " + count + " 条记录", result));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, 500, "批量更新失败: " + e.getMessage(), null));
        }
    }

    /**
     * 导出原材料类型列表
     */
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportMaterialTypes(
            @PathVariable String factoryId) {

        byte[] excelBytes = service.exportMaterialTypes(factoryId);

        // 生成文件名（包含时间戳）
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String filename = "原材料类型列表_" + timestamp + ".xlsx";

        // 设置响应头
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", filename);
        headers.setContentLength(excelBytes.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(excelBytes);
    }

    /**
     * 从Excel文件批量导入原材料类型
     */
    @PostMapping("/import")
    public ApiResponse<com.cretas.aims.dto.common.ImportResult<MaterialType>> importMaterialTypesFromExcel(
            @PathVariable String factoryId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {

        log.info("从Excel批量导入原材料类型: factoryId={}, filename={}", factoryId, file.getOriginalFilename());

        // 验证文件类型
        if (file.getOriginalFilename() == null || !file.getOriginalFilename().endsWith(".xlsx")) {
            return ApiResponse.error("只支持.xlsx格式的Excel文件");
        }

        // 验证文件大小（10MB限制）
        if (file.getSize() > 10 * 1024 * 1024) {
            return ApiResponse.error("文件大小不能超过10MB");
        }

        try {
            com.cretas.aims.dto.common.ImportResult<MaterialType> result =
                    service.importMaterialTypesFromExcel(factoryId, file.getInputStream());

            if (result.getIsFullSuccess()) {
                log.info("原材料类型批量导入完全成功: factoryId={}, count={}", factoryId, result.getSuccessCount());
                return ApiResponse.success("导入成功", result);
            } else {
                log.warn("原材料类型批量导入部分失败: factoryId={}, success={}, failure={}",
                        factoryId, result.getSuccessCount(), result.getFailureCount());
                return ApiResponse.success(
                        String.format("导入完成：成功%d条，失败%d条",
                                result.getSuccessCount(), result.getFailureCount()),
                        result);
            }
        } catch (Exception e) {
            log.error("原材料类型批量导入失败: factoryId={}", factoryId, e);
            return ApiResponse.error("导入失败: " + e.getMessage());
        }
    }

    /**
     * 下载原材料类型导入模板
     */
    @GetMapping("/export/template")
    public ResponseEntity<byte[]> downloadMaterialTypeTemplate(
            @PathVariable String factoryId) {

        byte[] templateBytes = service.generateImportTemplate();

        // 设置文件名
        String filename = "原材料类型导入模板.xlsx";

        // 设置响应头
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", filename);
        headers.setContentLength(templateBytes.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(templateBytes);
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

        // 静态工厂方法
        public static <T> ApiResponse<T> success(String message, T data) {
            return new ApiResponse<>(true, 200, message, data);
        }

        public static <T> ApiResponse<T> error(String message) {
            return new ApiResponse<>(false, 500, message, null);
        }
    }

    /**
     * 批量状态更新请求
     */
    public static class BatchStatusRequest {
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
}
