package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Schema 变更预览响应 DTO
 * 用于返回 Schema 变更预览端点的响应数据
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SchemaChangePreview {

    /**
     * Schema 变更报告
     * 包含新增、移除、修改的字段列表
     */
    private SchemaChangeReport changes;

    /**
     * LLM 推荐的字段映射列表
     * 针对新增或修改的字段，提供语义化映射建议
     */
    @Builder.Default
    private List<FieldMapping> suggestedMappings = new ArrayList<>();

    /**
     * 警告消息
     * 当存在潜在风险时显示，如：
     * - 移除字段可能影响现有报表
     * - 类型变更可能导致数据丢失
     */
    private String warningMessage;

    /**
     * 是否需要管理员审批
     * true 表示变更需要人工确认后才能应用
     * 通常在以下情况需要审批：
     * - 有字段被移除
     * - 有字段类型被修改
     * - LLM 推断置信度较低
     */
    private boolean requiresApproval;

    /**
     * 影响的报表数量
     * 变更可能影响到的现有报表/仪表板数量
     */
    private int affectedReportsCount;

    /**
     * 影响的报表名称列表
     */
    private List<String> affectedReportNames;

    /**
     * 预估迁移时间（秒）
     * 执行数据库迁移的预估耗时
     */
    private Long estimatedMigrationTime;

    /**
     * 创建无变更的预览
     */
    public static SchemaChangePreview noChanges(String datasourceName, int currentVersion) {
        return SchemaChangePreview.builder()
                .changes(SchemaChangeReport.noChanges(datasourceName, currentVersion))
                .requiresApproval(false)
                .affectedReportsCount(0)
                .build();
    }

    /**
     * 创建需要审批的预览
     */
    public static SchemaChangePreview requiresApproval(SchemaChangeReport changes,
                                                        List<FieldMapping> mappings,
                                                        String warningMessage) {
        return SchemaChangePreview.builder()
                .changes(changes)
                .suggestedMappings(mappings != null ? mappings : new ArrayList<>())
                .warningMessage(warningMessage)
                .requiresApproval(true)
                .build();
    }

    /**
     * 创建自动可应用的预览
     */
    public static SchemaChangePreview autoApplicable(SchemaChangeReport changes,
                                                      List<FieldMapping> mappings) {
        return SchemaChangePreview.builder()
                .changes(changes)
                .suggestedMappings(mappings != null ? mappings : new ArrayList<>())
                .requiresApproval(false)
                .build();
    }

    /**
     * 判断是否有高风险变更
     */
    public boolean hasHighRiskChanges() {
        if (changes == null) return false;
        return (changes.getRemovedFields() != null && !changes.getRemovedFields().isEmpty())
                || (changes.getModifiedFields() != null && !changes.getModifiedFields().isEmpty());
    }

    /**
     * 获取需要确认的映射数量
     */
    public long getConfirmationRequiredCount() {
        if (suggestedMappings == null) return 0;
        return suggestedMappings.stream()
                .filter(FieldMapping::requiresConfirmation)
                .count();
    }
}
