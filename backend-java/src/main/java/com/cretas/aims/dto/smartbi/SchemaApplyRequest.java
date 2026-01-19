package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotNull;
import java.util.List;

/**
 * Schema 变更应用请求 DTO
 * 用于请求应用 Schema 变更到数据源
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SchemaApplyRequest {

    /**
     * 数据源 ID
     * 要应用变更的目标数据源
     */
    @NotNull(message = "数据源ID不能为空")
    private Long datasourceId;

    /**
     * 确认的字段映射列表
     * 用户确认或修改后的字段映射配置
     */
    private List<FieldMapping> confirmedMappings;

    /**
     * 是否执行数据库迁移
     * true 表示同时执行数据库表结构变更
     * false 表示仅更新元数据配置
     */
    @Builder.Default
    private boolean executeDbMigration = false;

    /**
     * 备份标识
     * 是否在迁移前创建数据备份
     */
    @Builder.Default
    private boolean createBackup = true;

    /**
     * 变更说明
     * 用于记录此次变更的原因或备注
     */
    private String changeNote;

    /**
     * 审批人用户名
     * 当需要审批时，记录审批人信息
     */
    private String approvedBy;

    /**
     * 强制应用标识
     * true 表示即使有警告也强制应用
     * 需要管理员权限
     */
    @Builder.Default
    private boolean forceApply = false;

    /**
     * 创建简单的应用请求
     */
    public static SchemaApplyRequest of(Long datasourceId, List<FieldMapping> mappings) {
        return SchemaApplyRequest.builder()
                .datasourceId(datasourceId)
                .confirmedMappings(mappings)
                .executeDbMigration(false)
                .createBackup(true)
                .build();
    }

    /**
     * 创建带迁移的应用请求
     */
    public static SchemaApplyRequest withMigration(Long datasourceId, List<FieldMapping> mappings,
                                                    boolean backup, String note) {
        return SchemaApplyRequest.builder()
                .datasourceId(datasourceId)
                .confirmedMappings(mappings)
                .executeDbMigration(true)
                .createBackup(backup)
                .changeNote(note)
                .build();
    }

    /**
     * 创建强制应用请求
     */
    public static SchemaApplyRequest forceApply(Long datasourceId, List<FieldMapping> mappings,
                                                 String approver, String note) {
        return SchemaApplyRequest.builder()
                .datasourceId(datasourceId)
                .confirmedMappings(mappings)
                .executeDbMigration(true)
                .createBackup(true)
                .forceApply(true)
                .approvedBy(approver)
                .changeNote(note)
                .build();
    }
}
