package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 字段变更 DTO
 * 表示单个字段的变更信息，用于 Schema 变更检测
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FieldChange {

    /**
     * 字段名称
     */
    private String fieldName;

    /**
     * 原始数据类型
     * 仅在 MODIFY 或 REMOVE 类型变更时有值
     */
    private String oldType;

    /**
     * 新数据类型
     * 仅在 MODIFY 或 ADD 类型变更时有值
     */
    private String newType;

    /**
     * 变更类型
     * - ADD: 新增字段
     * - REMOVE: 移除字段
     * - MODIFY: 类型修改
     */
    private String changeType;

    /**
     * 样本数据值
     * 用于帮助理解字段内容
     */
    private List<Object> sampleValues;

    /**
     * 变更类型枚举
     */
    public enum ChangeType {
        ADD("ADD"),
        REMOVE("REMOVE"),
        MODIFY("MODIFY");

        private final String value;

        ChangeType(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * 创建新增字段变更
     */
    public static FieldChange addField(String fieldName, String newType, List<Object> sampleValues) {
        return FieldChange.builder()
                .fieldName(fieldName)
                .newType(newType)
                .changeType(ChangeType.ADD.getValue())
                .sampleValues(sampleValues)
                .build();
    }

    /**
     * 创建移除字段变更
     */
    public static FieldChange removeField(String fieldName, String oldType) {
        return FieldChange.builder()
                .fieldName(fieldName)
                .oldType(oldType)
                .changeType(ChangeType.REMOVE.getValue())
                .build();
    }

    /**
     * 创建修改字段变更
     */
    public static FieldChange modifyField(String fieldName, String oldType, String newType, List<Object> sampleValues) {
        return FieldChange.builder()
                .fieldName(fieldName)
                .oldType(oldType)
                .newType(newType)
                .changeType(ChangeType.MODIFY.getValue())
                .sampleValues(sampleValues)
                .build();
    }
}
