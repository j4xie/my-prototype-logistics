package com.cretas.aims.dto.skill;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Skill执行结果DTO
 *
 * 封装Skill执行的完整结果，包括：
 * - 执行状态和结果数据
 * - 执行的工具链
 * - 性能指标
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillResult {

    /**
     * 执行是否成功
     */
    private boolean success;

    /**
     * Skill名称
     * 执行的Skill标识
     */
    private String skillName;

    /**
     * 执行结果数据
     * 根据Skill类型返回不同结构：
     * - 查询类: 数据列表或统计结果
     * - 分析类: 分析报告和图表数据
     * - 操作类: 操作结果确认
     */
    private Object data;

    /**
     * 结果消息
     * 执行结果的文字描述或错误信息
     */
    private String message;

    /**
     * 已执行的工具列表
     * 记录Skill执行过程中调用的所有工具
     * 用于调试和执行链追踪
     */
    private List<String> executedTools;

    /**
     * 执行时间 (毫秒)
     * 从开始到完成的总耗时
     */
    private long executionTime;

    /**
     * 创建成功结果
     *
     * @param skillName     Skill名称
     * @param data          执行结果数据
     * @param executedTools 已执行的工具列表
     * @param executionTime 执行时间
     * @return 成功结果
     */
    public static SkillResult success(String skillName, Object data,
                                       List<String> executedTools, long executionTime) {
        return SkillResult.builder()
                .success(true)
                .skillName(skillName)
                .data(data)
                .executedTools(executedTools)
                .executionTime(executionTime)
                .build();
    }

    /**
     * 创建错误结果
     *
     * @param skillName     Skill名称
     * @param errorMessage  错误信息
     * @param executedTools 已执行的工具列表
     * @param executionTime 执行时间
     * @return 错误结果
     */
    public static SkillResult error(String skillName, String errorMessage,
                                     List<String> executedTools, long executionTime) {
        return SkillResult.builder()
                .success(false)
                .skillName(skillName)
                .message(errorMessage)
                .executedTools(executedTools)
                .executionTime(executionTime)
                .build();
    }
}
