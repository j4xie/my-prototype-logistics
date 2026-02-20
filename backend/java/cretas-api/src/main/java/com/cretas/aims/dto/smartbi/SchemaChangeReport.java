package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Schema 变更检测报告 DTO
 * 用于表示数据源 Schema 的变更检测结果
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SchemaChangeReport {

    /**
     * 数据源名称
     */
    private String datasourceName;

    /**
     * 当前 Schema 版本
     */
    private int currentVersion;

    /**
     * 新 Schema 版本
     */
    private int newVersion;

    /**
     * 新增字段列表
     */
    @Builder.Default
    private List<FieldChange> addedFields = new ArrayList<>();

    /**
     * 移除字段列表
     */
    @Builder.Default
    private List<FieldChange> removedFields = new ArrayList<>();

    /**
     * 修改字段列表
     */
    @Builder.Default
    private List<FieldChange> modifiedFields = new ArrayList<>();

    /**
     * 是否有变更
     */
    private boolean hasChanges;

    /**
     * 检测时间
     */
    private LocalDateTime detectedAt;

    /**
     * 计算是否有变更
     */
    public boolean hasChanges() {
        return (addedFields != null && !addedFields.isEmpty())
                || (removedFields != null && !removedFields.isEmpty())
                || (modifiedFields != null && !modifiedFields.isEmpty());
    }

    /**
     * 获取总变更数量
     */
    public int getTotalChanges() {
        int count = 0;
        if (addedFields != null) count += addedFields.size();
        if (removedFields != null) count += removedFields.size();
        if (modifiedFields != null) count += modifiedFields.size();
        return count;
    }

    /**
     * 创建无变更的报告
     */
    public static SchemaChangeReport noChanges(String datasourceName, int currentVersion) {
        return SchemaChangeReport.builder()
                .datasourceName(datasourceName)
                .currentVersion(currentVersion)
                .newVersion(currentVersion)
                .hasChanges(false)
                .detectedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 创建带变更的报告
     */
    public static SchemaChangeReport withChanges(String datasourceName, int currentVersion, int newVersion,
                                                  List<FieldChange> added, List<FieldChange> removed,
                                                  List<FieldChange> modified) {
        return SchemaChangeReport.builder()
                .datasourceName(datasourceName)
                .currentVersion(currentVersion)
                .newVersion(newVersion)
                .addedFields(added != null ? added : new ArrayList<>())
                .removedFields(removed != null ? removed : new ArrayList<>())
                .modifiedFields(modified != null ? modified : new ArrayList<>())
                .hasChanges(true)
                .detectedAt(LocalDateTime.now())
                .build();
    }
}
