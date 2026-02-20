package com.cretas.aims.entity.enums;

/**
 * 内部调拨类型
 */
public enum TransferType {
    HQ_TO_BRANCH("总部→分店/分厂", "总部统一调拨到下属门店或工厂"),
    BRANCH_TO_BRANCH("分店→分店", "同级门店/工厂之间的横向调拨"),
    BRANCH_TO_HQ("分店→总部", "下属门店/工厂退回总部");

    private final String displayName;
    private final String description;

    TransferType(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }
}
