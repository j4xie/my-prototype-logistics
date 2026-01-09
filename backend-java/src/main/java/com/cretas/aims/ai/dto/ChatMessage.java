package com.cretas.aims.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * OpenAI 兼容的 Chat Message
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatMessage {

    /**
     * 角色: system, user, assistant, tool
     */
    private String role;

    /**
     * 消息内容 (文本或多模态内容)
     */
    private Object content;

    /**
     * 工具调用列表 (仅 assistant 角色)
     * 当 LLM 决定调用工具时使用
     */
    @JsonProperty("tool_calls")
    private List<ToolCall> toolCalls;

    /**
     * 工具调用 ID (仅 tool 角色)
     * 用于关联工具调用和工具结果
     */
    @JsonProperty("tool_call_id")
    private String toolCallId;

    /**
     * 创建系统消息
     */
    public static ChatMessage system(String content) {
        return ChatMessage.builder()
                .role("system")
                .content(content)
                .build();
    }

    /**
     * 创建用户消息
     */
    public static ChatMessage user(String content) {
        return ChatMessage.builder()
                .role("user")
                .content(content)
                .build();
    }

    /**
     * 创建助手消息 (纯文本)
     */
    public static ChatMessage assistant(String content) {
        return ChatMessage.builder()
                .role("assistant")
                .content(content)
                .build();
    }

    /**
     * 创建助手消息 (带工具调用)
     *
     * @param content   文本内容 (可为 null)
     * @param toolCalls 工具调用列表
     * @return 助手消息
     */
    public static ChatMessage assistant(String content, List<ToolCall> toolCalls) {
        return ChatMessage.builder()
                .role("assistant")
                .content(content)
                .toolCalls(toolCalls)
                .build();
    }

    /**
     * 创建工具消息 (工具执行结果)
     *
     * @param result     工具执行结果 (JSON 字符串)
     * @param toolCallId 工具调用 ID (关联到之前的 tool_call)
     * @return 工具消息
     */
    public static ChatMessage tool(String result, String toolCallId) {
        return ChatMessage.builder()
                .role("tool")
                .content(result)
                .toolCallId(toolCallId)
                .build();
    }

    /**
     * 创建多模态用户消息 (图片+文本)
     */
    public static ChatMessage userWithImage(String text, String imageBase64) {
        List<ContentPart> parts = List.of(
                ContentPart.image(imageBase64),
                ContentPart.text(text)
        );
        return ChatMessage.builder()
                .role("user")
                .content(parts)
                .build();
    }

    /**
     * 多模态内容部分
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ContentPart {
        private String type;
        private String text;
        private ImageUrl image_url;

        public static ContentPart text(String text) {
            return ContentPart.builder()
                    .type("text")
                    .text(text)
                    .build();
        }

        public static ContentPart image(String base64) {
            // 自动检测图片格式 (PNG 以 iVBOR 开头, JPEG 以 /9j/ 开头)
            String mimeType = "image/jpeg";
            if (base64 != null && base64.startsWith("iVBOR")) {
                mimeType = "image/png";
            }
            return ContentPart.builder()
                    .type("image_url")
                    .image_url(new ImageUrl("data:" + mimeType + ";base64," + base64))
                    .build();
        }

        @Data
        @NoArgsConstructor
        @AllArgsConstructor
        public static class ImageUrl {
            private String url;
        }
    }
}
