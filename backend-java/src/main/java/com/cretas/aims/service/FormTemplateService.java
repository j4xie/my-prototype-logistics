package com.cretas.aims.service;

import com.cretas.aims.entity.config.FormTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 表单模板服务接口
 *
 * 提供:
 * - 表单模板 CRUD
 * - Schema 查询和合并
 * - AI 生成模板创建
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
public interface FormTemplateService {

    /**
     * 获取指定工厂和实体类型的表单模板
     * 工厂级模板优先于系统级模板
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return 模板（如果存在）
     */
    Optional<FormTemplate> getByFactoryAndEntityType(String factoryId, String entityType);

    /**
     * 获取 Schema JSON
     * 仅返回 schema_json 字段内容
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return Schema JSON 字符串（如果存在）
     */
    Optional<String> getSchemaJson(String factoryId, String entityType);

    /**
     * 创建表单模板
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @param name 模板名称
     * @param schemaJson Schema JSON
     * @param userId 创建者用户ID
     * @return 创建的模板
     */
    FormTemplate create(String factoryId, String entityType, String name, String schemaJson, Long userId);

    /**
     * 创建或更新表单模板
     * 如果已存在则更新，否则创建新的
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @param name 模板名称
     * @param schemaJson Schema JSON
     * @param userId 操作者用户ID
     * @return 创建/更新的模板
     */
    FormTemplate createOrUpdate(String factoryId, String entityType, String name, String schemaJson, Long userId);

    /**
     * 从 AI 助手创建模板
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @param name 模板名称
     * @param schemaJson Schema JSON
     * @param description 描述
     * @param userId 触发用户ID
     * @return 创建的模板
     */
    FormTemplate createFromAI(String factoryId, String entityType, String name,
                              String schemaJson, String description, Long userId);

    /**
     * 更新表单模板
     *
     * @param id 模板ID
     * @param name 新名称
     * @param schemaJson 新 Schema JSON
     * @param uiSchemaJson 新 UI Schema JSON
     * @return 更新后的模板
     */
    FormTemplate update(String id, String name, String schemaJson, String uiSchemaJson);

    /**
     * 启用/禁用模板
     *
     * @param id 模板ID
     * @param active 是否启用
     * @return 更新后的模板
     */
    FormTemplate setActive(String id, boolean active);

    /**
     * 删除模板（软删除）
     *
     * @param id 模板ID
     */
    void delete(String id);

    /**
     * 根据ID获取模板
     *
     * @param id 模板ID
     * @return 模板（如果存在）
     */
    Optional<FormTemplate> getById(String id);

    /**
     * 分页查询工厂的模板列表
     *
     * @param factoryId 工厂ID
     * @param pageable 分页参数
     * @return 分页模板列表
     */
    Page<FormTemplate> getByFactoryId(String factoryId, Pageable pageable);

    /**
     * 查询所有支持的实体类型
     *
     * @return 实体类型列表
     */
    List<String> getSupportedEntityTypes();

    /**
     * 获取统计信息
     *
     * @param factoryId 工厂ID
     * @return 统计信息 (totalCount, aiGeneratedCount, entityTypes)
     */
    Map<String, Object> getStatistics(String factoryId);

    /**
     * 检查是否存在自定义模板
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return 是否存在
     */
    boolean hasCustomTemplate(String factoryId, String entityType);

    /**
     * 回滚到指定版本
     *
     * @param templateId 模板ID
     * @param version 目标版本号
     * @param reason 回滚原因
     * @param userId 操作者用户ID
     * @return 回滚后的模板
     */
    FormTemplate rollbackToVersion(String templateId, Integer version, String reason, Long userId);
}
