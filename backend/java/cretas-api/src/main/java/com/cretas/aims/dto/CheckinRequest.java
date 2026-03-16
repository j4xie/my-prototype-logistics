package com.cretas.aims.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckinRequest {

    @NotNull(message = "batchId不能为空")
    private Long batchId;

    @NotNull(message = "employeeId不能为空")
    private Long employeeId;

    @Pattern(regexp = "^(NFC|QR|MANUAL)$", message = "签到方式必须为NFC/QR/MANUAL")
    private String checkinMethod;

    private Long assignedBy;
}
