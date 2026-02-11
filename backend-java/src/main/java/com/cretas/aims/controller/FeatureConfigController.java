package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.FactoryFeatureConfig;
import com.cretas.aims.repository.FactoryFeatureConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Feature config endpoints accessible by authenticated App users.
 * GET: load module configs for the current factory.
 * PUT: admin can adjust configs.
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
                .orElse(ApiResponse.error("Module config not found"));
    }

    @PutMapping("/{moduleId}")
    public ApiResponse<FactoryFeatureConfig> update(
            @PathVariable String factoryId,
            @PathVariable String moduleId,
            @RequestBody Map<String, Object> config) {
        var existing = featureConfigRepository
                .findByFactoryIdAndModuleIdAndDeletedAtIsNull(factoryId, moduleId);
        if (existing.isEmpty()) {
            return ApiResponse.error("Module config not found");
        }
        FactoryFeatureConfig cfg = existing.get();
        cfg.setConfig(config);
        featureConfigRepository.save(cfg);
        return ApiResponse.success(cfg);
    }
}
