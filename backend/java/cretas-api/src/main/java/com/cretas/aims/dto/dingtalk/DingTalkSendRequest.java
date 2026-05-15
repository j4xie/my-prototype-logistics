package com.cretas.aims.dto.dingtalk;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for the manual-push admin endpoint
 * {@code POST /api/mobile/{factoryId}/dingtalk/send}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DingTalkSendRequest {

    @NotBlank
    private String chatId;

    @NotBlank
    private String content;

    /** Optional. Format: DingTalk staff id ($:LWCP_v1:$XXX). */
    private String atUserId;

    /** Optional. Default AI_REPLY; admin pushes typically use ANNOUNCE. */
    private String messageType;
}
