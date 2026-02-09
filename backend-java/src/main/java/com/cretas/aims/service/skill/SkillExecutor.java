package com.cretas.aims.service.skill;

import com.cretas.aims.dto.skill.SkillContext;
import com.cretas.aims.dto.skill.SkillDefinition;
import com.cretas.aims.dto.skill.SkillResult;

/**
 * Skill执行器接口
 *
 * 负责执行Skill定义中定义的逻辑，包括：
 * - 参数提取
 * - 工具调用
 * - 结果组装
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public interface SkillExecutor {

    /**
     * 执行Skill
     *
     * 执行流程:
     * 1. 验证上下文完整性
     * 2. 从用户查询中提取参数
     * 3. 按顺序执行Skill定义的工具
     * 4. 组装并返回执行结果
     *
     * @param skillDefinition Skill定义
     * @param context 执行上下文
     * @return 执行结果
     */
    SkillResult execute(SkillDefinition skillDefinition, SkillContext context);

    /**
     * 执行Skill（带超时控制）
     *
     * @param skillDefinition Skill定义
     * @param context 执行上下文
     * @param timeoutMs 超时时间（毫秒）
     * @return 执行结果
     */
    SkillResult execute(SkillDefinition skillDefinition, SkillContext context, long timeoutMs);

    /**
     * 验证上下文是否满足Skill的需求
     *
     * @param skillDefinition Skill定义
     * @param context 执行上下文
     * @return 验证结果（null表示通过，否则为错误信息）
     */
    String validateContext(SkillDefinition skillDefinition, SkillContext context);

    /**
     * 检查执行器是否支持该Skill
     *
     * @param skillDefinition Skill定义
     * @return 是否支持
     */
    boolean supports(SkillDefinition skillDefinition);
}
