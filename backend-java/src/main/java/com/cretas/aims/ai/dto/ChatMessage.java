package com.cretas.aims.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
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
     * 角色: system, user, assistant
     */
    private String role;

    /**
     * 消息内容 (文本或多模态内容)
     */
    private Object content;

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
     * 创建助手消息
     */
    public static ChatMessage assistant(String content) {
        return ChatMessage.builder()
                .role("assistant")
                .content(content)
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
            return ContentPart.builder()
                    .type("image_url")
                    .image_url(new ImageUrl("data:image/jpeg;base64," + base64))
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
