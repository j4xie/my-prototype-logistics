package com.cretas.aims.dto.voice;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 语音识别配置DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "语音识别配置")
public class VoiceRecognitionConfigDTO {

    @Schema(description = "工厂ID")
    private String factoryId;

    @Schema(description = "是否启用语音识别")
    private Boolean enabled;

    @Schema(description = "默认语言: zh_cn, en_us")
    private String defaultLanguage;

    @Schema(description = "默认采样率: 8000, 16000")
    private Integer defaultSampleRate;

    @Schema(description = "默认音频格式")
    private String defaultFormat;

    @Schema(description = "默认音频编码")
    private String defaultEncoding;

    @Schema(description = "最大音频时长(秒)")
    private Integer maxAudioDuration;

    @Schema(description = "是否保存音频到OSS")
    private Boolean saveAudioToOss;

    @Schema(description = "是否保存识别历史")
    private Boolean saveHistory;

    @Schema(description = "历史记录保留天数")
    private Integer historyRetentionDays;

    @Schema(description = "每日识别次数限制 (0=不限制)")
    private Integer dailyLimit;

    @Schema(description = "每用户每日识别次数限制 (0=不限制)")
    private Integer userDailyLimit;

    @Schema(description = "批量识别任务最大并发数")
    private Integer batchMaxConcurrent;

    @Schema(description = "批量识别单次最大文件数")
    private Integer batchMaxFiles;

    @Schema(description = "配置备注")
    private String notes;
}
