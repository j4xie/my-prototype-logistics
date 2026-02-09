package com.cretas.aims.dto.voice;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.Size;
import java.util.List;

/**
 * 批量语音识别任务请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "批量语音识别任务请求")
public class BatchVoiceTaskRequest {

    @NotEmpty(message = "音频数据列表不能为空")
    @Size(min = 1, max = 100, message = "音频数量必须在1-100之间")
    @Schema(description = "Base64编码的音频数据列表")
    private List<String> audioDataList;

    @Schema(description = "音频格式: raw, mp3, speex, speex-wb")
    private String format = "raw";

    @Schema(description = "音频编码: raw, lame, speex, speex-wb")
    private String encoding = "raw";

    @Schema(description = "采样率: 8000, 16000")
    private Integer sampleRate = 16000;

    @Schema(description = "语言: zh_cn, en_us")
    private String language = "zh_cn";

    @Schema(description = "任务备注")
    private String notes;
}
