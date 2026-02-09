package com.cretas.aims.dto.slot;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 必需参数槽位定义
 *
 * 用于渐进式参数收集（Slot Filling）机制：
 * - 定义意图执行所需的参数
 * - 包含参数验证规则和提取模式
 * - 支持参数类型：TEXT, NUMBER, DATE, SELECT, BATCH_ID, QUANTITY 等
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RequiredSlot {

    /**
     * 参数名称（API 字段名）
     * 如: batchId, quantity, status
     */
    private String name;

    /**
     * 显示标签（用于生成友好提示）
     * 如: 批次号, 数量, 状态
     */
    private String label;

    /**
     * 参数类型
     * TEXT - 文本
     * NUMBER - 数字
     * INTEGER - 整数
     * DATE - 日期
     * DATETIME - 日期时间
     * SELECT - 选择项（需配合 options 使用）
     * BATCH_ID - 批次ID/批次号
     * QUANTITY - 数量（支持单位）
     * BOOLEAN - 布尔值
     */
    private String type;

    /**
     * 是否必需
     */
    @Builder.Default
    private boolean required = true;

    /**
     * 提取正则模式
     * 用于从用户输入中提取参数值
     * 如: 批次号提取 "([A-Z]{2,3}-?\\d{8}-?\\d{3})"
     */
    private String pattern;

    /**
     * 验证提示
     * 当参数值不符合要求时显示的提示
     * 如: "请输入有效的批次号，格式如 MT-20240115-001"
     */
    private String validationHint;

    /**
     * 默认值
     */
    private String defaultValue;

    /**
     * 选项列表（type=SELECT 时使用）
     * JSON 格式：[{"value": "ACTIVE", "label": "激活"}, ...]
     */
    private String options;

    /**
     * 参数描述
     * 详细描述参数的用途和格式要求
     */
    private String description;

    /**
     * 优先级（数字越小优先级越高）
     * 用于确定参数收集顺序
     */
    @Builder.Default
    private int priority = 10;

    /**
     * 是否支持从上下文自动填充
     * 如果为 true，系统会尝试从对话历史中提取
     */
    @Builder.Default
    private boolean autoFillFromContext = false;

    /**
     * 关联实体类型（用于上下文自动填充）
     * 如: BATCH, MATERIAL, PRODUCT, SUPPLIER
     */
    private String entityType;

    // ==================== 常用槽位定义工厂方法 ====================

    /**
     * 创建批次ID槽位
     */
    public static RequiredSlot batchId() {
        return RequiredSlot.builder()
                .name("batchId")
                .label("批次号")
                .type("BATCH_ID")
                .required(true)
                .pattern("([A-Z]{2,3}-?\\d{8}-?\\d{3,4}|[A-Za-z0-9-]{10,})")
                .validationHint("请提供批次号，例如：MT-20240115-001 或输入批次ID")
                .description("要操作的批次的唯一标识")
                .priority(1)
                .autoFillFromContext(true)
                .entityType("BATCH")
                .build();
    }

    /**
     * 创建数量槽位
     */
    public static RequiredSlot quantity() {
        return RequiredSlot.builder()
                .name("quantity")
                .label("数量")
                .type("NUMBER")
                .required(true)
                .pattern("(\\d+(?:\\.\\d+)?\\s*(?:kg|吨|个|件|箱)?)")
                .validationHint("请输入数量，可以带单位如 100kg")
                .description("操作数量")
                .priority(2)
                .build();
    }

    /**
     * 创建原因槽位
     */
    public static RequiredSlot reason() {
        return RequiredSlot.builder()
                .name("reason")
                .label("原因")
                .type("TEXT")
                .required(true)
                .validationHint("请说明原因")
                .description("操作原因说明")
                .priority(5)
                .build();
    }

    /**
     * 创建状态槽位
     */
    public static RequiredSlot status(String options) {
        return RequiredSlot.builder()
                .name("status")
                .label("状态")
                .type("SELECT")
                .required(true)
                .options(options)
                .validationHint("请选择状态")
                .description("目标状态")
                .priority(3)
                .build();
    }

    /**
     * 创建日期槽位
     */
    public static RequiredSlot date(String name, String label) {
        return RequiredSlot.builder()
                .name(name)
                .label(label)
                .type("DATE")
                .required(true)
                .pattern("(\\d{4}-\\d{2}-\\d{2}|\\d{4}/\\d{2}/\\d{2}|今天|明天|昨天|本周|上周)")
                .validationHint("请提供日期，格式：YYYY-MM-DD 或 今天/明天")
                .description(label)
                .priority(4)
                .build();
    }

    /**
     * 创建原材料类型槽位
     */
    public static RequiredSlot materialTypeId() {
        return RequiredSlot.builder()
                .name("materialTypeId")
                .label("原材料类型")
                .type("TEXT")
                .required(true)
                .validationHint("请提供原材料类型ID或名称")
                .description("原材料类型的唯一标识")
                .priority(2)
                .autoFillFromContext(true)
                .entityType("MATERIAL_TYPE")
                .build();
    }

    /**
     * 创建供应商槽位
     */
    public static RequiredSlot supplierId() {
        return RequiredSlot.builder()
                .name("supplierId")
                .label("供应商")
                .type("TEXT")
                .required(true)
                .validationHint("请提供供应商ID或名称")
                .description("供应商的唯一标识")
                .priority(3)
                .autoFillFromContext(true)
                .entityType("SUPPLIER")
                .build();
    }

    /**
     * 创建生产计划槽位
     */
    public static RequiredSlot productionPlanId() {
        return RequiredSlot.builder()
                .name("productionPlanId")
                .label("生产计划")
                .type("TEXT")
                .required(true)
                .validationHint("请提供生产计划ID或名称")
                .description("生产计划的唯一标识")
                .priority(1)
                .autoFillFromContext(true)
                .entityType("PRODUCTION_PLAN")
                .build();
    }
}
