package com.cretas.aims.controller;

import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.utils.JwtUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 食品知识库反馈控制器
 *
 * 代理 Python 食品知识库反馈 API，用于收集用户对 AI 回答的反馈：
 * - 提交反馈（点赞/点踩）
 * - 记录查询日志
 * - 获取反馈统计
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/food-kb/feedback")
@RequiredArgsConstructor
@Tag(name = "食品知识库反馈", description = "用户反馈收集与统计")
public class FoodKBFeedbackController {

    private final PythonSmartBIClient pythonClient;
    private final JwtUtil jwtUtil;

    @PostMapping("/submit")
    @Operation(summary = "提交反馈", description = "用户对食品知识库回答的反馈（点赞/点踩）")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitFeedback(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody FeedbackSubmitRequest request,
            @RequestHeader("Authorization") String authorization) {

        String tokenStr = authorization.replace("Bearer ", "");
        Long userId = jwtUtil.getUserIdFromToken(tokenStr);

        log.info("提交食品知识库反馈: factoryId={}, userId={}, helpful={}",
                factoryId, userId, request.getHelpful());

        try {
            // 映射到 Python FeedbackRequest schema
            Map<String, Object> pythonRequest = new HashMap<>();
            pythonRequest.put("query", request.getQuestion() != null ? request.getQuestion() : "");
            pythonRequest.put("answer", request.getAnswer());
            pythonRequest.put("rating", Boolean.TRUE.equals(request.getHelpful()) ? 5 : 2);
            pythonRequest.put("feedback_type", "explicit");
            pythonRequest.put("user_id", userId);

            // 映射 feedbackTags + feedbackText → feedback_detail
            if (request.getFeedbackTags() != null && !request.getFeedbackTags().isEmpty()) {
                Map<String, Object> detail = new HashMap<>();
                detail.put("category", request.getFeedbackTags().get(0));
                detail.put("tags", request.getFeedbackTags());
                if (request.getFeedbackText() != null) {
                    detail.put("comment", request.getFeedbackText());
                }
                pythonRequest.put("feedback_detail", detail);
            }

            // 映射 RAG 检索结果 + 会话/意图信息
            if (request.getRetrievedDocIds() != null) {
                pythonRequest.put("retrieved_doc_ids", request.getRetrievedDocIds());
            }
            if (request.getRetrievedDocTitles() != null) {
                pythonRequest.put("retrieved_doc_titles", request.getRetrievedDocTitles());
            }
            if (request.getSessionId() != null) {
                pythonRequest.put("session_id", request.getSessionId());
            }
            if (request.getIntentCode() != null) {
                pythonRequest.put("intent_code", request.getIntentCode());
            }

            Map<String, Object> result = pythonClient.submitFoodKBFeedback(pythonRequest);
            return ResponseEntity.ok(ApiResponse.success("反馈已提交", result));

        } catch (Exception e) {
            log.error("提交食品知识库反馈失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("提交反馈失败: " + e.getMessage()));
        }
    }

    @PostMapping("/log-query")
    @Operation(summary = "记录查询日志", description = "自动记录食品知识库查询日志")
    public ResponseEntity<ApiResponse<Map<String, Object>>> logQuery(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody QueryLogRequest request,
            @RequestHeader("Authorization") String authorization) {

        String tokenStr = authorization.replace("Bearer ", "");
        Long userId = jwtUtil.getUserIdFromToken(tokenStr);

        log.debug("记录食品知识库查询: factoryId={}, userId={}, query={}",
                factoryId, userId, request.getQuery());

        try {
            Map<String, Object> pythonRequest = new HashMap<>();
            pythonRequest.put("query", request.getQuery());
            pythonRequest.put("user_id", userId);
            pythonRequest.put("response_time_ms", request.getResponseTimeMs());
            pythonRequest.put("num_results", request.getRetrievedDocIds() != null ? request.getRetrievedDocIds().size() : 0);
            if (request.getRetrievedDocIds() != null && !request.getRetrievedDocIds().isEmpty()) {
                pythonRequest.put("top1_doc_id", request.getRetrievedDocIds().get(0));
            }
            if (request.getSessionId() != null) {
                pythonRequest.put("session_id", request.getSessionId());
            }

            Map<String, Object> result = pythonClient.logFoodKBQuery(pythonRequest);
            return ResponseEntity.ok(ApiResponse.success("查询日志已记录", result));

        } catch (Exception e) {
            log.error("记录食品知识库查询日志失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.success("查询日志记录失败（非致命）", null));
        }
    }

    @GetMapping("/stats")
    @Operation(summary = "获取反馈统计", description = "获取食品知识库反馈统计数据")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStats(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        log.info("获取食品知识库反馈统计: factoryId={}", factoryId);

        try {
            Map<String, Object> stats = pythonClient.getFoodKBFeedbackStats();
            return ResponseEntity.ok(ApiResponse.success(stats));

        } catch (Exception e) {
            log.error("获取食品知识库反馈统计失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取统计失败: " + e.getMessage()));
        }
    }

    // ==================== DTO Classes ====================

    @lombok.Data
    public static class FeedbackSubmitRequest {
        private String question;
        private String answer;
        private Boolean helpful;
        private java.util.List<String> feedbackTags;
        private String feedbackText;
        private java.util.List<Integer> retrievedDocIds;
        private java.util.List<String> retrievedDocTitles;
        private String sessionId;
        private String intentCode;
    }

    @lombok.Data
    public static class QueryLogRequest {
        private String query;
        private String intentCode;
        private java.util.List<Integer> retrievedDocIds;
        private String responseText;
        private Long responseTimeMs;
        private String sessionId;
    }
}
