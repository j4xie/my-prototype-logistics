package com.cretas.aims.service.scheduling.core;

import com.cretas.aims.dto.scheduling.*;
import com.cretas.aims.entity.WorkerAssignment;

import java.time.LocalDate;
import java.util.List;

/**
 * 工人分配：分配、移除、签到/签退、可用工人查询、任务历史、LinUCB 集成
 */
public interface WorkerAssignmentService {

    List<WorkerAssignmentDTO> assignWorkers(String factoryId, AssignWorkerRequest request);

    void removeWorkerAssignment(String factoryId, String assignmentId);

    WorkerAssignmentDTO workerCheckIn(String factoryId, String assignmentId);

    WorkerAssignmentDTO workerCheckOut(String factoryId, String assignmentId, Integer performanceScore);

    List<WorkerAssignmentDTO> getWorkerAssignments(String factoryId, Long userId, LocalDate date);

    List<TaskHistoryDTO> getEmployeeTaskHistory(String factoryId, Long userId, Integer limit);

    List<AvailableWorkerDTO> getAvailableWorkers(String factoryId, LocalDate date, String scheduleId);

    // ==================== DTO 丰富化（供外部调用） ====================

    List<WorkerAssignmentDTO> enrichAssignmentDTOs(List<WorkerAssignment> assignments);
}
