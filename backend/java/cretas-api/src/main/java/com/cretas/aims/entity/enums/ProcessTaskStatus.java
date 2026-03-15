package com.cretas.aims.entity.enums;

public enum ProcessTaskStatus {
    PENDING("待开始"),
    IN_PROGRESS("进行中"),
    COMPLETED("已完成"),
    CLOSED("已关闭"),
    SUPPLEMENTING("补报中");

    private final String label;

    ProcessTaskStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
