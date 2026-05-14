package com.cretas.aims.dto.dingtalk;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Inbound webhook payload from DingTalk Outgoing-Webhook.
 *
 * <p>Schema per Brief §6.1 + DingTalk Open Platform docs.
 * Unknown fields ignored — DingTalk may add fields in future.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DingTalkInboundPayload {

    /** TEXT / MARKDOWN / CARD / 等 */
    private String msgtype;

    /** Plain text body for msgtype=text */
    private TextBody text;

    /** DingTalk-side message id (for dedup + delivery receipt). */
    private String msgId;

    private Long createAt;

    /** "1" = single chat, "2" = group chat */
    private String conversationType;

    private String conversationId;

    private String conversationTitle;

    /** DingTalk staffId of sender ($:LWCP_v1:$...). */
    private String senderId;

    private String senderNick;

    /** DingTalk corp id of sender's enterprise. */
    private String senderCorpId;

    /** Robot's staff id in the at-list (if @bot mention). */
    private List<AtUser> atUsers;

    /** Catch-all for future fields. */
    private Map<String, Object> extra;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TextBody {
        private String content;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AtUser {
        private String dingtalkId;
        private String staffId;
    }
}
