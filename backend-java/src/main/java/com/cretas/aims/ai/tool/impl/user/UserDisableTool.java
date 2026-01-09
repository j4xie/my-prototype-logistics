package com.cretas.aims.ai.tool.impl.user;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 用户禁用工具
 *
 * 禁用指定用户账号，使其无法登录系统。
 * 支持添加禁用原因，可后续重新启用。
 *
 * Intent Code: USER_DISABLE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class UserDisableTool extends AbstractBusinessTool {

    // TODO: 注入实际的用户服务
    // @Autowired
    // private UserService userService;

    @Override
    public String getToolName() {
        return "user_disable";
    }

    @Override
    public String getDescription() {
        return "禁用用户账号。禁用后用户将无法登录系统，可后续重新启用。" +
                "适用场景：员工离职、账号安全问题、临时停用账号。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // userId: 用户ID（必需）
        Map<String, Object> userId = new HashMap<>();
        userId.put("type", "string");
        userId.put("description", "要禁用的用户ID或用户名");
        properties.put("userId", userId);

        // reason: 禁用原因（可选）
        Map<String, Object> reason = new HashMap<>();
        reason.put("type", "string");
        reason.put("description", "禁用原因");
        properties.put("reason", reason);

        // forceLogout: 是否强制登出（可选）
        Map<String, Object> forceLogout = new HashMap<>();
        forceLogout.put("type", "boolean");
        forceLogout.put("description", "是否强制当前已登录的会话登出");
        forceLogout.put("default", true);
        properties.put("forceLogout", forceLogout);

        // notifyUser: 是否通知用户（可选）
        Map<String, Object> notifyUser = new HashMap<>();
        notifyUser.put("type", "boolean");
        notifyUser.put("description", "是否发送通知给被禁用用户");
        notifyUser.put("default", false);
        properties.put("notifyUser", notifyUser);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("userId"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("userId");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行用户禁用 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 获取必需参数
        String userId = getString(params, "userId");

        // 获取可选参数
        String reason = getString(params, "reason");
        Boolean forceLogout = getBoolean(params, "forceLogout", true);
        Boolean notifyUser = getBoolean(params, "notifyUser", false);

        // 获取当前操作者信息
        Object contextOperatorId = context.get("userId");
        String operatorId = contextOperatorId != null ? String.valueOf(contextOperatorId) : null;
        Object contextOperatorName = context.get("userName");
        String operatorName = contextOperatorName != null ? String.valueOf(contextOperatorName) : null;

        // 验证：不能禁用自己
        if (userId.equals(operatorId)) {
            throw new IllegalArgumentException("不能禁用自己的账号");
        }

        LocalDateTime now = LocalDateTime.now();
        String disabledTime = now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        // TODO: 调用实际服务禁用用户
        // UserDisableResult result = userService.disableUser(factoryId, userId, reason, forceLogout, operatorId);

        // 占位实现：返回模拟结果
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("userId", userId);
        result.put("previousStatus", "ACTIVE");
        result.put("currentStatus", "DISABLED");
        result.put("disabledAt", disabledTime);
        result.put("disabledBy", operatorName != null ? operatorName : operatorId);

        if (reason != null) {
            result.put("reason", reason);
        }
        result.put("forceLogout", forceLogout);
        result.put("notifyUser", notifyUser);

        if (forceLogout) {
            result.put("activeSessionsTerminated", 1);
        }
        if (notifyUser) {
            result.put("notificationSent", true);
        }

        result.put("message", "用户账号已禁用");
        result.put("notice", "请接入UserService完成实际用户禁用操作");

        log.info("用户禁用完成 - 用户ID: {}, 原因: {}, 强制登出: {}",
                userId, reason, forceLogout);

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "userId", "请问要禁用哪个用户？请提供用户ID或用户名。",
            "reason", "请问禁用该用户的原因是什么？"
        );
        return questions.getOrDefault(paramName, super.getParameterQuestion(paramName));
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "userId", "用户ID",
            "reason", "禁用原因",
            "forceLogout", "强制登出",
            "notifyUser", "通知用户"
        );
        return displayNames.getOrDefault(paramName, super.getParameterDisplayName(paramName));
    }
}
