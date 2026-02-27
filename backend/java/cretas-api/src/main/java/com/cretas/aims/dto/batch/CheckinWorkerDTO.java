package com.cretas.aims.dto.batch;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckinWorkerDTO {
    private Long sessionId;
    private Long batchId;
    private Long employeeId;
    private String fullName;
    private String position;
    private String hireType;
    private String hireTypeLabel;
    private String checkinMethod;
    private String checkInTime;
    private String checkOutTime;
    private String status;
}
