package com.cretas.aims.service.dingtalk;

import com.cretas.aims.dto.ai.IntentExecuteResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Translates an {@link IntentExecuteResponse} into a DingTalk-group-ready reply
 * text. Plain text only (markdown rendering deferred to Phase 2 per Brief §8.3).
 *
 * <p>Fallback hierarchy when {@code formattedText} is null:
 * <ol>
 *   <li>NEED_MORE_INFO → first clarification question</li>
 *   <li>NOT_RECOGNIZED → "意图未识别"</li>
 *   <li>NO_PERMISSION → "无权限执行此操作"</li>
 *   <li>FAILED → message field or generic error</li>
 *   <li>else → status message or "已完成"</li>
 * </ol>
 */
@Slf4j
@Service
public class DingTalkResponseFormatter {

    private static final String DEFAULT_REPLY = "已收到您的请求, 请稍候再查看结果";

    public String format(IntentExecuteResponse response) {
        if (response == null) return DEFAULT_REPLY;

        if (response.getFormattedText() != null && !response.getFormattedText().isBlank()) {
            return response.getFormattedText();
        }

        String status = response.getStatus();
        if ("NEED_MORE_INFO".equals(status)) {
            List<String> qs = response.getClarificationQuestions();
            if (qs != null && !qs.isEmpty()) return qs.get(0);
            return "需要更多信息, 请补充";
        }
        if ("NOT_RECOGNIZED".equals(status)) {
            return "未识别到您的意图, 请尝试换一种说法";
        }
        if ("NO_PERMISSION".equals(status)) {
            return "您没有权限执行此操作";
        }
        if ("FAILED".equals(status)) {
            return response.getMessage() != null ? response.getMessage() : "执行失败, 请稍后再试";
        }

        return response.getMessage() != null && !response.getMessage().isBlank()
                ? response.getMessage()
                : "已完成";
    }
}
