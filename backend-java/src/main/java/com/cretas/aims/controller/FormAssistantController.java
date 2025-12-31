package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.AIQuotaUsage;
import com.cretas.aims.repository.AIQuotaUsageRepository;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.utils.JwtUtil;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import javax.annotation.PostConstruct;
import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AI表单助手控制器
 *
 * 提供AI辅助表单填写功能:
 * - 语音/文本输入 → AI解析 → 表单字段值
 * - 图片OCR → 结构化数据 → 表单字段值
 *
 * 路径: /api/mobile/{factoryId}/form-assistant/*
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/form-assistant")
@Tag(name = "AI表单助手", description = "AI辅助表单填写，支持语音、文本、OCR输入")
@Validated
public class FormAssistantController {

    @Value("${cretas.ai.service.url:http://localhost:8085}")
    private String aiServiceUrl;

    @Value("${cretas.ai.service.timeout:60000}")
    private int timeout;

    @Value("${cretas.ai.service.connect-timeout:10000}")
    private int connectTimeout;

    @Value("${cretas.ai.service.fallback-enabled:true}")
    private boolean fallbackEnabled;

    private RestTemplate restTemplate;

    @Autowired
    private MobileService mobileService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private AIQuotaUsageRepository quotaUsageRepository;

    // 每次Schema生成消耗的配额
    private static final int SCHEMA_GENERATE_QUOTA_COST = 1;

    @PostConstruct
    public void init() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(timeout);
        this.restTemplate = new RestTemplate(factory);
        log.info("AI表单助手RestTemplate已配置: 连接超时={}ms, 读取超时={}ms", connectTimeout, timeout);
    }

    // ==================== DTO定义 ====================

    /**
     * 表单解析请求
     */
    @Data
    public static class FormParseRequest {
        @NotBlank(message = "用户输入不能为空")
        private String userInput;

        private List<FormField> formFields;

        @NotBlank(message = "实体类型不能为空")
        private String entityType;

        private Map<String, Object> context;
    }

    /**
     * 表单字段定义
     */
    @Data
    public static class FormField {
        private String name;
        private String title;
        private String type;
        private String description;
        private List<EnumOption> enumOptions;
        private boolean required;
    }

    /**
     * 枚举选项
     */
    @Data
    public static class EnumOption {
        private String label;
        private String value;
    }

    /**
     * 表单解析响应
     */
    @Data
    public static class FormParseResponse {
        private boolean success;
        private Map<String, Object> fieldValues;
        private double confidence;
        private String unparsedText;
        private String message;

        // P1-1: 缺字段自动追问
        /** 缺失的必填字段名列表 */
        private List<String> missingRequiredFields;
        /** AI生成的追问问题列表 */
        private List<String> suggestedQuestions;
        /** 主要追问问题 (便于简单场景使用) */
        private String followUpQuestion;
    }

    /**
     * OCR解析请求
     */
    @Data
    public static class OCRParseRequest {
        @NotBlank(message = "图片不能为空")
        private String imageBase64;

        private List<FormField> formFields;

        @NotBlank(message = "实体类型不能为空")
        private String entityType;
    }

    /**
     * OCR解析响应
     */
    @Data
    public static class OCRParseResponse {
        private boolean success;
        private String extractedText;
        private Map<String, Object> fieldValues;
        private double confidence;
        private String message;
    }

    /**
     * Schema生成请求
     */
    @Data
    public static class SchemaGenerateRequest {
        @NotBlank(message = "用户输入不能为空")
        private String userInput;

        @NotBlank(message = "实体类型不能为空")
        private String entityType;

        private List<String> existingFields;  // 现有字段名列表，避免重复

        private Map<String, Object> context;  // 可选的上下文信息
    }

    /**
     * 生成的单个字段定义
     */
    @Data
    public static class SchemaFieldDefinition {
        private String name;           // 字段英文名 (camelCase)
        private String title;          // 字段中文名
        private String type;           // string, number, boolean, array
        private String description;    // 字段描述
        private String xComponent;     // Formily 组件名
        private Map<String, Object> xComponentProps;  // 组件属性
        private String xDecorator;     // 装饰器
        private Map<String, Object> xDecoratorProps;  // 装饰器属性
        private List<Map<String, Object>> xValidator; // 验证规则
        private Map<String, Object> xReactions;       // 联动规则
        private List<Map<String, Object>> enumOptions; // 枚举值
        private Object defaultValue;   // 默认值
    }

    /**
     * Schema生成响应
     */
    @Data
    public static class SchemaGenerateResponse {
        private boolean success;
        private List<SchemaFieldDefinition> fields;  // 生成的字段列表
        private List<Map<String, Object>> validationRules;  // 额外的验证规则
        private List<String> suggestions;  // AI建议
        private String message;
    }

    /**
     * 校验反馈请求 - 用于表单校验失败时的AI修正
     */
    @Data
    public static class ValidationFeedbackRequest {
        private String sessionId;  // 会话ID，用于多轮对话

        @NotBlank(message = "实体类型不能为空")
        private String entityType;

        private List<FormField> formFields;  // 表单字段定义

        private Map<String, Object> submittedValues;  // 用户提交的值

        private List<ValidationError> validationErrors;  // 校验错误列表

        private String userInstruction;  // 用户补充说明
    }

    /**
     * 校验错误详情
     */
    @Data
    public static class ValidationError {
        private String field;       // 字段名
        private String message;     // 错误信息
        private String rule;        // 违反的规则（可选）
        private Object currentValue; // 当前值（可选）
    }

    /**
     * 校验反馈响应
     */
    @Data
    public static class ValidationFeedbackResponse {
        private boolean success;
        private Map<String, String> correctionHints;  // 字段修正建议
        private Map<String, Object> correctedValues;  // AI建议的修正值
        private String explanation;  // AI解释
        private double confidence;
        private String sessionId;
        private String message;
    }

    // ==================== API端点 ====================

    /**
     * AI表单解析 - 文本/语音输入
     *
     * 将用户的自然语言输入解析为表单字段值
     *
     * @param factoryId 工厂ID
     * @param request 解析请求
     * @return 解析后的字段值
     */
    @PostMapping("/parse")
    @Operation(summary = "AI表单解析",
               description = "将用户自然语言输入(文本或语音转文字)解析为表单字段值")
    public ApiResponse<FormParseResponse> parseFormInput(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody @Parameter(description = "解析请求") FormParseRequest request,
            HttpServletRequest httpRequest) {

        // 1. 验证Token获取用户信息
        String token = TokenUtils.extractToken(httpRequest.getHeader("Authorization"));
        Object user = mobileService.getUserFromToken(token);

        log.info("AI表单解析: factoryId={}, entityType={}, inputLength={}",
                factoryId, request.getEntityType(), request.getUserInput().length());

        try {
            // 2. 构建请求发送到Python AI服务
            String url = aiServiceUrl + "/api/ai/form/parse";

            Map<String, Object> aiRequest = new HashMap<>();
            aiRequest.put("user_input", request.getUserInput());
            aiRequest.put("entity_type", request.getEntityType());
            aiRequest.put("factory_id", factoryId);

            if (request.getFormFields() != null && !request.getFormFields().isEmpty()) {
                aiRequest.put("form_fields", convertFormFields(request.getFormFields()));
            }

            if (request.getContext() != null) {
                aiRequest.put("context", request.getContext());
            }

            // 3. 调用AI服务
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(aiRequest, headers);

            log.info("调用AI表单解析服务: url={}", url);
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, Map.class);

            // 4. 处理响应
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();

                FormParseResponse result = new FormParseResponse();
                result.setSuccess(Boolean.TRUE.equals(body.get("success")));
                result.setFieldValues((Map<String, Object>) body.get("field_values"));
                result.setConfidence(body.get("confidence") != null ?
                        ((Number) body.get("confidence")).doubleValue() : 0.0);
                result.setUnparsedText((String) body.get("unparsed_text"));
                result.setMessage((String) body.get("message"));

                // P1-1: 提取缺字段自动追问相关字段
                if (body.get("missing_required_fields") != null) {
                    result.setMissingRequiredFields((List<String>) body.get("missing_required_fields"));
                }
                if (body.get("suggested_questions") != null) {
                    result.setSuggestedQuestions((List<String>) body.get("suggested_questions"));
                }
                if (body.get("follow_up_question") != null) {
                    result.setFollowUpQuestion((String) body.get("follow_up_question"));
                }

                log.info("AI表单解析成功: factoryId={}, fieldCount={}, confidence={}, missingFields={}",
                        factoryId,
                        result.getFieldValues() != null ? result.getFieldValues().size() : 0,
                        result.getConfidence(),
                        result.getMissingRequiredFields() != null ? result.getMissingRequiredFields().size() : 0);

                return ApiResponse.success(result);
            } else {
                throw new RuntimeException("AI服务返回错误: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.warn("AI服务不可用，使用降级响应: {}", e.getMessage());
            if (fallbackEnabled) {
                FormParseResponse fallback = new FormParseResponse();
                fallback.setSuccess(false);
                fallback.setMessage("AI服务暂时不可用，请手动填写表单");
                fallback.setConfidence(0.0);
                // 返回空的字段值，让前端显示手动填写提示
                fallback.setFieldValues(new HashMap<>());
                return ApiResponse.success(fallback);
            }
            return ApiResponse.error("AI表单解析失败: " + e.getMessage());
        }
    }

    /**
     * AI表单OCR解析 - 图片输入
     *
     * 从图片中提取文字并解析为表单字段值
     *
     * @param factoryId 工厂ID
     * @param request OCR解析请求
     * @return 解析后的字段值
     */
    @PostMapping("/ocr")
    @Operation(summary = "AI表单OCR解析",
               description = "从图片(如送货单、质检报告)中提取并解析表单字段值")
    public ApiResponse<OCRParseResponse> parseFormOCR(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody @Parameter(description = "OCR解析请求") OCRParseRequest request,
            HttpServletRequest httpRequest) {

        // 1. 验证Token
        String token = TokenUtils.extractToken(httpRequest.getHeader("Authorization"));
        Object user = mobileService.getUserFromToken(token);

        log.info("AI表单OCR解析: factoryId={}, entityType={}, imageSize={}",
                factoryId, request.getEntityType(),
                request.getImageBase64() != null ? request.getImageBase64().length() : 0);

        try {
            // 2. 构建请求发送到Python AI服务
            String url = aiServiceUrl + "/api/ai/form/ocr";

            Map<String, Object> aiRequest = new HashMap<>();
            aiRequest.put("image_base64", request.getImageBase64());
            aiRequest.put("entity_type", request.getEntityType());
            aiRequest.put("factory_id", factoryId);

            if (request.getFormFields() != null && !request.getFormFields().isEmpty()) {
                aiRequest.put("form_fields", convertFormFields(request.getFormFields()));
            }

            // 3. 调用AI服务
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(aiRequest, headers);

            log.info("调用AI表单OCR服务: url={}", url);
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, Map.class);

            // 4. 处理响应
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();

                OCRParseResponse result = new OCRParseResponse();
                result.setSuccess(Boolean.TRUE.equals(body.get("success")));
                result.setExtractedText((String) body.get("extracted_text"));
                result.setFieldValues((Map<String, Object>) body.get("field_values"));
                result.setConfidence(body.get("confidence") != null ?
                        ((Number) body.get("confidence")).doubleValue() : 0.0);
                result.setMessage((String) body.get("message"));

                log.info("AI表单OCR解析成功: factoryId={}, fieldCount={}, confidence={}",
                        factoryId,
                        result.getFieldValues() != null ? result.getFieldValues().size() : 0,
                        result.getConfidence());

                return ApiResponse.success(result);
            } else {
                throw new RuntimeException("AI服务返回错误: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.warn("AI服务不可用，使用降级响应: {}", e.getMessage());
            if (fallbackEnabled) {
                OCRParseResponse fallback = new OCRParseResponse();
                fallback.setSuccess(false);
                fallback.setMessage("AI服务暂时不可用，请手动填写表单");
                fallback.setExtractedText("");
                fallback.setFieldValues(new HashMap<>());
                fallback.setConfidence(0.0);
                return ApiResponse.success(fallback);
            }
            return ApiResponse.error("AI表单OCR解析失败: " + e.getMessage());
        }
    }

    /**
     * AI表单助手健康检查
     */
    @GetMapping("/health")
    @Operation(summary = "AI表单助手健康检查",
               description = "检查AI表单助手服务是否可用")
    public ApiResponse<Map<String, Object>> healthCheck(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {

        log.info("AI表单助手健康检查: factoryId={}", factoryId);

        try {
            String url = aiServiceUrl + "/api/ai/form/health";
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);

            Map<String, Object> result = new HashMap<>();
            result.put("available", response.getStatusCode() == HttpStatus.OK);
            result.put("serviceUrl", aiServiceUrl);
            result.put("serviceInfo", response.getBody());

            return ApiResponse.success(result);

        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("available", false);
            result.put("serviceUrl", aiServiceUrl);
            result.put("error", e.getMessage());

            return ApiResponse.success(result);
        }
    }

    /**
     * AI生成Schema字段
     *
     * 根据用户自然语言描述，AI生成 Formily JSON Schema 字段定义
     * 例如: "加一个辣度评分字段，1-5分，3分以上合格" → 生成 NumberPicker 组件 + 验证规则
     *
     * 权限要求: factory_super_admin, department_admin
     *
     * @param factoryId 工厂ID
     * @param request 生成请求
     * @return 生成的字段定义列表
     */
    @PostMapping("/generate-schema")
    @Operation(summary = "AI生成Schema字段",
               description = "根据自然语言描述生成Formily JSON Schema字段定义，用于动态表单配置")
    public ApiResponse<SchemaGenerateResponse> generateSchema(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody @Parameter(description = "生成请求") SchemaGenerateRequest request,
            HttpServletRequest httpRequest) {

        // 1. 验证Token获取用户信息
        String token = TokenUtils.extractToken(httpRequest.getHeader("Authorization"));
        Object user = mobileService.getUserFromToken(token);

        // 从token中获取角色进行权限检查
        String userRole = jwtUtil.getRoleFromToken(token);
        if (userRole == null ||
            (!userRole.equals("factory_super_admin") &&
             !userRole.equals("department_admin") &&
             !userRole.equals("super_admin"))) {
            log.warn("AI生成Schema权限不足: factoryId={}, role={}", factoryId, userRole);
            return ApiResponse.error("权限不足：仅工厂超级管理员或部门管理员可使用此功能");
        }

        log.info("AI生成Schema: factoryId={}, entityType={}, userInput={}",
                factoryId, request.getEntityType(),
                request.getUserInput().length() > 50 ?
                    request.getUserInput().substring(0, 50) + "..." : request.getUserInput());

        // 2. 配额检查
        String quotaError = checkQuota(factoryId, SCHEMA_GENERATE_QUOTA_COST);
        if (quotaError != null) {
            log.warn("AI生成Schema配额不足: factoryId={}, error={}", factoryId, quotaError);
            return ApiResponse.error("配额不足: " + quotaError);
        }

        try {
            // 2. 构建请求发送到Python AI服务
            String url = aiServiceUrl + "/api/ai/form/generate-schema";

            Map<String, Object> aiRequest = new HashMap<>();
            aiRequest.put("user_input", request.getUserInput());
            aiRequest.put("entity_type", request.getEntityType());
            aiRequest.put("factory_id", factoryId);

            if (request.getExistingFields() != null && !request.getExistingFields().isEmpty()) {
                aiRequest.put("existing_fields", request.getExistingFields());
            }

            if (request.getContext() != null) {
                aiRequest.put("context", request.getContext());
            }

            // 3. 调用AI服务
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(aiRequest, headers);

            log.info("调用AI生成Schema服务: url={}", url);
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, Map.class);

            // 4. 处理响应
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();

                SchemaGenerateResponse result = new SchemaGenerateResponse();
                result.setSuccess(Boolean.TRUE.equals(body.get("success")));
                result.setMessage((String) body.get("message"));

                // 解析字段列表
                List<Map<String, Object>> fieldsData = (List<Map<String, Object>>) body.get("fields");
                if (fieldsData != null) {
                    List<SchemaFieldDefinition> fields = fieldsData.stream()
                            .map(this::convertToSchemaFieldDefinition)
                            .toList();
                    result.setFields(fields);
                }

                // 解析验证规则
                result.setValidationRules((List<Map<String, Object>>) body.get("validation_rules"));

                // 解析建议
                result.setSuggestions((List<String>) body.get("suggestions"));

                log.info("AI生成Schema成功: factoryId={}, fieldCount={}, entityType={}",
                        factoryId,
                        result.getFields() != null ? result.getFields().size() : 0,
                        request.getEntityType());

                // 消耗配额（仅在成功后）
                consumeQuota(factoryId, SCHEMA_GENERATE_QUOTA_COST);

                return ApiResponse.success(result);
            } else {
                throw new RuntimeException("AI服务返回错误: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.warn("AI服务不可用，使用降级响应: {}", e.getMessage());
            if (fallbackEnabled) {
                SchemaGenerateResponse fallback = new SchemaGenerateResponse();
                fallback.setSuccess(false);
                fallback.setMessage("AI服务暂时不可用，请手动配置字段");
                fallback.setFields(List.of());
                return ApiResponse.success(fallback);
            }
            return ApiResponse.error("AI生成Schema失败: " + e.getMessage());
        }
    }

    /**
     * 校验失败反馈 - AI修正建议
     *
     * 当表单校验失败时，将错误信息反馈给AI，获取修正建议。
     * 支持多轮对话，可通过sessionId保持上下文。
     *
     * @param factoryId 工厂ID
     * @param request 校验反馈请求
     * @return AI修正建议
     */
    @PostMapping("/validation-feedback")
    @Operation(summary = "校验失败反馈",
               description = "表单校验失败时，将错误信息反馈给AI，获取修正建议和可能的修正值")
    public ApiResponse<ValidationFeedbackResponse> submitValidationFeedback(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody @Parameter(description = "校验反馈请求") ValidationFeedbackRequest request,
            HttpServletRequest httpRequest) {

        // 1. 验证Token获取用户信息
        String token = TokenUtils.extractToken(httpRequest.getHeader("Authorization"));
        Object user = mobileService.getUserFromToken(token);

        log.info("校验失败反馈: factoryId={}, entityType={}, errorCount={}",
                factoryId, request.getEntityType(),
                request.getValidationErrors() != null ? request.getValidationErrors().size() : 0);

        try {
            // 2. 构建请求发送到Python AI服务
            String url = aiServiceUrl + "/api/ai/form/parse/feedback";

            Map<String, Object> aiRequest = new HashMap<>();
            aiRequest.put("entity_type", request.getEntityType());
            aiRequest.put("factory_id", factoryId);

            if (request.getSessionId() != null) {
                aiRequest.put("session_id", request.getSessionId());
            }

            if (request.getFormFields() != null && !request.getFormFields().isEmpty()) {
                aiRequest.put("form_fields", convertFormFields(request.getFormFields()));
            }

            if (request.getSubmittedValues() != null) {
                aiRequest.put("submitted_values", request.getSubmittedValues());
            }

            // 转换校验错误列表
            if (request.getValidationErrors() != null) {
                List<Map<String, Object>> errors = request.getValidationErrors().stream()
                        .map(err -> {
                            Map<String, Object> errorMap = new HashMap<>();
                            errorMap.put("field", err.getField());
                            errorMap.put("message", err.getMessage());
                            if (err.getRule() != null) {
                                errorMap.put("rule", err.getRule());
                            }
                            if (err.getCurrentValue() != null) {
                                errorMap.put("current_value", err.getCurrentValue());
                            }
                            return errorMap;
                        })
                        .toList();
                aiRequest.put("validation_errors", errors);
            }

            if (request.getUserInstruction() != null) {
                aiRequest.put("user_instruction", request.getUserInstruction());
            }

            // 3. 调用AI服务
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(aiRequest, headers);

            log.info("调用AI校验反馈服务: url={}", url);
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, Map.class);

            // 4. 处理响应
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();

                ValidationFeedbackResponse result = new ValidationFeedbackResponse();
                result.setSuccess(Boolean.TRUE.equals(body.get("success")));
                result.setCorrectionHints((Map<String, String>) body.get("correction_hints"));
                result.setCorrectedValues((Map<String, Object>) body.get("corrected_values"));
                result.setExplanation((String) body.get("explanation"));
                result.setConfidence(body.get("confidence") != null ?
                        ((Number) body.get("confidence")).doubleValue() : 0.0);
                result.setSessionId((String) body.get("session_id"));
                result.setMessage((String) body.get("message"));

                log.info("校验反馈成功: factoryId={}, hintsCount={}, hasCorrectedValues={}",
                        factoryId,
                        result.getCorrectionHints() != null ? result.getCorrectionHints().size() : 0,
                        result.getCorrectedValues() != null && !result.getCorrectedValues().isEmpty());

                return ApiResponse.success(result);
            } else {
                throw new RuntimeException("AI服务返回错误: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.warn("AI服务不可用，使用降级响应: {}", e.getMessage());
            if (fallbackEnabled) {
                ValidationFeedbackResponse fallback = new ValidationFeedbackResponse();
                fallback.setSuccess(false);
                fallback.setMessage("AI服务暂时不可用，请手动检查并修正");
                fallback.setCorrectionHints(new HashMap<>());
                fallback.setConfidence(0.0);
                return ApiResponse.success(fallback);
            }
            return ApiResponse.error("校验反馈处理失败: " + e.getMessage());
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 将Python AI服务返回的字段数据转换为Java DTO
     */
    private SchemaFieldDefinition convertToSchemaFieldDefinition(Map<String, Object> data) {
        SchemaFieldDefinition field = new SchemaFieldDefinition();

        field.setName((String) data.get("name"));
        field.setTitle((String) data.get("title"));
        field.setType((String) data.get("type"));
        field.setDescription((String) data.get("description"));

        // 处理 x-component (Python用下划线，Java用驼峰)
        field.setXComponent((String) data.getOrDefault("x_component",
                data.get("xComponent")));

        // 处理 x-component-props
        Object componentProps = data.getOrDefault("x_component_props",
                data.get("xComponentProps"));
        if (componentProps instanceof Map) {
            field.setXComponentProps((Map<String, Object>) componentProps);
        }

        // 处理 x-decorator
        field.setXDecorator((String) data.getOrDefault("x_decorator",
                data.getOrDefault("xDecorator", "FormItem")));

        // 处理 x-decorator-props
        Object decoratorProps = data.getOrDefault("x_decorator_props",
                data.get("xDecoratorProps"));
        if (decoratorProps instanceof Map) {
            field.setXDecoratorProps((Map<String, Object>) decoratorProps);
        }

        // 处理 x-validator
        Object validator = data.getOrDefault("x_validator", data.get("xValidator"));
        if (validator instanceof List) {
            field.setXValidator((List<Map<String, Object>>) validator);
        }

        // 处理 x-reactions
        Object reactions = data.getOrDefault("x_reactions", data.get("xReactions"));
        if (reactions instanceof Map) {
            field.setXReactions((Map<String, Object>) reactions);
        }

        // 处理 enum (枚举选项)
        Object enumOptions = data.getOrDefault("enum", data.get("enumOptions"));
        if (enumOptions instanceof List) {
            field.setEnumOptions((List<Map<String, Object>>) enumOptions);
        }

        // 处理 default
        field.setDefaultValue(data.getOrDefault("default", data.get("defaultValue")));

        return field;
    }

    /**
     * 转换表单字段定义为Python服务期望的格式
     */
    private List<Map<String, Object>> convertFormFields(List<FormField> fields) {
        return fields.stream().map(field -> {
            Map<String, Object> map = new HashMap<>();
            map.put("name", field.getName());
            map.put("title", field.getTitle());
            map.put("type", field.getType());
            map.put("description", field.getDescription());
            map.put("required", field.isRequired());

            if (field.getEnumOptions() != null && !field.getEnumOptions().isEmpty()) {
                List<Map<String, String>> enumList = field.getEnumOptions().stream()
                        .map(opt -> {
                            Map<String, String> optMap = new HashMap<>();
                            optMap.put("label", opt.getLabel());
                            optMap.put("value", opt.getValue());
                            return optMap;
                        })
                        .toList();
                map.put("enum_options", enumList);
            }

            return map;
        }).toList();
    }

    /**
     * 检查配额是否足够
     *
     * @param factoryId 工厂ID
     * @param required 需要的配额数量
     * @return null if quota is sufficient, error message otherwise
     */
    private String checkQuota(String factoryId, int required) {
        LocalDate weekStart = getWeekStart(LocalDate.now());
        AIQuotaUsage quota = quotaUsageRepository
                .findByFactoryIdAndWeekStart(factoryId, weekStart)
                .orElseGet(() -> createNewQuota(factoryId, weekStart));

        if (quota.getUsedCount() + required > quota.getQuotaLimit()) {
            return String.format("本周配额不足。已使用: %d/%d，需要: %d",
                    quota.getUsedCount(), quota.getQuotaLimit(), required);
        }
        return null;  // 配额足够
    }

    /**
     * 消耗配额
     *
     * @param factoryId 工厂ID
     * @param count 消耗数量
     */
    private void consumeQuota(String factoryId, int count) {
        LocalDate weekStart = getWeekStart(LocalDate.now());
        quotaUsageRepository.incrementUsedCount(factoryId, weekStart, count);
    }

    /**
     * 获取本周开始日期（周一）
     */
    private LocalDate getWeekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    /**
     * 创建新的配额记录
     */
    private AIQuotaUsage createNewQuota(String factoryId, LocalDate weekStart) {
        AIQuotaUsage quota = AIQuotaUsage.builder()
                .factoryId(factoryId)
                .weekStart(weekStart)
                .usedCount(0)
                .quotaLimit(100)  // 默认每周100次
                .build();
        return quotaUsageRepository.save(quota);
    }
}
