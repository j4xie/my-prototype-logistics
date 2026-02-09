package com.cretas.aims.dto.intent;

public enum ConditionType {
    SET("设置值"),
    EQUALS("等于"),
    NOT_EQUALS("不等于"),
    GREATER_THAN("大于"),
    LESS_THAN("小于"),
    CONTAINS("包含"),
    STARTS_WITH("开始于"),
    ENDS_WITH("结束于"),
    IN("在列表中"),
    BETWEEN("范围");

    private final String description;
    ConditionType(String description) { this.description = description; }
    public String getDescription() { return description; }
}
