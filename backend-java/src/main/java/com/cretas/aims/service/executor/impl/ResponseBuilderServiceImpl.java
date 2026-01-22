package com.cretas.aims.service.executor.impl;

import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.ai.ToolResultDTO;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.executor.ResponseBuilderService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 响应构建服务实现
 *
 * 负责构建和格式化意图执行响应
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResponseBuilderServiceImpl implements ResponseBuilderService {

    private final ObjectMapper objectMapper;

    @Override
    public IntentExecuteResponse buildSuccessResponse(AIIntentConfig intent, Object data, String message) {
        return IntentExecuteResponse.builder()
                .success(true)
                .intentCode(intent.getIntentCode())
                .intentName(intent.getIntentName())
                .data(data)
                .message(message != null ? message : "执行成功")
                .responseType(determineResponseType(intent, data))
                .build();
    }

    @Override
    public IntentExecuteResponse buildErrorResponse(AIIntentConfig intent, String errorMessage, String errorCode) {
        return IntentExecuteResponse.builder()
                .success(false)
                .intentCode(intent != null ? intent.getIntentCode() : null)
                .intentName(intent != null ? intent.getIntentName() : null)
                .message(errorMessage)
                .errorCode(errorCode)
                .responseType("ERROR")
                .build();
    }

    @Override
    public IntentExecuteResponse buildConfirmationResponse(AIIntentConfig intent, String confirmMessage,
                                                            Map<String, Object> pendingAction) {
        Map<String, Object> data = new HashMap<>();
        data.put("confirmMessage", confirmMessage);
        data.put("pendingAction", pendingAction);
        data.put("requiresConfirmation", true);

        return IntentExecuteResponse.builder()
                .success(true)
                .intentCode(intent.getIntentCode())
                .intentName(intent.getIntentName())
                .data(data)
                .message(confirmMessage)
                .responseType("CONFIRMATION")
                .requiresConfirmation(true)
                .build();
    }

    @Override
    public IntentExecuteResponse buildMultiIntentResponse(List<IntentExecuteResponse> responses) {
        boolean allSuccess = responses.stream().allMatch(IntentExecuteResponse::isSuccess);

        Map<String, Object> data = new HashMap<>();
        data.put("responses", responses);
        data.put("totalCount", responses.size());
        data.put("successCount", responses.stream().filter(IntentExecuteResponse::isSuccess).count());

        return IntentExecuteResponse.builder()
                .success(allSuccess)
                .data(data)
                .message(allSuccess ? "所有意图执行成功" : "部分意图执行失败")
                .responseType("MULTI_INTENT")
                .build();
    }

    @Override
    public String formatResponseForDisplay(IntentExecuteResponse response) {
        if (response == null) {
            return "无响应数据";
        }

        StringBuilder sb = new StringBuilder();

        if (response.isSuccess()) {
            sb.append("✓ ").append(response.getMessage()).append("\n");

            if (response.getData() != null) {
                sb.append(formatDataForDisplay(response.getData()));
            }
        } else {
            sb.append("✗ 错误: ").append(response.getMessage());
            if (response.getErrorCode() != null) {
                sb.append(" (").append(response.getErrorCode()).append(")");
            }
        }

        return sb.toString();
    }

    @Override
    public IntentExecuteResponse enrichWithToolResults(IntentExecuteResponse response, List<ToolResultDTO> toolResults) {
        if (response == null || toolResults == null || toolResults.isEmpty()) {
            return response;
        }

        Map<String, Object> enrichedData = new HashMap<>();
        if (response.getData() instanceof Map) {
            enrichedData.putAll((Map<String, Object>) response.getData());
        } else if (response.getData() != null) {
            enrichedData.put("originalData", response.getData());
        }

        enrichedData.put("toolResults", toolResults);

        return response.toBuilder()
                .data(enrichedData)
                .build();
    }

    @Override
    public String applyResponseTemplate(AIIntentConfig intent, Object data) {
        String template = intent.getResponseTemplate();
        if (template == null || template.isBlank()) {
            return formatDataForDisplay(data);
        }

        try {
            // 简单的模板替换
            String result = template;
            if (data instanceof Map) {
                Map<String, Object> dataMap = (Map<String, Object>) data;
                for (Map.Entry<String, Object> entry : dataMap.entrySet()) {
                    String placeholder = "{{" + entry.getKey() + "}}";
                    String value = entry.getValue() != null ? entry.getValue().toString() : "";
                    result = result.replace(placeholder, value);
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("Template application failed: {}", e.getMessage());
            return formatDataForDisplay(data);
        }
    }

    /**
     * 确定响应类型
     */
    private String determineResponseType(AIIntentConfig intent, Object data) {
        if (data == null) {
            return "EMPTY";
        }

        if (data instanceof List) {
            return "LIST";
        }

        if (data instanceof Map) {
            Map<String, Object> dataMap = (Map<String, Object>) data;
            if (dataMap.containsKey("chart") || dataMap.containsKey("chartData")) {
                return "CHART";
            }
            if (dataMap.containsKey("table") || dataMap.containsKey("rows")) {
                return "TABLE";
            }
        }

        String category = intent.getIntentCategory();
        if ("analysis".equals(category)) {
            return "ANALYSIS";
        }
        if ("action".equals(category)) {
            return "ACTION_RESULT";
        }

        return "DATA";
    }

    /**
     * 格式化数据用于显示
     */
    private String formatDataForDisplay(Object data) {
        if (data == null) {
            return "";
        }

        if (data instanceof String) {
            return (String) data;
        }

        if (data instanceof List) {
            List<?> list = (List<?>) data;
            if (list.isEmpty()) {
                return "无数据";
            }
            StringBuilder sb = new StringBuilder();
            sb.append("共 ").append(list.size()).append(" 条记录:\n");
            int count = 0;
            for (Object item : list) {
                if (count >= 5) {
                    sb.append("... 还有 ").append(list.size() - 5).append(" 条\n");
                    break;
                }
                sb.append("- ").append(formatSingleItem(item)).append("\n");
                count++;
            }
            return sb.toString();
        }

        if (data instanceof Map) {
            Map<?, ?> map = (Map<?, ?>) data;
            StringBuilder sb = new StringBuilder();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                sb.append(entry.getKey()).append(": ").append(entry.getValue()).append("\n");
            }
            return sb.toString();
        }

        return data.toString();
    }

    private String formatSingleItem(Object item) {
        if (item == null) {
            return "null";
        }
        if (item instanceof Map) {
            Map<?, ?> map = (Map<?, ?>) item;
            if (map.containsKey("name")) {
                return map.get("name").toString();
            }
            if (map.containsKey("id")) {
                return "ID: " + map.get("id");
            }
        }
        String str = item.toString();
        return str.length() > 50 ? str.substring(0, 50) + "..." : str;
    }
}
