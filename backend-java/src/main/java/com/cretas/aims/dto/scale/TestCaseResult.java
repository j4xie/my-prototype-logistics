package com.cretas.aims.dto.scale;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 测试用例执行结果 DTO
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestCaseResult {

    /**
     * 测试用例ID
     */
    private String testCaseId;

    /**
     * 测试用例名称
     */
    private String testName;

    /**
     * 是否通过
     */
    private Boolean passed;

    /**
     * 结果状态: PASSED, FAILED, ERROR
     */
    private String resultStatus;

    /**
     * 期望的重量值
     */
    private BigDecimal expectedWeight;

    /**
     * 实际解析的重量值
     */
    private BigDecimal actualWeight;

    /**
     * 期望的单位
     */
    private String expectedUnit;

    /**
     * 实际解析的单位
     */
    private String actualUnit;

    /**
     * 期望的稳定状态
     */
    private Boolean expectedStable;

    /**
     * 实际解析的稳定状态
     */
    private Boolean actualStable;

    /**
     * 是否为负面测试
     */
    private Boolean isNegativeTest;

    /**
     * 期望的错误代码 (负面测试)
     */
    private String expectedErrorCode;

    /**
     * 实际的错误代码
     */
    private String actualErrorCode;

    /**
     * 错误信息
     */
    private String errorMessage;

    /**
     * 执行时间 (毫秒)
     */
    private Long executionTimeMs;

    /**
     * 执行时间戳
     */
    private LocalDateTime executedAt;

    // ==================== 工厂方法 ====================

    public static TestCaseResult passed(String testCaseId, String testName, ScaleDataParseResult parseResult, BigDecimal expectedWeight) {
        return TestCaseResult.builder()
                .testCaseId(testCaseId)
                .testName(testName)
                .passed(true)
                .resultStatus("PASSED")
                .expectedWeight(expectedWeight)
                .actualWeight(parseResult.getWeight())
                .expectedUnit(parseResult.getUnit())
                .actualUnit(parseResult.getUnit())
                .expectedStable(parseResult.getStable())
                .actualStable(parseResult.getStable())
                .executedAt(LocalDateTime.now())
                .build();
    }

    public static TestCaseResult failed(String testCaseId, String testName, String reason) {
        return TestCaseResult.builder()
                .testCaseId(testCaseId)
                .testName(testName)
                .passed(false)
                .resultStatus("FAILED")
                .errorMessage(reason)
                .executedAt(LocalDateTime.now())
                .build();
    }

    public static TestCaseResult error(String testCaseId, String testName, String errorMessage) {
        return TestCaseResult.builder()
                .testCaseId(testCaseId)
                .testName(testName)
                .passed(false)
                .resultStatus("ERROR")
                .errorMessage(errorMessage)
                .executedAt(LocalDateTime.now())
                .build();
    }
}
