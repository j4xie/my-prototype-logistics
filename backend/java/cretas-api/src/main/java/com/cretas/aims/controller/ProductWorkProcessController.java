package com.cretas.aims.controller;

import com.cretas.aims.dto.ProductWorkProcessDTO;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.service.ProductWorkProcessService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/product-work-processes")
@Tag(name = "产品工序关联", description = "产品与工序的关联管理")
@RequiredArgsConstructor
public class ProductWorkProcessController {

    private final ProductWorkProcessService service;

    @PostMapping
    @Operation(summary = "关联产品与工序")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<ProductWorkProcessDTO> create(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid ProductWorkProcessDTO dto) {
        return ApiResponse.success(service.create(factoryId, dto));
    }

    @GetMapping
    @Operation(summary = "查询产品关联的工序列表")
    public ApiResponse<List<ProductWorkProcessDTO>> listByProduct(
            @PathVariable String factoryId,
            @RequestParam @Parameter(description = "产品类型ID") String productTypeId) {
        return ApiResponse.success(service.listByProduct(factoryId, productTypeId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新关联(顺序/覆写参数)")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<ProductWorkProcessDTO> update(
            @PathVariable String factoryId,
            @PathVariable Long id,
            @RequestBody @Valid ProductWorkProcessDTO dto) {
        return ApiResponse.success(service.update(factoryId, id, dto));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "移除关联")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<Void> delete(
            @PathVariable String factoryId,
            @PathVariable Long id) {
        service.delete(factoryId, id);
        return ApiResponse.success();
    }

    @PutMapping("/batch-sort")
    @Operation(summary = "批量调整排序")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<Void> batchSort(
            @PathVariable String factoryId,
            @RequestBody @Valid ProductWorkProcessDTO.BatchSortRequest request) {
        service.batchSort(factoryId, request.getItems());
        return ApiResponse.success();
    }
}
