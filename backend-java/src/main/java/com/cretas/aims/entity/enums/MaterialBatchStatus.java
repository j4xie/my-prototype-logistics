package com.cretas.aims.entity.enums;

/**
 * 原材料批次状态枚举
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public enum MaterialBatchStatus {
    /** 库存中（兼容旧数据） */
    IN_STOCK("库存中", "批次在库存中"),
    /** 可用 */
    AVAILABLE("可用", "批次可以正常使用"),
    /** 鲜品 - 2025-11-20新增 */
    FRESH("鲜品", "新鲜原材料批次"),
    /** 冻品 - 2025-11-20新增 */
    FROZEN("冻品", "已冻结原材料批次"),
    /** 已耗尽（预留+剩余=0） */
    DEPLETED("已耗尽", "批次已全部预留或消耗，无剩余可用"),
    /** 已用完 */
    USED_UP("已用完", "批次已全部消耗"),
    /** 已过期 */
    EXPIRED("已过期", "批次已超过保质期"),
    /** 质检中 */
    INSPECTING("质检中", "批次正在质量检验"),
    /** 已报废 */
    SCRAPPED("已报废", "批次已报废处理"),
    /** 已预留 */
    RESERVED("已预留", "批次已被预留，等待使用");

    private final String displayName;
    private final String description;

    MaterialBatchStatus(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }
}
