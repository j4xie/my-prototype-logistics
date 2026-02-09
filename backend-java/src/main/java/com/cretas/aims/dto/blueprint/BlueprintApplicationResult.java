package com.cretas.aims.dto.blueprint;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 蓝图应用结果DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BlueprintApplicationResult {

    /**
     * 应用记录ID
     */
    private String applicationId;

    /**
     * 蓝图ID
     */
    private String blueprintId;

    /**
     * 蓝图名称
     */
    private String blueprintName;

    /**
     * 工厂ID
     */
    private String factoryId;

    /**
     * 应用状态
     */
    private String status;

    /**
     * 应用时间
     */
    private LocalDateTime appliedAt;

    /**
     * 是否成功
     */
    private Boolean success;

    /**
     * 总结信息
     */
    private String summary;

    /**
     * 创建的表单模板数量
     */
    private Integer formTemplatesCreated = 0;

    /**
     * 创建的规则配置数量
     */
    private Integer rulesCreated = 0;

    /**
     * 创建的产品类型数量
     */
    private Integer productTypesCreated = 0;

    /**
     * 创建的部门数量
     */
    private Integer departmentsCreated = 0;

    /**
     * 错误信息列表
     */
    @Builder.Default
    private List<String> errors = new ArrayList<>();

    /**
     * 警告信息列表
     */
    @Builder.Default
    private List<String> warnings = new ArrayList<>();

    /**
     * 详细日志
     */
    @Builder.Default
    private List<String> logs = new ArrayList<>();

    /**
     * 添加日志
     */
    public void addLog(String log) {
        if (this.logs == null) {
            this.logs = new ArrayList<>();
        }
        this.logs.add(log);
    }

    /**
     * 添加错误
     */
    public void addError(String error) {
        if (this.errors == null) {
            this.errors = new ArrayList<>();
        }
        this.errors.add(error);
    }

    /**
     * 添加警告
     */
    public void addWarning(String warning) {
        if (this.warnings == null) {
            this.warnings = new ArrayList<>();
        }
        this.warnings.add(warning);
    }
}
