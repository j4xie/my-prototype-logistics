package com.cretas.aims.entity;

import lombok.*;
import javax.persistence.*;
import java.time.LocalDateTime;
/**
 * 工厂设置实体类
 * 管理工厂的各种配置和设置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory"})
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Entity
@Table(name = "factory_settings",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"factory_id"})
       }
)
public class FactorySettings extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;
    /**
     * 工厂ID（唯一）
     */
    @Column(name = "factory_id", nullable = false, unique = true, length = 50)
    private String factoryId;
    // ==================== AI设置 ====================
    /**
     * AI设置JSON
     * 包含: enabled, tone, goal, detailLevel, industryStandards, customPrompt
     */
    @Column(name = "ai_settings", columnDefinition = "TEXT")
    private String aiSettings;

    /**
     * AI每周配额（只读，由平台管理员设置）
     */
    @Column(name = "ai_weekly_quota")
    @Builder.Default
    private Integer aiWeeklyQuota = 20;
    // ==================== 用户注册设置 ====================
    /**
     * 是否允许自注册
     */
    @Column(name = "allow_self_registration")
    private Boolean allowSelfRegistration = false;

    /**
     * 是否需要管理员审批
     */
    @Column(name = "require_admin_approval")
    private Boolean requireAdminApproval = true;

    /**
     * 默认用户角色
     */
    @Column(name = "default_user_role", length = 50)
    private String defaultUserRole = "viewer";

    // ==================== 通知设置 ====================
    /**
     * 通知设置JSON
     * 包含: email, sms, push, wechat等通知渠道配置
     */
    @Column(name = "notification_settings", columnDefinition = "TEXT")
    private String notificationSettings;

    // ==================== 系统设置 ====================
    /**
     * 工作时间设置JSON
     * 包含: startTime, endTime, workDays, holidays
     */
    @Column(name = "work_time_settings", columnDefinition = "TEXT")
    private String workTimeSettings;

    /**
     * 生产设置JSON
     * 包含: defaultBatchSize, qualityCheckFrequency, autoApprovalThreshold
     */
    @Column(name = "production_settings", columnDefinition = "TEXT")
    private String productionSettings;

    /**
     * 库存设置JSON
     * 包含: minStockAlert, maxStockLimit, autoReorderPoint
     */
    @Column(name = "inventory_settings", columnDefinition = "TEXT")
    private String inventorySettings;

    /**
     * 数据保留设置JSON
     * 包含: logRetentionDays, dataArchiveDays, backupFrequency
     */
    @Column(name = "data_retention_settings", columnDefinition = "TEXT")
    private String dataRetentionSettings;

    // ==================== 显示设置 ====================
    /**
     * 语言设置
     */
    @Column(name = "language", length = 10)
    private String language = "zh-CN";

    /**
     * 时区设置
     */
    @Column(name = "timezone", length = 50)
    private String timezone = "Asia/Shanghai";

    /**
     * 日期格式
     */
    @Column(name = "date_format", length = 20)
    private String dateFormat = "yyyy-MM-dd";

    /**
     * 货币符号
     */
    @Column(name = "currency", length = 10)
    private String currency = "CNY";

    // ==================== 功能开关 ====================
    /**
     * 是否启用QR码功能
     */
    @Column(name = "enable_qr_code")
    private Boolean enableQrCode = true;

    /**
     * 是否启用批次管理
     */
    @Column(name = "enable_batch_management")
    private Boolean enableBatchManagement = true;

    /**
     * 是否启用质量检测
     */
    @Column(name = "enable_quality_check")
    private Boolean enableQualityCheck = true;

    /**
     * 是否启用成本核算
     */
    @Column(name = "enable_cost_calculation")
    private Boolean enableCostCalculation = true;

    /**
     * 是否启用设备管理
     */
    @Column(name = "enable_equipment_management")
    private Boolean enableEquipmentManagement = true;

    /**
     * 是否启用考勤管理
     */
    @Column(name = "enable_attendance")
    private Boolean enableAttendance = true;

    // ==================== 审计字段 ====================
    /**
     * 创建人ID
     */
    @Column(name = "created_by")
    private Integer createdBy;

    /**
     * 更新人ID
     */
    @Column(name = "updated_by")
    private Integer updatedBy;

    /**
     * 最后修改时间
     */
    @Column(name = "last_modified_at")
    private LocalDateTime lastModifiedAt;
    // 关联关系
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Factory factory;
    @PreUpdate
    public void preUpdate() {
        this.lastModifiedAt = LocalDateTime.now();
    }
}
