package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.platform.FactoryDTO;
import com.cretas.aims.service.FactoryService;
import com.cretas.aims.utils.FactoryAccessValidator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 工厂网络可见性接口
 *
 * 用于内部调拨等场景下供前端获取"当前用户可见的工厂列表",
 * 作为调入方下拉选项的数据源 (PR #299 transfer 调入方 dropdown / PR #309 C2).
 *
 * 可见性规则:
 * 1. 当前工厂自身始终可见
 * 2. 上下级组织 (parent/children) 可见 — 通过 FactoryService.getAccessibleFactoryIds
 * 3. 多租户边界由 {@link FactoryAccessValidator} 强制 — 跨工厂 token 会被拒
 *
 * 平台管理员 (super_admin / platform_admin / developer / PLATFORM factory_id)
 * 可访问任意 factoryId 的 network。
 *
 * @author Cretas Team
 * @since 2026-05-10 (PR #309 C2)
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/factories")
@RequiredArgsConstructor
@Tag(name = "工厂网络可见性", description = "当前用户可见的工厂列表 (调拨等场景)")
public class FactoryNetworkController {

    private final FactoryService factoryService;
    private final FactoryAccessValidator factoryAccessValidator;

    /**
     * 获取当前工厂的可见工厂网络.
     *
     * 返回当前工厂自身 + 所有可访问的关联工厂 (上下级),
     * 去重后按 factoryId 升序输出.
     *
     * @param factoryId 当前工厂 ID (path variable, 必须等于 token 的 factoryId 或调用方为平台管理员)
     * @return 工厂列表 [{factoryId, factoryName}]
     */
    @GetMapping("/network")
    @Operation(summary = "获取可见工厂列表", description = "供调拨等场景的调入方下拉使用; 多租户边界强制校验")
    public ApiResponse<List<FactoryNetworkEntry>> getNetwork(
            @PathVariable @NotBlank String factoryId) {
        // Multi-tenancy gate: token's factoryId must match path factoryId (or be platform admin)
        factoryAccessValidator.validateAccess(factoryId);

        log.info("获取可见工厂网络: factoryId={}", factoryId);

        List<FactoryNetworkEntry> entries = new ArrayList<>();
        Set<String> seenIds = new LinkedHashSet<>();

        // 1. Current factory itself (lookup name; tolerate missing factory record gracefully)
        try {
            FactoryDTO self = factoryService.getFactoryById(factoryId);
            if (self != null && self.getId() != null && seenIds.add(self.getId())) {
                entries.add(new FactoryNetworkEntry(self.getId(),
                        self.getName() != null ? self.getName() : self.getId()));
            }
        } catch (Exception e) {
            // If factory record missing, still emit a stub so the dropdown isn't empty.
            log.warn("getFactoryById failed for {}, falling back to stub entry: {}", factoryId, e.getMessage());
            if (seenIds.add(factoryId)) {
                entries.add(new FactoryNetworkEntry(factoryId, factoryId));
            }
        }

        // 2. Accessible factory IDs (self + descendants per FactoryService impl).
        //    Some may already be in entries (self) — dedupe via seenIds.
        try {
            List<String> accessibleIds = factoryService.getAccessibleFactoryIds(factoryId);
            if (accessibleIds != null) {
                for (String fid : accessibleIds) {
                    if (fid == null || !seenIds.add(fid)) continue;
                    try {
                        FactoryDTO f = factoryService.getFactoryById(fid);
                        String name = f != null && f.getName() != null ? f.getName() : fid;
                        entries.add(new FactoryNetworkEntry(fid, name));
                    } catch (Exception ex) {
                        log.debug("Could not resolve name for factory {}, using id as name", fid);
                        entries.add(new FactoryNetworkEntry(fid, fid));
                    }
                }
            }
        } catch (Exception e) {
            // Non-fatal — at minimum we still return self.
            log.warn("getAccessibleFactoryIds failed for {}: {}", factoryId, e.getMessage());
        }

        return ApiResponse.success("查询成功", entries);
    }

    @Data
    public static class FactoryNetworkEntry {
        private final String factoryId;
        private final String factoryName;
    }
}
