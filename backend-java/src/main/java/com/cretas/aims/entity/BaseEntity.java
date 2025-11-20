package com.cretas.aims.entity;

import lombok.Data;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import javax.persistence.*;
import java.io.Serializable;
import java.time.LocalDateTime;
/**
 * 基础实体类
 * 提供通用的创建时间、更新时间和软删除字段
 *
 * 软删除机制说明:
 * - 所有继承此类的实体都支持软删除
 * - 删除操作会将deleted_at设置为当前时间，而非物理删除
 * - 查询时自动过滤已删除的记录（deleted_at IS NULL）
 * - 可通过deletedAt字段恢复误删除的数据
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2025-01-09
 * @updated 2025-11-05 - 添加软删除支持
 */
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
@SQLDelete(sql = "UPDATE {h-domain} SET deleted_at = NOW() WHERE id = ?")
@Where(clause = "deleted_at IS NULL")
@Data
public abstract class BaseEntity implements Serializable {
    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * 软删除时间戳
     * - NULL: 记录未删除（正常状态）
     * - 非NULL: 记录已删除（软删除状态）
     */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /**
     * 软删除方法
     * 将deletedAt设置为当前时间
     */
    public void softDelete() {
        this.deletedAt = LocalDateTime.now();
    }

    /**
     * 恢复软删除的记录
     * 将deletedAt重置为null
     */
    public void restore() {
        this.deletedAt = null;
    }

    /**
     * 检查记录是否已被软删除
     * @return true if deleted, false otherwise
     */
    public boolean isDeleted() {
        return this.deletedAt != null;
    }
}
