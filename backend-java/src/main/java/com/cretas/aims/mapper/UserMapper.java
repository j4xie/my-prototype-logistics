package com.cretas.aims.mapper;

import com.cretas.aims.dto.user.CreateUserRequest;
import com.cretas.aims.dto.user.UserDTO;
import com.cretas.aims.entity.User;
import org.springframework.stereotype.Component;
/**
 * 用户实体映射器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Component
public class UserMapper {
    /**
     * Entity 转 DTO
     */
    public UserDTO toDTO(User user) {
        if (user == null) {
            return null;
        }
        return UserDTO.builder()
                .id(user.getId())
                .factoryId(user.getFactoryId())
                .username(user.getUsername())
                .email(null) // email字段已删除
                .phone(user.getPhone())
                .fullName(user.getFullName())
                .isActive(user.getIsActive())
                .roleCode(null) // roleCode字段已删除，改用position
                .roleDisplayName(user.getPosition()) // 使用position作为显示名称
                .department(null) // department现在是String，不是枚举
                .departmentDisplayName(user.getDepartment()) // 直接使用department字符串
                .position(user.getPosition())
                .monthlySalary(user.getMonthlySalary())
                .expectedWorkMinutes(user.getExpectedWorkMinutes())
                .ccrRate(user.getCcrRate())
                .lastLogin(user.getLastLogin())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }

    /**
     * CreateRequest 转 Entity
     */
    public User toEntity(CreateUserRequest request, String factoryId) {
        if (request == null) {
            return null;
        }
        User user = new User();
        user.setFactoryId(factoryId);
        user.setUsername(request.getUsername());
        user.setPhone(request.getPhone());
        user.setFullName(request.getFullName());
        // department现在是String类型，如果request.getDepartment()返回枚举，需要转换
        if (request.getDepartment() != null) {
            user.setDepartment(request.getDepartment().name());
        }
        // position字段用于存储角色信息（roleCode已删除）
        if (request.getRoleCode() != null) {
            user.setPosition(request.getRoleCode().name());
        } else if (request.getPosition() != null) {
            user.setPosition(request.getPosition());
        }
        user.setMonthlySalary(request.getMonthlySalary());
        user.setExpectedWorkMinutes(request.getExpectedWorkMinutes());
        user.setCcrRate(request.getCcrRate());
        user.setIsActive(false); // 默认未激活
        return user;
    }

    /**
     * 更新实体
     */
    public void updateEntity(User user, CreateUserRequest request) {
        if (request.getPhone() != null) {
            user.setPhone(request.getPhone());
        }
        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }
        // 更新position字段（roleCode已删除）
        // department现在是String类型
        if (request.getMonthlySalary() != null) {
            user.setMonthlySalary(request.getMonthlySalary());
        }
        if (request.getExpectedWorkMinutes() != null) {
            user.setExpectedWorkMinutes(request.getExpectedWorkMinutes());
        }
        if (request.getCcrRate() != null) {
            user.setCcrRate(request.getCcrRate());
        }
    }
}
