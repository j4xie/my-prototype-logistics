package com.cretas.aims.service.workstation;

import com.cretas.aims.ai.client.DashScopeVisionClient;
import com.cretas.aims.ai.client.DashScopeVisionClient.CompletionGestureResult;
import com.cretas.aims.ai.client.DashScopeVisionClient.LabelRecognitionResult;
import com.cretas.aims.entity.BatchWorkSession;
import com.cretas.aims.entity.ProcessingStageRecord;
import com.cretas.aims.entity.enums.ProcessingStageType;
import com.cretas.aims.entity.iot.IotDeviceData;
import com.cretas.aims.repository.BatchWorkSessionRepository;
import com.cretas.aims.repository.ProcessingStageRecordRepository;
import com.cretas.aims.service.IotDataService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 工位计数服务
 *
 * 整合摄像头AI视觉识别 + 电子秤称重 + 自动计数功能。
 *
 * 核心场景:
 * 1. 工人在工位处理产品
 * 2. 摄像头检测完成手势/动作
 * 3. 触发电子秤读取当前重量
 * 4. 自动累加产品计数
 * 5. 记录单品重量数据
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkstationCountingService {

    private final DashScopeVisionClient visionClient;
    private final IotDataService iotDataService;
    private final ProcessingStageRecordRepository stageRecordRepository;
    private final BatchWorkSessionRepository workSessionRepository;
    private final ObjectMapper objectMapper;

    // 工位状态缓存 (workstationId -> WorkstationState)
    private final Map<String, WorkstationState> workstationStates = new ConcurrentHashMap<>();

    // ==================== 工位管理 ====================

    /**
     * 初始化/启动工位计数
     *
     * @param config 工位配置
     * @return 初始化结果
     */
    @Transactional
    public WorkstationInitResult initWorkstation(WorkstationConfig config) {
        // 如果未提供 workstationId，则自动生成
        String workstationId = config.getWorkstationId();
        if (workstationId == null || workstationId.trim().isEmpty()) {
            workstationId = UUID.randomUUID().toString();
            config.setWorkstationId(workstationId);
            log.info("自动生成工位ID: {}, workstationName={}", workstationId, config.getWorkstationName());
        }

        log.info("初始化工位计数: workstationId={}, workstationName={}, factoryId={}, batchId={}",
                workstationId, config.getWorkstationName(), config.getFactoryId(), config.getProductionBatchId());

        // 检查是否有活跃的工作会话
        Optional<BatchWorkSession> activeSession = findActiveWorkSession(
                config.getProductionBatchId(), config.getWorkerId());

        // 创建或获取加工环节记录
        ProcessingStageRecord stageRecord = getOrCreateStageRecord(config);

        // 初始化工位状态
        WorkstationState state = WorkstationState.builder()
                .workstationId(workstationId)
                .factoryId(config.getFactoryId())
                .productionBatchId(config.getProductionBatchId())
                .stageRecordId(stageRecord.getId())
                .workerId(config.getWorkerId())
                .workerName(config.getWorkerName())
                .cameraDeviceId(config.getCameraDeviceId())
                .scaleDeviceId(config.getScaleDeviceId())
                .startTime(LocalDateTime.now())
                .productCount(stageRecord.getPassCount() != null ? stageRecord.getPassCount() : 0)
                .totalWeight(BigDecimal.ZERO)
                .productWeights(new ArrayList<>())
                .status(WorkstationStatus.ACTIVE)
                .build();

        workstationStates.put(workstationId, state);

        return WorkstationInitResult.builder()
                .success(true)
                .workstationId(workstationId)
                .stageRecordId(stageRecord.getId())
                .initialCount(state.getProductCount())
                .message("工位初始化成功")
                .build();
    }

    /**
     * 停止工位计数
     *
     * @param workstationId 工位ID
     * @return 停止结果（含统计数据）
     */
    @Transactional
    public WorkstationStopResult stopWorkstation(String workstationId) {
        WorkstationState state = workstationStates.remove(workstationId);

        if (state == null) {
            return WorkstationStopResult.builder()
                    .success(false)
                    .workstationId(workstationId)
                    .message("工位未找到或未启动")
                    .build();
        }

        // 更新加工环节记录
        ProcessingStageRecord record = stageRecordRepository.findById(state.getStageRecordId())
                .orElse(null);

        if (record != null) {
            record.setEndTime(LocalDateTime.now());
            record.setPassCount(state.getProductCount());
            record.setOutputWeight(state.getTotalWeight());

            // 保存单品重量数据到 extraData
            if (!state.getProductWeights().isEmpty()) {
                try {
                    ObjectNode extraData = objectMapper.createObjectNode();
                    extraData.set("productWeights", objectMapper.valueToTree(state.getProductWeights()));
                    extraData.put("avgWeight", calculateAverageWeight(state.getProductWeights()));
                    record.setExtraData(objectMapper.writeValueAsString(extraData));
                } catch (Exception e) {
                    log.warn("保存单品重量数据失败: {}", e.getMessage());
                }
            }

            stageRecordRepository.save(record);
        }

        log.info("工位停止: workstationId={}, totalCount={}, totalWeight={}",
                workstationId, state.getProductCount(), state.getTotalWeight());

        return WorkstationStopResult.builder()
                .success(true)
                .workstationId(workstationId)
                .totalCount(state.getProductCount())
                .totalWeight(state.getTotalWeight())
                .productWeights(state.getProductWeights())
                .averageWeight(calculateAverageWeight(state.getProductWeights()))
                .duration(java.time.Duration.between(state.getStartTime(), LocalDateTime.now()).toMinutes())
                .message("工位停止成功")
                .build();
    }

    // ==================== 核心计数逻辑 ====================

    /**
     * 处理摄像头图像 - 检测完成手势并计数
     *
     * 工作流程:
     * 1. 分析图像识别完成手势
     * 2. 如果检测到完成动作，读取电子秤重量
     * 3. 累加计数和重量
     * 4. 返回处理结果
     *
     * @param workstationId 工位ID
     * @param imageBase64   摄像头图像 (Base64)
     * @return 处理结果
     */
    @Transactional
    public CountingResult processFrame(String workstationId, String imageBase64) {
        WorkstationState state = workstationStates.get(workstationId);

        if (state == null || state.getStatus() != WorkstationStatus.ACTIVE) {
            return CountingResult.builder()
                    .success(false)
                    .counted(false)
                    .message("工位未激活")
                    .build();
        }

        // 防抖: 检查距离上次计数的时间间隔
        if (state.getLastCountTime() != null) {
            long secondsSinceLastCount = java.time.Duration.between(
                    state.getLastCountTime(), LocalDateTime.now()).getSeconds();
            if (secondsSinceLastCount < 2) {  // 2秒防抖
                return CountingResult.builder()
                        .success(true)
                        .counted(false)
                        .message("防抖中，跳过")
                        .build();
            }
        }

        // 1. AI 分析完成手势
        Map<String, Object> context = new HashMap<>();
        context.put("workstationId", workstationId);
        context.put("workerId", state.getWorkerId());
        context.put("factoryId", state.getFactoryId());

        CompletionGestureResult gestureResult = visionClient.analyzeCompletionGesture(imageBase64, context);

        if (!gestureResult.isSuccess()) {
            return CountingResult.builder()
                    .success(false)
                    .counted(false)
                    .message("手势识别失败: " + gestureResult.getMessage())
                    .build();
        }

        // 2. 判断是否完成
        if (!gestureResult.canConfirmCompletion()) {
            return CountingResult.builder()
                    .success(true)
                    .counted(false)
                    .gestureDetected(gestureResult.getGestureType())
                    .confidence(gestureResult.getConfidence())
                    .message("未检测到完成动作")
                    .build();
        }

        // 3. 读取电子秤重量
        BigDecimal weight = readScaleWeight(state.getScaleDeviceId(), state.getFactoryId());

        // 4. 累加计数
        state.setProductCount(state.getProductCount() + 1);
        state.setTotalWeight(state.getTotalWeight().add(weight));
        state.getProductWeights().add(new ProductWeight(
                state.getProductCount(),
                weight,
                LocalDateTime.now()
        ));
        state.setLastCountTime(LocalDateTime.now());

        // 5. 更新数据库记录
        updateStageRecordCount(state.getStageRecordId(), state.getProductCount(), state.getTotalWeight());

        log.info("产品计数成功: workstationId={}, count={}, weight={}, total={}",
                workstationId, state.getProductCount(), weight, state.getTotalWeight());

        return CountingResult.builder()
                .success(true)
                .counted(true)
                .currentCount(state.getProductCount())
                .productWeight(weight)
                .totalWeight(state.getTotalWeight())
                .gestureDetected(gestureResult.getGestureType())
                .confidence(gestureResult.getConfidence())
                .message("计数成功")
                .build();
    }

    /**
     * 手动计数 (不依赖摄像头)
     *
     * @param workstationId 工位ID
     * @param manualWeight  可选的手动输入重量 (为null时从电子秤读取)
     * @return 计数结果
     */
    @Transactional
    public CountingResult manualCount(String workstationId, BigDecimal manualWeight) {
        WorkstationState state = workstationStates.get(workstationId);

        if (state == null || state.getStatus() != WorkstationStatus.ACTIVE) {
            return CountingResult.builder()
                    .success(false)
                    .counted(false)
                    .message("工位未激活")
                    .build();
        }

        // 如果提供了手动重量则使用，否则从电子秤读取
        BigDecimal weight = manualWeight != null ? manualWeight :
                readScaleWeight(state.getScaleDeviceId(), state.getFactoryId());

        // 累加计数
        state.setProductCount(state.getProductCount() + 1);
        state.setTotalWeight(state.getTotalWeight().add(weight));
        state.getProductWeights().add(new ProductWeight(
                state.getProductCount(),
                weight,
                LocalDateTime.now()
        ));
        state.setLastCountTime(LocalDateTime.now());

        // 更新数据库
        updateStageRecordCount(state.getStageRecordId(), state.getProductCount(), state.getTotalWeight());

        return CountingResult.builder()
                .success(true)
                .counted(true)
                .currentCount(state.getProductCount())
                .productWeight(weight)
                .totalWeight(state.getTotalWeight())
                .message("手动计数成功")
                .build();
    }

    // ==================== 标签验证 ====================

    /**
     * 验证产品标签
     *
     * @param workstationId   工位ID
     * @param labelImageBase64 标签图像 (Base64)
     * @return 验证结果
     */
    public LabelVerifyResult verifyLabel(String workstationId, String labelImageBase64) {
        WorkstationState state = workstationStates.get(workstationId);

        if (state == null) {
            return LabelVerifyResult.builder()
                    .success(false)
                    .message("工位未找到")
                    .build();
        }

        // 获取期望的批次号
        String expectedBatchId = state.getProductionBatchId().toString();

        Map<String, Object> context = new HashMap<>();
        context.put("workstationId", workstationId);
        context.put("factoryId", state.getFactoryId());

        LabelRecognitionResult result = visionClient.recognizeLabel(
                labelImageBase64, expectedBatchId, context);

        if (!result.isSuccess()) {
            return LabelVerifyResult.builder()
                    .success(false)
                    .message("标签识别失败: " + result.getMessage())
                    .build();
        }

        boolean batchMatch = Boolean.TRUE.equals(result.getBatchMatch());
        boolean qualityOk = "GOOD".equals(result.getPrintQuality()) ||
                           "ACCEPTABLE".equals(result.getPrintQuality());

        // 判断是否需要告警
        boolean needAlert = result.requiresAlert();
        if (needAlert) {
            // 创建告警
            String alertMsg = buildLabelAlertMessage(result);
            iotDataService.createDeviceAlert(
                    state.getFactoryId(),
                    state.getCameraDeviceId(),
                    "LABEL_ALERT",
                    alertMsg
            );
        }

        return LabelVerifyResult.builder()
                .success(true)
                .readable(result.isReadable())
                .batchMatch(batchMatch)
                .qualityOk(qualityOk)
                .recognizedBatchNumber(result.getRecognizedBatchNumber())
                .expectedBatchNumber(expectedBatchId)
                .printQuality(result.getPrintQuality())
                .productName(result.getProductName())
                .barcode(result.getBarcode())
                .overallScore(result.getOverallScore())
                .recommendation(result.getRecommendation())
                .qualityIssues(result.getQualityIssues())
                .needAlert(needAlert)
                .message(batchMatch && qualityOk ? "标签验证通过" : "标签验证异常")
                .build();
    }

    // ==================== 状态查询 ====================

    /**
     * 获取工位当前状态
     *
     * @param workstationId 工位ID
     * @return 工位状态
     */
    public WorkstationStatusInfo getWorkstationStatus(String workstationId) {
        WorkstationState state = workstationStates.get(workstationId);

        if (state == null) {
            return WorkstationStatusInfo.builder()
                    .workstationId(workstationId)
                    .status(WorkstationStatus.INACTIVE)
                    .message("工位未启动")
                    .build();
        }

        return WorkstationStatusInfo.builder()
                .workstationId(workstationId)
                .factoryId(state.getFactoryId())
                .productionBatchId(state.getProductionBatchId())
                .workerId(state.getWorkerId())
                .workerName(state.getWorkerName())
                .status(state.getStatus())
                .productCount(state.getProductCount())
                .totalWeight(state.getTotalWeight())
                .averageWeight(calculateAverageWeight(state.getProductWeights()))
                .startTime(state.getStartTime())
                .lastCountTime(state.getLastCountTime())
                .message("正常运行")
                .build();
    }

    /**
     * 获取所有活跃工位
     *
     * @param factoryId 工厂ID
     * @return 活跃工位列表
     */
    public List<WorkstationStatusInfo> getActiveWorkstations(String factoryId) {
        List<WorkstationStatusInfo> result = new ArrayList<>();

        for (WorkstationState state : workstationStates.values()) {
            if (factoryId == null || factoryId.equals(state.getFactoryId())) {
                result.add(getWorkstationStatus(state.getWorkstationId()));
            }
        }

        return result;
    }

    // ==================== 辅助方法 ====================

    private ProcessingStageRecord getOrCreateStageRecord(WorkstationConfig config) {
        // 查找现有的加工环节记录
        Optional<ProcessingStageRecord> existing = stageRecordRepository
                .findTopByProductionBatchIdAndStageTypeOrderByStartTimeDesc(
                        config.getProductionBatchId(),
                        config.getStageType() != null ? config.getStageType() : ProcessingStageType.TRIMMING
                );

        if (existing.isPresent()) {
            return existing.get();
        }

        // 创建新记录
        ProcessingStageRecord record = ProcessingStageRecord.builder()
                .factoryId(config.getFactoryId())
                .productionBatchId(config.getProductionBatchId())
                .stageType(config.getStageType() != null ? config.getStageType() : ProcessingStageType.TRIMMING)
                .stageName(config.getStageName())
                .startTime(LocalDateTime.now())
                .operatorId(config.getWorkerId())
                .operatorName(config.getWorkerName())
                .equipmentId(config.getEquipmentId())
                .passCount(0)
                .failCount(0)
                .inputWeight(BigDecimal.ZERO)
                .outputWeight(BigDecimal.ZERO)
                .build();

        return stageRecordRepository.save(record);
    }

    private Optional<BatchWorkSession> findActiveWorkSession(Long batchId, Long workerId) {
        if (batchId == null || workerId == null) {
            return Optional.empty();
        }

        return workSessionRepository.findActiveByBatchIdAndEmployeeId(batchId, workerId);
    }

    private BigDecimal readScaleWeight(String scaleDeviceId, String factoryId) {
        if (scaleDeviceId == null) {
            return BigDecimal.ZERO;
        }

        try {
            // 获取电子秤最近的称重数据
            List<IotDeviceData> recentData = iotDataService.getRecentData(factoryId, scaleDeviceId, 1);

            if (recentData != null && !recentData.isEmpty()) {
                IotDeviceData data = recentData.get(0);
                String dataValue = data.getDataValue();

                if (dataValue != null && !dataValue.isEmpty()) {
                    JsonNode payload = objectMapper.readTree(dataValue);
                    if (payload.has("weight")) {
                        return BigDecimal.valueOf(payload.get("weight").asDouble());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("读取电子秤重量失败: deviceId={}, error={}", scaleDeviceId, e.getMessage());
        }

        return BigDecimal.ZERO;
    }

    private void updateStageRecordCount(Long stageRecordId, int count, BigDecimal totalWeight) {
        stageRecordRepository.findById(stageRecordId).ifPresent(record -> {
            record.setPassCount(count);
            record.setOutputWeight(totalWeight);
            stageRecordRepository.save(record);
        });
    }

    private BigDecimal calculateAverageWeight(List<ProductWeight> weights) {
        if (weights == null || weights.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal sum = weights.stream()
                .map(ProductWeight::getWeight)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return sum.divide(BigDecimal.valueOf(weights.size()), 3, java.math.RoundingMode.HALF_UP);
    }

    private String buildLabelAlertMessage(LabelRecognitionResult result) {
        StringBuilder sb = new StringBuilder();
        sb.append("标签异常告警: ");

        if (!Boolean.TRUE.equals(result.getBatchMatch())) {
            sb.append("批次号不匹配(识别:").append(result.getRecognizedBatchNumber())
              .append(",期望:").append(result.getExpectedBatchNumber()).append("); ");
        }

        if ("POOR".equals(result.getPrintQuality()) || "UNREADABLE".equals(result.getPrintQuality())) {
            sb.append("打印质量差(").append(result.getPrintQuality()).append("); ");
        }

        if (result.getQualityIssues() != null && !result.getQualityIssues().isEmpty()) {
            sb.append("问题:").append(String.join(",", result.getQualityIssues()));
        }

        return sb.toString();
    }

    // ==================== 内部数据类 ====================

    /**
     * 工位状态
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    private static class WorkstationState {
        private String workstationId;
        private String factoryId;
        private Long productionBatchId;
        private Long stageRecordId;
        private Long workerId;
        private String workerName;
        private String cameraDeviceId;
        private String scaleDeviceId;
        private LocalDateTime startTime;
        private LocalDateTime lastCountTime;
        private int productCount;
        private BigDecimal totalWeight;
        private List<ProductWeight> productWeights;
        private WorkstationStatus status;
    }

    // ==================== 公开数据类 ====================

    /**
     * 工位状态枚举
     */
    public enum WorkstationStatus {
        INACTIVE,   // 未启动
        ACTIVE,     // 运行中
        PAUSED,     // 暂停
        STOPPED     // 已停止
    }

    /**
     * 工位配置
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkstationConfig {
        private String workstationId;
        private String workstationName;  // 工位名称，若未提供 workstationId 则用于生成
        private String factoryId;

        @com.fasterxml.jackson.annotation.JsonAlias({"processingBatchId", "batchId"})
        private Long productionBatchId;

        private Long workerId;
        private String workerName;
        private String cameraDeviceId;
        private String scaleDeviceId;
        private Long equipmentId;

        @com.fasterxml.jackson.annotation.JsonAlias({"stageId"})
        private ProcessingStageType stageType;

        private String stageName;
    }

    /**
     * 工位初始化结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkstationInitResult {
        private boolean success;
        private String workstationId;
        private Long stageRecordId;
        private int initialCount;
        private String message;
    }

    /**
     * 工位停止结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkstationStopResult {
        private boolean success;
        private String workstationId;
        private int totalCount;
        private BigDecimal totalWeight;
        private List<ProductWeight> productWeights;
        private BigDecimal averageWeight;
        private long duration;  // 分钟
        private String message;
    }

    /**
     * 计数结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CountingResult {
        private boolean success;
        private boolean counted;
        private int currentCount;
        private BigDecimal productWeight;
        private BigDecimal totalWeight;
        private String gestureDetected;
        private double confidence;
        private String message;
    }

    /**
     * 标签验证结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LabelVerifyResult {
        private boolean success;
        private boolean readable;
        private boolean batchMatch;
        private boolean qualityOk;
        private String recognizedBatchNumber;
        private String expectedBatchNumber;
        private String printQuality;
        private String productName;
        private String barcode;
        private int overallScore;
        private String recommendation;
        private List<String> qualityIssues;
        private boolean needAlert;
        private String message;
    }

    /**
     * 工位状态信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkstationStatusInfo {
        private String workstationId;
        private String factoryId;
        private Long productionBatchId;
        private Long workerId;
        private String workerName;
        private WorkstationStatus status;
        private int productCount;
        private BigDecimal totalWeight;
        private BigDecimal averageWeight;
        private LocalDateTime startTime;
        private LocalDateTime lastCountTime;
        private String message;
    }

    /**
     * 单品重量记录
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProductWeight {
        private int sequence;
        private BigDecimal weight;
        private LocalDateTime timestamp;
    }
}
