package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.user.CreateUserRequest;
import com.cretas.aims.dto.user.UserDTO;
import com.cretas.aims.entity.enums.FactoryUserRole;
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

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

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

    /**
     * 创建用户
     */
    @PostMapping
    @Operation(summary = "创建用户")
    public ApiResponse<UserDTO> createUser(
            @Parameter(description = "工厂ID", required = true)
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
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true)
            @PathVariable @NotNull Integer userId,
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
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true)
            @PathVariable @NotNull Integer userId) {
        log.info("删除用户: factoryId={}, userId={}", factoryId, userId);
        userService.deleteUser(factoryId, userId);
        return ApiResponse.success("用户删除成功", null);
    }

    /**
     * 获取用户详情
     */
    @GetMapping("/{userId}")
    @Operation(summary = "获取用户详情")
    public ApiResponse<UserDTO> getUserById(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true)
            @PathVariable @NotNull Integer userId) {
        UserDTO user = userService.getUserById(factoryId, userId);
        return ApiResponse.success(user);
    }

    /**
     * 获取用户列表
     */
    @GetMapping
    @Operation(summary = "获取用户列表（分页）")
    public ApiResponse<PageResponse<UserDTO>> getUserList(
            @Parameter(description = "工厂ID", required = true)
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
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "角色代码", required = true)
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
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true)
            @PathVariable @NotNull Integer userId) {
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
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true)
            @PathVariable @NotNull Integer userId) {
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
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户ID", required = true)
            @PathVariable @NotNull Integer userId,
            @Parameter(description = "新角色", required = true)
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
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "用户名", required = true)
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
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "邮箱", required = true)
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
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "搜索关键词", required = true)
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
            @Parameter(description = "工厂ID", required = true)
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
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "Excel文件", required = true)
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
            return ApiResponse.error("导入失败: " + e.getMessage());
        }
    }

    /**
     * 下载用户导入模板
     */
    @GetMapping("/export/template")
    @Operation(summary = "下载用户导入模板")
    public ResponseEntity<byte[]> downloadUserTemplate(
            @Parameter(description = "工厂ID", required = true)
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
}