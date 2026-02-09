package com.cretas.aims.dto.intent;

public enum ObjectType {
    BATCH("批次"),
    PRODUCT("产品"),
    PLAN("生产计划"),
    MATERIAL("原材料"),
    MATERIAL_BATCH("原料批次"),
    EQUIPMENT("设备"),
    USER("用户"),
    INTENT("意图"),
    DEVICE("秤设备"),
    CHECK("质检"),
    RECORD("记录"),
    SHIPMENT("出货"),
    FORM_SCHEMA("表单Schema"),
    CONFIG("配置");

    private final String description;
    ObjectType(String description) { this.description = description; }
    public String getDescription() { return description; }
}
