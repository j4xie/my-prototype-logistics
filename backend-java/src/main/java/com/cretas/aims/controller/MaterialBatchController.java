package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.material.*;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import com.cretas.aims.service.MaterialBatchService;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 原材料批次管理控制器
 *
 * <p>本控制器负责处理原材料批次相关的所有HTTP请求，提供完整的批次管理功能。</p>
 *
 * <h3>功能说明</h3>
 * <p>原材料批次管理是生产管理系统的核心模块之一，负责管理原材料的入库、出库、库存、过期处理等全生命周期。</p>
 *
 * <h3>API路径</h3>
 * <p>基础路径: <code>/api/mobile/{factoryId}/material-batches</code></p>
 *
 * <h3>提供的API端点 (共24个接口)</h3>
 * <ol>
 *   <li><b>GET</b>    /material-batches                          - 获取原材料批次列表（分页，支持关键词搜索）</li>
 *   <li><b>POST</b>   /material-batches                          - 创建原材料批次（入库）</li>
 *   <li><b>POST</b>   /material-batches/batch                    - 批量创建材料批次</li>
 *   <li><b>GET</b>    /material-batches/{batchId}                - 获取原材料批次详情</li>
 *   <li><b>PUT</b>    /material-batches/{batchId}                - 更新原材料批次</li>
 *   <li><b>DELETE</b> /material-batches/{batchId}                - 删除原材料批次</li>
 *   <li><b>GET</b>    /material-batches/material-type/{materialTypeId} - 按材料类型获取批次</li>
 *   <li><b>GET</b>    /material-batches/status/{status}          - 按状态获取批次</li>
 *   <li><b>GET</b>    /material-batches/fifo/{materialTypeId}    - 获取FIFO批次（先进先出）</li>
 *   <li><b>GET</b>    /material-batches/expiring                 - 获取即将过期的批次</li>
 *   <li><b>GET</b>    /material-batches/expired                  - 获取已过期的批次</li>
 *   <li><b>GET</b>    /material-batches/inventory/statistics     - 获取库存统计</li>
 *   <li><b>GET</b>    /material-batches/inventory/valuation      - 获取库存价值</li>
 *   <li><b>GET</b>    /material-batches/low-stock                - 获取低库存警告</li>
 *   <li><b>POST</b>   /material-batches/{batchId}/use            - 使用批次材料</li>
 *   <li><b>POST</b>   /material-batches/{batchId}/adjust         - 调整批次数量</li>
 *   <li><b>PUT</b>    /material-batches/{batchId}/status         - 更新批次状态</li>
 *   <li><b>POST</b>   /material-batches/{batchId}/reserve        - 预留批次材料</li>
 *   <li><b>POST</b>   /material-batches/{batchId}/release        - 释放预留材料</li>
 *   <li><b>POST</b>   /material-batches/{batchId}/consume        - 消耗批次材料</li>
 *   <li><b>GET</b>    /material-batches/{batchId}/usage-history  - 获取批次使用历史</li>
 *   <li><b>POST</b>   /material-batches/handle-expired           - 处理过期批次</li>
 *   <li><b>POST</b>   /material-batches/{batchId}/convert-to-frozen - 将批次转为冻品</li>
 *   <li><b>POST</b>   /material-batches/{batchId}/undo-frozen    - 撤销转冻品操作</li>
 *   <li><b>GET</b>    /material-batches/export                   - 导出库存报表</li>
 * </ol>
 *
 * <h3>批次状态说明</h3>
 * <ul>
 *   <li><b>AVAILABLE</b>：可用 - 批次已入库，可以正常使用</li>
 *   <li><b>RESERVED</b>：已预留 - 批次已被生产计划预留，等待使用</li>
 *   <li><b>IN_USE</b>：使用中 - 批次正在被生产使用</li>
 *   <li><b>DEPLETED</b>：已耗尽 - 批次数量已用完</li>
 *   <li><b>EXPIRED</b>：已过期 - 批次已超过保质期</li>
 * </ul>
 *
 * <h3>核心业务功能</h3>
 * <ul>
 *   <li><b>批次入库</b>：创建新的原材料批次，记录入库信息</li>
 *   <li><b>FIFO出库</b>：按照先进先出原则推荐出库批次</li>
 *   <li><b>批次预留</b>：为生产计划预留原材料</li>
 *   <li><b>批次使用</b>：记录原材料的使用情况</li>
 *   <li><b>过期管理</b>：自动检测和处理过期批次</li>
 *   <li><b>库存统计</b>：提供库存数量、价值等统计信息</li>
 * </ul>
 *
 * <h3>业务规则</h3>
 * <ul>
 *   <li><b>唯一性</b>：批次号（batchNumber）必须全局唯一</li>
 *   <li><b>数量管理</b>：可用数量 = 入库数量 - 已用数量 - 预留数量</li>
 *   <li><b>状态流转</b>：AVAILABLE -> RESERVED -> IN_USE -> DEPLETED</li>
 *   <li><b>过期处理</b>：系统自动检测过期批次并更新状态</li>
 *   <li><b>数据隔离</b>：所有操作基于工厂ID进行数据隔离</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 * @see MaterialBatchService 业务逻辑层
 * @see MaterialBatch 实体类
 * @see MaterialBatchRepository 数据访问层
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/material-batches")
@RequiredArgsConstructor
@Tag(name = "原材料批次管理", description = "原材料批次管理相关接口")
public class MaterialBatchController {

