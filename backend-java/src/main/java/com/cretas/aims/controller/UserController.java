package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.user.CreateUserRequest;
import com.cretas.aims.dto.user.UpdateSkillsRequest;
import com.cretas.aims.dto.user.UserDTO;
import com.cretas.aims.entity.enums.FactoryUserRole;
import com.cretas.aims.entity.enums.HireType;
import com.cretas.aims.service.UserService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.cretas.aims.utils.SecurityUtils;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import com.cretas.aims.util.ErrorSanitizer;

/**
 * 用户管理控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/users")
@RequiredArgsConstructor
@Tag(name = "用户管理", description = "用户管理相关接口")
public class UserController {

    private final UserService userService;
    private final com.cretas.aims.service.MobileService mobileService;

    /**
     * 创建用户
     */
    @PostMapping
    @Operation(summary = "创建用户")
    public ApiResponse<UserDTO> createUser(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Valid @RequestBody CreateUserRequest request) {
        log.info("创建用户: factoryId={}, username={}", factoryId, request.getUsername());
        UserDTO user = userService.createUser(factoryId, request);
        return ApiResponse.success("用户创建成功", user);
    }

    /**
     * 更新用户信息
     */
    @PutMapping("/{userId}")
    @Operation(summary = "更新用户信息")
    public ApiResponse<UserDTO> updateUser(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true, example = "1")
            @PathVariable @NotNull Long userId,
            @Valid @RequestBody CreateUserRequest request) {
        log.info("更新用户: factoryId={}, userId={}", factoryId, userId);
        UserDTO user = userService.updateUser(factoryId, userId, request);
        return ApiResponse.success("用户更新成功", user);
    }

    /**
     * 删除用户
     */
    @DeleteMapping("/{userId}")
    @Operation(summary = "删除用户")
    public ApiResponse<Void> deleteUser(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true, example = "1")
            @PathVariable @NotNull Long userId) {
        log.info("删除用户: factoryId={}, userId={}", factoryId, userId);
        userService.deleteUser(factoryId, userId);
        return ApiResponse.success("用户删除成功", null);
    }

    /**
     * 获取当前登录用户信息
     */
    @GetMapping("/current")
    @Operation(summary = "获取当前登录用户信息")
    public ApiResponse<UserDTO> getCurrentUser(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", required = true, example = "Bearer eyJhbGciOiJIUzI1NiJ9...")
            @RequestHeader("Authorization") String authorization) {
        String token = com.cretas.aims.utils.TokenUtils.extractToken(authorization);
        UserDTO user = mobileService.getUserFromToken(token);
        log.debug("获取当前用户信息: factoryId={}, userId={}", factoryId, user.getId());
        return ApiResponse.success(user);
    }

    /**
     * 获取用户详情
     */
    @GetMapping("/{userId}")
    @Operation(summary = "获取用户详情")
    public ApiResponse<UserDTO> getUserById(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true, example = "1")
            @PathVariable @NotNull Long userId) {
        UserDTO user = userService.getUserById(factoryId, userId);
        return ApiResponse.success(user);
    }

    /**
     * 获取用户列表
     */
    @GetMapping
    @Operation(summary = "获取用户列表（分页）")
    public ApiResponse<PageResponse<UserDTO>> getUserList(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Valid PageRequest pageRequest) {
        PageResponse<UserDTO> response = userService.getUserList(factoryId, pageRequest);
        return ApiResponse.success(response);
    }

    /**
     * 按角色获取用户
     */
    @GetMapping("/role/{roleCode}")
    @Operation(summary = "按角色获取用户列表")
    public ApiResponse<List<UserDTO>> getUsersByRole(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "角色代码", required = true, example = "OPERATOR")
            @PathVariable FactoryUserRole roleCode) {
        List<UserDTO> users = userService.getUsersByRole(factoryId, roleCode);
        return ApiResponse.success(users);
    }

    /**
     * 激活用户
     */
    @PostMapping("/{userId}/activate")
    @Operation(summary = "激活用户")
    public ApiResponse<Void> activateUser(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true, example = "1")
            @PathVariable @NotNull Long userId) {
        log.info("激活用户: factoryId={}, userId={}", factoryId, userId);
        userService.activateUser(factoryId, userId);
        return ApiResponse.success("用户激活成功", null);
    }

    /**
     * 停用用户
     */
    @PostMapping("/{userId}/deactivate")
    @Operation(summary = "停用用户")
    public ApiResponse<Void> deactivateUser(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true, example = "1")
            @PathVariable @NotNull Long userId) {
        log.info("停用用户: factoryId={}, userId={}", factoryId, userId);
        userService.deactivateUser(factoryId, userId);
        return ApiResponse.success("用户停用成功", null);
    }

    /**
     * 更新用户角色
     */
    @PutMapping("/{userId}/role")
    @Operation(summary = "更新用户角色")
    public ApiResponse<Void> updateUserRole(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true, example = "1")
            @PathVariable @NotNull Long userId,
            @Parameter(description = "新角色", required = true, example = "OPERATOR")
            @RequestParam FactoryUserRole newRole) {
        log.info("更新用户角色: factoryId={}, userId={}, newRole={}", factoryId, userId, newRole);
        userService.updateUserRole(factoryId, userId, newRole);
        return ApiResponse.success("角色更新成功", null);
    }

    /**
     * 检查用户名是否存在
     */
    @GetMapping("/check/username")
    @Operation(summary = "检查用户名是否存在")
    public ApiResponse<Boolean> checkUsernameExists(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户名", required = true, example = "zhangsan")
            @RequestParam @NotBlank String username) {
        boolean exists = userService.checkUsernameExists(factoryId, username);
        return ApiResponse.success(exists);
    }

    /**
     * 检查邮箱是否存在
     */
    @GetMapping("/check/email")
    @Operation(summary = "检查邮箱是否存在")
    public ApiResponse<Boolean> checkEmailExists(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "邮箱", required = true, example = "zhangsan@example.com")
            @RequestParam @NotBlank String email) {
        boolean exists = userService.checkEmailExists(factoryId, email);
        return ApiResponse.success(exists);
    }

    /**
     * 搜索用户
     */
    @GetMapping("/search")
    @Operation(summary = "搜索用户")
    public ApiResponse<PageResponse<UserDTO>> searchUsers(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "搜索关键词", required = true, example = "张三")
            @RequestParam @NotBlank String keyword,
            @Valid PageRequest pageRequest) {
        PageResponse<UserDTO> response = userService.searchUsers(factoryId, keyword, pageRequest);
        return ApiResponse.success(response);
    }


    /**
     * 导出用户列表
     */
    @GetMapping("/export")
    @Operation(summary = "导出用户列表")
    public ResponseEntity<byte[]> exportUsers(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId) {
        log.info("导出用户列表: factoryId={}", factoryId);
        byte[] excelBytes = userService.exportUsers(factoryId);

        // 生成文件名（包含时间戳）
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String filename = "用户列表_" + timestamp + ".xlsx";

        // 设置响应头
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", filename);
        headers.setContentLength(excelBytes.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(excelBytes);
    }

    /**
     * 从Excel文件批量导入用户
     */
    @PostMapping("/import")
    @Operation(summary = "从Excel文件批量导入用户")
    public ApiResponse<com.cretas.aims.dto.common.ImportResult<UserDTO>> importUsersFromExcel(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "Excel文件 (.xlsx)", required = true)
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {

        log.info("从Excel批量导入用户: factoryId={}, filename={}", factoryId, file.getOriginalFilename());

        // 验证文件类型
        if (file.getOriginalFilename() == null || !file.getOriginalFilename().endsWith(".xlsx")) {
            return ApiResponse.error("只支持.xlsx格式的Excel文件");
        }

        // 验证文件大小（10MB限制）
        if (file.getSize() > 10 * 1024 * 1024) {
            return ApiResponse.error("文件大小不能超过10MB");
        }

        try {
            com.cretas.aims.dto.common.ImportResult<UserDTO> result =
                    userService.importUsersFromExcel(factoryId, file.getInputStream());

            if (result.getIsFullSuccess()) {
                log.info("用户批量导入完全成功: factoryId={}, count={}", factoryId, result.getSuccessCount());
                return ApiResponse.success("导入成功", result);
            } else {
                log.warn("用户批量导入部分失败: factoryId={}, success={}, failure={}",
                        factoryId, result.getSuccessCount(), result.getFailureCount());
                return ApiResponse.success(
                        String.format("导入完成：成功%d条，失败%d条",
                                result.getSuccessCount(), result.getFailureCount()),
                        result);
            }
        } catch (Exception e) {
            log.error("用户批量导入失败: factoryId={}", factoryId, e);
            return ApiResponse.error("导入失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    /**
     * 下载用户导入模板
     */
    @GetMapping("/export/template")
    @Operation(summary = "下载用户导入模板")
    public ResponseEntity<byte[]> downloadUserTemplate(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId) {

        log.info("下载用户导入模板: factoryId={}", factoryId);
        byte[] templateBytes = userService.generateImportTemplate();

        // 设置文件名
        String filename = "用户导入模板.xlsx";

        // 设置响应头
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", filename);
        headers.setContentLength(templateBytes.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(templateBytes);
    }

    /**
     * 根据入职日期范围获取用户列表
     * HR Dashboard 用于显示"本月入职"统计
     */
    @GetMapping("/join-date-range")
    @Operation(summary = "根据入职日期范围获取用户列表")
    public ApiResponse<PageResponse<UserDTO>> getUsersByJoinDateRange(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "开始日期 (yyyy-MM-dd)", required = true, example = "2025-01-01")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期 (yyyy-MM-dd)", required = true, example = "2025-01-31")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "页码", example = "1")
            @RequestParam(defaultValue = "1") Integer page,
            @Parameter(description = "每页大小", example = "20")
            @RequestParam(defaultValue = "20") Integer size) {

        log.info("获取入职日期范围内用户: factoryId={}, startDate={}, endDate={}, page={}, size={}",
                factoryId, startDate, endDate, page, size);

        PageResponse<UserDTO> response = userService.getUsersByJoinDateRange(
                factoryId, startDate, endDate, page, size);

        return ApiResponse.success(response);
    }

    // ==================== 调度员模块扩展 API ====================

    /**
     * 按工号查询用户
     */
    @GetMapping("/by-employee-code/{employeeCode}")
    @Operation(summary = "按工号查询用户")
    public ApiResponse<UserDTO> getUserByEmployeeCode(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "工号", required = true, example = "001")
            @PathVariable @NotBlank String employeeCode) {
        UserDTO user = userService.getUserByEmployeeCode(factoryId, employeeCode);
        return ApiResponse.success(user);
    }

    /**
     * 绑定/更新工号
     */
    @PutMapping("/{userId}/employee-code")
    @Operation(summary = "绑定或更新用户工号")
    public ApiResponse<Void> updateEmployeeCode(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true, example = "1")
            @PathVariable @NotNull Long userId,
            @Parameter(description = "新工号 (001-999)", required = true, example = "001")
            @RequestParam @NotBlank String employeeCode) {
        log.info("更新用户工号: factoryId={}, userId={}, employeeCode={}", factoryId, userId, employeeCode);
        userService.updateEmployeeCode(factoryId, userId, employeeCode);
        return ApiResponse.success("工号更新成功", null);
    }

    /**
     * 获取用户技能
     */
    @GetMapping("/{userId}/skills")
    @Operation(summary = "获取用户技能等级")
    public ApiResponse<Map<String, Integer>> getUserSkills(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true, example = "1")
            @PathVariable @NotNull Long userId) {
        Map<String, Integer> skills = userService.getUserSkills(factoryId, userId);
        return ApiResponse.success(skills);
    }

    /**
     * 更新用户技能
     */
    @PutMapping("/{userId}/skills")
    @Operation(summary = "更新用户技能等级")
    public ApiResponse<Void> updateUserSkills(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true, example = "1")
            @PathVariable @NotNull Long userId,
            @Valid @RequestBody UpdateSkillsRequest request) {
        log.info("更新用户技能: factoryId={}, userId={}", factoryId, userId);
        userService.updateUserSkills(factoryId, userId, request.getSkillLevels());
        return ApiResponse.success("技能更新成功", null);
    }

    /**
     * 获取合同即将到期的员工
     */
    @GetMapping("/expiring-contracts")
    @Operation(summary = "获取合同即将到期的员工列表")
    public ApiResponse<List<UserDTO>> getExpiringContracts(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "提前预警天数", example = "30")
            @RequestParam(defaultValue = "30") Integer daysAhead) {
        log.info("获取合同即将到期员工: factoryId={}, daysAhead={}", factoryId, daysAhead);
        List<UserDTO> users = userService.getExpiringContracts(factoryId, daysAhead);
        return ApiResponse.success(users);
    }

    /**
     * 按雇用类型获取用户
     */
    @GetMapping("/hire-type/{hireType}")
    @Operation(summary = "按雇用类型获取用户列表")
    public ApiResponse<List<UserDTO>> getUsersByHireType(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "雇用类型", required = true, example = "FULL_TIME")
            @PathVariable HireType hireType) {
        List<UserDTO> users = userService.getUsersByHireType(factoryId, hireType);
        return ApiResponse.success(users);
    }

    /**
     * 获取临时工列表
     */
    @GetMapping("/temporary-workers")
    @Operation(summary = "获取所有临时性质员工")
    public ApiResponse<List<UserDTO>> getTemporaryWorkers(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId) {
        List<UserDTO> users = userService.getTemporaryWorkers(factoryId);
        return ApiResponse.success(users);
    }

    /**
     * 自动生成下一个可用工号
     */
    @GetMapping("/next-employee-code")
    @Operation(summary = "获取下一个可用工号")
    public ApiResponse<String> getNextEmployeeCode(
            @Parameter(description = "工厂ID", required = true, example = "F001")
            @PathVariable @NotBlank String factoryId) {
        String nextCode = userService.generateNextEmployeeCode(factoryId);
        return ApiResponse.success(nextCode);
    }
}