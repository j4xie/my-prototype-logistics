package com.cretas.aims.dto.scheduling;

import com.cretas.aims.entity.User;
import lombok.Data;

/**
 * 可用工人 DTO
 * 用于 /scheduling/workers/available 端点
 */
@Data
public class AvailableWorkerDTO {
    private Long id;
    private String fullName;
    private String phone;
    private String department;
    private String position;
    private String roleCode;
    private Boolean isActive;
    private String factoryId;

    public static AvailableWorkerDTO fromEntity(User user) {
        AvailableWorkerDTO dto = new AvailableWorkerDTO();
        dto.setId(user.getId());
        dto.setFullName(user.getFullName());
        dto.setPhone(user.getPhone());
        dto.setDepartment(user.getDepartment());
        dto.setPosition(user.getPosition());
        dto.setRoleCode(user.getRoleCode());
        dto.setIsActive(user.getIsActive());
        dto.setFactoryId(user.getFactoryId());
        return dto;
    }
}
