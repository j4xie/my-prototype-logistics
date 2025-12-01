package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
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
 * <p>本控制器负责处理原材料类型相关的所有HTTP请求，提供完整的CRUD操作和业务查询功能。</p>
 *
 * <h3>API路径</h3>
 * <p>基础路径: <code>/api/mobile/{factoryId}/materials/types</code></p>
 * <p>所有接口都需要在路径中包含工厂ID ({@code factoryId})，确保数据隔离和权限控制。</p>
 *
 * <h3>提供的API端点 (共16个)</h3>
 * <ol>
 *   <li><b>GET</b>    /materials/types                     - 获取原材料类型列表（支持分页、筛选、排序）</li>
 *   <li><b>POST</b>   /materials/types                     - 创建新的原材料类型（需验证唯一性）</li>
 *   <li><b>GET</b>    /materials/types/{id}                - 根据ID获取单个原材料类型详情</li>
 *   <li><b>PUT</b>    /materials/types/{id}                - 更新指定原材料类型信息</li>
 *   <li><b>DELETE</b> /materials/types/{id}                - 删除指定原材料类型（软删除或硬删除）</li>
 *   <li><b>GET</b>    /materials/types/active              - 获取所有激活状态的原材料类型列表（不分页）</li>
 *   <li><b>GET</b>    /materials/types/category/{category} - 按类别筛选原材料类型（如：海水鱼、淡水鱼）</li>
 *   <li><b>GET</b>    /materials/types/storage-type/{storageType} - 按存储方式筛选（如：冷冻、冷藏、常温）</li>
 *   <li><b>GET</b>    /materials/types/search              - 按关键词搜索原材料类型（名称或编码模糊匹配）</li>
 *   <li><b>GET</b>    /materials/types/check-code          - 检查原材料编码是否已存在（用于前端验证）</li>
 *   <li><b>GET</b>    /materials/types/categories          - 获取所有唯一的原材料类别列表（去重）</li>
 *   <li><b>GET</b>    /materials/types/low-stock           - 获取低库存预警的原材料类型列表</li>
 *   <li><b>PUT</b>    /materials/types/batch/status        - 批量更新多个原材料类型的激活状态</li>
 *   <li><b>GET</b>    /materials/types/export              - 导出原材料类型列表（Excel）</li>
 *   <li><b>POST</b>   /materials/types/import              - 批量导入原材料类型（Excel）</li>
 *   <li><b>GET</b>    /materials/types/export/template     - 下载导入模板（Excel）</li>
 * </ol>
 *
 * <h3>业务规则</h3>
 * <ul>
 *   <li><b>唯一性约束</b>：同一工厂内，原材料名称和编码必须唯一</li>
 *   <li><b>数据隔离</b>：所有操作都基于工厂ID进行数据隔离</li>
 *   <li><b>状态管理</b>：支持激活/停用状态，停用的原材料类型不会出现在生产相关列表中</li>
 *   <li><b>关联检查</b>：删除前需检查是否被批次、生产计划等关联使用</li>
 * </ul>
 *
 * <h3>响应格式</h3>
 * <p>所有接口统一使用 {@link ApiResponse} 包装响应数据，包含以下字段：</p>
 * <ul>
 *   <li><code>success</code>: 操作是否成功 (boolean)</li>
 *   <li><code>code</code>: HTTP状态码 (int)</li>
 *   <li><code>message</code>: 响应消息 (String)</li>
 *   <li><code>data</code>: 响应数据 (泛型T)</li>
 *   <li><code>timestamp</code>: 响应时间戳 (LocalDateTime)</li>
 * </ul>
 *
 * @author Claude (AI Assistant)
 * @date 2025-11-19
 * @version 1.0.0
 * @see MaterialTypeService 业务逻辑层
 * @see MaterialType 实体类
 * @see MaterialTypeRepository 数据访问层
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
     * <p>根据工厂ID获取原材料类型列表，支持以下功能：</p>
     * <ul>
     *   <li>分页查询：通过page和size参数控制分页</li>
     *   <li>状态筛选：通过isActive参数筛选激活/停用的类型</li>
     *   <li>排序功能：通过sortBy和sortDirection参数自定义排序</li>
     * </ul>
     *
     * <h4>请求示例</h4>
     * <pre>
     * GET /api/mobile/F001/materials/types?isActive=true&page=1&size=20&sortBy=createdAt&sortDirection=DESC
     * </pre>
     *
     * <h4>参数说明</h4>
     * <ul>
     *   <li><code>factoryId</code> (路径参数, 必填): 工厂ID</li>
     *   <li><code>isActive</code> (查询参数, 可选): 是否激活 (true=仅激活, false=仅停用, null=全部)</li>
     *   <li><code>page</code> (查询参数, 可选, 默认1): 页码（从1开始，前端使用1-based）</li>
     *   <li><code>size</code> (查询参数, 可选, 默认20): 每页大小</li>
     *   <li><code>sortBy</code> (查询参数, 可选): 排序字段（如：createdAt, name, category）</li>
     *   <li><code>sortDirection</code> (查询参数, 可选, 默认DESC): 排序方向（ASC/DESC）</li>
     * </ul>
     *
     * <h4>响应示例</h4>
     * <pre>
     * {
     *   "success": true,
     *   "code": 200,
     *   "message": "获取成功",
     *   "data": {
     *     "content": [...],  // 原材料类型列表
     *     "totalElements": 100,
     *     "totalPages": 5,
     *     "number": 0,
     *     "size": 20
     *   },
     *   "timestamp": "2025-11-19T10:00:00"
     * }
     * </pre>
     *
     * @param factoryId 工厂ID（路径参数）
     * @param isActive 是否激活（可选，null表示查询全部）
     * @param page 页码（从1开始，默认1，前端使用1-based）
     * @param size 每页大小（默认20）
     * @param sortBy 排序字段（可选）
     * @param sortDirection 排序方向（ASC/DESC，默认DESC）
     * @return 分页的原材料类型列表
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
            return ResponseEntity.ok(ApiResponse.success("获取成功", result));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(500, "获取失败: " + e.getMessage()));
        }
    }

    // ========================================
    // 2. POST - 创建原材料类型
    // ========================================

    /**
     * 创建新的原材料类型
     *
     * <p>在指定工厂下创建新的原材料类型。创建前会进行以下验证：</p>
     * <ul>
     *   <li>名称唯一性：同一工厂内原材料名称不能重复</li>
     *   <li>编码唯一性：如果提供了编码，同一工厂内编码不能重复</li>
     *   <li>必填字段：名称、单位等必填字段必须提供</li>
     * </ul>
     *
     * <h4>请求示例</h4>
     * <pre>
     * POST /api/mobile/F001/materials/types
     * Content-Type: application/json
     *
     * {
     *   "name": "三文鱼",
     *   "materialCode": "SWY",
     *   "category": "海水鱼",
     *   "unit": "kg",
     *   "storageType": "冷冻",
     *   "description": "挪威进口三文鱼"
     * }
     * </pre>
     *
     * <h4>字段说明</h4>
     * <ul>
     *   <li><code>name</code> (必填): 原材料名称，如"三文鱼"、"带鱼"</li>
     *   <li><code>materialCode</code> (可选): 原材料编码，如"SWY"、"DY"，用于快速识别</li>
     *   <li><code>category</code> (可选): 原材料类别，如"海水鱼"、"淡水鱼"、"虾类"、"贝类"</li>
     *   <li><code>unit</code> (必填, 默认"kg"): 计量单位，如"kg"、"g"、"箱"</li>
     *   <li><code>storageType</code> (可选): 存储方式，如"冷冻"、"冷藏"、"常温"</li>
     *   <li><code>description</code> (可选): 原材料描述信息</li>
     * </ul>
     *
     * <h4>响应示例</h4>
     * <pre>
     * {
     *   "success": true,
     *   "code": 201,
     *   "message": "创建成功",
     *   "data": {
     *     "id": "uuid-string",
     *     "factoryId": "F001",
     *     "name": "三文鱼",
     *     "materialCode": "SWY",
     *     "category": "海水鱼",
     *     "unit": "kg",
     *     "storageType": "冷冻",
     *     "isActive": true,
     *     "createdAt": "2025-11-19T10:00:00"
     *   }
     * }
     * </pre>
     *
     * @param factoryId 工厂ID（路径参数，会自动设置到materialType对象中）
     * @param materialType 原材料类型对象（请求体）
     * @return 创建成功的原材料类型对象
     * @throws IllegalArgumentException 如果名称或编码已存在
     */
    @PostMapping
    public ResponseEntity<ApiResponse<MaterialType>> createMaterialType(
            @PathVariable String factoryId,
            @RequestBody MaterialType materialType) {
        try {
            materialType.setFactoryId(factoryId);
            MaterialType created = service.createMaterialType(materialType);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.of(201, "创建成功", created));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(500, "创建失败: " + e.getMessage()));
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
            return ResponseEntity.ok(ApiResponse.success("获取成功", materialType));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(500, "获取失败: " + e.getMessage()));
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
            return ResponseEntity.ok(ApiResponse.success("更新成功", updated));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(500, "更新失败: " + e.getMessage()));
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
            return ResponseEntity.ok(ApiResponse.success("删除成功", null));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(500, "删除失败: " + e.getMessage()));
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
            return ResponseEntity.ok(ApiResponse.success("获取成功", materials));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(500, "获取失败: " + e.getMessage()));
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
            return ResponseEntity.ok(ApiResponse.success("获取成功", materials));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(500, "获取失败: " + e.getMessage()));
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
            return ResponseEntity.ok(ApiResponse.success("获取成功", materials));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(500, "获取失败: " + e.getMessage()));
        }
    }

    // ========================================
    // 9. GET - 搜索原材料类型
    // ========================================

    /**
     * 搜索原材料类型（按名称或编码模糊匹配）
     *
     * GET /api/mobile/{factoryId}/materials/types/search?keyword=鱼&page=1&size=20
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<Page<MaterialType>>> searchMaterialTypes(
            @PathVariable String factoryId,
            @RequestParam String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Page<MaterialType> result = service.searchMaterialTypes(factoryId, keyword, page, size);
            return ResponseEntity.ok(ApiResponse.success("搜索成功", result));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(500, "搜索失败: " + e.getMessage()));
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
            return ResponseEntity.ok(ApiResponse.success("检查完成", result));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(500, "检查失败: " + e.getMessage()));
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
            return ResponseEntity.ok(ApiResponse.success("获取成功", categories));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(500, "获取失败: " + e.getMessage()));
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
            return ResponseEntity.ok(ApiResponse.success("获取成功", materials));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(500, "获取失败: " + e.getMessage()));
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
            return ResponseEntity.ok(ApiResponse.success("批量更新成功，共更新 " + count + " 条记录", result));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(500, "批量更新失败: " + e.getMessage()));
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
    // 辅助类
    // ========================================

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
