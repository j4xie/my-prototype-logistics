package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.SchemaApplyRequest;
import com.cretas.aims.dto.smartbi.SchemaChangePreview;
import com.cretas.aims.entity.smartbi.SmartBiDatasource;
import com.cretas.aims.entity.smartbi.SmartBiFieldDefinition;
import com.cretas.aims.entity.smartbi.SmartBiSchemaHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * SmartBI Schema 管理服务接口
 *
 * <p>提供数据源 Schema 管理功能，包括：</p>
 * <ul>
 *     <li>Excel 上传与 Schema 检测</li>
 *     <li>Schema 变更预览与应用</li>
 *     <li>数据源和字段定义管理</li>
 *     <li>Schema 变更历史追踪</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public interface SmartBiSchemaService {

    // ==================== Excel 上传与检测 ====================

    /**
     * 上传 Excel 并检测 Schema 变化
     *
     * <p>执行以下步骤：</p>
     * <ol>
     *     <li>解析 Excel 文件结构</li>
     *     <li>与现有 Schema 进行比较（如果存在）</li>
     *     <li>使用 LLM 推断新字段的语义含义</li>
     *     <li>返回 Schema 变更预览</li>
     * </ol>
     *
     * @param file Excel 文件
     * @param datasourceName 数据源名称
     * @param factoryId 工厂ID（可选）
     * @return Schema 变更预览
     */
    SchemaChangePreview uploadAndDetectSchema(MultipartFile file, String datasourceName, String factoryId);

    /**
     * 预览指定数据源的待处理 Schema 变更
     *
     * @param datasourceId 数据源ID
     * @return Schema 变更预览
     */
    SchemaChangePreview previewSchemaChanges(Long datasourceId);

    /**
     * 应用 Schema 变更
     *
     * <p>执行以下步骤：</p>
     * <ol>
     *     <li>验证用户确认的映射</li>
     *     <li>执行 DDL 语句（如果需要）</li>
     *     <li>更新字段定义</li>
     *     <li>创建 Schema 历史记录</li>
     * </ol>
     *
     * @param request 应用请求
     */
    void applySchemaChanges(SchemaApplyRequest request);

    // ==================== 数据源管理 ====================

    /**
     * 获取数据源列表
     *
     * @param factoryId 工厂ID（可选，为空时返回所有）
     * @return 数据源列表
     */
    List<SmartBiDatasource> listDatasources(String factoryId);

    /**
     * 根据ID获取数据源
     *
     * @param datasourceId 数据源ID
     * @return 数据源
     */
    SmartBiDatasource getDatasource(Long datasourceId);

    /**
     * 创建新数据源
     *
     * @param datasource 数据源信息
     * @return 创建的数据源
     */
    SmartBiDatasource createDatasource(SmartBiDatasource datasource);

    /**
     * 更新数据源
     *
     * @param datasource 数据源信息
     * @return 更新后的数据源
     */
    SmartBiDatasource updateDatasource(SmartBiDatasource datasource);

    /**
     * 删除数据源
     *
     * @param datasourceId 数据源ID
     */
    void deleteDatasource(Long datasourceId);

    // ==================== 字段定义管理 ====================

    /**
     * 获取数据源的字段定义列表
     *
     * @param datasourceId 数据源ID
     * @return 字段定义列表
     */
    List<SmartBiFieldDefinition> getDatasourceFields(Long datasourceId);

    /**
     * 批量保存字段定义
     *
     * @param datasourceId 数据源ID
     * @param fields 字段定义列表
     * @return 保存的字段列表
     */
    List<SmartBiFieldDefinition> saveFields(Long datasourceId, List<SmartBiFieldDefinition> fields);

    /**
     * 更新单个字段定义
     *
     * @param field 字段定义
     * @return 更新后的字段
     */
    SmartBiFieldDefinition updateField(SmartBiFieldDefinition field);

    /**
     * 删除字段定义
     *
     * @param fieldId 字段ID
     */
    void deleteField(Long fieldId);

    // ==================== Schema 历史管理 ====================

    /**
     * 获取数据源的 Schema 变更历史
     *
     * @param datasourceId 数据源ID
     * @param pageable 分页参数
     * @return Schema 变更历史分页
     */
    Page<SmartBiSchemaHistory> getSchemaHistory(Long datasourceId, Pageable pageable);

    /**
     * 获取指定版本的 Schema 历史记录
     *
     * @param datasourceId 数据源ID
     * @param version 版本号
     * @return Schema 历史记录
     */
    SmartBiSchemaHistory getSchemaHistoryByVersion(Long datasourceId, Integer version);

    /**
     * 回滚到指定版本
     *
     * @param datasourceId 数据源ID
     * @param version 目标版本号
     */
    void rollbackToVersion(Long datasourceId, Integer version);
}
