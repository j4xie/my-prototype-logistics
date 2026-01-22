package com.cretas.aims.service.scheduling;

import com.cretas.aims.dto.scheduling.*;
import java.time.LocalDate;
import java.util.List;

/**
 * 工人分配服务接口
 *
 * 负责工人分配管理，包括：
 * - 工人分配（LinUCB 算法）
 * - 签到签退
 * - 任务历史
 * - 工人优化
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface WorkerAssignmentService {

    /**
     * 分配工人到排程
     */
    List<WorkerAssignmentDTO> assignWorkers(String factoryId, AssignWorkerRequest request);

    /**
     * 移除工人分配
     */
    void removeWorkerAssignment(String factoryId, String assignmentId);

    /**
     * 工人签到
     */
    WorkerAssignmentDTO workerCheckIn(String factoryId, String assignmentId);

    /**
     * 工人签退
     */
    WorkerAssignmentDTO workerCheckOut(String factoryId, String assignmentId, Integer performanceScore);

    /**
     * 获取工人分配列表
     */
    List<WorkerAssignmentDTO> getWorkerAssignments(String factoryId, Long userId, LocalDate date);

    /**
     * 获取可用工人列表
     */
    List<AvailableWorkerDTO> getAvailableWorkers(String factoryId, LocalDate date, String scheduleId);

    /**
     * 优化工人分配
     */
    List<WorkerAssignmentDTO> optimizeWorkers(String factoryId, OptimizeWorkersRequest request);

    /**
     * 获取员工任务历史
     */
    List<TaskHistoryDTO> getEmployeeTaskHistory(String factoryId, Long userId, Integer limit);
}
