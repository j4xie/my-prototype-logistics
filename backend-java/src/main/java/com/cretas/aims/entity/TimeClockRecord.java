package com.cretas.aims.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import javax.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
/**
 * 考勤打卡记录实体
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Entity
@Table(name = "time_clock_record")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimeClockRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    /**
     * 工厂ID
     */
    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;
     /**
      * 用户ID
      */
    @Column(name = "user_id", nullable = false)
    private Long userId;
     /**
      * 用户名（计算字段，不映射到数据库）
      */
    @Transient
    private String username;
     /**
      * 打卡日期（从clock_in_time派生，不存储在表中）
      */
    @Transient
    private LocalDate clockDate;
     /**
      * 上班打卡时间
      */
    @Column(name = "clock_in_time")
    private LocalDateTime clockInTime;
     /**
      * 下班打卡时间
      */
    @Column(name = "clock_out_time")
    private LocalDateTime clockOutTime;
     /**
      * 休息开始时间
      */
    @Column(name = "break_start_time")
    private LocalDateTime breakStartTime;
     /**
      * 休息结束时间
      */
    @Column(name = "break_end_time")
    private LocalDateTime breakEndTime;
     /**
      * 工作时长（分钟）- 数据库字段名: work_duration
      */
    @Column(name = "work_duration")
    private Integer workDurationMinutes;
     /**
      * 休息时长（分钟）- 数据库字段名: break_duration
      */
    @Column(name = "break_duration")
    private Integer breakDurationMinutes;
     /**
      * 加班时长（分钟）- 计算字段，不存储在表中
      */
    @Transient
    private Integer overtimeMinutes;
     /**
      * 状态: WORKING, ON_BREAK, OFF_WORK, completed
      */
    @Column(name = "status", length = 20)
    private String status;
     /**
      * 考勤状态: NORMAL, LATE, EARLY_LEAVE, ABSENT（计算字段）
      */
    @Transient
    private String attendanceStatus;
     /**
      * 工作类型ID（扩展字段，表中暂无）
      */
    @Transient
    private Integer workTypeId;
     /**
      * 工作类型名称（扩展字段，表中暂无）
      */
    @Transient
    private String workTypeName;
     /**
      * 打卡位置 - 数据库字段名: location
      */
    @Column(name = "location", length = 255)
    private String clockLocation;
     /**
      * 打卡设备 - 数据库字段名: device
      */
    @Column(name = "device", length = 255)
    private String clockDevice;
     /**
      * GPS纬度
      */
    @Column(name = "latitude")
    private Double latitude;
     /**
      * GPS经度
      */
    @Column(name = "longitude")
    private Double longitude;
     /**
      * 备注 - 数据库字段名: remarks
      */
    @Column(name = "remarks", length = 500)
    private String notes;
     /**
      * 是否为手动修改（扩展字段，表中暂无）
      */
    @Transient
    @Builder.Default
    private Boolean isManualEdit = false;
     /**
      * 修改人ID（扩展字段，表中暂无）
      */
    @Transient
    private Integer editedBy;
     /**
      * 修改原因（扩展字段，表中暂无）
      */
    @Transient
    private String editReason;
     /**
      * 创建时间
      */
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
     /**
      * 更新时间
      */
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
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
     * 获取打卡日期（从clock_in_time派生）
     */
    public LocalDate getClockDate() {
        if (clockInTime != null) {
            return clockInTime.toLocalDate();
        }
        return LocalDate.now();
    }

    /**
     * 计算工作时长
     */
    public void calculateWorkDuration() {
        if (clockInTime != null && clockOutTime != null) {
            long totalMinutes = java.time.Duration.between(clockInTime, clockOutTime).toMinutes();
            // 减去休息时间
            if (breakStartTime != null && breakEndTime != null) {
                long breakMinutes = java.time.Duration.between(breakStartTime, breakEndTime).toMinutes();
                this.breakDurationMinutes = (int) breakMinutes;
                totalMinutes -= breakMinutes;
            }
            this.workDurationMinutes = (int) totalMinutes;
            // 计算加班时间（假设标准工作时间是8小时）
            int standardWorkMinutes = 8 * 60;
            if (this.workDurationMinutes > standardWorkMinutes) {
                this.overtimeMinutes = this.workDurationMinutes - standardWorkMinutes;
            } else {
                this.overtimeMinutes = 0;
            }
        }
    }
}
