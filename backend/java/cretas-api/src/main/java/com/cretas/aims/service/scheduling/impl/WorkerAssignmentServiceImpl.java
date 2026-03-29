package com.cretas.aims.service.scheduling.impl;

import com.cretas.aims.dto.scheduling.*;
import com.cretas.aims.entity.*;
import com.cretas.aims.exception.EntityNotFoundException;
import com.cretas.aims.repository.*;
import com.cretas.aims.service.FeatureEngineeringService;
import com.cretas.aims.service.LinUCBService;
import com.cretas.aims.service.scheduling.core.WorkerAssignmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 工人分配：分配、移除、签到/签退、可用工人查询、任务历史、LinUCB 集成
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkerAssignmentServiceImpl implements WorkerAssignmentService {

    private final WorkerAssignmentRepository assignmentRepository;
    private final LineScheduleRepository scheduleRepository;
    private final SchedulingPlanRepository planRepository;
    private final ProductionLineRepository lineRepository;
    private final ProductionBatchRepository batchRepository;
    private final UserRepository userRepository;
    private final FeatureEngineeringService featureEngineeringService;
    private final LinUCBService linUCBService;

    @Override
    @Transactional
    public List<WorkerAssignmentDTO> assignWorkers(String factoryId, AssignWorkerRequest request) {
        LineSchedule schedule = scheduleRepository.findById(request.getScheduleId())
            .orElseThrow(() -> new EntityNotFoundException("ProductionSchedule", request.getScheduleId()));

        // === Phase 5B: LinUCB 集成 ===
        double[] taskFeatures = extractTaskFeaturesFromSchedule(factoryId, schedule);

        Map<Long, BigDecimal> workerScores = new HashMap<>();
        try {
            List<LinUCBService.WorkerRecommendation> recommendations =
                linUCBService.recommendWorkers(factoryId, taskFeatures, request.getWorkerIds());
            for (LinUCBService.WorkerRecommendation rec : recommendations) {
                workerScores.put(rec.getWorkerId(), rec.getUcbScore());
            }
            log.info("LinUCB 推荐完成: scheduleId={}, 候选工人数={}, 推荐数={}",
                request.getScheduleId(), request.getWorkerIds().size(), recommendations.size());
        } catch (Exception e) {
            log.warn("LinUCB 推荐失败，使用原始顺序: {}", e.getMessage());
            for (Long workerId : request.getWorkerIds()) {
                workerScores.put(workerId, BigDecimal.valueOf(0.5));
            }
        }

        List<WorkerAssignment> assignments = new ArrayList<>();
        for (Long userId : request.getWorkerIds()) {
            if (assignmentRepository.findByScheduleIdAndUserId(request.getScheduleId(), userId).isPresent()) {
                continue;
            }

            double[] workerFeatures = featureEngineeringService.extractWorkerFeatures(factoryId, userId);
            double[] context = featureEngineeringService.combineFeatures(taskFeatures, workerFeatures);

            BigDecimal ucbScore = workerScores.getOrDefault(userId, BigDecimal.valueOf(0.5));
            String feedbackId = null;
            try {
                User worker = userRepository.findById(userId).orElse(null);
                String workerCode = worker != null ? worker.getEmployeeCode() : null;
                feedbackId = linUCBService.recordAllocation(
                    factoryId,
                    schedule.getId(),
                    "LINE_SCHEDULE",
                    userId,
                    workerCode,
                    context,
                    ucbScore,
                    schedule.getPlannedQuantity() != null ? BigDecimal.valueOf(schedule.getPlannedQuantity()) : BigDecimal.ZERO,
                    calculatePlannedHours(schedule)
                );
                log.debug("LinUCB 分配记录成功: userId={}, feedbackId={}", userId, feedbackId);
            } catch (Exception e) {
                log.warn("LinUCB 分配记录失败: userId={}, error={}", userId, e.getMessage());
            }

            WorkerAssignment assignment = new WorkerAssignment();
            assignment.setSchedule(schedule);
            assignment.setUserId(userId);
            assignment.setIsTemporary(request.getIsTemporary());
            assignment.setStatus(WorkerAssignment.AssignmentStatus.assigned);
            assignment.setLinucbFeedbackId(feedbackId);
            assignment.setLinucbScore(ucbScore);
            assignments.add(assignment);
        }

        assignments = assignmentRepository.saveAll(assignments);

        schedule.setAssignedWorkers((int) assignmentRepository.countByScheduleId(request.getScheduleId()));
        scheduleRepository.save(schedule);

        return enrichAssignmentDTOs(assignments);
    }

    @Override
    @Transactional
    public void removeWorkerAssignment(String factoryId, String assignmentId) {
        WorkerAssignment assignment = assignmentRepository.findById(assignmentId)
            .orElseThrow(() -> new EntityNotFoundException("WorkerAssignment", assignmentId));

        String scheduleId = assignment.getScheduleId();
        assignmentRepository.delete(assignment);

        LineSchedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
        if (schedule != null) {
            schedule.setAssignedWorkers((int) assignmentRepository.countByScheduleId(scheduleId));
            scheduleRepository.save(schedule);
        }
    }

    @Override
    @Transactional
    public WorkerAssignmentDTO workerCheckIn(String factoryId, String assignmentId) {
        WorkerAssignment assignment = assignmentRepository.findById(assignmentId)
            .orElseThrow(() -> new EntityNotFoundException("WorkerAssignment", assignmentId));

        assignment.setStatus(WorkerAssignment.AssignmentStatus.checked_in);
        assignment.setActualStartTime(LocalDateTime.now());
        assignment = assignmentRepository.save(assignment);

        return enrichSingleAssignmentDTO(assignment);
    }

    @Override
    @Transactional
    public WorkerAssignmentDTO workerCheckOut(String factoryId, String assignmentId, Integer performanceScore) {
        WorkerAssignment assignment = assignmentRepository.findById(assignmentId)
            .orElseThrow(() -> new EntityNotFoundException("WorkerAssignment", assignmentId));

        assignment.setStatus(WorkerAssignment.AssignmentStatus.checked_out);
        assignment.setActualEndTime(LocalDateTime.now());
        if (performanceScore != null) {
            assignment.setPerformanceScore(performanceScore);
        }
        assignment = assignmentRepository.save(assignment);

        // === Phase 5B: LinUCB 反馈收集 ===
        completeLinUCBFeedback(assignment, performanceScore);

        return enrichSingleAssignmentDTO(assignment);
    }

    @Override
    public List<WorkerAssignmentDTO> getWorkerAssignments(String factoryId, Long userId, LocalDate date) {
        List<WorkerAssignment> assignments = assignmentRepository.findByUserIdAndDate(userId, date);
        return enrichAssignmentDTOs(assignments);
    }

    @Override
    public List<AvailableWorkerDTO> getAvailableWorkers(String factoryId, LocalDate date, String scheduleId) {
        log.info("获取可用工人列表: factoryId={}, date={}, scheduleId={}", factoryId, date, scheduleId);

        List<User> activeWorkers = userRepository.findByFactoryIdAndIsActive(factoryId, true);

        if (activeWorkers.isEmpty()) {
            log.warn("工厂 {} 没有活跃工人", factoryId);
            return new ArrayList<>();
        }

        Set<Long> assignedWorkerIds = new HashSet<>();
        if (date != null && scheduleId != null) {
            List<WorkerAssignment> existingAssignments = assignmentRepository
                .findByScheduleId(scheduleId);
            assignedWorkerIds = existingAssignments.stream()
                .map(WorkerAssignment::getUserId)
                .collect(Collectors.toSet());
        } else if (date != null) {
            List<SchedulingPlan> plansOnDate = planRepository
                .findByFactoryIdAndPlanDateAndDeletedAtIsNull(factoryId, date)
                .stream().collect(Collectors.toList());

            for (SchedulingPlan plan : plansOnDate) {
                List<LineSchedule> schedules = scheduleRepository
                    .findByPlanId(plan.getId());
                for (LineSchedule schedule : schedules) {
                    List<WorkerAssignment> assignments = assignmentRepository
                        .findByScheduleId(schedule.getId());
                    assignedWorkerIds.addAll(
                        assignments.stream()
                            .map(WorkerAssignment::getUserId)
                            .collect(Collectors.toSet())
                    );
                }
            }
        }

        final Set<Long> finalAssignedIds = assignedWorkerIds;
        List<User> availableWorkers = activeWorkers.stream()
            .filter(w -> !finalAssignedIds.contains(w.getId()))
            .collect(Collectors.toList());

        log.info("可用工人数: {}, 已分配工人数: {}", availableWorkers.size(), finalAssignedIds.size());

        return availableWorkers.stream()
            .map(AvailableWorkerDTO::fromEntity)
            .collect(Collectors.toList());
    }

    @Override
    public List<TaskHistoryDTO> getEmployeeTaskHistory(String factoryId, Long userId, Integer limit) {
        log.info("获取员工任务历史: factoryId={}, userId={}, limit={}", factoryId, userId, limit);

        List<WorkerAssignment> assignments = assignmentRepository
                .findRecentByFactoryIdAndUserId(factoryId, userId);

        int actualLimit = (limit != null && limit > 0) ? limit : 10;
        List<WorkerAssignment> limitedAssignments = assignments.stream()
                .limit(actualLimit)
                .collect(Collectors.toList());

        return limitedAssignments.stream().map(wa -> {
            LineSchedule schedule = wa.getSchedule();
            SchedulingPlan plan = schedule != null ? schedule.getPlan() : null;

            String taskName = "任务";
            if (schedule != null && schedule.getBatchId() != null) {
                try {
                    ProductionBatch batch = batchRepository.findById(schedule.getBatchId()).orElse(null);
                    if (batch != null) {
                        taskName = batch.getBatchNumber();
                        String productName = batch.getProductType();
                        if (productName != null && !productName.isEmpty()) {
                            taskName += " - " + productName;
                        }
                    }
                } catch (Exception e) {
                    log.debug("获取批次信息失败: batchId={}", schedule.getBatchId());
                }
            }

            String dateStr = "";
            if (plan != null && plan.getPlanDate() != null) {
                dateStr = plan.getPlanDate().format(java.time.format.DateTimeFormatter.ofPattern("MM-dd"));
            } else if (wa.getAssignedAt() != null) {
                dateStr = wa.getAssignedAt().format(java.time.format.DateTimeFormatter.ofPattern("MM-dd"));
            }

            Double hours = null;
            if (wa.getActualStartTime() != null && wa.getActualEndTime() != null) {
                long minutes = java.time.Duration.between(wa.getActualStartTime(), wa.getActualEndTime()).toMinutes();
                hours = Math.round(minutes / 6.0) / 10.0;
            }

            String status = mapAssignmentStatus(wa.getStatus());

            return TaskHistoryDTO.builder()
                    .id(wa.getId())
                    .name(taskName)
                    .date(dateStr)
                    .status(status)
                    .hours(hours)
                    .build();
        }).collect(Collectors.toList());
    }

    // ==================== DTO 丰富化 ====================

    @Override
    public List<WorkerAssignmentDTO> enrichAssignmentDTOs(List<WorkerAssignment> assignments) {
        if (assignments == null || assignments.isEmpty()) {
            return Collections.emptyList();
        }

        Set<Long> userIds = assignments.stream()
                .map(WorkerAssignment::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Set<String> productionLineIds = assignments.stream()
                .filter(a -> a.getSchedule() != null)
                .map(a -> a.getSchedule().getProductionLineId())
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Set<Long> batchIds = assignments.stream()
                .filter(a -> a.getSchedule() != null && a.getSchedule().getBatchId() != null)
                .map(a -> a.getSchedule().getBatchId())
                .collect(Collectors.toSet());

        Map<Long, User> userMap = userIds.isEmpty() ? Collections.emptyMap() :
                userRepository.findAllById(userIds).stream()
                        .collect(Collectors.toMap(User::getId, Function.identity()));

        Map<String, ProductionLine> lineMap = productionLineIds.isEmpty() ? Collections.emptyMap() :
                lineRepository.findAllById(productionLineIds).stream()
                        .collect(Collectors.toMap(ProductionLine::getId, Function.identity()));

        Map<Long, ProductionBatch> batchMap = batchIds.isEmpty() ? Collections.emptyMap() :
                batchRepository.findAllById(batchIds).stream()
                        .collect(Collectors.toMap(ProductionBatch::getId, Function.identity()));

        return assignments.stream().map(entity -> {
            WorkerAssignmentDTO dto = WorkerAssignmentDTO.fromEntity(entity);

            User user = userMap.get(entity.getUserId());
            if (user != null) {
                dto.setUserName(user.getFullName());
                dto.setUserPhone(user.getPhone());
            }

            if (entity.getSchedule() != null) {
                LineSchedule schedule = entity.getSchedule();
                dto.setScheduledStartTime(schedule.getPlannedStartTime());
                dto.setScheduledEndTime(schedule.getPlannedEndTime());

                ProductionLine line = lineMap.get(schedule.getProductionLineId());
                if (line != null) {
                    dto.setProductionLineName(line.getName());
                }

                if (schedule.getBatchId() != null) {
                    ProductionBatch batch = batchMap.get(schedule.getBatchId());
                    if (batch != null) {
                        dto.setBatchNumber(batch.getBatchNumber());
                    }
                }
            }

            return dto;
        }).collect(Collectors.toList());
    }

    // ==================== 私有方法 ====================

    private WorkerAssignmentDTO enrichSingleAssignmentDTO(WorkerAssignment entity) {
        WorkerAssignmentDTO dto = WorkerAssignmentDTO.fromEntity(entity);

        userRepository.findById(entity.getUserId()).ifPresent(user -> {
            dto.setUserName(user.getFullName());
            dto.setUserPhone(user.getPhone());
        });

        if (entity.getSchedule() != null) {
            LineSchedule schedule = entity.getSchedule();
            dto.setScheduledStartTime(schedule.getPlannedStartTime());
            dto.setScheduledEndTime(schedule.getPlannedEndTime());

            lineRepository.findById(schedule.getProductionLineId()).ifPresent(line ->
                dto.setProductionLineName(line.getName()));

            if (schedule.getBatchId() != null) {
                batchRepository.findById(schedule.getBatchId()).ifPresent(batch ->
                    dto.setBatchNumber(batch.getBatchNumber()));
            }
        }

        return dto;
    }

    private double[] extractTaskFeaturesFromSchedule(String factoryId, LineSchedule schedule) {
        Map<String, Object> taskInfo = new HashMap<>();

        taskInfo.put("quantity", schedule.getPlannedQuantity() != null ?
            schedule.getPlannedQuantity().doubleValue() : 100.0);

        if (schedule.getPlannedEndTime() != null && schedule.getPlannedStartTime() != null) {
            long hours = Duration.between(schedule.getPlannedStartTime(), schedule.getPlannedEndTime()).toHours();
            taskInfo.put("deadlineHours", hours);
        } else {
            taskInfo.put("deadlineHours", 8);
        }

        if (schedule.getBatchId() != null) {
            batchRepository.findById(schedule.getBatchId()).ifPresent(batch -> {
                taskInfo.put("productType", batch.getProductTypeId());
            });
        }

        if (schedule.getPlan() != null) {
            taskInfo.put("priority", 5);
        }

        String productTypeId = (String) taskInfo.get("productType");
        if (productTypeId != null) {
            int complexity = featureEngineeringService.getProductComplexity(factoryId, productTypeId);
            taskInfo.put("complexity", complexity);
        } else {
            taskInfo.put("complexity", 3);
        }

        if (schedule.getProductionLineId() != null) {
            taskInfo.put("workshopId", schedule.getProductionLineId().toString());
        }

        return featureEngineeringService.extractTaskFeatures(factoryId, taskInfo);
    }

    private BigDecimal calculatePlannedHours(LineSchedule schedule) {
        if (schedule.getPlannedStartTime() != null && schedule.getPlannedEndTime() != null) {
            long minutes = Duration.between(schedule.getPlannedStartTime(), schedule.getPlannedEndTime()).toMinutes();
            return BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(8);
    }

    private void completeLinUCBFeedback(WorkerAssignment assignment, Integer performanceScore) {
        String feedbackId = assignment.getLinucbFeedbackId();
        if (feedbackId == null || feedbackId.isEmpty()) {
            log.debug("跳过 LinUCB 反馈: 无 feedbackId, assignmentId={}", assignment.getId());
            return;
        }

        try {
            BigDecimal actualHours = BigDecimal.valueOf(8);
            if (assignment.getActualStartTime() != null && assignment.getActualEndTime() != null) {
                long minutes = Duration.between(assignment.getActualStartTime(), assignment.getActualEndTime()).toMinutes();
                actualHours = BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
            }

            BigDecimal actualQuantity = BigDecimal.ZERO;
            LineSchedule schedule = assignment.getSchedule();
            if (schedule != null && schedule.getCompletedQuantity() != null) {
                int workerCount = schedule.getAssignedWorkers() != null ? schedule.getAssignedWorkers() : 1;
                actualQuantity = BigDecimal.valueOf(schedule.getCompletedQuantity()).divide(
                    BigDecimal.valueOf(workerCount), 2, RoundingMode.HALF_UP);
            }

            BigDecimal qualityScore = BigDecimal.ONE;
            if (performanceScore != null) {
                qualityScore = BigDecimal.valueOf(performanceScore).divide(
                    BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
            }

            BigDecimal reward = linUCBService.completeFeedback(
                feedbackId,
                actualQuantity,
                actualHours,
                qualityScore
            );

            log.info("LinUCB 反馈完成: feedbackId={}, userId={}, reward={}, actualHours={}, qualityScore={}",
                feedbackId, assignment.getUserId(), reward, actualHours, qualityScore);

        } catch (Exception e) {
            log.warn("LinUCB 反馈失败: feedbackId={}, error={}", feedbackId, e.getMessage());
        }
    }

    private String mapAssignmentStatus(WorkerAssignment.AssignmentStatus status) {
        if (status == null) {
            return "pending";
        }
        switch (status) {
            case checked_out:
                return "completed";
            case checked_in:
            case working:
                return "in_progress";
            case absent:
                return "cancelled";
            case assigned:
            default:
                return "pending";
        }
    }
}
