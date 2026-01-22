package com.cretas.aims.service.scheduling.impl;

import com.cretas.aims.dto.scheduling.*;
import com.cretas.aims.entity.scheduling.WorkerAssignment;
import com.cretas.aims.repository.scheduling.WorkerAssignmentRepository;
import com.cretas.aims.service.scheduling.WorkerAssignmentService;
import com.cretas.aims.mapper.SchedulingMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 工人分配服务实现
 *
 * 负责工人分配管理，包括 LinUCB 算法推荐
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkerAssignmentServiceImpl implements WorkerAssignmentService {

    private final WorkerAssignmentRepository assignmentRepository;
    private final SchedulingMapper mapper;

    // LinUCB 算法参数
    private static final double ALPHA = 0.5; // 探索参数

    @Override
    @Transactional
    public List<WorkerAssignmentDTO> assignWorkers(String factoryId, AssignWorkerRequest request) {
        log.info("Assigning workers for factory {}, schedule {}", factoryId, request.getScheduleId());

        List<WorkerAssignment> assignments = new ArrayList<>();

        for (Long workerId : request.getWorkerIds()) {
            WorkerAssignment assignment = new WorkerAssignment();
            assignment.setAssignmentId(generateAssignmentId());
            assignment.setFactoryId(factoryId);
            assignment.setScheduleId(request.getScheduleId());
            assignment.setWorkerId(workerId);
            assignment.setAssignedDate(request.getAssignedDate());
            assignment.setStatus(WorkerAssignment.AssignmentStatus.assigned);
            assignment.setCreatedAt(LocalDateTime.now());

            assignments.add(assignmentRepository.save(assignment));
        }

        log.info("Assigned {} workers to schedule {}", assignments.size(), request.getScheduleId());
        return assignments.stream().map(mapper::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void removeWorkerAssignment(String factoryId, String assignmentId) {
        WorkerAssignment assignment = assignmentRepository
                .findByFactoryIdAndAssignmentIdAndDeletedAtIsNull(factoryId, assignmentId)
                .orElseThrow(() -> new IllegalArgumentException("分配记录不存在: " + assignmentId));

        assignment.setDeletedAt(LocalDateTime.now());
        assignmentRepository.save(assignment);
        log.info("Removed worker assignment: {}", assignmentId);
    }

    @Override
    @Transactional
    public WorkerAssignmentDTO workerCheckIn(String factoryId, String assignmentId) {
        WorkerAssignment assignment = assignmentRepository
                .findByFactoryIdAndAssignmentIdAndDeletedAtIsNull(factoryId, assignmentId)
                .orElseThrow(() -> new IllegalArgumentException("分配记录不存在: " + assignmentId));

        assignment.setStatus(WorkerAssignment.AssignmentStatus.checked_in);
        assignment.setCheckInTime(LocalDateTime.now());
        assignment.setUpdatedAt(LocalDateTime.now());

        WorkerAssignment saved = assignmentRepository.save(assignment);
        log.info("Worker checked in: {}", assignmentId);

        return mapper.toDTO(saved);
    }

    @Override
    @Transactional
    public WorkerAssignmentDTO workerCheckOut(String factoryId, String assignmentId, Integer performanceScore) {
        WorkerAssignment assignment = assignmentRepository
                .findByFactoryIdAndAssignmentIdAndDeletedAtIsNull(factoryId, assignmentId)
                .orElseThrow(() -> new IllegalArgumentException("分配记录不存在: " + assignmentId));

        assignment.setStatus(WorkerAssignment.AssignmentStatus.completed);
        assignment.setCheckOutTime(LocalDateTime.now());
        assignment.setPerformanceScore(performanceScore);
        assignment.setUpdatedAt(LocalDateTime.now());

        WorkerAssignment saved = assignmentRepository.save(assignment);
        log.info("Worker checked out: {}, performance: {}", assignmentId, performanceScore);

        return mapper.toDTO(saved);
    }

    @Override
    public List<WorkerAssignmentDTO> getWorkerAssignments(String factoryId, Long userId, LocalDate date) {
        List<WorkerAssignment> assignments;

        if (userId != null) {
            assignments = assignmentRepository
                    .findByFactoryIdAndWorkerIdAndAssignedDateAndDeletedAtIsNull(factoryId, userId, date);
        } else {
            assignments = assignmentRepository
                    .findByFactoryIdAndAssignedDateAndDeletedAtIsNull(factoryId, date);
        }

        return assignments.stream().map(mapper::toDTO).collect(Collectors.toList());
    }

    @Override
    public List<AvailableWorkerDTO> getAvailableWorkers(String factoryId, LocalDate date, String scheduleId) {
        // 获取已分配的工人ID
        Set<Long> assignedWorkerIds = assignmentRepository
                .findByFactoryIdAndAssignedDateAndDeletedAtIsNull(factoryId, date)
                .stream()
                .map(WorkerAssignment::getWorkerId)
                .collect(Collectors.toSet());

        // 这里应该查询所有工人，然后排除已分配的
        // 返回模拟数据
        return List.of(
                AvailableWorkerDTO.builder()
                        .workerId(1L)
                        .workerName("张三")
                        .skills(List.of("包装", "质检"))
                        .efficiency(0.85)
                        .build(),
                AvailableWorkerDTO.builder()
                        .workerId(2L)
                        .workerName("李四")
                        .skills(List.of("加工", "调度"))
                        .efficiency(0.90)
                        .build()
        );
    }

    @Override
    public List<TaskHistoryDTO> getEmployeeTaskHistory(String factoryId, Long userId, Integer limit) {
        List<WorkerAssignment> history = assignmentRepository
                .findByFactoryIdAndWorkerIdAndDeletedAtIsNullOrderByAssignedDateDesc(
                        factoryId, userId, limit != null ? limit : 10);

        return history.stream()
                .map(this::convertToTaskHistory)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<WorkerAssignmentDTO> optimizeWorkers(String factoryId, OptimizeWorkersRequest request) {
        log.info("Optimizing worker assignments for factory {}", factoryId);

        String scheduleId = request.getScheduleId();
        int requiredWorkers = request.getRequiredWorkerCount();

        // 使用 LinUCB 算法推荐工人
        List<AvailableWorkerDTO> availableWorkers = getAvailableWorkers(factoryId,
                request.getAssignedDate(), scheduleId);

        // 计算 UCB 分数并排序
        List<WorkerWithUCB> rankedWorkers = availableWorkers.stream()
                .map(w -> new WorkerWithUCB(w, calculateUCBScore(factoryId, w, request)))
                .sorted(Comparator.comparingDouble(WorkerWithUCB::getUcbScore).reversed())
                .limit(requiredWorkers)
                .collect(Collectors.toList());

        // 创建分配
        List<Long> selectedWorkerIds = rankedWorkers.stream()
                .map(w -> w.getWorker().getWorkerId())
                .collect(Collectors.toList());

        AssignWorkerRequest assignRequest = new AssignWorkerRequest();
        assignRequest.setScheduleId(scheduleId);
        assignRequest.setWorkerIds(selectedWorkerIds);
        assignRequest.setAssignedDate(request.getAssignedDate());

        List<WorkerAssignmentDTO> assignments = assignWorkers(factoryId, assignRequest);
        log.info("Optimized {} worker assignments using LinUCB", assignments.size());

        return assignments;
    }

    @Override
    public List<WorkerRecommendationDTO> recommendWorkers(String factoryId, String scheduleId,
                                                           int count, List<String> requiredSkills) {
        LocalDate today = LocalDate.now();
        List<AvailableWorkerDTO> available = getAvailableWorkers(factoryId, today, scheduleId);

        // 过滤具有所需技能的工人
        List<AvailableWorkerDTO> qualified = available.stream()
                .filter(w -> requiredSkills == null || requiredSkills.isEmpty() ||
                        w.getSkills().stream().anyMatch(requiredSkills::contains))
                .collect(Collectors.toList());

        // 计算推荐分数
        return qualified.stream()
                .map(w -> WorkerRecommendationDTO.builder()
                        .workerId(w.getWorkerId())
                        .workerName(w.getWorkerName())
                        .matchScore(calculateMatchScore(w, requiredSkills))
                        .efficiency(w.getEfficiency())
                        .matchedSkills(w.getSkills().stream()
                                .filter(s -> requiredSkills == null || requiredSkills.contains(s))
                                .collect(Collectors.toList()))
                        .build())
                .sorted(Comparator.comparingDouble(WorkerRecommendationDTO::getMatchScore).reversed())
                .limit(count)
                .collect(Collectors.toList());
    }

    /**
     * 计算 LinUCB 分数
     */
    private double calculateUCBScore(String factoryId, AvailableWorkerDTO worker, OptimizeWorkersRequest request) {
        // UCB = 预期收益 + ALPHA * 不确定性
        double expectedReward = worker.getEfficiency();
        double uncertainty = calculateUncertainty(factoryId, worker.getWorkerId());

        return expectedReward + ALPHA * uncertainty;
    }

    /**
     * 计算不确定性（基于历史数据量）
     */
    private double calculateUncertainty(String factoryId, Long workerId) {
        long historyCount = assignmentRepository.countByFactoryIdAndWorkerIdAndDeletedAtIsNull(factoryId, workerId);
        // 历史记录越多，不确定性越低
        return 1.0 / Math.sqrt(historyCount + 1);
    }

    /**
     * 计算匹配分数
     */
    private double calculateMatchScore(AvailableWorkerDTO worker, List<String> requiredSkills) {
        if (requiredSkills == null || requiredSkills.isEmpty()) {
            return worker.getEfficiency();
        }

        long matchedCount = worker.getSkills().stream()
                .filter(requiredSkills::contains)
                .count();

        double skillMatch = (double) matchedCount / requiredSkills.size();
        return 0.6 * skillMatch + 0.4 * worker.getEfficiency();
    }

    /**
     * 转换为任务历史
     */
    private TaskHistoryDTO convertToTaskHistory(WorkerAssignment assignment) {
        return TaskHistoryDTO.builder()
                .assignmentId(assignment.getAssignmentId())
                .scheduleId(assignment.getScheduleId())
                .assignedDate(assignment.getAssignedDate())
                .status(assignment.getStatus().name())
                .performanceScore(assignment.getPerformanceScore())
                .build();
    }

    /**
     * 生成分配ID
     */
    private String generateAssignmentId() {
        return "WA" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    /**
     * 内部类：带 UCB 分数的工人
     */
    @lombok.Data
    @lombok.AllArgsConstructor
    private static class WorkerWithUCB {
        private AvailableWorkerDTO worker;
        private double ucbScore;
    }
}
