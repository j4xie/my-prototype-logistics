package com.cretas.aims.ai.tool.impl.user;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 用户角色分配工具
 *
 * 为用户分配或更新角色权限。
 * 支持设置单个角色或多个角色组合。
 *
 * Intent Code: USER_ROLE_ASSIGN
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class UserRoleAssignTool extends AbstractBusinessTool {

    // TODO: 注入实际的用户服务
    // @Autowired
    // private UserService userService;

    @Override
    public String getToolName() {
        return "user_role_assign";
    }

    @Override
    public String getDescription() {
        return "为用户分配或更新角色。支持设置用户的系统角色和权限级别。" +
                "适用场景：员工岗位调整、权限提升/降级、角色变更。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // userId: 用户ID（必需）
        Map<String, Object> userId = new HashMap<>();
        userId.put("type", "string");
        userId.put("description", "要分配角色的用户ID或用户名");
        properties.put("userId", userId);

        // role: 角色（必需）
        Map<String, Object> role = new HashMap<>();
        role.put("type", "string");
        role.put("description", "要分配的角色");
        role.put("enum", Arrays.asList(
                "ADMIN",           // 管理员
                "OPERATOR",        // 操作员
                "QUALITY_INSPECTOR", // 质检员
                "WAREHOUSE_KEEPER",  // 仓管员
                "PRODUCTION_MANAGER", // 生产主管
                "VIEWER"           // 只读用户
        ));
        properties.put("role", role);

        // additionalRoles: 附加角色（可选）
        Map<String, Object> additionalRoles = new HashMap<>();
        additionalRoles.put("type", "array");
        additionalRoles.put("description", "附加角色列表，用于多角色场景");
        Map<String, Object> roleItem = new HashMap<>();
        roleItem.put("type", "string");
        additionalRoles.put("items", roleItem);
        properties.put("additionalRoles", additionalRoles);

        // reason: 变更原因（可选）
        Map<String, Object> reason = new HashMap<>();
        reason.put("type", "string");
        reason.put("description", "角色变更原因");
        properties.put("reason", reason);

        // effectiveDate: 生效日期（可选）
        Map<String, Object> effectiveDate = new HashMap<>();
        effectiveDate.put("type", "string");
        effectiveDate.put("description", "生效日期，格式 YYYY-MM-DD，默认立即生效");
        properties.put("effectiveDate", effectiveDate);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("userId", "role"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("userId", "role");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行用户角色分配 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 获取必需参数
        String userId = getString(params, "userId");
        String role = getString(params, "role");

        // 获取可选参数
        List<String> additionalRoles = getList(params, "additionalRoles");
        String reason = getString(params, "reason");
        String effectiveDate = getString(params, "effectiveDate");

        // 获取当前操作者信息
        Object contextOperatorId = context.get("userId");
        String operatorId = contextOperatorId != null ? String.valueOf(contextOperatorId) : null;
        Object contextOperatorName = context.get("userName");
        String operatorName = contextOperatorName != null ? String.valueOf(contextOperatorName) : null;

        // 验证角色
        List<String> validRoles = Arrays.asList(
                "ADMIN", "OPERATOR", "QUALITY_INSPECTOR",
                "WAREHOUSE_KEEPER", "PRODUCTION_MANAGER", "VIEWER"
        );
        if (!validRoles.contains(role.toUpperCase())) {
            throw new IllegalArgumentException("无效的用户角色: " + role);
        }

        // 验证附加角色
        if (additionalRoles != null) {
            for (String addRole : additionalRoles) {
                if (!validRoles.contains(addRole.toUpperCase())) {
                    throw new IllegalArgumentException("无效的附加角色: " + addRole);
                }
            }
        }

        LocalDateTime now = LocalDateTime.now();
        String timestamp = now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        // TODO: 调用实际服务分配角色
        // UserRoleResult result = userService.assignRole(factoryId, userId, role, additionalRoles, reason, effectiveDate);

        // 构建角色列表
        List<String> allRoles = new ArrayList<>();
        allRoles.add(role.toUpperCase());
        if (additionalRoles != null) {
            for (String addRole : additionalRoles) {
                if (!allRoles.contains(addRole.toUpperCase())) {
                    allRoles.add(addRole.toUpperCase());
                }
            }
        }

        // 占位实现：返回模拟结果
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("userId", userId);
        result.put("previousRole", "OPERATOR"); // 模拟之前的角色
        result.put("newRole", role.toUpperCase());
        result.put("newRoleName", getRoleName(role));
        result.put("allRoles", allRoles);
        result.put("allRoleNames", getRoleNames(allRoles));
        result.put("assignedAt", timestamp);
        result.put("assignedBy", operatorName != null ? operatorName : operatorId);
        result.put("effectiveDate", effectiveDate != null ? effectiveDate : "立即生效");

        if (reason != null) {
            result.put("reason", reason);
        }

        result.put("message", "用户角色已更新为：" + getRoleName(role));
        result.put("notice", "请接入UserService完成实际角色分配");

        log.info("用户角色分配完成 - 用户ID: {}, 新角色: {}", userId, role);

        return result;
    }

    /**
     * 获取角色的中文名称
     */
    private String getRoleName(String role) {
        Map<String, String> roleNames = Map.of(
            "ADMIN", "管理员",
            "OPERATOR", "操作员",
            "QUALITY_INSPECTOR", "质检员",
            "WAREHOUSE_KEEPER", "仓管员",
            "PRODUCTION_MANAGER", "生产主管",
            "VIEWER", "只读用户"
        );
        return roleNames.getOrDefault(role.toUpperCase(), role);
    }

    /**
     * 获取多个角色的中文名称列表
     */
    private List<String> getRoleNames(List<String> roles) {
        List<String> names = new ArrayList<>();
        for (String role : roles) {
            names.add(getRoleName(role));
        }
        return names;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "userId", "请问要为哪个用户分配角色？请提供用户ID或用户名。",
            "role", "请问要分配什么角色？（管理员/操作员/质检员/仓管员/生产主管/只读用户）"
        );
        return questions.getOrDefault(paramName, super.getParameterQuestion(paramName));
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "userId", "用户ID",
            "role", "角色",
            "additionalRoles", "附加角色",
            "reason", "变更原因",
            "effectiveDate", "生效日期"
        );
        return displayNames.getOrDefault(paramName, super.getParameterDisplayName(paramName));
    }
}
