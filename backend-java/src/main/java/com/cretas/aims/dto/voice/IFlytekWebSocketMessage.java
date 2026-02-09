package com.cretas.aims.dto.voice;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.List;

/**
 * 讯飞 WebSocket 消息格式
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
public class IFlytekWebSocketMessage {

    /**
     * 讯飞 WebSocket 请求消息
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Request {
        private Common common;
        private Business business;
        private AudioData data;
    }

    /**
     * common 参数（仅首帧需要）
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Common {
        @JsonProperty("app_id")
        private String appId;
    }

    /**
     * business 参数（仅首帧需要）
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Business {
        /**
         * 语言 (zh_cn, en_us)
         */
        private String language;

        /**
         * 领域 (iat, medical)
         */
        private String domain;

        /**
         * 方言 (mandarin, cantonese)
         */
        private String accent;

        /**
         * 返回结果格式 (plain, json)
         */
        @JsonProperty("vad_eos")
        @Builder.Default
        private Integer vadEos = 3000;

        /**
         * 动态修正 (wpgs: 开启, 空字符串: 关闭)
         */
        @Builder.Default
        private String dwa = "";

        /**
         * 是否返回标点
         */
        @Builder.Default
        private Integer ptt = 1;
    }

    /**
     * data 参数
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AudioData {
        /**
         * 数据状态: 0-首帧, 1-中间帧, 2-末帧
         */
        private Integer status;

        /**
         * 音频格式 (raw, speex, speex-wb)
         */
        private String format;

        /**
         * 音频编码 (raw, lame, speex, speex-wb)
         */
        private String encoding;

        /**
         * Base64 编码的音频数据
         */
        private String audio;
    }

    /**
     * 讯飞 WebSocket 响应消息
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Response {
        /**
         * 状态码 (0: 成功)
         */
        private Integer code;

        /**
         * 错误消息
         */
        private String message;

        /**
         * 会话 ID
         */
        private String sid;

        /**
         * 识别结果数据
         */
        private ResponseData data;
    }

    /**
     * 响应数据
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ResponseData {
        /**
         * 结果状态: 0-首结果, 1-中间结果, 2-最终结果
         */
        private Integer status;

        /**
         * 识别结果
         */
        private RecognitionResult result;
    }

    /**
     * 识别结果
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RecognitionResult {
        /**
         * 序号
         */
        private Integer sn;

        /**
         * 是否最后一条
         */
        private Boolean ls;

        /**
         * 词汇组
         */
        private List<WordSet> ws;
    }

    /**
     * 词汇组
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WordSet {
        /**
         * 开始时间 (10ms)
         */
        private Integer bg;

        /**
         * 词汇列表
         */
        private List<ChineseWord> cw;
    }

    /**
     * 中文词汇
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ChineseWord {
        /**
         * 词汇内容
         */
        private String w;

        /**
         * 词性 (n: 名词, v: 动词, etc.)
         */
        private String sc;
    }
}
