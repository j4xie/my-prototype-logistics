package com.cretas.aims.service.skill;

import com.cretas.aims.dto.skill.SkillContext;
import com.cretas.aims.dto.skill.SkillDefinition;
import com.cretas.aims.dto.skill.SkillResult;

import java.util.List;
import java.util.Map;

/**
 * Skill路由服务接口
 *
 * 作为AI请求处理的入口，负责：
 * - 查找匹配的Skill
 * - 执行Skill
 * - Fallback到ToolRouter
 *
 * 处理流程:
 * 1. 检查Skills是否启用
 * 2. 查找匹配的Skill
 * 3. 执行最佳匹配的Skill
 * 4. 如果失败，fallback到ToolRouter
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public interface SkillRouterService {

    /**
     * 处理用户查询
     *
     * 优先尝试Skill匹配，失败则fallback到ToolRouter
     *
     * @param userQuery 用户查询文本
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @return 处理结果（SkillResult或ToolRouter返回的结果）
     */
    Object processQuery(String userQuery, String factoryId, String userId);

    /**
     * 处理用户查询（带会话上下文）
     *
     * @param userQuery 用户查询文本
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param sessionId 会话ID（用于多轮对话）
     * @return 处理结果
     */
    Object processQuery(String userQuery, String factoryId, String userId, String sessionId);

    /**
     * 处理用户查询（完整上下文）
     *
     * @param context Skill执行上下文
     * @return 处理结果
     */
    Object processQuery(SkillContext context);

    /**
     * 查找匹配的Skill
     *
     * @param userQuery 用户查询文本
     * @return 匹配的Skill列表（按匹配度降序）
     */
    List<SkillDefinition> findMatchingSkills(String userQuery);

    /**
     * 直接执行指定的Skill
     *
     * @param skillName Skill名称
     * @param context 执行上下文
     * @return 执行结果
     */
    SkillResult executeSkill(String skillName, SkillContext context);

    /**
     * 检查Skill路由是否启用
     *
     * @return 是否启用
     */
    boolean isSkillsEnabled();

    /**
     * 获取路由统计信息
     *
     * @return 统计信息Map
     */
    Map<String, Object> getRouterStats();
}
