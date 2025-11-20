package com.cretas.aims.controller;

import com.cretas.aims.dto.WhitelistDTO;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.service.WhitelistService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

/**
 * 白名单管理控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/{factoryId}/whitelist")
@Tag(name = "白名单管理", description = "白名单管理相关接口")
@RequiredArgsConstructor
public class WhitelistController {

    private final WhitelistService whitelistService;

    @PostMapping("/batch")
    @Operation(summary = "批量添加白名单")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<WhitelistDTO.BatchResult> batchAdd(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid WhitelistDTO.BatchAddRequest request) {
        log.info("批量添加白名单: factoryId={}, count={}", factoryId, request.getEntries().size());
        WhitelistDTO.BatchResult result = whitelistService.batchAdd(factoryId, request);
        return ApiResponse.success(result);
    }

    @GetMapping
    @Operation(summary = "获取白名单列表")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<PageResponse<WhitelistDTO>> getWhitelist(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @Parameter(description = "状态") String status,
            @RequestParam(required = false) @Parameter(description = "部门") String department,
            @RequestParam(required = false) @Parameter(description = "角色") String role,
            @RequestParam(required = false) @Parameter(description = "搜索关键词") String keyword,
            @RequestParam(defaultValue = "0") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size,
            @RequestParam(defaultValue = "createdAt") @Parameter(description = "排序字段") String sortBy,
            @RequestParam(defaultValue = "DESC") @Parameter(description = "排序方向") String sortDirection) {

        log.debug("获取白名单列表: factoryId={}, status={}, keyword={}", factoryId, status, keyword);

        WhitelistDTO.QueryRequest queryRequest = WhitelistDTO.QueryRequest.builder()
                .status(status)
                .department(department)
                .role(role)
                .keyword(keyword)
                .page(page)
                .size(size)
                .sortBy(sortBy)
                .sortDirection(sortDirection)
                .build();

        Sort.Direction direction = "ASC".equalsIgnoreCase(sortDirection) ?
                Sort.Direction.ASC : Sort.Direction.DESC;
        // 前端使用1-based索引，Spring Data使用0-based索引，需要减1
        Pageable pageable = PageRequest.of(Math.max(0, page - 1), size, Sort.by(direction, sortBy));

        PageResponse<WhitelistDTO> response = whitelistService.getWhitelist(factoryId, queryRequest, pageable);
        return ApiResponse.success(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取白名单详情")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<WhitelistDTO> getWhitelistById(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "白名单ID") Integer id) {
        log.debug("获取白名单详情: factoryId={}, id={}", factoryId, id);
        WhitelistDTO whitelist = whitelistService.getWhitelistById(factoryId, id);
        return ApiResponse.success(whitelist);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新白名单")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<WhitelistDTO> updateWhitelist(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "白名单ID") Integer id,
            @RequestBody @Valid WhitelistDTO.UpdateRequest request) {
        log.info("更新白名单: factoryId={}, id={}", factoryId, id);
        WhitelistDTO updated = whitelistService.updateWhitelist(factoryId, id, request);
        return ApiResponse.success(updated);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除白名单")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<Void> deleteWhitelist(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "白名单ID") Integer id) {
        log.info("删除白名单: factoryId={}, id={}", factoryId, id);
        whitelistService.deleteWhitelist(factoryId, id);
        return ApiResponse.success();
    }

    @DeleteMapping("/batch")
    @Operation(summary = "批量删除白名单")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<Integer> batchDelete(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Parameter(description = "ID列表") List<Integer> ids) {
        log.info("批量删除白名单: factoryId={}, ids={}", factoryId, ids);
        Integer count = whitelistService.batchDelete(factoryId, ids);
        return ApiResponse.success(count);
    }

    @GetMapping("/stats")
    @Operation(summary = "获取白名单统计信息")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<WhitelistDTO.WhitelistStats> getStats(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取白名单统计: factoryId={}", factoryId);
        WhitelistDTO.WhitelistStats stats = whitelistService.getStats(factoryId);
        return ApiResponse.success(stats);
    }

    @PutMapping("/expired")
    @Operation(summary = "更新过期的白名单状态")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<Integer> updateExpired(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("更新过期的白名单状态: factoryId={}", factoryId);
        Integer count = whitelistService.updateExpiredWhitelist();
        return ApiResponse.success(count);
    }

    @PutMapping("/limit-reached")
    @Operation(summary = "更新达到使用上限的白名单状态")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<Integer> updateLimitReached(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("更新达到使用上限的白名单状态: factoryId={}", factoryId);
        Integer count = whitelistService.updateLimitReachedWhitelist();
        return ApiResponse.success(count);
    }

    @GetMapping("/validate/{phoneNumber}")
    @Operation(summary = "验证手机号是否在白名单中")
    public ApiResponse<WhitelistDTO.ValidationResponse> validatePhoneNumber(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "手机号") String phoneNumber) {
        log.debug("验证手机号: factoryId={}, phone={}", factoryId, phoneNumber);
        WhitelistDTO.ValidationResponse response = whitelistService.validatePhoneNumber(factoryId, phoneNumber);
        return ApiResponse.success(response);
    }

    @PutMapping("/usage/{phoneNumber}")
    @Operation(summary = "增加白名单使用次数")
    public ApiResponse<Void> incrementUsage(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "手机号") String phoneNumber) {
        log.debug("增加使用次数: factoryId={}, phone={}", factoryId, phoneNumber);
        whitelistService.incrementUsage(factoryId, phoneNumber);
        return ApiResponse.success();
    }

    @GetMapping("/search")
    @Operation(summary = "搜索白名单")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<PageResponse<WhitelistDTO>> searchWhitelist(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "搜索关键词") String keyword,
            @RequestParam(defaultValue = "0") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {
        log.debug("搜索白名单: factoryId={}, keyword={}", factoryId, keyword);
        // 前端使用1-based索引，Spring Data使用0-based索引，需要减1
        Pageable pageable = PageRequest.of(Math.max(0, page - 1), size);
        PageResponse<WhitelistDTO> response = whitelistService.searchWhitelist(factoryId, keyword, pageable);
        return ApiResponse.success(response);
    }

    @GetMapping("/expiring")
    @Operation(summary = "获取即将过期的白名单")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<List<WhitelistDTO>> getExpiringSoon(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "7") @Parameter(description = "天数") Integer days) {
        log.debug("获取即将过期的白名单: factoryId={}, days={}", factoryId, days);
        List<WhitelistDTO> expiring = whitelistService.getExpiringSoon(factoryId, days);
        return ApiResponse.success(expiring);
    }

    @GetMapping("/most-active")
    @Operation(summary = "获取最活跃的白名单用户")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<List<WhitelistDTO>> getMostActiveUsers(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "10") @Parameter(description = "限制数量") Integer limit) {
        log.debug("获取最活跃用户: factoryId={}, limit={}", factoryId, limit);
        List<WhitelistDTO> users = whitelistService.getMostActiveUsers(factoryId, limit);
        return ApiResponse.success(users);
    }

    @GetMapping("/recently-used")
    @Operation(summary = "获取最近使用的白名单")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<List<WhitelistDTO>> getRecentlyUsed(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "10") @Parameter(description = "限制数量") Integer limit) {
        log.debug("获取最近使用: factoryId={}, limit={}", factoryId, limit);
        List<WhitelistDTO> users = whitelistService.getRecentlyUsed(factoryId, limit);
        return ApiResponse.success(users);
    }

    @GetMapping("/export")
    @Operation(summary = "导出白名单")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<String> exportWhitelist(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @Parameter(description = "状态筛选") String status) {
        log.info("导出白名单: factoryId={}, status={}", factoryId, status);
        String csvData = whitelistService.exportWhitelist(factoryId, status);
        return ApiResponse.success(csvData);
    }

    @PostMapping("/import")
    @Operation(summary = "导入白名单")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<WhitelistDTO.BatchResult> importWhitelist(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Parameter(description = "CSV数据") String csvData) {
        log.info("导入白名单: factoryId={}", factoryId);
        WhitelistDTO.BatchResult result = whitelistService.importWhitelist(factoryId, csvData);
        return ApiResponse.success(result);
    }

    @DeleteMapping("/cleanup")
    @Operation(summary = "清理已删除的记录")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<Integer> cleanupDeleted(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "30") @Parameter(description = "多少天前的记录") Integer daysOld) {
        log.info("清理已删除记录: factoryId={}, daysOld={}", factoryId, daysOld);
        Integer count = whitelistService.cleanupDeleted(daysOld);
        return ApiResponse.success(count);
    }

    @PutMapping("/{id}/reset-usage")
    @Operation(summary = "重置使用次数")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<Void> resetUsageCount(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "白名单ID") Integer id) {
        log.info("重置使用次数: factoryId={}, id={}", factoryId, id);
        whitelistService.resetUsageCount(factoryId, id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/extend")
    @Operation(summary = "延长有效期")
    @PreAuthorize("hasAnyAuthority('super_admin', 'factory_admin', 'permission_admin')")
    public ApiResponse<WhitelistDTO> extendExpiration(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "白名单ID") Integer id,
            @RequestParam @Parameter(description = "延长天数") Integer days) {
        log.info("延长有效期: factoryId={}, id={}, days={}", factoryId, id, days);
        WhitelistDTO updated = whitelistService.extendExpiration(factoryId, id, days);
        return ApiResponse.success(updated);
    }
}