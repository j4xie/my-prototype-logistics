package com.cretas.aims.service.validator;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 首页布局验证器
 *
 * 验证布局配置的合法性:
 * - 必须模块检查
 * - 重复模块检查
 * - 大小约束检查
 * - 位置合法性检查
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-13
 */
@Slf4j
@Component
public class LayoutValidator {

    // 必须存在的模块
    private static final Set<String> REQUIRED_MODULES = Set.of("stats_grid");

    // 模块大小约束
    private static final Map<String, SizeConstraint> SIZE_CONSTRAINTS = Map.of(
            "welcome", new SizeConstraint(2, 1),
            "ai_insight", new SizeConstraint(2, 2),
            "stats_grid", new SizeConstraint(2, 2),
            "quick_actions", new SizeConstraint(2, 1),
            "dev_tools", new SizeConstraint(1, 1)
    );

    // 有效的模块ID列表
    private static final Set<String> VALID_MODULE_IDS = Set.of(
            "welcome", "ai_insight", "stats_grid", "quick_actions", "dev_tools"
    );

    /**
     * 验证布局配置
     *
     * @param modules 模块列表
     * @return 验证结果
     */
    public ValidationResult validate(List<Map<String, Object>> modules) {
        if (modules == null || modules.isEmpty()) {
            return ValidationResult.error("布局配置不能为空");
        }

        // 1. 检查必须模块
        ValidationResult requiredCheck = checkRequiredModules(modules);
        if (!requiredCheck.isValid()) {
            return requiredCheck;
        }

        // 2. 检查重复模块
        ValidationResult duplicateCheck = checkDuplicateModules(modules);
        if (!duplicateCheck.isValid()) {
            return duplicateCheck;
        }

        // 3. 检查无效模块
        ValidationResult invalidCheck = checkInvalidModules(modules);
        if (!invalidCheck.isValid()) {
            return invalidCheck;
        }

        // 4. 检查大小约束
        ValidationResult sizeCheck = checkSizeConstraints(modules);
        if (!sizeCheck.isValid()) {
            return sizeCheck;
        }

        // 5. 检查位置合法性
        ValidationResult positionCheck = checkPositionValidity(modules);
        if (!positionCheck.isValid()) {
            return positionCheck;
        }

        log.debug("布局验证通过: moduleCount={}", modules.size());
        return ValidationResult.success();
    }

    /**
     * 检查必须模块是否存在
     */
    private ValidationResult checkRequiredModules(List<Map<String, Object>> modules) {
        Set<String> presentIds = new HashSet<>();
        for (Map<String, Object> module : modules) {
            Object id = module.get("id");
            if (id != null) {
                // 只统计可见的模块，或者不管可见性都统计
                presentIds.add(id.toString());
            }
        }

        for (String requiredId : REQUIRED_MODULES) {
            if (!presentIds.contains(requiredId)) {
                String moduleName = getModuleName(requiredId);
                return ValidationResult.error("缺少必须模块: " + moduleName);
            }
        }

        return ValidationResult.success();
    }

    /**
     * 检查是否有重复模块
     */
    private ValidationResult checkDuplicateModules(List<Map<String, Object>> modules) {
        Set<String> seenIds = new HashSet<>();
        for (Map<String, Object> module : modules) {
            Object id = module.get("id");
            if (id != null) {
                String idStr = id.toString();
                if (seenIds.contains(idStr)) {
                    String moduleName = getModuleName(idStr);
                    return ValidationResult.error("存在重复模块: " + moduleName);
                }
                seenIds.add(idStr);
            }
        }
        return ValidationResult.success();
    }

    /**
     * 检查是否有无效模块
     */
    private ValidationResult checkInvalidModules(List<Map<String, Object>> modules) {
        for (Map<String, Object> module : modules) {
            Object id = module.get("id");
            if (id != null) {
                String idStr = id.toString();
                if (!VALID_MODULE_IDS.contains(idStr)) {
                    return ValidationResult.error("无效的模块ID: " + idStr);
                }
            } else {
                return ValidationResult.error("模块缺少ID属性");
            }
        }
        return ValidationResult.success();
    }

    /**
     * 检查模块大小约束
     */
    private ValidationResult checkSizeConstraints(List<Map<String, Object>> modules) {
        for (Map<String, Object> module : modules) {
            String id = (String) module.get("id");
            if (id == null) continue;

            SizeConstraint constraint = SIZE_CONSTRAINTS.get(id);
            if (constraint == null) continue;

            int w = getIntValue(module.get("w"), 1);
            int h = getIntValue(module.get("h"), 1);

            if (w > constraint.getMaxW()) {
                String moduleName = getModuleName(id);
                return ValidationResult.error(
                        String.format("%s 宽度超出限制 (最大: %d, 当前: %d)",
                                moduleName, constraint.getMaxW(), w));
            }

            if (h > constraint.getMaxH()) {
                String moduleName = getModuleName(id);
                return ValidationResult.error(
                        String.format("%s 高度超出限制 (最大: %d, 当前: %d)",
                                moduleName, constraint.getMaxH(), h));
            }

            if (w < 1 || h < 1) {
                String moduleName = getModuleName(id);
                return ValidationResult.error(moduleName + " 尺寸不能小于1");
            }
        }
        return ValidationResult.success();
    }

    /**
     * 检查位置合法性
     */
    private ValidationResult checkPositionValidity(List<Map<String, Object>> modules) {
        for (Map<String, Object> module : modules) {
            String id = (String) module.get("id");
            if (id == null) continue;

            int x = getIntValue(module.get("x"), 0);
            int y = getIntValue(module.get("y"), 0);
            int w = getIntValue(module.get("w"), 1);

            // x位置检查 (假设网格宽度为2)
            if (x < 0 || x >= 2) {
                String moduleName = getModuleName(id);
                return ValidationResult.error(moduleName + " X位置无效 (应为0-1)");
            }

            // 检查模块是否超出网格边界
            if (x + w > 2) {
                String moduleName = getModuleName(id);
                return ValidationResult.error(moduleName + " 超出网格边界");
            }

            // y位置检查
            if (y < 0) {
                String moduleName = getModuleName(id);
                return ValidationResult.error(moduleName + " Y位置不能为负数");
            }
        }
        return ValidationResult.success();
    }

    /**
     * 获取模块显示名称
     */
    private String getModuleName(String id) {
        return switch (id) {
            case "welcome" -> "欢迎卡片";
            case "ai_insight" -> "AI洞察";
            case "stats_grid" -> "数据统计";
            case "quick_actions" -> "快捷操作";
            case "dev_tools" -> "开发工具";
            default -> id;
        };
    }

    /**
     * 安全获取整数值
     */
    private int getIntValue(Object value, int defaultValue) {
        if (value == null) return defaultValue;
        if (value instanceof Integer) return (Integer) value;
        if (value instanceof Number) return ((Number) value).intValue();
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    /**
     * 大小约束定义
     */
    @Data
    @AllArgsConstructor
    public static class SizeConstraint {
        private int maxW;
        private int maxH;
    }

    /**
     * 验证结果
     */
    @Data
    @Builder
    public static class ValidationResult {
        private boolean valid;
        private String errorMessage;

        public static ValidationResult success() {
            return ValidationResult.builder()
                    .valid(true)
                    .build();
        }

        public static ValidationResult error(String message) {
            return ValidationResult.builder()
                    .valid(false)
                    .errorMessage(message)
                    .build();
        }
    }
}
