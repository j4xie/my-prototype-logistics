package com.cretas.aims.ai.tool.impl.user;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 用户创建工具
 *
 * 创建新用户账号，包括设置用户名、角色、初始密码等。
 * 支持多种用户角色：管理员、操作员、质检员等。
 *
 * Intent Code: USER_CREATE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class UserCreateTool extends AbstractBusinessTool {

    // TODO: 注入实际的用户服务
    // @Autowired
    // private UserService userService;

    @Override
    public String getToolName() {
        return "user_create";
    }

    @Override
    public String getDescription() {
        return "创建新用户账号。支持设置用户名、角色、联系方式等基本信息。" +
                "适用场景：新员工入职开户、添加系统用户、创建操作员账号。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // username: 用户名（必需）
        Map<String, Object> username = new HashMap<>();
        username.put("type", "string");
        username.put("description", "用户名，用于登录");
        username.put("minLength", 3);
        username.put("maxLength", 50);
        properties.put("username", username);

        // role: 角色（必需）
        Map<String, Object> role = new HashMap<>();
        role.put("type", "string");
        role.put("description", "用户角色");
        role.put("enum", Arrays.asList(
                "ADMIN",           // 管理员
                "OPERATOR",        // 操作员
                "QUALITY_INSPECTOR", // 质检员
                "WAREHOUSE_KEEPER",  // 仓管员
                "PRODUCTION_MANAGER", // 生产主管
                "VIEWER"           // 只读用户
        ));
        properties.put("role", role);

        // realName: 真实姓名（可选）
        Map<String, Object> realName = new HashMap<>();
        realName.put("type", "string");
        realName.put("description", "用户真实姓名");
        properties.put("realName", realName);

        // phone: 手机号（可选）
        Map<String, Object> phone = new HashMap<>();
        phone.put("type", "string");
        phone.put("description", "手机号码");
        properties.put("phone", phone);

        // email: 邮箱（可选）
        Map<String, Object> email = new HashMap<>();
        email.put("type", "string");
        email.put("description", "电子邮箱");
        properties.put("email", email);

        // department: 部门（可选）
        Map<String, Object> department = new HashMap<>();
        department.put("type", "string");
        department.put("description", "所属部门");
        properties.put("department", department);

        // initialPassword: 初始密码（可选，默认自动生成）
        Map<String, Object> initialPassword = new HashMap<>();
        initialPassword.put("type", "string");
        initialPassword.put("description", "初始密码，不提供则自动生成");
        properties.put("initialPassword", initialPassword);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("username", "role"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("username", "role");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行用户创建 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 获取必需参数
        String username = getString(params, "username");
        String role = getString(params, "role");

        // 获取可选参数
        String realName = getString(params, "realName");
        String phone = getString(params, "phone");
        String email = getString(params, "email");
        String department = getString(params, "department");
        String initialPassword = getString(params, "initialPassword");

        // 验证用户名
        if (username.length() < 3) {
            throw new IllegalArgumentException("用户名长度不能少于3个字符");
        }

        // 验证角色
        List<String> validRoles = Arrays.asList(
                "ADMIN", "OPERATOR", "QUALITY_INSPECTOR",
                "WAREHOUSE_KEEPER", "PRODUCTION_MANAGER", "VIEWER"
        );
        if (!validRoles.contains(role.toUpperCase())) {
            throw new IllegalArgumentException("无效的用户角色: " + role);
        }

        // 生成初始密码（如果未提供）
        if (initialPassword == null || initialPassword.trim().isEmpty()) {
            initialPassword = generateInitialPassword();
        }

        LocalDateTime now = LocalDateTime.now();
        String createdTime = now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        // TODO: 调用实际服务创建用户
        // User user = userService.createUser(factoryId, username, role, realName, phone, email, department, initialPassword);

        // 占位实现：返回模拟结果
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("userId", "USER_" + System.currentTimeMillis());
        result.put("username", username);
        result.put("role", role.toUpperCase());
        result.put("roleName", getRoleName(role));
        result.put("status", "ACTIVE");
        result.put("createdAt", createdTime);
        result.put("initialPassword", initialPassword);
        result.put("passwordNote", "请用户首次登录后修改密码");

        if (realName != null) {
            result.put("realName", realName);
        }
        if (phone != null) {
            result.put("phone", phone);
        }
        if (email != null) {
            result.put("email", email);
        }
        if (department != null) {
            result.put("department", department);
        }

        result.put("message", "用户创建成功：" + username + " (" + getRoleName(role) + ")");
        result.put("notice", "请接入UserService完成实际用户创建");

        log.info("用户创建完成 - 用户名: {}, 角色: {}", username, role);

        return result;
    }

    /**
     * 生成初始密码
     */
    private String generateInitialPassword() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        StringBuilder password = new StringBuilder();
        Random random = new Random();
        for (int i = 0; i < 10; i++) {
            password.append(chars.charAt(random.nextInt(chars.length())));
        }
        return password.toString();
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

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "username", "请问新用户的登录用户名是什么？",
            "role", "请问新用户的角色是什么？（管理员/操作员/质检员/仓管员/生产主管/只读用户）"
        );
        return questions.getOrDefault(paramName, super.getParameterQuestion(paramName));
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "username", "用户名",
            "role", "角色",
            "realName", "真实姓名",
            "phone", "手机号",
            "email", "邮箱",
            "department", "部门",
            "initialPassword", "初始密码"
        );
        return displayNames.getOrDefault(paramName, super.getParameterDisplayName(paramName));
    }
}
