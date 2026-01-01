package com.cretas.aims.entity.voice;

import com.cretas.aims.entity.BaseEntity;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * 批量语音识别任务实体
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Entity
@Table(name = "batch_voice_task", indexes = {
    @Index(name = "idx_bvt_factory_id", columnList = "factory_id"),
    @Index(name = "idx_bvt_user_id", columnList = "user_id"),
    @Index(name = "idx_bvt_status", columnList = "status"),
    @Index(name = "idx_bvt_created_at", columnList = "created_at")
})
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class BatchVoiceTask extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 任务编号
     */
    @Column(name = "task_number", length = 50, unique = true)
    private String taskNumber;

    /**
     * 工厂ID
     */
    @Column(name = "factory_id", length = 50)
    private String factoryId;

    /**
     * 创建用户ID
     */
    @Column(name = "user_id")
    private Long userId;

    /**
     * 创建用户名
     */
    @Column(name = "username", length = 100)
    private String username;

    /**
     * 任务状态: PENDING-待处理, PROCESSING-处理中, COMPLETED-已完成, FAILED-失败, CANCELLED-已取消
     */
    @Column(name = "status", length = 20)
    private String status = "PENDING";

    /**
     * 总文件数
     */
    @Column(name = "total_files")
    private Integer totalFiles = 0;

    /**
     * 已处理文件数
     */
    @Column(name = "processed_files")
    private Integer processedFiles = 0;

    /**
     * 成功识别数
     */
    @Column(name = "success_count")
    private Integer successCount = 0;

    /**
     * 失败数
     */
    @Column(name = "failure_count")
    private Integer failureCount = 0;

    /**
     * 进度百分比 (0-100)
     */
    @Column(name = "progress")
    private Integer progress = 0;

    /**
     * 音频格式
     */
    @Column(name = "audio_format", length = 20)
    private String audioFormat = "raw";

    /**
     * 音频编码
     */
    @Column(name = "audio_encoding", length = 20)
    private String audioEncoding = "raw";

    /**
     * 采样率
     */
    @Column(name = "sample_rate")
    private Integer sampleRate = 16000;

    /**
     * 语言
     */
    @Column(name = "language", length = 10)
    private String language = "zh_cn";

    /**
     * 业务场景
     */
    @Column(name = "business_scene", length = 50)
    private String businessScene = "BATCH_PROCESS";

    /**
     * 任务开始时间
     */
    @Column(name = "started_at")
    private LocalDateTime startedAt;

    /**
     * 任务完成时间
     */
    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    /**
     * 总处理耗时(毫秒)
     */
    @Column(name = "total_duration_ms")
    private Long totalDurationMs;

    /**
     * 错误信息
     */
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    /**
     * 结果JSON (包含每个文件的识别结果)
     */
    @Column(name = "result_json", columnDefinition = "LONGTEXT")
    private String resultJson;

    /**
     * 备注
     */
    @Column(name = "notes", length = 500)
    private String notes;
}