    private final MaterialBatchService materialBatchService;
    private final MobileService mobileService;

    /**
     * 创建原材料批次
     */
    @PostMapping
    @Operation(summary = "创建原材料批次")
    public ApiResponse<MaterialBatchDTO> createMaterialBatch(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", required = true)
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody CreateMaterialBatchRequest request) {

        // 获取当前用户ID
        String token = TokenUtils.extractToken(authorization);
        Integer userId = mobileService.getUserFromToken(token).getId();

        log.info("创建原材料批次: factoryId={}, materialTypeId={}", factoryId, request.getMaterialTypeId());
        MaterialBatchDTO batch = materialBatchService.createMaterialBatch(factoryId, request, userId);
        return ApiResponse.success("原材料批次创建成功", batch);
    }

    /**
     * 更新原材料批次
     */
    @PutMapping("/{batchId}")
    @Operation(summary = "更新原材料批次")
    public ApiResponse<MaterialBatchDTO> updateMaterialBatch(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId,
            @Valid @RequestBody CreateMaterialBatchRequest request) {

        log.info("更新原材料批次: factoryId={}, batchId={}", factoryId, batchId);
        MaterialBatchDTO batch = materialBatchService.updateMaterialBatch(factoryId, batchId, request);
        return ApiResponse.success("原材料批次更新成功", batch);
    }

    /**
     * 删除原材料批次
     */
    @DeleteMapping("/{batchId}")
    @Operation(summary = "删除原材料批次")
    public ApiResponse<Void> deleteMaterialBatch(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId) {

        log.info("删除原材料批次: factoryId={}, batchId={}", factoryId, batchId);
        materialBatchService.deleteMaterialBatch(factoryId, batchId);
        return ApiResponse.success("原材料批次删除成功", null);
    }

    /**
     * 获取原材料批次详情
     */
    @GetMapping("/{batchId}")
    @Operation(summary = "获取原材料批次详情")
    public ApiResponse<MaterialBatchDTO> getMaterialBatchById(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId) {

        MaterialBatchDTO batch = materialBatchService.getMaterialBatchById(factoryId, batchId);
        return ApiResponse.success(batch);
    }

