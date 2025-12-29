package com.cretas.aims.dto.voice;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.List;

/**
 * 语音识别响应 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoiceRecognitionResponse {

    /**
     * 识别状态码 (0: 成功)
     */
    private Integer code;

    /**
     * 状态消息
     */
    private String message;

    /**
     * 会话 ID
     */
    private String sid;

    /**
     * 识别出的文本
     */
    private String text;

    /**
     * 详细词汇列表（可选）
     */
    private List<WordInfo> words;

    /**
     * 是否为最终结果
     */
    @Builder.Default
    private Boolean isFinal = false;

    /**
     * 词汇信息
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class WordInfo {
        /**
         * 词汇内容
         */
        private String word;

        /**
         * 词汇类型 (cw: 中文, w: 英文标点)
         */
        private String type;

        /**
         * 开始时间 (ms)
         */
        private Integer beginTime;

        /**
         * 结束时间 (ms)
         */
        private Integer endTime;
    }

    /**
     * 创建成功响应
     */
    public static VoiceRecognitionResponse success(String text, String sid, boolean isFinal) {
        return VoiceRecognitionResponse.builder()
            .code(0)
            .message("识别成功")
            .text(text)
            .sid(sid)
            .isFinal(isFinal)
            .build();
    }

    /**
     * 创建错误响应
     */
    public static VoiceRecognitionResponse error(int code, String message) {
        return VoiceRecognitionResponse.builder()
            .code(code)
            .message(message)
            .build();
    }
}
