package com.cretas.aims.service.skill;

import com.cretas.aims.dto.skill.SkillDefinition;

import java.util.List;
import java.util.Optional;

/**
 * Skill注册中心接口
 *
 * 管理所有可用的Skill定义，提供：
 * - Skill注册和注销
 * - Skill查询和匹配
 * - 触发词匹配
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public interface SkillRegistry {

    /**
     * 注册Skill定义
     *
     * @param skillDefinition Skill定义
     */
    void register(SkillDefinition skillDefinition);

    /**
     * 批量注册Skill定义
     *
     * @param skillDefinitions Skill定义列表
     */
    void registerAll(List<SkillDefinition> skillDefinitions);

    /**
     * 注销Skill
     *
     * @param skillName Skill名称
     */
    void unregister(String skillName);

    /**
     * 根据名称获取Skill定义
     *
     * @param skillName Skill名称
     * @return Skill定义（如果存在）
     */
    Optional<SkillDefinition> getSkill(String skillName);

    /**
     * 获取所有已注册的Skill定义
     *
     * @return Skill定义列表
     */
    List<SkillDefinition> getAllSkills();

    /**
     * 获取所有启用的Skill定义
     *
     * @return 启用的Skill定义列表
     */
    List<SkillDefinition> getEnabledSkills();

    /**
     * 根据用户查询查找匹配的Skill
     *
     * 匹配逻辑:
     * 1. 遍历所有启用的Skill
     * 2. 检查触发词是否匹配
     * 3. 计算匹配得分
     * 4. 按得分降序排序返回
     *
     * @param userQuery 用户查询文本
     * @return 匹配的Skill列表（按匹配得分降序）
     */
    List<SkillDefinition> findMatchingSkills(String userQuery);

    /**
     * 根据用户查询查找最佳匹配的Skill
     *
     * @param userQuery 用户查询文本
     * @return 最佳匹配的Skill（如果存在）
     */
    Optional<SkillDefinition> findBestMatch(String userQuery);

    /**
     * 根据用户查询查找匹配的Skill（带最小得分阈值）
     *
     * @param userQuery 用户查询文本
     * @param minScore 最小匹配得分阈值 (0.0 - 1.0)
     * @return 匹配的Skill列表
     */
    List<SkillDefinition> findMatchingSkills(String userQuery, double minScore);

    /**
     * 检查Skill是否存在
     *
     * @param skillName Skill名称
     * @return 是否存在
     */
    boolean hasSkill(String skillName);

    /**
     * 获取已注册的Skill数量
     *
     * @return Skill数量
     */
    int getSkillCount();

    /**
     * 清空所有Skill注册
     */
    void clear();

    /**
     * 刷新Skill配置（从数据源重新加载）
     */
    void refresh();
}
