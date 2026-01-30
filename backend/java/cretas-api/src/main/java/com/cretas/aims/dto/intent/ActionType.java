package com.cretas.aims.dto.intent;

public enum ActionType {
    QUERY("查询"),
    UPDATE("更新"),
    CREATE("创建"),
    DELETE("删除"),
    ANALYZE("分析"),
    EXECUTE("执行"),
    CONFIGURE("配置"),
    DETECT("检测"),
    START("启动"),
    AMBIGUOUS("歧义"),
    UNKNOWN("未知");

    private final String description;
    ActionType(String description) { this.description = description; }
    public String getDescription() { return description; }
}
