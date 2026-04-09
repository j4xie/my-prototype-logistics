package com.cretas.aims.entity.config;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;
import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "factory_scheduler_configs",
    uniqueConstraints = @UniqueConstraint(name = "idx_fschd_factory_task", columnNames = {"factory_id", "task_code"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FactorySchedulerConfig {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "factory_id", length = 50) private String factoryId;
    @Column(name = "task_code", length = 64, nullable = false) private String taskCode;
    @Column(name = "cron_expression", length = 50, nullable = false) private String cronExpression;
    @Column(name = "enabled", nullable = false) @Builder.Default private Boolean enabled = true;
    @Column(name = "tool_or_method", length = 100) private String toolOrMethod;
    @Type(JsonBinaryType.class)
    @Column(name = "params", columnDefinition = "jsonb", nullable = false) @Builder.Default private Map<String, Object> params = Map.of();
    @Column(name = "description", columnDefinition = "TEXT") private String description;
    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;
    @PrePersist protected void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
