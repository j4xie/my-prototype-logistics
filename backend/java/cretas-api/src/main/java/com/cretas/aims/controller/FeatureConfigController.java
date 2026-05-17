package com.cretas.aims.controller;

import com.cretas.aims.config.RequireRole;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.FactoryFeatureConfig;
import com.cretas.aims.repository.FactoryFeatureConfigRepository;
import com.cretas.aims.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Feature config endpoints accessible by authenticated App users.
 * GET: load module configs for the current factory.
 * PUT: admin can adjust configs (Issue #718 — @RequireRole added 2026-05-17).
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/feature-config")
@RequiredArgsConstructor
public class FeatureConfigController {

    private final FactoryFeatureConfigRepository featureConfigRepository;

    @GetMapping
    public ApiResponse<List<FactoryFeatureConfig>> getAll(@PathVariable String factoryId) {
        List<FactoryFeatureConfig> configs =
                featureConfigRepository.findByFactoryIdAndDeletedAtIsNull(factoryId);
        return ApiResponse.success(configs);
    }

    @GetMapping("/{moduleId}")
    public ApiResponse<FactoryFeatureConfig> getOne(
            @PathVariable String factoryId,
            @PathVariable String moduleId) {
        return featureConfigRepository
                .findByFactoryIdAndModuleIdAndDeletedAtIsNull(factoryId, moduleId)
                .map(ApiResponse::success)
                .orElseThrow(() -> new BusinessException(404, "Module config not found"));
    }

    @PutMapping("/{moduleId}")
    @RequireRole({"factory_super_admin", "permission_admin"})
    public ApiResponse<FactoryFeatureConfig> update(
            @PathVariable String factoryId,
            @PathVariable String moduleId,
            @RequestBody Map<String, Object> config) {
        var existing = featureConfigRepository
                .findByFactoryIdAndModuleIdAndDeletedAtIsNull(factoryId, moduleId);
        if (existing.isEmpty()) {
            throw new BusinessException(400, "Module config not found");
        }
        FactoryFeatureConfig cfg = existing.get();
        cfg.setConfig(config);
        featureConfigRepository.save(cfg);
        return ApiResponse.success(cfg);
    }
}
