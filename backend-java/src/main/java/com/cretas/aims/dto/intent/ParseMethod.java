package com.cretas.aims.dto.intent;

public enum ParseMethod {
    CONTEXT("从结构化context解析"),
    AI("从AI服务解析"),
    HYBRID("混合解析");

    private final String description;
    ParseMethod(String description) { this.description = description; }
    public String getDescription() { return description; }
}
