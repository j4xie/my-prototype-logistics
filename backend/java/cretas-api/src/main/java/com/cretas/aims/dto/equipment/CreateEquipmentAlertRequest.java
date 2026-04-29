package com.cretas.aims.dto.equipment;

import com.cretas.aims.entity.enums.DeviceAlertLevel;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 创建设备告警请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-27
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "创建设备告警请求")
public class CreateEquipmentAlertRequest {

    @Schema(description = "设备ID", required = true)
    @NotNull(message = "设备ID不能为空")
    private Long equipmentId;

    @Schema(description = "告警类型", required = true, example = "维护提醒")
    @NotBlank(message = "告警类型不能为空")
    @Size(max = 100, message = "告警类型长度不能超过100个字符")
    private String alertType;

    @Schema(description = "告警级别: CRITICAL, WARNING, INFO", required = true)
    @NotNull(message = "告警级别不能为空")
    private DeviceAlertLevel level;

    @Schema(description = "告警消息", required = true)
    @NotBlank(message = "告警消息不能为空")
    @Size(max = 500, message = "告警消息长度不能超过500个字符")
    private String message;

    @Schema(description = "告警详情")
    @Size(max = 5000, message = "告警详情长度不能超过5000个字符")
    private String details;
}
