package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 可切换维度 DTO
 * 用于前端展示可切换的 X 轴或 Series 维度选项
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlternativeDimension {

    /**
     * 字段名
     * 数据源中的原始字段名
     */
    private String fieldName;

    /**
     * 显示名称
     * 用于前端展示的中文名称
     */
    private String displayName;

    /**
     * 可切换的目标角色
     * X_AXIS 或 SERIES
     */
    private String targetRole;

    /**
     * 数据类型
     */
    private String dataType;

    /**
     * 是否为时间维度
     */
    @Builder.Default
    private boolean timeDimension = false;

    /**
     * 是否当前选中
     */
    @Builder.Default
    private boolean selected = false;

    /**
     * 优先级
     * 数字越小优先级越高，用于排序
     */
    @Builder.Default
    private int priority = 100;

    /**
     * 预估的唯一值数量
     * 用于判断是否适合作为 X 轴（太多不适合）或 Series（太多不适合）
     */
    private Integer distinctCount;

    /**
     * 创建 X 轴备选维度
     */
    public static AlternativeDimension forXAxis(String fieldName, String displayName,
                                                 String dataType, boolean isTime, int priority) {
        return AlternativeDimension.builder()
                .fieldName(fieldName)
                .displayName(displayName)
                .targetRole("X_AXIS")
                .dataType(dataType)
                .timeDimension(isTime)
                .priority(priority)
                .build();
    }

    /**
     * 创建 Series 备选维度
     */
    public static AlternativeDimension forSeries(String fieldName, String displayName,
                                                  String dataType, int priority) {
        return AlternativeDimension.builder()
                .fieldName(fieldName)
                .displayName(displayName)
                .targetRole("SERIES")
                .dataType(dataType)
                .timeDimension(false)
                .priority(priority)
                .build();
    }

    /**
     * 创建可同时作为 X 轴和 Series 的维度
     */
    public static AlternativeDimension forBoth(String fieldName, String displayName,
                                                String dataType, int priority) {
        return AlternativeDimension.builder()
                .fieldName(fieldName)
                .displayName(displayName)
                .targetRole("BOTH")
                .dataType(dataType)
                .priority(priority)
                .build();
    }

    /**
     * 判断是否适合作为 X 轴
     * 唯一值数量不宜过多（建议小于 50）
     */
    public boolean suitableForXAxis() {
        if (distinctCount == null) {
            return true;
        }
        return distinctCount <= 50;
    }

    /**
     * 判断是否适合作为 Series
     * 唯一值数量不宜过多（建议小于 10）
     */
    public boolean suitableForSeries() {
        if (distinctCount == null) {
            return true;
        }
        return distinctCount <= 10;
    }
}
