package com.cretas.aims.service.calibration;

import java.time.LocalDate;
import java.util.Map;

/**
 * 外部验证器服务接口
 *
 * 基于 CRITIC 论文 (ICLR 2024) 的核心思想：
 * LLM 自我纠错需要依赖外部工具的反馈，而非仅靠自身判断。
 *
 * 本服务提供工具执行失败时的外部验证功能：
 * 1. 验证数据可用性 - 查询数据库确认数据是否存在
 * 2. 验证参数格式 - 检查参数格式是否正确
 * 3. 验证时间范围 - 检查时间范围内是否有数据
 * 4. 收集上下文信息 - 为纠错 Agent 提供决策依据
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public interface ExternalVerifierService {

    /**
     * 综合验证结果
     */
    record VerificationResult(
            boolean hasData,
            int recordCount,
            String dataStatus,
            Map<String, Object> contextInfo,
            String suggestion
    ) {
        public static VerificationResult empty(String reason) {
            return new VerificationResult(false, 0, reason, Map.of(), null);
        }

        public static VerificationResult withData(int count, Map<String, Object> context, String suggestion) {
            return new VerificationResult(true, count, "DATA_AVAILABLE", context, suggestion);
        }
    }

    /**
     * 验证数据可用性
     *
     * 检查指定条件下数据库中是否有数据
     *
     * @param factoryId 工厂ID
     * @param tableName 表名（如 material_batches, quality_inspections）
     * @param conditions 查询条件
     * @return 验证结果
     */
    VerificationResult verifyDataAvailability(String factoryId, String tableName, Map<String, Object> conditions);

    /**
     * 验证时间范围内的数据
     *
     * @param factoryId 工厂ID
     * @param tableName 表名
     * @param startDate 开始日期
     * @param endDate 结束日期
     * @return 验证结果，包含记录数和建议的时间范围
     */
    VerificationResult verifyTimeRangeData(String factoryId, String tableName, LocalDate startDate, LocalDate endDate);

    /**
     * 验证参数格式
     *
     * @param paramName 参数名
     * @param paramValue 参数值
     * @param expectedFormat 期望格式（如 "date", "number", "enum"）
     * @return 验证结果，包含格式是否正确和修正建议
     */
    VerificationResult verifyParameterFormat(String paramName, Object paramValue, String expectedFormat);

    /**
     * 获取工具执行的上下文信息
     *
     * 收集有助于纠错的上下文信息，如：
     * - 数据库中相关表的记录数
     * - 最近一条记录的时间
     * - 可用的枚举值列表
     *
     * @param factoryId 工厂ID
     * @param toolName 工具名称
     * @param params 原始参数
     * @return 上下文信息
     */
    Map<String, Object> collectContextInfo(String factoryId, String toolName, Map<String, Object> params);

    /**
     * 综合验证工具调用
     *
     * 对工具调用进行全面验证，返回综合验证结果
     *
     * @param factoryId 工厂ID
     * @param toolName 工具名称
     * @param params 参数
     * @param errorMessage 错误信息
     * @return 综合验证结果
     */
    VerificationResult verifyToolCall(String factoryId, String toolName, Map<String, Object> params, String errorMessage);
}
