package com.cretas.aims.controller;

import com.cretas.aims.entity.config.AIQuotaConfig;
import com.cretas.aims.repository.config.AIQuotaConfigRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AI配额规则配置 Controller
 *
 * 提供AI配额规则的增删改查功能
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/ai-quota-configs")
@Tag(name = "AI配额配置", description = "AI配额规则配置管理")
public class AIQuotaConfigController {

    private static final Logger log = LoggerFactory.getLogger(AIQuotaConfigController.class);

    @Autowired
    private AIQuotaConfigRepository quotaConfigRepository;

    /**
     * 获取工厂的AI配额配置列表
     */
    @GetMapping
    @Operation(summary = "获取配额配置列表", description = "获取指定工厂的所有AI配额配置")
    public ResponseEntity<Map<String, Object>> getConfigs(@PathVariable String factoryId) {
        try {
            // 查询工厂级别配置
            List<AIQuotaConfig> factoryConfigs = quotaConfigRepository
                    .findByFactoryIdAndEnabledTrueOrderByPriorityDesc(factoryId);

            // 查询全局配置
            List<AIQuotaConfig> globalConfigs = quotaConfigRepository
                    .findByFactoryIdAndEnabledTrueOrderByQuestionType("*");

            Map<String, Object> result = new HashMap<>();
            result.put("factoryConfigs", factoryConfigs);
            result.put("globalConfigs", globalConfigs);
            result.put("total", factoryConfigs.size() + globalConfigs.size());

            return ResponseEntity.ok(Map.of("success", true, "data", result));

        } catch (Exception e) {
            log.error("获取配额配置失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "获取配额配置失败: " + e.getMessage()
            ));
        }
    }

    /**
     * 创建配额配置
     */
    @PostMapping
    @Operation(summary = "创建配额配置", description = "为工厂创建新的AI配额配置规则")
    public ResponseEntity<Map<String, Object>> createConfig(
            @PathVariable String factoryId,
            @RequestBody AIQuotaConfigRequest request) {
        try {
            // 参数校验
            if (request.getQuestionType() == null || request.getQuestionType().trim().isEmpty()) {
                return ResponseEntity.ok(Map.of(
                        "success", false,
                        "message", "问题类型不能为空"
                ));
            }

            if (request.getQuotaCost() == null || request.getQuotaCost() < 0) {
                return ResponseEntity.ok(Map.of(
                        "success", false,
                        "message", "配额消耗次数必须为非负整数"
                ));
            }

            // 检查是否已存在
            if (quotaConfigRepository.existsByFactoryIdAndQuestionType(factoryId, request.getQuestionType())) {
                return ResponseEntity.ok(Map.of(
                        "success", false,
                        "message", "该问题类型的配置已存在"
                ));
            }

            // 创建配置
            AIQuotaConfig config = AIQuotaConfig.builder()
                    .factoryId(factoryId)
                    .questionType(request.getQuestionType())
                    .quotaCost(request.getQuotaCost())
                    .weeklyLimit(request.getWeeklyLimit())
                    .description(request.getDescription())
                    .enabled(request.getEnabled() != null ? request.getEnabled() : true)
                    .priority(request.getPriority() != null ? request.getPriority() : 0)
                    .build();

            AIQuotaConfig saved = quotaConfigRepository.save(config);

            log.info("创建配额配置成功: factoryId={}, questionType={}, quotaCost={}",
                    factoryId, saved.getQuestionType(), saved.getQuotaCost());

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", saved,
                    "message", "配置创建成功"
            ));

        } catch (Exception e) {
            log.error("创建配额配置失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "创建配置失败: " + e.getMessage()
            ));
        }
    }

    /**
     * 更新配额配置
     */
    @PutMapping("/{configId}")
    @Operation(summary = "更新配额配置", description = "更新指定的AI配额配置规则")
    public ResponseEntity<Map<String, Object>> updateConfig(
            @PathVariable String factoryId,
            @PathVariable String configId,
            @RequestBody AIQuotaConfigRequest request) {
        try {
            // 查询配置
            AIQuotaConfig config = quotaConfigRepository.findById(configId)
                    .orElseThrow(() -> new RuntimeException("配置不存在: configId=" + configId));

            // 权限验证
            if (!config.getFactoryId().equals(factoryId)) {
                return ResponseEntity.ok(Map.of(
                        "success", false,
                        "message", "无权修改此配置"
                ));
            }

            // 更新字段
            if (request.getQuotaCost() != null && request.getQuotaCost() >= 0) {
                config.setQuotaCost(request.getQuotaCost());
            }
            if (request.getWeeklyLimit() != null) {
                config.setWeeklyLimit(request.getWeeklyLimit());
            }
            if (request.getDescription() != null) {
                config.setDescription(request.getDescription());
            }
            if (request.getEnabled() != null) {
                config.setEnabled(request.getEnabled());
            }
            if (request.getPriority() != null) {
                config.setPriority(request.getPriority());
            }

            AIQuotaConfig updated = quotaConfigRepository.save(config);

            log.info("更新配额配置成功: configId={}, questionType={}, quotaCost={}",
                    configId, updated.getQuestionType(), updated.getQuotaCost());

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", updated,
                    "message", "配置更新成功"
            ));

        } catch (Exception e) {
            log.error("更新配额配置失败: configId={}, error={}", configId, e.getMessage(), e);
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "更新配置失败: " + e.getMessage()
            ));
        }
    }

    /**
     * 删除配额配置
     */
    @DeleteMapping("/{configId}")
    @Operation(summary = "删除配额配置", description = "删除指定的AI配额配置规则")
    public ResponseEntity<Map<String, Object>> deleteConfig(
            @PathVariable String factoryId,
            @PathVariable String configId) {
        try {
            // 查询配置
            AIQuotaConfig config = quotaConfigRepository.findById(configId)
                    .orElseThrow(() -> new RuntimeException("配置不存在: configId=" + configId));

            // 权限验证
            if (!config.getFactoryId().equals(factoryId)) {
                return ResponseEntity.ok(Map.of(
                        "success", false,
                        "message", "无权删除此配置"
                ));
            }

            // 禁止删除全局配置
            if ("*".equals(config.getFactoryId())) {
                return ResponseEntity.ok(Map.of(
                        "success", false,
                        "message", "不能删除全局配置"
                ));
            }

            quotaConfigRepository.delete(config);

            log.info("删除配额配置成功: configId={}, questionType={}",
                    configId, config.getQuestionType());

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "配置删除成功"
            ));

        } catch (Exception e) {
            log.error("删除配额配置失败: configId={}, error={}", configId, e.getMessage(), e);
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "删除配置失败: " + e.getMessage()
            ));
        }
    }

    /**
     * 获取配额配置详情
     */
    @GetMapping("/{configId}")
    @Operation(summary = "获取配额配置详情", description = "获取指定AI配额配置的详细信息")
    public ResponseEntity<Map<String, Object>> getConfig(
            @PathVariable String factoryId,
            @PathVariable String configId) {
        try {
            AIQuotaConfig config = quotaConfigRepository.findById(configId)
                    .orElseThrow(() -> new RuntimeException("配置不存在: configId=" + configId));

            // 权限验证
            if (!config.getFactoryId().equals(factoryId) && !"*".equals(config.getFactoryId())) {
                return ResponseEntity.ok(Map.of(
                        "success", false,
                        "message", "无权查看此配置"
                ));
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", config
            ));

        } catch (Exception e) {
            log.error("获取配额配置详情失败: configId={}, error={}", configId, e.getMessage(), e);
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "获取配置失败: " + e.getMessage()
            ));
        }
    }

    /**
     * 请求DTO
     */
    public static class AIQuotaConfigRequest {
        private String questionType;
        private Integer quotaCost;
        private Integer weeklyLimit;
        private String description;
        private Boolean enabled;
        private Integer priority;

        // Getters and Setters
        public String getQuestionType() { return questionType; }
        public void setQuestionType(String questionType) { this.questionType = questionType; }

        public Integer getQuotaCost() { return quotaCost; }
        public void setQuotaCost(Integer quotaCost) { this.quotaCost = quotaCost; }

        public Integer getWeeklyLimit() { return weeklyLimit; }
        public void setWeeklyLimit(Integer weeklyLimit) { this.weeklyLimit = weeklyLimit; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public Boolean getEnabled() { return enabled; }
        public void setEnabled(Boolean enabled) { this.enabled = enabled; }

        public Integer getPriority() { return priority; }
        public void setPriority(Integer priority) { this.priority = priority; }
    }
}
