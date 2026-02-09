package com.cretas.aims.dto.intent;

public enum DomainType {
    DATA("数据操作"),
    QUALITY("质量管理"),
    SCHEDULE("排程调度"),
    SCALE("电子秤设备"),
    SHIPMENT("出货管理"),
    FORM("表单助手"),
    META("元数据配置"),
    SYSTEM("系统管理");

    private final String description;
    DomainType(String description) { this.description = description; }
    public String getDescription() { return description; }
}
