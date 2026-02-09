package com.cretas.aims.dto.calibration;

import lombok.Getter;

/**
 * 工具执行失败类型枚举
 * 用于分类不同的失败原因，以便采用对应的恢复策略
 *
 * 基于 ET-Agent 论文 (arXiv:2601.06860) 的设计
 */
@Getter
public enum FailureType {

    /**
     * 参数错误
     * 触发关键词: "参数错误", "参数格式", "Invalid parameter", "parameter"
     * 恢复策略: 建议修正参数格式
     */
    PARAMETER_ERROR(
        "PARAMETER_ERROR",
        "参数错误",
        "请检查参数格式是否正确，确保所有必填参数已提供且类型匹配。",
        true
    ),

    /**
     * 权限不足
     * 触发关键词: "权限不足", "无权", "Forbidden", "Unauthorized"
     * 恢复策略: 建议用户操作或使用替代工具
     */
    PERMISSION_ERROR(
        "PERMISSION_ERROR",
        "权限不足",
        "当前用户权限不足以执行此操作，请联系管理员或尝试使用其他功能。",
        false
    ),

    /**
     * 服务不可用
     * 触发关键词: "服务不可用", "超时", "Timeout", "Service unavailable"
     * 恢复策略: 建议重试或使用替代工具
     */
    SERVICE_UNAVAILABLE(
        "SERVICE_UNAVAILABLE",
        "服务不可用",
        "目标服务暂时不可用或响应超时，请稍后重试。",
        true
    ),

    /**
     * 数据未找到
     * 触发关键词: "未找到", "不存在", "Not found", "No data"
     * 恢复策略: 建议扩大搜索范围或使用替代方案
     */
    DATA_NOT_FOUND(
        "DATA_NOT_FOUND",
        "数据未找到",
        "未找到匹配的数据记录，请尝试调整查询条件或检查数据是否存在。",
        true
    ),

    /**
     * 验证失败
     * 触发关键词: "验证失败", "校验", "Validation failed", "Invalid"
     * 恢复策略: 建议修正数据
     */
    VALIDATION_ERROR(
        "VALIDATION_ERROR",
        "数据验证失败",
        "数据验证不通过，请检查输入数据是否符合业务规则。",
        true
    ),

    /**
     * 业务逻辑错误
     * 触发关键词: "业务异常", "操作不允许", "Business error"
     * 恢复策略: 需要调整业务流程
     */
    BUSINESS_ERROR(
        "BUSINESS_ERROR",
        "业务逻辑错误",
        "业务规则不允许此操作，请检查当前状态是否满足操作条件。",
        true
    ),

    /**
     * 资源冲突
     * 触发关键词: "冲突", "已存在", "Conflict", "Duplicate"
     * 恢复策略: 建议使用不同的标识或更新现有资源
     */
    RESOURCE_CONFLICT(
        "RESOURCE_CONFLICT",
        "资源冲突",
        "资源已存在或存在冲突，请使用不同的标识符或更新现有资源。",
        true
    ),

    /**
     * 未知错误
     * 默认分类，无法确定具体错误类型
     * 恢复策略: 完全重试
     */
    UNKNOWN(
        "UNKNOWN",
        "未知错误",
        "发生未知错误，请稍后重试或联系技术支持。",
        true
    );

    /**
     * 错误代码
     */
    private final String code;

    /**
     * 错误描述（中文）
     */
    private final String description;

    /**
     * 默认恢复提示
     */
    private final String defaultRecoveryHint;

    /**
     * 是否可以自动恢复
     */
    private final boolean recoverable;

    FailureType(String code, String description, String defaultRecoveryHint, boolean recoverable) {
        this.code = code;
        this.description = description;
        this.defaultRecoveryHint = defaultRecoveryHint;
        this.recoverable = recoverable;
    }

    /**
     * 根据错误类型字符串和错误消息解析 FailureType
     *
     * @param errorType    错误类型字符串
     * @param errorMessage 错误消息
     * @return 匹配的 FailureType，默认返回 UNKNOWN
     */
    public static FailureType fromErrorInfo(String errorType, String errorMessage) {
        String combined = (errorType != null ? errorType : "") + " " + (errorMessage != null ? errorMessage : "");
        combined = combined.toLowerCase();

        // 参数错误检测
        if (combined.contains("参数错误") || combined.contains("参数格式") ||
            combined.contains("invalid parameter") || combined.contains("parameter") ||
            combined.contains("missing required") || combined.contains("缺少必填")) {
            return PARAMETER_ERROR;
        }

        // 权限错误检测
        if (combined.contains("权限不足") || combined.contains("无权") ||
            combined.contains("forbidden") || combined.contains("unauthorized") ||
            combined.contains("access denied") || combined.contains("禁止访问")) {
            return PERMISSION_ERROR;
        }

        // 服务不可用检测
        if (combined.contains("服务不可用") || combined.contains("超时") ||
            combined.contains("timeout") || combined.contains("service unavailable") ||
            combined.contains("connection refused") || combined.contains("连接失败")) {
            return SERVICE_UNAVAILABLE;
        }

        // 数据未找到检测
        if (combined.contains("未找到") || combined.contains("不存在") ||
            combined.contains("not found") || combined.contains("no data") ||
            combined.contains("empty result") || combined.contains("查无此")) {
            return DATA_NOT_FOUND;
        }

        // 验证失败检测
        if (combined.contains("验证失败") || combined.contains("校验") ||
            combined.contains("validation failed") || combined.contains("invalid") ||
            combined.contains("格式错误") || combined.contains("不合法")) {
            return VALIDATION_ERROR;
        }

        // 业务逻辑错误检测
        if (combined.contains("业务异常") || combined.contains("操作不允许") ||
            combined.contains("business error") || combined.contains("状态不允许") ||
            combined.contains("流程错误")) {
            return BUSINESS_ERROR;
        }

        // 资源冲突检测
        if (combined.contains("冲突") || combined.contains("已存在") ||
            combined.contains("conflict") || combined.contains("duplicate") ||
            combined.contains("重复")) {
            return RESOURCE_CONFLICT;
        }

        return UNKNOWN;
    }
}