    /**
     * 获取原材料批次列表（分页）
     *
     * <p>根据工厂ID获取原材料批次列表，支持分页、排序和关键词搜索。</p>
     *
     * <h4>功能说明</h4>
     * <ul>
     *   <li>分页查询：通过page和size参数控制分页</li>
     *   <li>排序功能：通过sortBy和sortDirection参数自定义排序</li>
     *   <li>关键词搜索：通过keyword参数搜索批次号或材料类型名称</li>
     * </ul>
     *
     * <h4>请求示例</h4>
     * <pre>
     * GET /api/mobile/F001/material-batches?page=1&size=20&sortBy=createdAt&sortDirection=DESC&keyword=MT001
     * </pre>
     *
     * <h4>参数说明</h4>
     * <ul>
     *   <li><code>factoryId</code> (路径参数, 必填): 工厂ID</li>
     *   <li><code>page</code> (查询参数, 可选, 默认1): 页码（从1开始）</li>
     *   <li><code>size</code> (查询参数, 可选, 默认20): 每页大小</li>
     *   <li><code>sortBy</code> (查询参数, 可选, 默认createdAt): 排序字段</li>
     *   <li><code>sortDirection</code> (查询参数, 可选, 默认DESC): 排序方向（ASC/DESC）</li>
     *   <li><code>keyword</code> (查询参数, 可选): 搜索关键词（批次号或材料类型名称）</li>
     * </ul>
     *
     * <h4>响应示例</h4>
     * <pre>
     * {
     *   "success": true,
     *   "code": 200,
     *   "message": "操作成功",
     *   "data": {
     *     "content": [...],  // 批次列表
     *     "totalElements": 100,
     *     "totalPages": 5,
     *     "currentPage": 1,
     *     "pageSize": 20
     *   }
     * }
     * </pre>
     *
     * @param factoryId 工厂ID（路径参数，必填）
     * @param pageRequest 分页请求对象（包含page、size、sortBy、sortDirection、keyword）
     * @return 分页的批次列表
     */
    @GetMapping
    @Operation(summary = "获取原材料批次列表（分页）", 
               description = "支持分页、排序和关键词搜索（批次号或材料类型名称）")
    public ApiResponse<PageResponse<MaterialBatchDTO>> getMaterialBatchList(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Valid PageRequest pageRequest) {

        log.debug("获取原材料批次列表: factoryId={}, page={}, size={}, keyword={}", 
                 factoryId, pageRequest.getPage(), pageRequest.getSize(), pageRequest.getKeyword());
        PageResponse<MaterialBatchDTO> response = materialBatchService.getMaterialBatchList(factoryId, pageRequest);
        return ApiResponse.success(response);
    }

