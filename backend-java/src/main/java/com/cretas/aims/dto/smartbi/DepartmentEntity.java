package com.cretas.aims.dto.smartbi;

import com.cretas.aims.entity.smartbi.enums.DepartmentType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 部门实体 DTO
 *
 * 用于表示从自然语言查询中识别出的部门实体，
 * 包含匹配文本、部门类型、标准化名称和位置信息。
 *
 * 使用示例：
 * - 查询 "销售部业绩" -> DepartmentEntity(text="销售部", type=DEPARTMENT, normalizedName="销售部")
 * - 查询 "销售一部的订单" -> DepartmentEntity(text="销售一部", type=SUB_DEPARTMENT, normalizedName="销售一部", parentDepartment="销售部")
 * - 查询 "研发团队进度" -> DepartmentEntity(text="研发团队", type=DEPARTMENT, normalizedName="研发部", matchedByAlias=true)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-20
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentEntity {

    /**
     * 匹配的原始文本
     * 从用户查询中提取的部门相关文本片段
     * 例如："销售部"、"销售一部"、"研发团队"
     */
    private String text;

    /**
     * 部门类型
     * DEPARTMENT: 一级部门（销售部、市场部等）
     * SUB_DEPARTMENT: 子部门/分组（销售一部、前端组等）
     */
    private DepartmentType type;

    /**
     * 标准化名称
     * 统一规范后的部门名称，用于数据库查询和数据匹配
     * 例如："销售" -> "销售部"，"研发团队" -> "研发部"
     */
    private String normalizedName;

    /**
     * 父级部门
     * 对于子部门：父级为一级部门名称
     * 例如："销售一部" -> parentDepartment="销售部"
     */
    private String parentDepartment;

    /**
     * 匹配置信度 (0.0 - 1.0)
     * 精确匹配为 1.0，别名匹配为 0.9，模式匹配为 0.8
     */
    @Builder.Default
    private double confidence = 1.0;

    /**
     * 是否通过别名匹配
     */
    @Builder.Default
    private boolean matchedByAlias = false;

    /**
     * 匹配到的别名（如果 matchedByAlias 为 true）
     */
    private String matchedAlias;

    /**
     * 是否通过模式匹配（如"一部"、"2组"等）
     */
    @Builder.Default
    private boolean matchedByPattern = false;

    /**
     * 匹配到的模式（如果 matchedByPattern 为 true）
     */
    private String matchedPattern;

    /**
     * 在原始查询文本中的起始位置（包含）
     * 用于文本高亮和定位
     */
    private int startIndex;

    /**
     * 在原始查询文本中的结束位置（不包含）
     * 用于文本高亮和定位
     */
    private int endIndex;

    // ==================== 便捷构造方法 ====================

    /**
     * 创建部门实体
     *
     * @param text 匹配文本
     * @param normalizedName 标准化名称
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return DepartmentEntity
     */
    public static DepartmentEntity department(String text, String normalizedName, int startIndex, int endIndex) {
        return DepartmentEntity.builder()
                .text(text)
                .type(DepartmentType.DEPARTMENT)
                .normalizedName(normalizedName)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .confidence(1.0)
                .build();
    }

    /**
     * 创建部门实体（通过别名匹配）
     *
     * @param text 匹配文本
     * @param normalizedName 标准化名称
     * @param alias 匹配到的别名
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return DepartmentEntity
     */
    public static DepartmentEntity departmentByAlias(String text, String normalizedName, String alias,
                                                      int startIndex, int endIndex) {
        return DepartmentEntity.builder()
                .text(text)
                .type(DepartmentType.DEPARTMENT)
                .normalizedName(normalizedName)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .matchedByAlias(true)
                .matchedAlias(alias)
                .confidence(0.9)
                .build();
    }

    /**
     * 创建子部门实体
     *
     * @param text 匹配文本
     * @param normalizedName 标准化名称
     * @param parentDepartment 所属部门
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return DepartmentEntity
     */
    public static DepartmentEntity subDepartment(String text, String normalizedName, String parentDepartment,
                                                  int startIndex, int endIndex) {
        return DepartmentEntity.builder()
                .text(text)
                .type(DepartmentType.SUB_DEPARTMENT)
                .normalizedName(normalizedName)
                .parentDepartment(parentDepartment)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .confidence(1.0)
                .build();
    }

    /**
     * 创建子部门实体（通过模式匹配）
     *
     * @param text 匹配文本
     * @param normalizedName 标准化名称
     * @param parentDepartment 所属部门
     * @param pattern 匹配到的模式
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return DepartmentEntity
     */
    public static DepartmentEntity subDepartmentByPattern(String text, String normalizedName, String parentDepartment,
                                                           String pattern, int startIndex, int endIndex) {
        return DepartmentEntity.builder()
                .text(text)
                .type(DepartmentType.SUB_DEPARTMENT)
                .normalizedName(normalizedName)
                .parentDepartment(parentDepartment)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .matchedByPattern(true)
                .matchedPattern(pattern)
                .confidence(0.8)
                .build();
    }

    // ==================== 工具方法 ====================

    /**
     * 获取匹配文本的长度
     *
     * @return 文本长度
     */
    public int getTextLength() {
        return text != null ? text.length() : 0;
    }

    /**
     * 判断是否为一级部门类型
     *
     * @return true 如果是一级部门
     */
    public boolean isDepartment() {
        return type == DepartmentType.DEPARTMENT;
    }

    /**
     * 判断是否为子部门类型
     *
     * @return true 如果是子部门/分组
     */
    public boolean isSubDepartment() {
        return type == DepartmentType.SUB_DEPARTMENT;
    }

    /**
     * 判断实体是否有效
     *
     * @return true 如果包含必要信息
     */
    public boolean isValid() {
        return text != null && !text.isEmpty()
                && type != null
                && normalizedName != null && !normalizedName.isEmpty()
                && startIndex >= 0
                && endIndex > startIndex;
    }

    /**
     * 判断是否有父级部门
     *
     * @return true 如果有父级部门
     */
    public boolean hasParentDepartment() {
        return parentDepartment != null && !parentDepartment.isEmpty();
    }
}
