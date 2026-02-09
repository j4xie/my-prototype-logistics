package com.cretas.aims.dto.voice;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.validation.constraints.NotBlank;

/**
 * 语音识别请求 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoiceRecognitionRequest {

    /**
     * Base64 编码的音频数据
     */
    @NotBlank(message = "音频数据不能为空")
    private String audioData;

    /**
     * 音频格式 (raw: PCM, mp3: MP3, speex: speex)
     * 默认: raw
     */
    @Builder.Default
    private String format = "raw";

    /**
     * 音频编码 (raw: 原生, lame: MP3, speex: speex, speex-wb: speex宽带)
     * 默认: raw
     */
    @Builder.Default
    private String encoding = "raw";

    /**
     * 采样率 (16000: 16k, 8000: 8k)
     * 默认: 16000
     */
    @Builder.Default
    private Integer sampleRate = 16000;

    /**
     * 语言 (zh_cn: 中文普通话, en_us: 英语)
     */
    private String language;

    /**
     * 是否返回标点符号
     */
    private Boolean ptt;
}
