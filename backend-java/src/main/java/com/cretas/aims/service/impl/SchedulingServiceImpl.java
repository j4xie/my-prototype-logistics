package com.cretas.aims.service.impl;

import com.cretas.aims.dto.scheduling.*;
import com.cretas.aims.entity.*;
import com.cretas.aims.repository.*;
import com.cretas.aims.service.SchedulingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 智能调度服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SchedulingServiceImpl implements SchedulingService {

    private final SchedulingPlanRepository planRepository;
    private final LineScheduleRepository scheduleRepository;
    private final WorkerAssignmentRepository assignmentRepository;
    private final ProductionLineRepository lineRepository;
    private final SchedulingAlertRepository alertRepository;
    private final SchedulingPredictionRepository predictionRepository;
    private final UserRepository userRepository;
    private final ProductionBatchRepository batchRepository;
    private final RestTemplate restTemplate;

    @Value("${ai.service.url:http://localhost:8085}")
    private String aiServiceUrl;

    @Value("${ml.hybrid-predict.enabled:true}")
    private boolean hybridPredictEnabled;

    // ==================== 调度计划 CRUD ====================

    @Override
    @Transactional
    public SchedulingPlanDTO createPlan(String factoryId, CreateSchedulingPlanRequest request, Long userId) {
        // 检查是否已存在同日计划
        Optional<SchedulingPlan> existing = planRepository.findByFactoryIdAndPlanDateAndDeletedAtIsNull(
            factoryId, request.getPlanDate());
        if (existing.isPresent()) {
            throw new RuntimeException("该日期已存在调度计划");
        }

        SchedulingPlan plan = new SchedulingPlan();
        plan.setFactoryId(factoryId);
        plan.setPlanDate(request.getPlanDate());
        plan.setPlanName(request.getPlanName() != null ? request.getPlanName()
            : request.getPlanDate().toString() + " 生产计划");
        plan.setNotes(request.getNotes());
        plan.setCreatedBy(userId);
        plan.setStatus(SchedulingPlan.PlanStatus.draft);

        plan = planRepository.save(plan);

        // 创建排程
        if (request.getSchedules() != null && !request.getSchedules().isEmpty()) {
            List<LineSchedule> schedules = new ArrayList<>();
            int totalWorkers = 0;
            for (CreateSchedulingPlanRequest.ScheduleItem item : request.getSchedules()) {
                LineSchedule schedule = new LineSchedule();
                schedule.setPlan(plan);
                schedule.setProductionLineId(item.getProductionLineId());
                schedule.setBatchId(item.getBatchId());
                schedule.setSequenceOrder(item.getSequenceOrder() != null ? item.getSequenceOrder() : 0);
                schedule.setPlannedStartTime(item.getPlannedStartTime());
                schedule.setPlannedEndTime(item.getPlannedEndTime());
                schedule.setPlannedQuantity(item.getPlannedQuantity());
                schedule.setStatus(LineSchedule.ScheduleStatus.pending);
                schedules.add(schedule);

                if (item.getWorkerIds() != null) {
                    totalWorkers += item.getWorkerIds().size();
                }
            }
            scheduleRepository.saveAll(schedules);
            plan.setTotalBatches(schedules.size());
            plan.setTotalWorkers(totalWorkers);
            planRepository.save(plan);
        }

        return enrichPlanDTO(SchedulingPlanDTO.fromEntity(plan));
    }

    @Override
    public SchedulingPlanDTO getPlan(String factoryId, String planId) {
        SchedulingPlan plan = planRepository.findByIdAndFactoryIdAndDeletedAtIsNull(planId, factoryId)
            .orElseThrow(() -> new RuntimeException("调度计划不存在"));
        SchedulingPlanDTO dto = SchedulingPlanDTO.fromEntity(plan);

        // 获取排程列表
        List<LineSchedule> schedules = scheduleRepository.findByPlanIdOrderBySequenceOrder(planId);
        dto.setLineSchedules(schedules.stream()
            .map(this::enrichScheduleDTO)
            .collect(Collectors.toList()));

        return enrichPlanDTO(dto);
    }

    @Override
    public Page<SchedulingPlanDTO> getPlans(String factoryId, LocalDate startDate, LocalDate endDate,
                                             String status, Pageable pageable) {
        Page<SchedulingPlan> plans;

        if (startDate != null && endDate != null && status != null) {
            SchedulingPlan.PlanStatus planStatus = SchedulingPlan.PlanStatus.valueOf(status);
            plans = planRepository.findByFactoryIdAndDateRangeAndStatusPaged(
                factoryId, startDate, endDate, planStatus, pageable);
        } else if (startDate != null && endDate != null) {
            plans = planRepository.findByFactoryIdAndDateRangePaged(factoryId, startDate, endDate, pageable);
        } else {
            plans = planRepository.findByFactoryIdAndDeletedAtIsNullOrderByPlanDateDesc(factoryId, pageable);
        }

        List<SchedulingPlanDTO> dtos = plans.getContent().stream()
            .map(SchedulingPlanDTO::fromEntity)
            .map(this::enrichPlanDTO)
            .collect(Collectors.toList());

        return new PageImpl<>(dtos, pageable, plans.getTotalElements());
    }

    @Override
    @Transactional
    public SchedulingPlanDTO updatePlan(String factoryId, String planId, CreateSchedulingPlanRequest request) {
        SchedulingPlan plan = planRepository.findByIdAndFactoryIdAndDeletedAtIsNull(planId, factoryId)
            .orElseThrow(() -> new RuntimeException("调度计划不存在"));

        if (plan.getStatus() != SchedulingPlan.PlanStatus.draft) {
            throw new RuntimeException("只能修改草稿状态的计划");
        }

        plan.setPlanName(request.getPlanName());
        plan.setNotes(request.getNotes());
        planRepository.save(plan);

        return enrichPlanDTO(SchedulingPlanDTO.fromEntity(plan));
    }

    @Override
    @Transactional
    public SchedulingPlanDTO confirmPlan(String factoryId, String planId, Long userId) {
        SchedulingPlan plan = planRepository.findByIdAndFactoryIdAndDeletedAtIsNull(planId, factoryId)
            .orElseThrow(() -> new RuntimeException("调度计划不存在"));

        if (plan.getStatus() != SchedulingPlan.PlanStatus.draft) {
            throw new RuntimeException("只能确认草稿状态的计划");
        }

        plan.setStatus(SchedulingPlan.PlanStatus.confirmed);
        plan.setConfirmedBy(userId);
        plan.setConfirmedAt(LocalDateTime.now());
        planRepository.save(plan);

        return enrichPlanDTO(SchedulingPlanDTO.fromEntity(plan));
    }

    @Override
    @Transactional
    public void cancelPlan(String factoryId, String planId, String reason) {
        SchedulingPlan plan = planRepository.findByIdAndFactoryIdAndDeletedAtIsNull(planId, factoryId)
            .orElseThrow(() -> new RuntimeException("调度计划不存在"));

        plan.setStatus(SchedulingPlan.PlanStatus.cancelled);
        plan.setNotes(plan.getNotes() != null ? plan.getNotes() + "\n取消原因: " + reason : "取消原因: " + reason);
        planRepository.save(plan);
    }

    // ==================== 产线排程 ====================

    @Override
    public LineScheduleDTO getSchedule(String factoryId, String scheduleId) {
        LineSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new RuntimeException("排程不存在"));
        return enrichScheduleDTO(schedule);
    }

    @Override
    @Transactional
    public LineScheduleDTO updateSchedule(String factoryId, String scheduleId, UpdateScheduleRequest request) {
        LineSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new RuntimeException("排程不存在"));

        if (request.getSequenceOrder() != null) {
            schedule.setSequenceOrder(request.getSequenceOrder());
        }
        if (request.getPlannedStartTime() != null) {
            schedule.setPlannedStartTime(request.getPlannedStartTime());
        }
        if (request.getPlannedEndTime() != null) {
            schedule.setPlannedEndTime(request.getPlannedEndTime());
        }
        if (request.getPlannedQuantity() != null) {
            schedule.setPlannedQuantity(request.getPlannedQuantity());
        }
        if (request.getNotes() != null) {
            schedule.setDelayReason(request.getNotes());
        }

        schedule = scheduleRepository.save(schedule);
        return enrichScheduleDTO(schedule);
    }

    @Override
    @Transactional
    public LineScheduleDTO startSchedule(String factoryId, String scheduleId) {
        LineSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new RuntimeException("排程不存在"));

        schedule.setStatus(LineSchedule.ScheduleStatus.in_progress);
        schedule.setActualStartTime(LocalDateTime.now());

        // 更新计划状态
        SchedulingPlan plan = schedule.getPlan();
        if (plan.getStatus() == SchedulingPlan.PlanStatus.confirmed) {
            plan.setStatus(SchedulingPlan.PlanStatus.in_progress);
            planRepository.save(plan);
        }

        schedule = scheduleRepository.save(schedule);
        return enrichScheduleDTO(schedule);
    }

    @Override
    @Transactional
    public LineScheduleDTO completeSchedule(String factoryId, String scheduleId, Integer completedQuantity) {
        LineSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new RuntimeException("排程不存在"));

        schedule.setStatus(LineSchedule.ScheduleStatus.completed);
        schedule.setActualEndTime(LocalDateTime.now());
        schedule.setCompletedQuantity(completedQuantity);

        // 计算实际效率
        if (schedule.getActualStartTime() != null && schedule.getPlannedQuantity() != null
            && schedule.getPlannedQuantity() > 0) {
            long minutes = java.time.Duration.between(schedule.getActualStartTime(),
                LocalDateTime.now()).toMinutes();
            if (minutes > 0) {
                BigDecimal efficiency = BigDecimal.valueOf(completedQuantity)
                    .divide(BigDecimal.valueOf(schedule.getPlannedQuantity()), 4, BigDecimal.ROUND_HALF_UP)
                    .multiply(BigDecimal.valueOf(100));
                schedule.setActualEfficiency(efficiency);
            }
        }

        schedule = scheduleRepository.save(schedule);
        return enrichScheduleDTO(schedule);
    }

    @Override
    @Transactional
    public LineScheduleDTO updateProgress(String factoryId, String scheduleId, Integer completedQuantity) {
        LineSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new RuntimeException("排程不存在"));

        schedule.setCompletedQuantity(completedQuantity);
        schedule = scheduleRepository.save(schedule);
        return enrichScheduleDTO(schedule);
    }

    // ==================== 工人分配 ====================

    @Override
    @Transactional
    public List<WorkerAssignmentDTO> assignWorkers(String factoryId, AssignWorkerRequest request) {
        LineSchedule schedule = scheduleRepository.findById(request.getScheduleId())
            .orElseThrow(() -> new RuntimeException("排程不存在"));

        List<WorkerAssignment> assignments = new ArrayList<>();
        for (Long userId : request.getWorkerIds()) {
            // 检查是否已分配
            if (assignmentRepository.findByScheduleIdAndUserId(request.getScheduleId(), userId).isPresent()) {
                continue;
            }

            WorkerAssignment assignment = new WorkerAssignment();
            assignment.setSchedule(schedule);
            assignment.setUserId(userId);
            assignment.setIsTemporary(request.getIsTemporary());
            assignment.setStatus(WorkerAssignment.AssignmentStatus.assigned);
            assignments.add(assignment);
        }

        assignments = assignmentRepository.saveAll(assignments);

        // 更新排程的工人数
        schedule.setAssignedWorkers((int) assignmentRepository.countByScheduleId(request.getScheduleId()));
        scheduleRepository.save(schedule);

        return assignments.stream()
            .map(this::enrichAssignmentDTO)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void removeWorkerAssignment(String factoryId, String assignmentId) {
        WorkerAssignment assignment = assignmentRepository.findById(assignmentId)
            .orElseThrow(() -> new RuntimeException("分配记录不存在"));

        String scheduleId = assignment.getScheduleId();
        assignmentRepository.delete(assignment);

        // 更新排程的工人数
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
            .orElseThrow(() -> new RuntimeException("分配记录不存在"));

        assignment.setStatus(WorkerAssignment.AssignmentStatus.checked_in);
        assignment.setActualStartTime(LocalDateTime.now());
        assignment = assignmentRepository.save(assignment);

        return enrichAssignmentDTO(assignment);
    }

    @Override
    @Transactional
    public WorkerAssignmentDTO workerCheckOut(String factoryId, String assignmentId, Integer performanceScore) {
        WorkerAssignment assignment = assignmentRepository.findById(assignmentId)
            .orElseThrow(() -> new RuntimeException("分配记录不存在"));

        assignment.setStatus(WorkerAssignment.AssignmentStatus.checked_out);
        assignment.setActualEndTime(LocalDateTime.now());
        if (performanceScore != null) {
            assignment.setPerformanceScore(performanceScore);
        }
        assignment = assignmentRepository.save(assignment);

        return enrichAssignmentDTO(assignment);
    }

    @Override
    public List<WorkerAssignmentDTO> getWorkerAssignments(String factoryId, Long userId, LocalDate date) {
        List<WorkerAssignment> assignments = assignmentRepository.findByUserIdAndDate(userId, date);
        return assignments.stream()
            .map(this::enrichAssignmentDTO)
            .collect(Collectors.toList());
    }

    // ==================== AI 功能 ====================

    @Override
    @Transactional
    public SchedulingPlanDTO generateSchedule(String factoryId, GenerateScheduleRequest request, Long userId) {
        log.info("开始 AI 智能排产: factoryId={}, planDate={}, batchIds={}",
            factoryId, request.getPlanDate(), request.getBatchIds());

        // 1. 获取需要排产的批次
        List<ProductionBatch> batches;
        if (request.getBatchIds() != null && !request.getBatchIds().isEmpty()) {
            batches = batchRepository.findAllById(request.getBatchIds());
        } else {
            // 自动选择待生产的批次 (PLANNED 或 PLANNING 状态)
            batches = batchRepository.findByFactoryIdAndStatus(
                factoryId,
                com.cretas.aims.entity.enums.ProductionBatchStatus.PLANNED,
                org.springframework.data.domain.Pageable.unpaged()
            ).getContent();
            if (batches.isEmpty()) {
                batches = batchRepository.findByFactoryIdAndStatus(
                    factoryId,
                    com.cretas.aims.entity.enums.ProductionBatchStatus.PLANNING,
                    org.springframework.data.domain.Pageable.unpaged()
                ).getContent();
            }
        }

        if (batches.isEmpty()) {
            log.warn("没有找到需要排产的批次，请在请求中指定 batchIds");
            throw new RuntimeException("没有找到需要排产的批次，请指定 batchIds 参数");
        }

        log.info("找到 {} 个批次需要排产", batches.size());

        // 2. 获取可用产线
        List<ProductionLine> productionLines = lineRepository.findByFactoryIdAndStatusAndDeletedAtIsNull(
            factoryId, ProductionLine.LineStatus.active);

        if (productionLines.isEmpty()) {
            log.warn("没有可用的产线，创建默认产线");
            // 创建默认产线
            ProductionLine defaultLine = new ProductionLine();
            defaultLine.setFactoryId(factoryId);
            defaultLine.setName("默认产线");
            defaultLine.setLineCode("LINE-001");
            defaultLine.setMinWorkers(2);
            defaultLine.setMaxWorkers(10);
            defaultLine.setHourlyCapacity(BigDecimal.valueOf(50));
            defaultLine.setStatus(ProductionLine.LineStatus.active);
            defaultLine = lineRepository.save(defaultLine);
            productionLines = List.of(defaultLine);
        }

        // 3. 创建调度计划
        SchedulingPlan plan = new SchedulingPlan();
        plan.setFactoryId(factoryId);
        plan.setPlanDate(request.getPlanDate());
        plan.setPlanName("AI生成-" + request.getPlanDate());
        plan.setCreatedBy(userId);
        plan.setStatus(SchedulingPlan.PlanStatus.draft);
        plan = planRepository.save(plan);

        // 4. 调用 AI 服务获取优化的排程建议
        List<Map<String, Object>> aiScheduleResult = null;
        try {
            aiScheduleResult = callAISchedulingService(factoryId, batches, productionLines, request);
        } catch (Exception e) {
            log.warn("AI 调度服务调用失败，使用本地算法: {}", e.getMessage());
        }

        // 5. 创建产线排程
        List<LineSchedule> schedules = new ArrayList<>();
        int sequenceOrder = 0;

        if (aiScheduleResult != null && !aiScheduleResult.isEmpty()) {
            // 使用 AI 建议的排程
            for (Map<String, Object> suggestion : aiScheduleResult) {
                LineSchedule schedule = createScheduleFromAISuggestion(plan, suggestion, productionLines);
                if (schedule != null) {
                    schedule.setSequenceOrder(sequenceOrder++);
                    schedules.add(schedule);
                }
            }
        } else {
            // 使用本地简单轮询算法分配
            int lineIndex = 0;
            LocalDateTime startTime = request.getPlanDate().atTime(8, 0); // 默认早上8点开始

            for (ProductionBatch batch : batches) {
                ProductionLine line = productionLines.get(lineIndex % productionLines.size());

                LineSchedule schedule = new LineSchedule();
                schedule.setPlan(plan);
                schedule.setProductionLineId(line.getId());
                schedule.setBatchId(batch.getId());
                schedule.setSequenceOrder(sequenceOrder++);
                schedule.setPlannedStartTime(startTime);

                // 估算完成时间 (根据产能)
                int quantity = batch.getPlannedQuantity() != null ?
                    batch.getPlannedQuantity().intValue() : 100;
                double hourlyCapacity = line.getHourlyCapacity() != null ?
                    line.getHourlyCapacity().doubleValue() : 50;
                double hoursNeeded = quantity / hourlyCapacity;
                LocalDateTime endTime = startTime.plusMinutes((long)(hoursNeeded * 60));

                schedule.setPlannedEndTime(endTime);
                schedule.setPlannedQuantity(quantity);
                schedule.setStatus(LineSchedule.ScheduleStatus.pending);

                // 预测效率
                try {
                    Map<String, Object> prediction = getPredictionForSchedule(factoryId, batch, line);
                    if (prediction != null) {
                        if (prediction.get("predicted_efficiency") != null) {
                            schedule.setPredictedEfficiency(toBigDecimal(prediction.get("predicted_efficiency")));
                        }
                        if (prediction.get("probability") != null) {
                            schedule.setPredictedCompletionProb(toBigDecimal(prediction.get("probability")));
                        }
                    }
                } catch (Exception e) {
                    log.debug("获取预测失败: {}", e.getMessage());
                }

                schedules.add(schedule);

                // 下一个批次开始时间
                startTime = endTime.plusMinutes(15); // 15分钟间隔
                lineIndex++;
            }
        }

        if (!schedules.isEmpty()) {
            scheduleRepository.saveAll(schedules);
            plan.setTotalBatches(schedules.size());
            planRepository.save(plan);
        }

        log.info("AI 排产完成: planId={}, schedules={}", plan.getId(), schedules.size());

        // 6. 返回完整的计划 DTO
        return getPlan(factoryId, plan.getId());
    }

    /**
     * 调用 AI 调度服务
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> callAISchedulingService(
            String factoryId, List<ProductionBatch> batches,
            List<ProductionLine> lines, GenerateScheduleRequest request) {

        try {
            Map<String, Object> aiRequest = new HashMap<>();
            aiRequest.put("factory_id", factoryId);

            // 批次数据
            List<Map<String, Object>> batchData = batches.stream().map(b -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", b.getId());
                m.put("batch_number", b.getBatchNumber());
                m.put("quantity", b.getPlannedQuantity() != null ? b.getPlannedQuantity().intValue() : 100);
                m.put("product_type", b.getProductTypeId());
                m.put("priority", 1);
                return m;
            }).collect(Collectors.toList());
            aiRequest.put("batches", batchData);

            // 产线数据
            List<Map<String, Object>> lineData = lines.stream().map(l -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", l.getId());
                m.put("name", l.getName());
                m.put("capacity", l.getHourlyCapacity() != null ? l.getHourlyCapacity().doubleValue() : 50);
                m.put("min_workers", l.getMinWorkers());
                m.put("max_workers", l.getMaxWorkers());
                return m;
            }).collect(Collectors.toList());
            aiRequest.put("production_lines", lineData);

            aiRequest.put("plan_date", request.getPlanDate().toString());
            aiRequest.put("priority_strategy", request.getPriorityStrategy());
            aiRequest.put("target_probability", request.getTargetProbability());

            String url = aiServiceUrl + "/scheduling/generate";
            log.debug("调用 AI 调度服务: {}", url);

            Map<String, Object> response = restTemplate.postForObject(url, aiRequest, Map.class);

            if (response != null && response.get("schedules") != null) {
                return (List<Map<String, Object>>) response.get("schedules");
            }
        } catch (Exception e) {
            log.warn("AI 调度服务调用失败: {}", e.getMessage());
        }

        return null;
    }

    /**
     * 从 AI 建议创建排程
     */
    private LineSchedule createScheduleFromAISuggestion(
            SchedulingPlan plan, Map<String, Object> suggestion, List<ProductionLine> lines) {

        try {
            LineSchedule schedule = new LineSchedule();
            schedule.setPlan(plan);

            // 产线ID
            String lineId = (String) suggestion.get("line_id");
            if (lineId == null && suggestion.get("line_index") != null) {
                int index = ((Number) suggestion.get("line_index")).intValue();
                lineId = lines.get(index % lines.size()).getId();
            }
            schedule.setProductionLineId(lineId);

            // 批次ID
            if (suggestion.get("batch_id") != null) {
                schedule.setBatchId(((Number) suggestion.get("batch_id")).longValue());
            }

            // 时间
            if (suggestion.get("start_time") != null) {
                schedule.setPlannedStartTime(LocalDateTime.parse((String) suggestion.get("start_time")));
            }
            if (suggestion.get("end_time") != null) {
                schedule.setPlannedEndTime(LocalDateTime.parse((String) suggestion.get("end_time")));
            }

            // 数量
            if (suggestion.get("quantity") != null) {
                schedule.setPlannedQuantity(((Number) suggestion.get("quantity")).intValue());
            }

            // 预测值
            if (suggestion.get("predicted_efficiency") != null) {
                schedule.setPredictedEfficiency(toBigDecimal(suggestion.get("predicted_efficiency")));
            }
            if (suggestion.get("completion_probability") != null) {
                schedule.setPredictedCompletionProb(toBigDecimal(suggestion.get("completion_probability")));
            }

            schedule.setStatus(LineSchedule.ScheduleStatus.pending);
            return schedule;
        } catch (Exception e) {
            log.warn("解析 AI 排程建议失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 获取排程的效率预测
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> getPredictionForSchedule(
            String factoryId, ProductionBatch batch, ProductionLine line) {

        try {
            Map<String, Object> request = new HashMap<>();
            request.put("factory_id", factoryId);
            request.put("remaining_quantity", batch.getPlannedQuantity() != null ?
                batch.getPlannedQuantity().intValue() : 100);
            request.put("deadline_hours", 8.0);
            request.put("available_workers", line.getMinWorkers() != null ? line.getMinWorkers() : 5);

            Map<String, Object> features = new HashMap<>();
            LocalDateTime now = LocalDateTime.now();
            features.put("hour_of_day", 8);
            features.put("day_of_week", now.getDayOfWeek().getValue());
            features.put("worker_count", line.getMinWorkers() != null ? line.getMinWorkers() : 5);
            features.put("product_complexity", 5);
            request.put("features", features);

            String url = aiServiceUrl + "/scheduling/hybrid-predict";
            Map<String, Object> result = restTemplate.postForObject(url, request, Map.class);

            if (result != null && result.get("efficiency_prediction") instanceof Map) {
                Map<String, Object> effPred = (Map<String, Object>) result.get("efficiency_prediction");
                Map<String, Object> prediction = new HashMap<>();
                prediction.put("predicted_efficiency", effPred.get("prediction"));
                prediction.put("probability", result.get("probability"));
                return prediction;
            }
        } catch (Exception e) {
            log.debug("预测服务调用失败: {}", e.getMessage());
        }

        return null;
    }

    @Override
    public List<WorkerAssignmentDTO> optimizeWorkers(String factoryId, OptimizeWorkersRequest request) {
        // TODO: 调用 OR-Tools 优化
        // 简化实现：返回现有分配
        SchedulingPlan plan = planRepository.findByIdAndFactoryIdAndDeletedAtIsNull(request.getPlanId(), factoryId)
            .orElseThrow(() -> new RuntimeException("计划不存在"));

        List<WorkerAssignment> assignments = new ArrayList<>();
        List<LineSchedule> schedules = scheduleRepository.findByPlanId(request.getPlanId());
        for (LineSchedule schedule : schedules) {
            assignments.addAll(assignmentRepository.findByScheduleId(schedule.getId()));
        }

        return assignments.stream()
            .map(this::enrichAssignmentDTO)
            .collect(Collectors.toList());
    }

    @Override
    public CompletionProbabilityResponse calculateCompletionProbability(String factoryId, String scheduleId) {
        LineSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new RuntimeException("排程不存在"));

        CompletionProbabilityResponse response = new CompletionProbabilityResponse();
        response.setScheduleId(scheduleId);

        // 获取产线名称和批次号
        lineRepository.findById(schedule.getProductionLineId()).ifPresent(line ->
            response.setProductionLineName(line.getName()));

        if (schedule.getBatchId() != null) {
            batchRepository.findById(schedule.getBatchId()).ifPresent(batch ->
                response.setBatchNumber(batch.getBatchNumber()));
        }

        // 计算基本数据
        int planned = schedule.getPlannedQuantity() != null ? schedule.getPlannedQuantity() : 0;
        int completed = schedule.getCompletedQuantity() != null ? schedule.getCompletedQuantity() : 0;
        int remaining = planned - completed;
        int workers = schedule.getAssignedWorkers() != null ? schedule.getAssignedWorkers() : 1;

        response.setRemainingQuantity(remaining);
        response.setCurrentWorkers(workers);

        // 计算截止时间(小时)
        double deadlineHours = 8.0; // 默认8小时
        if (schedule.getPlannedEndTime() != null) {
            LocalDateTime now = LocalDateTime.now();
            if (schedule.getPlannedEndTime().isAfter(now)) {
                deadlineHours = Duration.between(now, schedule.getPlannedEndTime()).toMinutes() / 60.0;
            } else {
                deadlineHours = 0;
            }
        }
        response.setDeadlineHours(deadlineHours);

        // 尝试使用混合预测服务
        if (hybridPredictEnabled && remaining > 0) {
            try {
                return callHybridPredictService(factoryId, schedule, response, remaining, deadlineHours, workers);
            } catch (Exception e) {
                log.warn("混合预测服务调用失败，使用本地计算: {}", e.getMessage());
                // 降级到本地计算
            }
        }

        // 本地简单概率计算 (降级方案)
        return calculateLocalProbability(response, planned, completed, remaining, deadlineHours, workers);
    }

    /**
     * 调用混合预测服务
     */
    @SuppressWarnings("unchecked")
    private CompletionProbabilityResponse callHybridPredictService(
            String factoryId, LineSchedule schedule, CompletionProbabilityResponse response,
            int remaining, double deadlineHours, int workers) {

        // 构建预测请求
        Map<String, Object> request = new HashMap<>();
        request.put("factory_id", factoryId);
        request.put("remaining_quantity", remaining);
        request.put("deadline_hours", deadlineHours);
        request.put("available_workers", workers);

        // 添加特征数据
        Map<String, Object> features = buildPredictionFeatures(schedule, workers);
        request.put("features", features);

        String url = aiServiceUrl + "/scheduling/hybrid-predict";
        log.debug("调用混合预测服务: {}", url);

        Map<String, Object> result = restTemplate.postForObject(url, request, Map.class);

        if (result != null) {
            // 解析预测结果
            if (result.get("probability") != null) {
                response.setProbability(toBigDecimal(result.get("probability")));
            }
            if (result.get("mean_hours") != null) {
                response.setMeanHours(toBigDecimal(result.get("mean_hours")));
            }
            if (result.get("std_hours") != null) {
                response.setStdHours(toBigDecimal(result.get("std_hours")));
            }
            if (result.get("percentile_90") != null) {
                response.setPercentile90(toBigDecimal(result.get("percentile_90")));
            }

            // 置信区间
            if (result.get("confidence_interval") != null) {
                Object ci = result.get("confidence_interval");
                if (ci instanceof List) {
                    List<?> ciList = (List<?>) ci;
                    if (ciList.size() >= 2) {
                        response.setConfidenceLower(toBigDecimal(ciList.get(0)));
                        response.setConfidenceUpper(toBigDecimal(ciList.get(1)));
                    }
                }
            }

            // AI 预测模式信息
            response.setPredictionMode((String) result.get("mode"));
            if (result.get("efficiency_prediction") instanceof Map) {
                Map<String, Object> effPred = (Map<String, Object>) result.get("efficiency_prediction");
                response.setModelVersion((String) effPred.get("model_version"));
                if (effPred.get("confidence") != null) {
                    response.setConfidence(toBigDecimal(effPred.get("confidence")));
                }
                if (effPred.get("prediction") != null) {
                    response.setPredictedEfficiency(toBigDecimal(effPred.get("prediction")));
                }
                response.setExplanation((String) effPred.get("explanation"));
            }

            // 风险分析
            response.setRiskAnalysis((String) result.get("risk_analysis"));

            // 设置风险等级和建议
            double prob = response.getProbability() != null ? response.getProbability().doubleValue() : 0.5;
            setRiskLevelAndSuggestion(response, prob);

            // 保存预测记录
            savePrediction(schedule.getId(), "completion_prob", response.getProbability(),
                    response.getConfidenceLower(), response.getConfidenceUpper(),
                    response.getModelVersion(), features);
        }

        return response;
    }

    /**
     * 构建预测特征数据
     */
    private Map<String, Object> buildPredictionFeatures(LineSchedule schedule, int workers) {
        Map<String, Object> features = new HashMap<>();
        LocalDateTime now = LocalDateTime.now();

        features.put("hour_of_day", now.getHour());
        features.put("day_of_week", now.getDayOfWeek().getValue());
        features.put("is_overtime", now.getHour() >= 18 || now.getHour() < 6);
        features.put("worker_count", workers);

        // 工人特征（默认值，可从实际工人数据获取）
        features.put("avg_worker_experience_days", 90);
        features.put("avg_skill_level", 3.0);
        features.put("temporary_worker_ratio", 0.1);

        // 产品复杂度（默认值）
        features.put("product_complexity", 5);

        // 设备特征（默认值）
        features.put("equipment_age_days", 365);
        features.put("equipment_utilization", 0.7);

        // 如果有批次信息，尝试获取更详细的特征
        if (schedule.getBatchId() != null) {
            batchRepository.findById(schedule.getBatchId()).ifPresent(batch -> {
                if (batch.getProductTypeId() != null) {
                    features.put("product_type", batch.getProductTypeId());
                }
            });
        }

        return features;
    }

    /**
     * 本地概率计算 (降级方案)
     */
    private CompletionProbabilityResponse calculateLocalProbability(
            CompletionProbabilityResponse response, int planned, int completed,
            int remaining, double deadlineHours, int workers) {

        if (planned <= 0) {
            response.setProbability(BigDecimal.ONE);
            response.setRiskLevel("low");
            response.setSuggestion("无生产任务");
            response.setPredictionMode("local");
            return response;
        }

        // 如果没有分配工人，设置为极高风险
        if (workers <= 0) {
            response.setProbability(BigDecimal.ZERO);
            response.setMeanHours(null);
            response.setRiskLevel("critical");
            response.setSuggestion("尚未分配工人，请先分配生产人员");
            response.setPredictionMode("local");
            return response;
        }

        double progress = (double) completed / planned;

        // 基于进度和剩余时间估算
        double estimatedEfficiency = 15.0; // 默认效率：15件/人/小时
        double estimatedHours = remaining / (estimatedEfficiency * workers);

        double probability;
        if (deadlineHours <= 0) {
            probability = 0;
        } else if (estimatedHours <= deadlineHours * 0.8) {
            probability = 0.9 + progress * 0.1;
        } else if (estimatedHours <= deadlineHours) {
            probability = 0.7 + progress * 0.2;
        } else {
            probability = Math.max(0.1, 0.5 - (estimatedHours - deadlineHours) / deadlineHours * 0.3);
        }

        response.setProbability(BigDecimal.valueOf(probability).setScale(4, RoundingMode.HALF_UP));
        response.setMeanHours(BigDecimal.valueOf(estimatedHours).setScale(2, RoundingMode.HALF_UP));
        response.setPredictionMode("local");

        setRiskLevelAndSuggestion(response, probability);

        return response;
    }

    /**
     * 设置风险等级和建议
     */
    private void setRiskLevelAndSuggestion(CompletionProbabilityResponse response, double probability) {
        if (probability >= 0.85) {
            response.setRiskLevel("low");
            response.setSuggestion("进度正常，按计划继续执行");
        } else if (probability >= 0.7) {
            response.setRiskLevel("medium");
            response.setSuggestion("建议密切关注进度，必要时增加人手");
        } else if (probability >= 0.5) {
            response.setRiskLevel("high");
            response.setSuggestion("风险较高，建议立即增加人手或延长工作时间");
        } else {
            response.setRiskLevel("critical");
            response.setSuggestion("风险极高，建议重新调度或调整交付计划");
        }
    }

    /**
     * 保存预测记录
     */
    private void savePrediction(String scheduleId, String predictionType, BigDecimal predictedValue,
                                  BigDecimal confidenceLower, BigDecimal confidenceUpper,
                                  String modelVersion, Map<String, Object> features) {
        try {
            SchedulingPrediction prediction = new SchedulingPrediction();
            prediction.setScheduleId(scheduleId);
            prediction.setPredictionType(SchedulingPrediction.PredictionType.valueOf(predictionType));
            prediction.setPredictedValue(predictedValue);
            prediction.setConfidenceLower(confidenceLower);
            prediction.setConfidenceUpper(confidenceUpper);
            prediction.setModelVersion(modelVersion);

            if (features != null) {
                try {
                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    prediction.setFeaturesJson(mapper.writeValueAsString(features));
                } catch (Exception e) {
                    log.warn("序列化特征数据失败: {}", e.getMessage());
                }
            }

            predictionRepository.save(prediction);
        } catch (Exception e) {
            log.warn("保存预测记录失败: {}", e.getMessage());
        }
    }

    /**
     * 安全转换为 BigDecimal
     */
    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return null;
        if (value instanceof BigDecimal) return (BigDecimal) value;
        if (value instanceof Number) {
            return BigDecimal.valueOf(((Number) value).doubleValue()).setScale(4, RoundingMode.HALF_UP);
        }
        try {
            return new BigDecimal(value.toString()).setScale(4, RoundingMode.HALF_UP);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public List<CompletionProbabilityResponse> calculateBatchProbabilities(String factoryId, String planId) {
        List<LineSchedule> schedules = scheduleRepository.findByPlanId(planId);
        return schedules.stream()
            .map(s -> calculateCompletionProbability(factoryId, s.getId()))
            .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public SchedulingPlanDTO reschedule(String factoryId, RescheduleRequest request, Long userId) {
        SchedulingPlan plan = planRepository.findByIdAndFactoryIdAndDeletedAtIsNull(request.getPlanId(), factoryId)
            .orElseThrow(() -> new RuntimeException("计划不存在"));

        // 简化实现：标记为需要重新调度
        plan.setNotes((plan.getNotes() != null ? plan.getNotes() + "\n" : "")
            + "重新调度原因: " + request.getReason() + " @ " + LocalDateTime.now());
        planRepository.save(plan);

        return enrichPlanDTO(SchedulingPlanDTO.fromEntity(plan));
    }

    // ==================== 告警管理 ====================

    @Override
    public List<SchedulingAlertDTO> getUnresolvedAlerts(String factoryId) {
        List<SchedulingAlert> alerts = alertRepository.findByFactoryIdAndIsResolvedFalseOrderByCreatedAtDesc(factoryId);
        return alerts.stream()
            .map(SchedulingAlertDTO::fromEntity)
            .collect(Collectors.toList());
    }

    @Override
    public Page<SchedulingAlertDTO> getAlerts(String factoryId, String severity, String alertType, Pageable pageable) {
        Page<SchedulingAlert> alerts;

        if (severity != null) {
            SchedulingAlert.Severity sev = SchedulingAlert.Severity.valueOf(severity);
            alerts = alertRepository.findByFactoryIdAndSeverity(factoryId, sev, pageable);
        } else if (alertType != null) {
            SchedulingAlert.AlertType type = SchedulingAlert.AlertType.valueOf(alertType);
            alerts = alertRepository.findByFactoryIdAndAlertType(factoryId, type, pageable);
        } else {
            alerts = alertRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageable);
        }

        List<SchedulingAlertDTO> dtos = alerts.getContent().stream()
            .map(SchedulingAlertDTO::fromEntity)
            .collect(Collectors.toList());

        return new PageImpl<>(dtos, pageable, alerts.getTotalElements());
    }

    @Override
    @Transactional
    public SchedulingAlertDTO acknowledgeAlert(String factoryId, String alertId, Long userId) {
        SchedulingAlert alert = alertRepository.findByIdAndFactoryId(alertId, factoryId)
            .orElseThrow(() -> new RuntimeException("告警不存在"));

        alert.setAcknowledgedAt(LocalDateTime.now());
        alert.setAcknowledgedBy(userId);
        alert = alertRepository.save(alert);

        return SchedulingAlertDTO.fromEntity(alert);
    }

    @Override
    @Transactional
    public SchedulingAlertDTO resolveAlert(String factoryId, String alertId, Long userId, String resolutionNotes) {
        SchedulingAlert alert = alertRepository.findByIdAndFactoryId(alertId, factoryId)
            .orElseThrow(() -> new RuntimeException("告警不存在"));

        alert.setIsResolved(true);
        alert.setResolvedAt(LocalDateTime.now());
        alert.setResolvedBy(userId);
        alert.setResolutionNotes(resolutionNotes);
        alert = alertRepository.save(alert);

        return SchedulingAlertDTO.fromEntity(alert);
    }

    // ==================== 产线管理 ====================

    @Override
    public List<ProductionLineDTO> getProductionLines(String factoryId, String status) {
        List<ProductionLine> lines;
        if (status != null) {
            ProductionLine.LineStatus lineStatus = ProductionLine.LineStatus.valueOf(status);
            lines = lineRepository.findByFactoryIdAndStatusAndDeletedAtIsNull(factoryId, lineStatus);
        } else {
            lines = lineRepository.findByFactoryIdAndDeletedAtIsNull(factoryId);
        }
        return lines.stream()
            .map(ProductionLineDTO::fromEntity)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ProductionLineDTO createProductionLine(String factoryId, ProductionLineDTO request) {
        ProductionLine line = new ProductionLine();
        line.setFactoryId(factoryId);
        line.setName(request.getName());
        line.setLineCode(request.getLineCode());
        line.setLineType(request.getLineType());
        line.setDepartmentId(request.getDepartmentId());
        line.setMinWorkers(request.getMinWorkers() != null ? request.getMinWorkers() : 1);
        line.setMaxWorkers(request.getMaxWorkers() != null ? request.getMaxWorkers() : 10);
        line.setRequiredSkillLevel(request.getRequiredSkillLevel() != null ? request.getRequiredSkillLevel() : 1);
        line.setHourlyCapacity(request.getHourlyCapacity());
        line.setEquipmentIds(request.getEquipmentIds());
        line.setStatus(ProductionLine.LineStatus.active);

        line = lineRepository.save(line);
        return ProductionLineDTO.fromEntity(line);
    }

    @Override
    @Transactional
    public ProductionLineDTO updateProductionLine(String factoryId, String lineId, ProductionLineDTO request) {
        ProductionLine line = lineRepository.findByIdAndFactoryIdAndDeletedAtIsNull(lineId, factoryId)
            .orElseThrow(() -> new RuntimeException("产线不存在"));

        if (request.getName() != null) line.setName(request.getName());
        if (request.getLineCode() != null) line.setLineCode(request.getLineCode());
        if (request.getLineType() != null) line.setLineType(request.getLineType());
        if (request.getDepartmentId() != null) line.setDepartmentId(request.getDepartmentId());
        if (request.getMinWorkers() != null) line.setMinWorkers(request.getMinWorkers());
        if (request.getMaxWorkers() != null) line.setMaxWorkers(request.getMaxWorkers());
        if (request.getRequiredSkillLevel() != null) line.setRequiredSkillLevel(request.getRequiredSkillLevel());
        if (request.getHourlyCapacity() != null) line.setHourlyCapacity(request.getHourlyCapacity());
        if (request.getEquipmentIds() != null) line.setEquipmentIds(request.getEquipmentIds());

        line = lineRepository.save(line);
        return ProductionLineDTO.fromEntity(line);
    }

    @Override
    @Transactional
    public ProductionLineDTO updateProductionLineStatus(String factoryId, String lineId, String status) {
        ProductionLine line = lineRepository.findByIdAndFactoryIdAndDeletedAtIsNull(lineId, factoryId)
            .orElseThrow(() -> new RuntimeException("产线不存在"));

        line.setStatus(ProductionLine.LineStatus.valueOf(status));
        line = lineRepository.save(line);
        return ProductionLineDTO.fromEntity(line);
    }

    // ==================== Dashboard ====================

    @Override
    public SchedulingDashboardDTO getDashboard(String factoryId, LocalDate date) {
        SchedulingDashboardDTO dashboard = new SchedulingDashboardDTO();
        dashboard.setDate(date);

        // 计划统计
        Optional<SchedulingPlan> todayPlan = planRepository.findTodayPlan(factoryId, date);
        if (todayPlan.isPresent()) {
            dashboard.setTotalPlans(1);
            SchedulingPlan plan = todayPlan.get();
            switch (plan.getStatus()) {
                case confirmed:
                    dashboard.setConfirmedPlans(1);
                    break;
                case in_progress:
                    dashboard.setInProgressPlans(1);
                    break;
                case completed:
                    dashboard.setCompletedPlans(1);
                    break;
                default:
                    break;
            }

            // 排程统计
            List<LineSchedule> schedules = scheduleRepository.findByPlanId(plan.getId());
            dashboard.setTotalSchedules(schedules.size());

            int pending = 0, inProgress = 0, completed = 0, delayed = 0;
            int totalPlanned = 0, totalCompleted = 0;

            for (LineSchedule schedule : schedules) {
                switch (schedule.getStatus()) {
                    case pending: pending++; break;
                    case in_progress: inProgress++; break;
                    case completed: completed++; break;
                    case delayed: delayed++; break;
                    default: break;
                }
                if (schedule.getPlannedQuantity() != null) {
                    totalPlanned += schedule.getPlannedQuantity();
                }
                if (schedule.getCompletedQuantity() != null) {
                    totalCompleted += schedule.getCompletedQuantity();
                }
            }

            dashboard.setPendingSchedules(pending);
            dashboard.setInProgressSchedules(inProgress);
            dashboard.setCompletedSchedules(completed);
            dashboard.setDelayedSchedules(delayed);
            dashboard.setTotalPlannedQuantity(totalPlanned);
            dashboard.setTotalCompletedQuantity(totalCompleted);

            if (totalPlanned > 0) {
                dashboard.setOverallCompletionRate(BigDecimal.valueOf(totalCompleted)
                    .divide(BigDecimal.valueOf(totalPlanned), 4, BigDecimal.ROUND_HALF_UP)
                    .multiply(BigDecimal.valueOf(100)));
            }

            // 当前排程
            dashboard.setCurrentSchedules(schedules.stream()
                .filter(s -> s.getStatus() == LineSchedule.ScheduleStatus.in_progress)
                .map(this::enrichScheduleDTO)
                .collect(Collectors.toList()));
        }

        // 产线状态
        dashboard.setProductionLines(getProductionLines(factoryId, null));

        // 未解决告警
        dashboard.setAlerts(getUnresolvedAlerts(factoryId));
        dashboard.setUnresolvedAlerts(dashboard.getAlerts() != null ? dashboard.getAlerts().size() : 0);
        dashboard.setCriticalAlerts((int) alertRepository.countCriticalUnresolvedByFactoryId(factoryId));

        return dashboard;
    }

    @Override
    public SchedulingDashboardDTO getRealtimeMonitor(String factoryId, String planId) {
        SchedulingPlan plan = planRepository.findByIdAndFactoryIdAndDeletedAtIsNull(planId, factoryId)
            .orElseThrow(() -> new RuntimeException("计划不存在"));

        SchedulingDashboardDTO dashboard = getDashboard(factoryId, plan.getPlanDate());

        // 添加实时排程详情
        List<LineSchedule> schedules = scheduleRepository.findByPlanIdOrderBySequenceOrder(planId);
        dashboard.setCurrentSchedules(schedules.stream()
            .map(this::enrichScheduleDTO)
            .collect(Collectors.toList()));

        return dashboard;
    }

    // ==================== 辅助方法 ====================

    private SchedulingPlanDTO enrichPlanDTO(SchedulingPlanDTO dto) {
        // 获取创建者名称
        if (dto.getCreatedBy() != null) {
            userRepository.findById(dto.getCreatedBy()).ifPresent(user ->
                dto.setCreatedByName(user.getFullName()));
        }
        if (dto.getConfirmedBy() != null) {
            userRepository.findById(dto.getConfirmedBy()).ifPresent(user ->
                dto.setConfirmedByName(user.getFullName()));
        }

        // 统计排程状态
        if (dto.getId() != null) {
            dto.setPendingSchedules((int) scheduleRepository.countByPlanIdAndStatus(
                dto.getId(), LineSchedule.ScheduleStatus.pending));
            dto.setInProgressSchedules((int) scheduleRepository.countByPlanIdAndStatus(
                dto.getId(), LineSchedule.ScheduleStatus.in_progress));
            dto.setCompletedSchedules((int) scheduleRepository.countByPlanIdAndStatus(
                dto.getId(), LineSchedule.ScheduleStatus.completed));
        }

        return dto;
    }

    private LineScheduleDTO enrichScheduleDTO(LineSchedule entity) {
        LineScheduleDTO dto = LineScheduleDTO.fromEntity(entity);

        // 获取产线名称
        lineRepository.findById(entity.getProductionLineId()).ifPresent(line ->
            dto.setProductionLineName(line.getName()));

        // 获取批次号
        if (entity.getBatchId() != null) {
            batchRepository.findById(entity.getBatchId()).ifPresent(batch ->
                dto.setBatchNumber(batch.getBatchNumber()));
        }

        // 获取工人分配
        List<WorkerAssignment> assignments = assignmentRepository.findByScheduleId(entity.getId());
        dto.setWorkerAssignments(assignments.stream()
            .map(this::enrichAssignmentDTO)
            .collect(Collectors.toList()));

        return dto;
    }

    private WorkerAssignmentDTO enrichAssignmentDTO(WorkerAssignment entity) {
        WorkerAssignmentDTO dto = WorkerAssignmentDTO.fromEntity(entity);

        // 获取用户信息
        userRepository.findById(entity.getUserId()).ifPresent(user -> {
            dto.setUserName(user.getFullName());
            dto.setUserPhone(user.getPhone());
        });

        // 获取排程信息
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
}
