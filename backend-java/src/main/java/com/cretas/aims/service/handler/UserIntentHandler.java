package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.user.CreateUserRequest;
import com.cretas.aims.dto.user.UserDTO;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.enums.FactoryUserRole;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.UserService;
import com.cretas.aims.util.ErrorSanitizer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 用户管理意图处理器
 *
 * 处理 USER 分类的意图:
 * - USER_CREATE: 创建用户
 * - USER_DISABLE: 禁用用户
 * - USER_ROLE_ASSIGN: 角色分配
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-03
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserIntentHandler implements IntentHandler {

    private final UserService userService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Override
    public String getSupportedCategory() {
        return "USER";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        String intentCode = intentConfig.getIntentCode();
        log.info("UserIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            return switch (intentCode) {
                case "USER_CREATE" -> handleCreateUser(factoryId, request, intentConfig, userId);
                case "USER_DISABLE" -> handleDisableUser(factoryId, request, intentConfig, userId);
                case "USER_ROLE_ASSIGN" -> handleRoleAssign(factoryId, request, intentConfig, userId);
                default -> buildFailedResponse(intentCode, intentConfig, "未知的用户管理意图: " + intentCode);
            };

        } catch (Exception e) {
            log.error("UserIntentHandler执行失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            return buildFailedResponse(intentCode, intentConfig, "执行失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    /**
     * 处理创建用户意图
     */
    private IntentExecuteResponse handleCreateUser(String factoryId, IntentExecuteRequest request,
                                                   AIIntentConfig intentConfig, Long operatorId) {
        String userInput = request.getUserInput();
        log.info("创建用户意图: factoryId={}, userInput={}", factoryId, userInput);

        // 尝试从 context 中获取结构化数据
        if (request.getContext() == null || request.getContext().isEmpty()) {
            return buildNeedMoreInfoResponse(intentConfig,
                    "请提供要创建的用户信息。需要包含：用户名、姓名、角色。\n" +
                    "例如：'创建用户张三，用户名zhangsan，角色操作员'\n" +
                    "或提供 context: {username, fullName, role, phone, email}");
        }

        // 解析参数
        JsonNode params = objectMapper.valueToTree(request.getContext());
        CreateUserRequest createRequest = new CreateUserRequest();

        if (params.has("username")) {
            createRequest.setUsername(params.get("username").asText());
        }
        if (params.has("fullName") || params.has("name")) {
            String name = params.has("fullName") ?
                    params.get("fullName").asText() : params.get("name").asText();
            createRequest.setFullName(name);
        }
        if (params.has("role") || params.has("roleCode")) {
            String roleStr = params.has("role") ?
                    params.get("role").asText() : params.get("roleCode").asText();
            createRequest.setRoleCode(parseRole(roleStr));
        }
        if (params.has("phone")) {
            createRequest.setPhone(params.get("phone").asText());
        }
        if (params.has("email")) {
            createRequest.setEmail(params.get("email").asText());
        }
        if (params.has("password")) {
            createRequest.setPassword(params.get("password").asText());
        } else {
            createRequest.setPassword("123456");
        }

        // 验证必填字段
        if (createRequest.getUsername() == null || createRequest.getFullName() == null) {
            return buildNeedMoreInfoResponse(intentConfig,
                    "创建用户需要提供用户名和姓名。请补充信息，例如：'创建用户张三，用户名zhangsan，角色操作员'");
        }

        // 设置默认角色
        if (createRequest.getRoleCode() == null) {
            createRequest.setRoleCode(FactoryUserRole.operator);
        }
        // 设置默认邮箱（如果未提供）
        if (createRequest.getEmail() == null) {
            createRequest.setEmail(createRequest.getUsername() + "@cretas.local");
        }

        // 执行创建（异常会被外层 try-catch 捕获）
        UserDTO created = userService.createUser(factoryId, createRequest);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("USER")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("用户 " + created.getFullName() + " 创建成功，用户名: " + created.getUsername())
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("User")
                                .entityId(String.valueOf(created.getId()))
                                .entityName(created.getFullName())
                                .action("CREATED")
                                .changes(Map.of(
                                        "username", created.getUsername(),
                                        "role", created.getRoleCode() != null ?
                                                created.getRoleCode().name() : "operator"
                                ))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 处理禁用用户意图
     */
    private IntentExecuteResponse handleDisableUser(String factoryId, IntentExecuteRequest request,
                                                    AIIntentConfig intentConfig, Long operatorId) {
        String userInput = request.getUserInput();
        log.info("禁用用户意图: factoryId={}, userInput={}", factoryId, userInput);

        // 从 context 获取用户ID
        Long targetUserId = null;
        String targetUsername = null;

        if (request.getContext() != null) {
            Object userIdObj = request.getContext().get("userId");
            if (userIdObj != null) {
                try {
                    targetUserId = Long.valueOf(userIdObj.toString());
                } catch (NumberFormatException e) {
                    log.warn("无效的用户ID格式: {}", userIdObj);
                    return buildNeedMoreInfoResponse(intentConfig,
                            "用户ID格式无效，请提供有效的数字ID。例如: context: {userId: 123}");
                }
            }
            Object usernameObj = request.getContext().get("username");
            if (usernameObj != null) {
                targetUsername = usernameObj.toString();
            }
        }

        // 尝试从用户输入中解析用户名
        if (targetUserId == null && targetUsername == null) {
            targetUsername = extractUsernameFromInput(userInput);
        }

        if (targetUserId == null && targetUsername == null) {
            return buildNeedMoreInfoResponse(intentConfig,
                    "请指定要禁用的用户。\n" +
                    "例如：'禁用用户zhangsan' 或提供 context: {userId: 123} 或 {username: 'zhangsan'}");
        }

        // 如果只有 username，查询获取 userId
        if (targetUserId == null && targetUsername != null) {
            User user = userRepository.findByFactoryIdAndUsername(factoryId, targetUsername)
                    .orElse(null);
            if (user == null) {
                return buildNeedMoreInfoResponse(intentConfig,
                        "未找到用户名为 '" + targetUsername + "' 的用户，请检查用户名是否正确。");
            }
            targetUserId = user.getId();
            log.info("通过用户名查询到用户ID: username={}, userId={}", targetUsername, targetUserId);
        }

        // 执行禁用
        userService.deactivateUser(factoryId, targetUserId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("USER")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("用户已禁用 (ID: " + targetUserId + ")")
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("User")
                                .entityId(String.valueOf(targetUserId))
                                .action("DISABLED")
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 处理角色分配意图
     */
    private IntentExecuteResponse handleRoleAssign(String factoryId, IntentExecuteRequest request,
                                                   AIIntentConfig intentConfig, Long operatorId) {
        String userInput = request.getUserInput();
        log.info("角色分配意图: factoryId={}, userInput={}", factoryId, userInput);

        Long targetUserId = null;
        FactoryUserRole newRole = null;

        if (request.getContext() != null) {
            Object userIdObj = request.getContext().get("userId");
            if (userIdObj != null) {
                try {
                    targetUserId = Long.valueOf(userIdObj.toString());
                } catch (NumberFormatException e) {
                    log.warn("无效的用户ID格式: {}", userIdObj);
                    return buildNeedMoreInfoResponse(intentConfig,
                            "用户ID格式无效，请提供有效的数字ID。例如: context: {userId: 123, role: 'operator'}");
                }
            }
            Object roleObj = request.getContext().get("role");
            if (roleObj != null) {
                newRole = parseRole(roleObj.toString());
            }
        }

        if (targetUserId == null || newRole == null) {
            return buildNeedMoreInfoResponse(intentConfig,
                    "角色分配需要指定用户和新角色。\n" +
                    "请提供 context: {userId: 123, role: 'operator'}\n" +
                    "可用角色: operator(操作员), quality_inspector(质检员), department_admin(部门管理员), factory_super_admin(工厂超管)");
        }

        // 执行角色更新
        userService.updateUserRole(factoryId, targetUserId, newRole);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("USER")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("用户角色已更新为: " + getRoleDisplayName(newRole))
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("User")
                                .entityId(String.valueOf(targetUserId))
                                .action("ROLE_UPDATED")
                                .changes(Map.of("newRole", newRole.name()))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        String intentCode = intentConfig.getIntentCode();
        log.info("UserIntentHandler预览: intentCode={}, factoryId={}", intentCode, factoryId);

        String previewMessage = switch (intentCode) {
            case "USER_CREATE" -> "将创建新用户。需要提供用户名、姓名和角色信息。";
            case "USER_DISABLE" -> "将禁用指定用户，用户将无法登录系统。";
            case "USER_ROLE_ASSIGN" -> "将更改用户角色，此操作需要审批确认。";
            default -> "未知的用户管理操作";
        };

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentName(intentConfig.getIntentName())
                .intentCategory("USER")
                .status("PREVIEW")
                .message(previewMessage)
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ==================== Helper Methods ====================

    private FactoryUserRole parseRole(String roleStr) {
        if (roleStr == null) return null;
        String normalized = roleStr.toLowerCase().trim();

        return switch (normalized) {
            case "operator", "操作员" -> FactoryUserRole.operator;
            case "quality_inspector", "质检员" -> FactoryUserRole.quality_inspector;
            case "department_admin", "部门管理员" -> FactoryUserRole.department_admin;
            case "factory_super_admin", "工厂超管", "超级管理员" -> FactoryUserRole.factory_super_admin;
            case "workshop_supervisor", "车间主管", "车间主任" -> FactoryUserRole.workshop_supervisor;
            case "dispatcher", "调度员", "调度" -> FactoryUserRole.dispatcher;
            case "hr_admin", "hr管理员" -> FactoryUserRole.hr_admin;
            case "quality_manager", "质量经理" -> FactoryUserRole.quality_manager;
            case "warehouse_worker", "仓库员" -> FactoryUserRole.warehouse_worker;
            default -> null;
        };
    }

    private String getRoleDisplayName(FactoryUserRole role) {
        return role != null ? role.getDisplayName() : "未知角色";
    }

    private String extractUsernameFromInput(String input) {
        // 尝试匹配 "禁用用户xxx" 模式
        Pattern pattern = Pattern.compile("(?:禁用|停用|冻结)(?:用户)?\\s*([a-zA-Z0-9_]+|[\\u4e00-\\u9fa5]+)");
        Matcher matcher = pattern.matcher(input);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    private IntentExecuteResponse buildFailedResponse(String intentCode, AIIntentConfig intentConfig, String message) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentName(intentConfig != null ? intentConfig.getIntentName() : null)
                .intentCategory("USER")
                .status("FAILED")
                .message(message)
                .executedAt(LocalDateTime.now())
                .build();
    }

    private IntentExecuteResponse buildNeedMoreInfoResponse(AIIntentConfig intentConfig, String message) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("USER")
                .status("NEED_MORE_INFO")
                .message(message)
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("PROVIDE_PARAMS")
                                .actionName("补充参数")
                                .description("请在请求中添加 context 字段提供所需信息")
                                .build()
                ))
                .build();
    }

    @Override
    public boolean supportsSemanticsMode() {
        // 启用语义模式
        return true;
    }
}
