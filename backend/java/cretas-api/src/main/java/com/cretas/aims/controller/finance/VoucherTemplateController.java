package com.cretas.aims.controller.finance;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.enums.VoucherType;
import com.cretas.aims.entity.finance.VoucherTemplate;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.service.VoucherTemplateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 凭证模板控制器 (C-VOUCHER-TPL-1).
 *
 * <p>读: 公开 (admin / 财务用户列模板). 写: {@code finance:read_write}.
 *
 * @since 2026-05-17
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/voucher-templates")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "凭证模板", description = "替代 Sprint 3 E 7 generator hardcoded subjectCode, 让财务管理员可编辑.")
public class VoucherTemplateController {

    private final VoucherTemplateService service;

    @GetMapping
    @Operation(summary = "列出工厂所有模板")
    public ApiResponse<List<VoucherTemplate>> listAll(@PathVariable String factoryId) {
        return ApiResponse.success(service.listByFactory(factoryId));
    }

    @GetMapping("/by-type/{voucherType}")
    @Operation(summary = "列某 voucherType 的模板")
    public ApiResponse<List<VoucherTemplate>> listByType(@PathVariable String factoryId,
                                                        @PathVariable VoucherType voucherType) {
        return ApiResponse.success(service.listByFactoryAndType(factoryId, voucherType));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取模板详情")
    public ApiResponse<VoucherTemplate> getById(@PathVariable String factoryId,
                                                @PathVariable String id) {
        VoucherTemplate t = service.getById(factoryId, id)
                .orElseThrow(() -> new ResourceNotFoundException("凭证模板", "id", id));
        return ApiResponse.success(t);
    }

    @RequirePermission({"finance:read_write"})
    @PostMapping
    @Operation(summary = "创建凭证模板 (R4 幂等: 同 type+name 返 409)")
    public ApiResponse<VoucherTemplate> create(@PathVariable String factoryId,
                                               @RequestBody VoucherTemplate request) {
        return ApiResponse.success("凭证模板创建成功", service.create(factoryId, request));
    }

    @RequirePermission({"finance:read_write"})
    @PutMapping("/{id}")
    @Operation(summary = "更新凭证模板 (PATCH; isDefault 走专门 endpoint)")
    public ApiResponse<VoucherTemplate> update(@PathVariable String factoryId,
                                               @PathVariable String id,
                                               @RequestBody VoucherTemplate partial) {
        return ApiResponse.success("凭证模板更新成功", service.update(factoryId, id, partial));
    }

    @RequirePermission({"finance:read_write"})
    @DeleteMapping("/{id}")
    @Operation(summary = "删除凭证模板 (软删除)")
    public ApiResponse<Void> delete(@PathVariable String factoryId,
                                    @PathVariable String id) {
        service.delete(factoryId, id);
        return ApiResponse.successMessage("凭证模板已删除");
    }

    @RequirePermission({"finance:read_write"})
    @PatchMapping("/{id}/set-default")
    @Operation(summary = "设为 default (同 factory+type 唯一)",
               description = "自动取消同 (factory, voucherType) 其他 default 模板.")
    public ApiResponse<VoucherTemplate> setAsDefault(@PathVariable String factoryId,
                                                     @PathVariable String id) {
        return ApiResponse.success("已设为默认模板", service.setAsDefault(factoryId, id));
    }
}
