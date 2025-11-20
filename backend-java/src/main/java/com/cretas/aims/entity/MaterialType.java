package com.cretas.aims.entity;

import com.fasterxml.jackson.annotation.JsonProperty;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 原材料类型实体
 *
 * 数据库表: raw_material_types
 * 对应前端: MaterialType interface
 *
 * 关键字段:
 * - id: UUID字符串主键
 * - factory_id: 工厂ID（外键）
 * - material_code: 原材料编码（factory_id + material_code 唯一）
 * - name: 原材料名称（factory_id + name 唯一）
 * - category: 原材料类别（如：海水鱼、淡水鱼）
 * - unit: 计量单位（默认kg）
 * - storage_type: 存储方式（如：冷冻、冷藏、常温）
 * - is_active: 是否激活
 *
 * @author Claude (AI Assistant)
 * @date 2025-11-19
 */
@Entity
@Table(name = "raw_material_types",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"factory_id", "name"}),
           @UniqueConstraint(columnNames = {"factory_id", "material_code"})
       },
       indexes = {
           @Index(name = "raw_material_types_factory_id_idx", columnList = "factory_id"),
           @Index(name = "raw_material_types_category_idx", columnList = "category")
       })
public class MaterialType {

    /**
     * 主键ID - UUID字符串
     * 前端JSON: "id"
     */
    @Id
    @Column(name = "id", length = 191, nullable = false)
    private String id;

    /**
     * 工厂ID
     * 外键: factories.id
     * 前端JSON: "factoryId"
     */
    @JsonProperty("factoryId")
    @Column(name = "factory_id", length = 191, nullable = false)
    private String factoryId;

    /**
     * 原材料编码
     * 约束: factory_id + material_code 唯一
     * 前端JSON: "materialCode"
     */
    @JsonProperty("materialCode")
    @Column(name = "material_code", length = 191)
    private String materialCode;

    /**
     * 原材料名称
     * 约束: factory_id + name 唯一
     * 前端JSON: "name"
     */
    @Column(name = "name", length = 191, nullable = false)
    private String name;

    /**
     * 原材料类别
     * 示例: "海水鱼", "淡水鱼", "贝类", "虾类"
     * 前端JSON: "category"
     */
    @Column(name = "category", length = 191)
    private String category;

    /**
     * 计量单位
     * 默认: kg
     * 前端JSON: "unit"
     */
    @Column(name = "unit", length = 191, nullable = false)
    private String unit = "kg";

    /**
     * 存储方式
     * 示例: "冷冻", "冷藏", "常温"
     * 前端JSON: "storageType"
     */
    @JsonProperty("storageType")
    @Column(name = "storage_type", length = 191)
    private String storageType;

    /**
     * 原材料描述
     * 前端JSON: "description"
     */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * 是否激活
     * 默认: true
     * 前端JSON: "isActive"
     */
    @JsonProperty("isActive")
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    /**
     * 创建时间
     * 自动设置
     * 前端JSON: "createdAt"
     */
    @JsonProperty("createdAt")
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * 更新时间
     * 自动更新
     * 前端JSON: "updatedAt"
     */
    @JsonProperty("updatedAt")
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * 创建者用户ID
     * 外键: users.id
     * 前端JSON: "createdBy"
     */
    @JsonProperty("createdBy")
    @Column(name = "created_by")
    private Integer createdBy;

    /**
     * 插入前自动生成UUID和时间戳
     */
    @PrePersist
    public void prePersist() {
        if (this.id == null || this.id.isEmpty()) {
            this.id = UUID.randomUUID().toString();
        }
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.isActive == null) {
            this.isActive = true;
        }
        if (this.unit == null || this.unit.isEmpty()) {
            this.unit = "kg";
        }
    }

    /**
     * 更新前自动更新时间戳
     */
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // ========== 构造函数 ==========

    public MaterialType() {}

    /**
     * 构造函数 - 创建新原材料类型
     */
    public MaterialType(String factoryId, String name, String materialCode, String unit) {
        this.factoryId = factoryId;
        this.name = name;
        this.materialCode = materialCode;
        this.unit = unit;
        this.isActive = true;
    }

    /**
     * 构造函数 - 创建带类别的原材料类型
     */
    public MaterialType(String factoryId, String name, String materialCode, String category,
                        String unit, String storageType, String description) {
        this.factoryId = factoryId;
        this.name = name;
        this.materialCode = materialCode;
        this.category = category;
        this.unit = unit;
        this.storageType = storageType;
        this.description = description;
        this.isActive = true;
    }

    // ========== Getter and Setter ==========

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getFactoryId() {
        return factoryId;
    }

    public void setFactoryId(String factoryId) {
        this.factoryId = factoryId;
    }

    public String getMaterialCode() {
        return materialCode;
    }

    public void setMaterialCode(String materialCode) {
        this.materialCode = materialCode;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public String getStorageType() {
        return storageType;
    }

    public void setStorageType(String storageType) {
        this.storageType = storageType;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Integer getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(Integer createdBy) {
        this.createdBy = createdBy;
    }
}
