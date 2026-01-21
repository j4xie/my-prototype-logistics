package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;

/**
 * SmartBI 动态字典实体
 * 支持运行时动态添加识别词条，无需重启服务
 *
 * 字典类型：
 * - region: 区域（华东、上海等）
 * - department: 部门（销售部、研发部等）
 * - metric: 指标（销售额、利润率等）
 * - time: 时间表达式（本月、Q1等）
 * - dimension: 维度（按部门、按区域等）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-20
 */
@Entity
@Table(name = "smart_bi_dictionary",
       indexes = {
           @Index(name = "idx_dict_type", columnList = "dict_type"),
           @Index(name = "idx_dict_factory", columnList = "factory_id"),
           @Index(name = "idx_dict_active", columnList = "is_active")
       },
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_dict_type_name_factory",
                            columnNames = {"dict_type", "name", "factory_id"})
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiDictionary extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 工厂ID，null 表示全局配置
     */
    @Column(name = "factory_id", length = 50)
    private String factoryId;

    /**
     * 字典类型：region/department/metric/time/dimension
     */
    @Column(name = "dict_type", nullable = false, length = 50)
    private String dictType;

    /**
     * 标准名称（用于识别后返回）
     */
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /**
     * 别名列表 (JSON 数组)
     * 如：["销售", "营销部", "销售团队"]
     */
    @Column(name = "aliases", columnDefinition = "JSON")
    private String aliases;

    /**
     * 父级名称（用于层级关系）
     * 如：城市的父级是省份，省份的父级是大区
     */
    @Column(name = "parent_name", length = 100)
    private String parentName;

    /**
     * 扩展元数据 (JSON)
     * 如指标的单位、聚合方式等
     */
    @Column(name = "metadata", columnDefinition = "JSON")
    private String metadata;

    /**
     * 来源：SYSTEM（JSON导入）/ USER（用户添加）/ AI（AI学习）
     */
    @Builder.Default
    @Column(name = "source", length = 20)
    private String source = "USER";

    /**
     * 是否启用
     */
    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    /**
     * 优先级（数值越小越优先匹配）
     */
    @Builder.Default
    @Column(name = "priority")
    private Integer priority = 100;
}
