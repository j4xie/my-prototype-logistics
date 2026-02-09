package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.FactorySchedulingConfig;
import com.cretas.aims.entity.FactoryTempWorker;
import com.cretas.aims.service.scheduling.*;
import com.cretas.aims.service.scheduling.SchedulingComplexityRouter.SchedulingContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 调度优化 API Controller
 * 提供工厂配置、临时工管理、SKU复杂度、公平性监控等接口
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/scheduling")
@RequiredArgsConstructor
public class SchedulingOptimizationController {

    private final FactorySchedulingConfigService configService;
    private final TempWorkerService tempWorkerService;
    private final SkuComplexityService skuComplexityService;
    private final FairMABService fairMABService;
    private final SchedulingComplexityRouter complexityRouter;

    // ==================== 工厂配置 API ====================

    /**
     * 获取工厂调度配置
     */
    @GetMapping("/config")
    public ResponseEntity<ApiResponse<FactorySchedulingConfig>> getConfig(
            @PathVariable String factoryId) {
        try {
            FactorySchedulingConfig config = configService.getOrCreateConfig(factoryId);
            return ResponseEntity.ok(ApiResponse.success(config));
        } catch (Exception e) {
            log.error("Error getting config for factory: {}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取配置失败: " + e.getMessage()));
        }
    }

    /**
     * 更新工厂调度配置
     */
    @PutMapping("/config")
    public ResponseEntity<ApiResponse<FactorySchedulingConfig>> updateConfig(
            @PathVariable String factoryId,
            @RequestBody FactorySchedulingConfig config) {
        try {
            FactorySchedulingConfig updated = configService.updateConfig(factoryId, config);
            return ResponseEntity.ok(ApiResponse.success("配置更新成功", updated));
        } catch (Exception e) {
            log.error("Error updating config for factory: {}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("更新配置失败: " + e.getMessage()));
        }
    }

    /**
     * 获取工人的有效配置（考虑临时工调整）
     */
    @GetMapping("/config/effective/{workerId}")
    public ResponseEntity<ApiResponse<FactorySchedulingConfigService.EffectiveConfig>> getEffectiveConfig(
            @PathVariable String factoryId,
            @PathVariable Long workerId) {
        try {
            var effective = configService.getEffectiveConfig(factoryId, workerId);
            return ResponseEntity.ok(ApiResponse.success(effective));
        } catch (Exception e) {
            log.error("Error getting effective config for worker: {}", workerId, e);
            return ResponseEntity.ok(ApiResponse.error("获取有效配置失败: " + e.getMessage()));
        }
    }

    /**
     * 手动触发自适应学习
     */
    @PostMapping("/config/adapt")
    public ResponseEntity<ApiResponse<String>> triggerAdaptation(
            @PathVariable String factoryId) {
        try {
            configService.performAdaptiveLearning(factoryId);
            return ResponseEntity.ok(ApiResponse.success("自适应学习执行成功", "OK"));
        } catch (Exception e) {
            log.error("Error triggering adaptation for factory: {}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("自适应学习失败: " + e.getMessage()));
        }
    }

    // ==================== 临时工管理 API ====================

    /**
     * 获取临时工统计
     */
    @GetMapping("/temp-workers/stats")
    public ResponseEntity<ApiResponse<TempWorkerService.TempWorkerStats>> getTempWorkerStats(
            @PathVariable String factoryId) {
        try {
            var stats = tempWorkerService.getFactoryTempWorkerStats(factoryId);
            return ResponseEntity.ok(ApiResponse.success(stats));
        } catch (Exception e) {
            log.error("Error getting temp worker stats for factory: {}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取统计失败: " + e.getMessage()));
        }
    }

    /**
     * 注册临时工
     */
    @PostMapping("/temp-workers/{workerId}")
    public ResponseEntity<ApiResponse<FactoryTempWorker>> registerTempWorker(
            @PathVariable String factoryId,
            @PathVariable Long workerId,
            @RequestBody TempWorkerRegistrationRequest request) {
        try {
            FactoryTempWorker worker = tempWorkerService.registerTempWorker(
                    factoryId, workerId, request.getHireDate(), request.getExpectedEndDate());
            return ResponseEntity.ok(ApiResponse.success("临时工注册成功", worker));
        } catch (Exception e) {
            log.error("Error registering temp worker: {}", workerId, e);
            return ResponseEntity.ok(ApiResponse.error("注册失败: " + e.getMessage()));
        }
    }

    /**
     * 临时工转正
     */
    @PostMapping("/temp-workers/{workerId}/convert")
    public ResponseEntity<ApiResponse<FactoryTempWorker>> convertToPermanent(
            @PathVariable String factoryId,
            @PathVariable Long workerId) {
        try {
            FactoryTempWorker worker = tempWorkerService.convertToPermanent(factoryId, workerId);
            return ResponseEntity.ok(ApiResponse.success("转正成功", worker));
        } catch (Exception e) {
            log.error("Error converting temp worker: {}", workerId, e);
            return ResponseEntity.ok(ApiResponse.error("转正失败: " + e.getMessage()));
        }
    }

    /**
     * 获取转正候选人
     */
    @GetMapping("/temp-workers/conversion-candidates")
    public ResponseEntity<ApiResponse<List<TempWorkerService.TempWorkerConversionCandidate>>> getConversionCandidates(
            @PathVariable String factoryId) {
        try {
            var candidates = tempWorkerService.getConversionCandidates(factoryId);
            return ResponseEntity.ok(ApiResponse.success(candidates));
        } catch (Exception e) {
            log.error("Error getting conversion candidates for factory: {}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取候选人失败: " + e.getMessage()));
        }
    }

    /**
     * 获取需要优先分配的临时工
     */
    @GetMapping("/temp-workers/needs-assignment")
    public ResponseEntity<ApiResponse<List<Long>>> getTempWorkersNeedingAssignment(
            @PathVariable String factoryId) {
        try {
            var workers = tempWorkerService.getTempWorkersNeedingAssignment(factoryId);
            return ResponseEntity.ok(ApiResponse.success(workers));
        } catch (Exception e) {
            log.error("Error getting temp workers needing assignment: {}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    // ==================== SKU复杂度 API ====================

    /**
     * 获取SKU复杂度
     */
    @GetMapping("/sku/{skuCode}/complexity")
    public ResponseEntity<ApiResponse<SkuComplexityService.SkuProfile>> getSkuComplexity(
            @PathVariable String factoryId,
            @PathVariable String skuCode) {
        try {
            var profile = skuComplexityService.getSkuProfile(factoryId, skuCode);
            return profile.map(p -> ResponseEntity.ok(ApiResponse.success(p)))
                    .orElse(ResponseEntity.ok(ApiResponse.error("SKU不存在: " + skuCode)));
        } catch (Exception e) {
            log.error("Error getting SKU complexity: {}", skuCode, e);
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    /**
     * 设置SKU复杂度
     */
    @PutMapping("/sku/{skuCode}/complexity")
    public ResponseEntity<ApiResponse<String>> setSkuComplexity(
            @PathVariable String factoryId,
            @PathVariable String skuCode,
            @RequestBody SkuComplexityRequest request) {
        try {
            skuComplexityService.setSkuComplexity(factoryId, skuCode, request.getComplexityLevel());
            return ResponseEntity.ok(ApiResponse.success("SKU复杂度设置成功", "OK"));
        } catch (Exception e) {
            log.error("Error setting SKU complexity: {}", skuCode, e);
            return ResponseEntity.ok(ApiResponse.error("设置失败: " + e.getMessage()));
        }
    }

    /**
     * 获取适合新人练习的SKU
     */
    @GetMapping("/sku/training")
    public ResponseEntity<ApiResponse<List<String>>> getTrainingSkus(
            @PathVariable String factoryId) {
        try {
            var skus = skuComplexityService.getTrainingSkus(factoryId);
            return ResponseEntity.ok(ApiResponse.success(skus));
        } catch (Exception e) {
            log.error("Error getting training SKUs: {}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    /**
     * 获取需要专家处理的SKU
     */
    @GetMapping("/sku/expert")
    public ResponseEntity<ApiResponse<List<String>>> getExpertSkus(
            @PathVariable String factoryId) {
        try {
            var skus = skuComplexityService.getExpertSkus(factoryId);
            return ResponseEntity.ok(ApiResponse.success(skus));
        } catch (Exception e) {
            log.error("Error getting expert SKUs: {}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    /**
     * 检测SKU复杂度漂移
     */
    @GetMapping("/sku/drift")
    public ResponseEntity<ApiResponse<List<SkuComplexityService.SkuComplexityDrift>>> detectSkuDrift(
            @PathVariable String factoryId) {
        try {
            var drifts = skuComplexityService.detectComplexityDrift(factoryId);
            return ResponseEntity.ok(ApiResponse.success(drifts));
        } catch (Exception e) {
            log.error("Error detecting SKU drift: {}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("检测失败: " + e.getMessage()));
        }
    }

    // ==================== 公平性监控 API ====================

    /**
     * 获取公平性统计
     */
    @GetMapping("/fairness/stats")
    public ResponseEntity<ApiResponse<FairMABService.FairnessStats>> getFairnessStats(
            @PathVariable String factoryId) {
        try {
            var stats = fairMABService.getFactoryFairnessStats(factoryId);
            return ResponseEntity.ok(ApiResponse.success(stats));
        } catch (Exception e) {
            log.error("Error getting fairness stats: {}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    /**
     * 检测公平性违规
     */
    @GetMapping("/fairness/violations")
    public ResponseEntity<ApiResponse<List<FairMABService.FairnessViolation>>> getFairnessViolations(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "7") int days) {
        try {
            var violations = fairMABService.detectFairnessViolations(factoryId, days);
            return ResponseEntity.ok(ApiResponse.success(violations));
        } catch (Exception e) {
            log.error("Error detecting fairness violations: {}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("检测失败: " + e.getMessage()));
        }
    }

    /**
     * 重置公平性统计周期
     */
    @PostMapping("/fairness/reset")
    public ResponseEntity<ApiResponse<String>> resetFairnessPeriod(
            @PathVariable String factoryId) {
        try {
            fairMABService.resetPeriod(factoryId);
            return ResponseEntity.ok(ApiResponse.success("公平性周期已重置", "OK"));
        } catch (Exception e) {
            log.error("Error resetting fairness period: {}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("重置失败: " + e.getMessage()));
        }
    }

    // ==================== 复杂度路由 API ====================

    /**
     * 评估调度复杂度
     */
    @PostMapping("/complexity/evaluate")
    public ResponseEntity<ApiResponse<SchedulingComplexityRouter.SchedulingComplexity>> evaluateComplexity(
            @PathVariable String factoryId,
            @RequestBody SchedulingContext context) {
        try {
            var complexity = complexityRouter.evaluateComplexity(factoryId, context);
            return ResponseEntity.ok(ApiResponse.success(complexity));
        } catch (Exception e) {
            log.error("Error evaluating complexity: {}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("评估失败: " + e.getMessage()));
        }
    }

    /**
     * 获取调度优化总览
     */
    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getOverview(
            @PathVariable String factoryId) {
        try {
            Map<String, Object> overview = new HashMap<>();

            // 配置状态
            var config = configService.getOrCreateConfig(factoryId);
            overview.put("config", config);

            // 临时工统计
            var tempStats = tempWorkerService.getFactoryTempWorkerStats(factoryId);
            overview.put("tempWorkerStats", tempStats);

            // 公平性统计
            var fairnessStats = fairMABService.getFactoryFairnessStats(factoryId);
            overview.put("fairnessStats", fairnessStats);

            // SKU复杂度漂移
            var drifts = skuComplexityService.detectComplexityDrift(factoryId);
            overview.put("skuDrifts", drifts);
            overview.put("skuDriftCount", drifts.size());

            // 公平性违规
            var violations = fairMABService.detectFairnessViolations(factoryId, 7);
            overview.put("fairnessViolations", violations);
            overview.put("violationCount", violations.size());

            // 转正候选人
            var candidates = tempWorkerService.getConversionCandidates(factoryId);
            overview.put("conversionCandidates", candidates.size());

            return ResponseEntity.ok(ApiResponse.success(overview));
        } catch (Exception e) {
            log.error("Error getting overview: {}", factoryId, e);
            return ResponseEntity.ok(ApiResponse.error("获取总览失败: " + e.getMessage()));
        }
    }

    // ==================== Request DTOs ====================

    @lombok.Data
    public static class TempWorkerRegistrationRequest {
        private LocalDate hireDate;
        private LocalDate expectedEndDate;
    }

    @lombok.Data
    public static class SkuComplexityRequest {
        private int complexityLevel;
        private Integer minSkillRequired;
        private String preferredWorkerType;
    }
}
