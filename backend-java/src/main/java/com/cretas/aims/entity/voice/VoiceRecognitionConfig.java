package com.cretas.aims.entity.voice;

import com.cretas.aims.entity.BaseEntity;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;

/**
 * 语音识别配置实体
 * 每个工厂可以有自己的语音识别配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Entity
@Table(name = "voice_recognition_config", indexes = {
    @Index(name = "idx_vrc_factory_id", columnList = "factory_id", unique = true)
})
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class VoiceRecognitionConfig extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 工厂ID (唯一)
     */
    @Column(name = "factory_id", length = 50, unique = true)
    private String factoryId;

    /**
     * 是否启用语音识别
     */
    @Column(name = "enabled")
    private Boolean enabled = true;

    /**
     * 默认语言: zh_cn, en_us
     */
    @Column(name = "default_language", length = 10)
    private String defaultLanguage = "zh_cn";

    /**
     * 默认采样率: 8000, 16000
     */
    @Column(name = "default_sample_rate")
    private Integer defaultSampleRate = 16000;

    /**
     * 默认音频格式: raw, mp3, speex, speex-wb
     */
    @Column(name = "default_format", length = 20)
    private String defaultFormat = "raw";

    /**
     * 默认音频编码: raw, lame, speex, speex-wb
     */
    @Column(name = "default_encoding", length = 20)
    private String defaultEncoding = "raw";

    /**
     * 最大音频时长(秒)
     */
    @Column(name = "max_audio_duration")
    private Integer maxAudioDuration = 60;

    /**
     * 是否保存音频到OSS
     */
    @Column(name = "save_audio_to_oss")
    private Boolean saveAudioToOss = false;

    /**
     * 是否保存识别历史
     */
    @Column(name = "save_history")
    private Boolean saveHistory = true;

    /**
     * 历史记录保留天数
     */
    @Column(name = "history_retention_days")
    private Integer historyRetentionDays = 90;

    /**
     * 每日识别次数限制 (0=不限制)
     */
    @Column(name = "daily_limit")
    private Integer dailyLimit = 0;

    /**
     * 每用户每日识别次数限制 (0=不限制)
     */
    @Column(name = "user_daily_limit")
    private Integer userDailyLimit = 0;

    /**
     * 批量识别任务最大并发数
     */
    @Column(name = "batch_max_concurrent")
    private Integer batchMaxConcurrent = 5;

    /**
     * 批量识别单次最大文件数
     */
    @Column(name = "batch_max_files")
    private Integer batchMaxFiles = 50;

    /**
     * 配置备注
     */
    @Column(name = "notes", length = 500)
    private String notes;

    /**
     * 最后修改人ID
     */
    @Column(name = "last_modified_by")
    private Long lastModifiedBy;

    /**
     * 最后修改人姓名
     */
    @Column(name = "last_modified_by_name", length = 100)
    private String lastModifiedByName;
}
