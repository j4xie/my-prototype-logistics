package com.cretas.aims.entity.rules;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.Type;

import javax.persistence.*;

/**
 * 状态机配置实体
 *
 * 定义实体的状态流转规则
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Entity
@Table(name = "state_machines",
       indexes = {
           @Index(name = "idx_state_machines_factory", columnList = "factory_id"),
           @Index(name = "idx_state_machines_entity", columnList = "factory_id, entity_type")
       },
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_state_machines",
                            columnNames = {"factory_id", "entity_type"})
       })
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class StateMachine extends BaseEntity {

    @Id
    @Column(name = "id", length = 50)
    private String id;

    /**
     * 工厂ID
     */
    @Column(name = "factory_id", length = 50, nullable = false)
    private String factoryId;

    /**
     * 实体类型
     * 如: QUALITY_CHECK, PROCESSING_BATCH
     */
    @Column(name = "entity_type", length = 50, nullable = false)
    private String entityType;

    /**
     * 状态机名称
     */
    @Column(name = "machine_name", length = 100, nullable = false)
    private String machineName;

    /**
     * 状态机描述
     */
    @Column(name = "machine_description", columnDefinition = "TEXT")
    private String machineDescription;

    /**
     * 初始状态
     */
    @Column(name = "initial_state", length = 50, nullable = false)
    private String initialState;

    /**
     * 状态定义 JSON
     * 格式: [{"code":"pending", "name":"待处理", "isFinal":false, "color":"#FFA500"}]
     */
    @Column(name = "states_json", columnDefinition = "JSON", nullable = false)
    private String statesJson;

    /**
     * 状态转换定义 JSON
     * 格式: [{"from":"pending", "to":"approved", "event":"approve", "guard":"role == 'admin'", "action":"notify"}]
     */
    @Column(name = "transitions_json", columnDefinition = "JSON", nullable = false)
    private String transitionsJson;

    /**
     * 版本号
     */
    @Column(name = "version")
    @Builder.Default
    private Integer version = 1;

    /**
     * 是否启用
     */
    @Column(name = "enabled")
    @Builder.Default
    private Boolean enabled = true;

    /**
     * 创建者用户ID
     */
    @Column(name = "created_by")
    private Long createdBy;
}
