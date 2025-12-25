package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.user.CreateUserRequest;
import com.cretas.aims.dto.user.UserDTO;
import com.cretas.aims.entity.enums.FactoryUserRole;
import java.util.List;
/**
 * 用户服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface UserService {
    /**
     * 创建用户
     */
    UserDTO createUser(String factoryId, CreateUserRequest request);

    /**
     * 更新用户信息
     */
    UserDTO updateUser(String factoryId, Long userId, CreateUserRequest request);

    /**
     * 删除用户
     */
    void deleteUser(String factoryId, Long userId);

    /**
     * 获取用户详情
     */
    UserDTO getUserById(String factoryId, Long userId);

    /**
     * 获取用户列表(分页)
     */
    PageResponse<UserDTO> getUserList(String factoryId, PageRequest pageRequest);

    /**
     * 根据角色获取用户列表
     */
    List<UserDTO> getUsersByRole(String factoryId, FactoryUserRole role);

    /**
     * 激活用户
     */
    void activateUser(String factoryId, Long userId);

    /**
     * 停用用户
     */
    void deactivateUser(String factoryId, Long userId);

    /**
     * 更新用户角色
     */
    void updateUserRole(String factoryId, Long userId, FactoryUserRole newRole);

    /**
     * 检查用户名是否存在
     */
    boolean checkUsernameExists(String factoryId, String username);

    /**
     * 检查邮箱是否存在
     */
    boolean checkEmailExists(String factoryId, String email);

    /**
     * 搜索用户
     */
    PageResponse<UserDTO> searchUsers(String factoryId, String keyword, PageRequest pageRequest);

    /**
     * 批量导入用户
     */
    List<UserDTO> batchImportUsers(String factoryId, List<CreateUserRequest> requests);

    /**
     * 导出用户列表
     */
    byte[] exportUsers(String factoryId);

    /**
     * 生成用户导入模板
     */
    byte[] generateImportTemplate();
     /**
     * 从Excel文件批量导入用户
     */
    com.cretas.aims.dto.common.ImportResult<UserDTO> importUsersFromExcel(String factoryId, java.io.InputStream inputStream);
}