    /**
     * 按材料类型获取批次
     */
    @GetMapping("/material-type/{materialTypeId}")
    @Operation(summary = "按材料类型获取批次")
    public ApiResponse<List<MaterialBatchDTO>> getMaterialBatchesByType(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "材料类型ID", required = true)
            @PathVariable @NotBlank String materialTypeId) {

        List<MaterialBatchDTO> batches = materialBatchService.getMaterialBatchesByType(factoryId, materialTypeId);
        return ApiResponse.success(batches);
    }

    /**
     * 按状态获取批次
     */
    @GetMapping("/status/{status}")
    @Operation(summary = "按状态获取批次")
    public ApiResponse<List<MaterialBatchDTO>> getMaterialBatchesByStatus(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "状态", required = true)
            @PathVariable MaterialBatchStatus status) {

        List<MaterialBatchDTO> batches = materialBatchService.getMaterialBatchesByStatus(factoryId, status);
        return ApiResponse.success(batches);
    }

    /**
     * 获取FIFO批次（先进先出）
     */
    @GetMapping("/fifo/{materialTypeId}")
    @Operation(summary = "获取FIFO批次（先进先出）")
    public ApiResponse<List<MaterialBatchDTO>> getFIFOBatches(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "材料类型ID", required = true)
            @PathVariable @NotBlank String materialTypeId,
            @Parameter(description = "需求数量", required = true)
            @RequestParam @NotNull BigDecimal requiredQuantity) {

        List<MaterialBatchDTO> batches = materialBatchService.getFIFOBatches(factoryId, materialTypeId, requiredQuantity);
        return ApiResponse.success(batches);
    }

    /**
     * 获取即将过期的批次
     */
    @GetMapping("/expiring")
    @Operation(summary = "获取即将过期的批次")
    public ApiResponse<List<MaterialBatchDTO>> getExpiringBatches(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "天数", required = true, example = "3")
            @RequestParam(defaultValue = "3") Integer days) {

        List<MaterialBatchDTO> batches = materialBatchService.getExpiringBatches(factoryId, days);
        return ApiResponse.success(batches);
    }

    /**
     * 获取已过期的批次
     */
    @GetMapping("/expired")
    @Operation(summary = "获取已过期的批次")
    public ApiResponse<List<MaterialBatchDTO>> getExpiredBatches(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        List<MaterialBatchDTO> batches = materialBatchService.getExpiredBatches(factoryId);
        return ApiResponse.success(batches);
    }

    /**
     * 使用批次材料
     */
    @PostMapping("/{batchId}/use")
    @Operation(summary = "使用批次材料")
    public ApiResponse<MaterialBatchDTO> useBatchMaterial(
            @Parameter(description = "工厂ID")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID")
            @PathVariable @NotBlank String batchId,
            @Valid @RequestBody UseMaterialBatchRequest request) {

        log.info("使用批次材料: factoryId={}, batchId={}, quantity={}", factoryId, batchId, request.getQuantity());
        MaterialBatchDTO batch = materialBatchService.useBatchMaterial(factoryId, batchId, request.getQuantity(), request.getProductionPlanId());
        return ApiResponse.success("材料使用成功", batch);
    }

    /**
     * 调整批次数量
     */
    @PostMapping("/{batchId}/adjust")
    @Operation(summary = "调整批次数量")
    public ApiResponse<MaterialBatchDTO> adjustBatchQuantity(
            @Parameter(description = "工厂ID")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID")
            @PathVariable @NotBlank String batchId,
            @Parameter(description = "访问令牌")
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody AdjustMaterialBatchRequest request) {

        // 获取当前用户ID
        String token = TokenUtils.extractToken(authorization);
        Integer userId = mobileService.getUserFromToken(token).getId();

        log.info("调整批次数量: factoryId={}, batchId={}, quantity={}, reason={}",
                factoryId, batchId, request.getQuantity(), request.getReason());
        MaterialBatchDTO batch = materialBatchService.adjustBatchQuantity(factoryId, batchId, request.getQuantity(), request.getReason(), userId);
        return ApiResponse.success("批次数量调整成功", batch);
    }

    /**
     * 更新批次状态
     */
    @PutMapping("/{batchId}/status")
    @Operation(summary = "更新批次状态")
    public ApiResponse<MaterialBatchDTO> updateBatchStatus(
            @Parameter(description = "工厂ID")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID")
            @PathVariable @NotBlank String batchId,
            @Valid @RequestBody UpdateBatchStatusRequest request) {

        MaterialBatchStatus status = MaterialBatchStatus.valueOf(request.getStatus());
        log.info("更新批次状态: factoryId={}, batchId={}, status={}", factoryId, batchId, status);
        MaterialBatchDTO batch = materialBatchService.updateBatchStatus(factoryId, batchId, status);
        return ApiResponse.success("批次状态更新成功", batch);
    }

    /**
     * 预留批次材料
     */
    @PostMapping("/{batchId}/reserve")
    @Operation(summary = "预留批次材料")
    public ApiResponse<Void> reserveBatchMaterial(
            @Parameter(description = "工厂ID")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID")
            @PathVariable @NotBlank String batchId,
            @Valid @RequestBody ReserveMaterialBatchRequest request) {

        // 使用planId或productionBatchId作为生产计划ID
        String productionPlanId = request.getPlanId() != null ? request.getPlanId() : request.getProductionBatchId();
        log.info("预留批次材料: factoryId={}, batchId={}, quantity={}, productionPlanId={}",
                factoryId, batchId, request.getQuantity(), productionPlanId);
        materialBatchService.reserveBatchMaterial(factoryId, batchId, request.getQuantity(), productionPlanId);
        return ApiResponse.success("材料预留成功", null);
    }

    /**
     * 释放预留材料
     */
    @PostMapping("/{batchId}/release")
    @Operation(summary = "释放预留材料")
    public ApiResponse<Void> releaseBatchReservation(
            @Parameter(description = "工厂ID")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID")
            @PathVariable @NotBlank String batchId,
            @Valid @RequestBody ReleaseMaterialBatchRequest request) {

        log.info("释放预留材料: factoryId={}, batchId={}, quantity={}",
                factoryId, batchId, request.getQuantity());
        // 注意: Service方法需要planId参数，但测试脚本不提供，需要修改Service或使用null
        materialBatchService.releaseBatchReservation(factoryId, batchId, request.getQuantity(), null);
        return ApiResponse.success("预留释放成功", null);
    }

    /**
     * 消耗批次材料
     */
    @PostMapping("/{batchId}/consume")
    @Operation(summary = "消耗批次材料")
    public ApiResponse<Void> consumeBatchMaterial(
            @Parameter(description = "工厂ID")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID")
            @PathVariable @NotBlank String batchId,
            @Valid @RequestBody ConsumeMaterialBatchRequest request) {

        log.info("消耗批次材料: factoryId={}, batchId={}, quantity={}, processId={}",
                factoryId, batchId, request.getQuantity(), request.getProcessId());
        materialBatchService.consumeBatchMaterial(factoryId, batchId, request.getQuantity(), request.getProcessId());
        return ApiResponse.success("材料消耗成功", null);
    }

    /**
     * 获取库存统计
     */
    @GetMapping("/inventory/statistics")
    @Operation(summary = "获取库存统计")
    public ApiResponse<Map<String, Object>> getInventoryStatistics(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        Map<String, Object> statistics = materialBatchService.getInventoryStatistics(factoryId);
        return ApiResponse.success(statistics);
    }

    /**
     * 获取库存价值
     */
    @GetMapping("/inventory/valuation")
    @Operation(summary = "获取库存价值")
    public ApiResponse<BigDecimal> getInventoryValuation(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        BigDecimal valuation = materialBatchService.getInventoryValuation(factoryId);
        return ApiResponse.success(valuation);
    }

    /**
     * 获取低库存警告
     */
    @GetMapping("/low-stock")
    @Operation(summary = "获取低库存警告")
    public ApiResponse<List<Map<String, Object>>> getLowStockWarnings(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        List<Map<String, Object>> warnings = materialBatchService.getLowStockWarnings(factoryId);
        return ApiResponse.success(warnings);
    }

    /**
     * 批量创建材料批次
     */
    @PostMapping("/batch")
    @Operation(summary = "批量创建材料批次")
    public ApiResponse<List<MaterialBatchDTO>> batchCreateMaterialBatches(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", required = true)
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody List<CreateMaterialBatchRequest> requests) {

        // 获取当前用户ID
        String token = TokenUtils.extractToken(authorization);
        Integer userId = mobileService.getUserFromToken(token).getId();

        log.info("批量创建材料批次: factoryId={}, count={}", factoryId, requests.size());
        List<MaterialBatchDTO> batches = materialBatchService.batchCreateMaterialBatches(factoryId, requests, userId);
        return ApiResponse.success("批量创建成功", batches);
    }

    /**
     * 获取批次使用历史
     */
    @GetMapping("/{batchId}/usage-history")
    @Operation(summary = "获取批次使用历史")
    public ApiResponse<List<Map<String, Object>>> getBatchUsageHistory(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId) {

        List<Map<String, Object>> history = materialBatchService.getBatchUsageHistory(factoryId, batchId);
        return ApiResponse.success(history);
    }

    /**
     * 导出库存报表
     */
    @GetMapping("/export")
    @Operation(summary = "导出库存报表")
    public byte[] exportInventoryReport(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "开始日期")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        log.info("导出库存报表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        return materialBatchService.exportInventoryReport(factoryId, startDate, endDate);
    }

    /**
     * 处理过期批次
     */
    @PostMapping("/handle-expired")
    @Operation(summary = "处理过期批次")
    public ApiResponse<Integer> handleExpiredBatches(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        log.info("处理过期批次: factoryId={}", factoryId);
        int count = materialBatchService.handleExpiredBatches(factoryId);
        return ApiResponse.success(String.format("已处理%d个过期批次", count), count);
    }

    /**
     * 转冻品
     * 将原材料批次从鲜品转换为冻品状态
     *
     * @param factoryId 工厂ID
     * @param batchId 批次ID
     * @param request 转换请求参数
     * @return 转换后的批次信息
     * @since 2025-11-20
     */
    @PostMapping("/{batchId}/convert-to-frozen")
    @Operation(summary = "将原材料批次转为冻品",
               description = "将鲜品批次转换为冻品，更新批次状态和存储条件")
    public ApiResponse<MaterialBatchDTO> convertToFrozen(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId,
            @Parameter(description = "转换请求参数", required = true)
            @RequestBody @Valid ConvertToFrozenRequest request) {

        log.info("转冻品: factoryId={}, batchId={}, convertedBy={}",
                factoryId, batchId, request.getConvertedBy());
        MaterialBatchDTO result = materialBatchService.convertToFrozen(factoryId, batchId, request);
        return ApiResponse.success("已成功转为冻品", result);
    }

    /**
     * 撤销转冻品操作
     *
     * @param factoryId 工厂ID
     * @param batchId 批次ID
     * @param request 撤销请求参数
     * @return 撤销后的批次信息
     * @since 2025-11-20
     */
    @PostMapping("/{batchId}/undo-frozen")
    @Operation(summary = "撤销转冻品操作",
               description = "撤销误操作的转冻品，仅允许转换后10分钟内撤销")
    public ApiResponse<MaterialBatchDTO> undoFrozen(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "批次ID", required = true)
            @PathVariable @NotBlank String batchId,
            @Parameter(description = "撤销请求参数", required = true)
            @RequestBody @Valid UndoFrozenRequest request) {

        log.info("撤销转冻品: factoryId={}, batchId={}, operatorId={}, reason={}",
                factoryId, batchId, request.getOperatorId(), request.getReason());
        MaterialBatchDTO result = materialBatchService.undoFrozen(factoryId, batchId, request);
        return ApiResponse.success("已成功撤销转冻品操作", result);
    }
}