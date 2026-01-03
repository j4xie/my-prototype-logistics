package com.cretas.aims.scheduler;

import com.cretas.aims.entity.DecisionAuditLog;
import com.cretas.aims.entity.DecisionAuditLog.ApprovalStatus;
import com.cretas.aims.entity.config.ApprovalChainConfig;
import com.cretas.aims.repository.DecisionAuditLogRepository;
import com.cretas.aims.repository.config.ApprovalChainConfigRepository;
import com.cretas.aims.service.PushNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * 审批超时处理调度器
 * 定期检查超时的审批申请并执行升级或通知
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ApprovalTimeoutScheduler {

    private final ApprovalChainConfigRepository approvalConfigRepository;
    private final DecisionAuditLogRepository auditLogRepository;
    private final PushNotificationService pushNotificationService;

    /**
     * 已发送超时通知的审批ID缓存
     * Key: approvalId, Value: 最后通知时间戳
     */
    private final Map<String, Long> notifiedApprovals = new HashMap<>();

    /**
     * 通知冷却时间（毫秒）- 同一审批在此时间内不会重复发送通知
     */
    private static final long NOTIFICATION_COOLDOWN_MS = 15 * 60 * 1000; // 15分钟

    /**
     * 每5分钟检查超时的审批申请
     */
    @Scheduled(fixedRate = 300000)
    @Transactional
    public void checkApprovalTimeouts() {
        log.debug("开始检查审批超时...");

        try {
            // 清理过期的通知缓存
            cleanExpiredNotifications();

            // 获取所有工厂的待审批记录
            checkAllPendingApprovals();

        } catch (Exception e) {
            log.error("审批超时检查失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 检查所有工厂的待审批记录
     */
    private void checkAllPendingApprovals() {
        // 获取所有启用的审批链配置
        List<ApprovalChainConfig> allConfigs = approvalConfigRepository.findAll();

        // 按工厂ID分组
        Map<String, List<ApprovalChainConfig>> configsByFactory = new HashMap<>();
        for (ApprovalChainConfig config : allConfigs) {
            if (Boolean.TRUE.equals(config.getEnabled())) {
                configsByFactory.computeIfAbsent(config.getFactoryId(), k -> new ArrayList<>())
                        .add(config);
            }
        }

        // 逐工厂处理
        for (Map.Entry<String, List<ApprovalChainConfig>> entry : configsByFactory.entrySet()) {
            String factoryId = entry.getKey();
            List<ApprovalChainConfig> configs = entry.getValue();

            checkFactoryApprovals(factoryId, configs);
        }
    }

    /**
     * 检查单个工厂的待审批记录
     */
    private void checkFactoryApprovals(String factoryId, List<ApprovalChainConfig> configs) {
        // 查询该工厂所有待审批的记录
        Page<DecisionAuditLog> pendingPage = auditLogRepository.findPendingApprovals(
                factoryId, PageRequest.of(0, 100));

        List<DecisionAuditLog> pendingApprovals = pendingPage.getContent();

        log.debug("工厂 {} 有 {} 条待审批记录", factoryId, pendingApprovals.size());

        // 构建决策类型到配置的映射
        Map<ApprovalChainConfig.DecisionType, ApprovalChainConfig> configMap = new HashMap<>();
        for (ApprovalChainConfig config : configs) {
            if (config.getTimeoutMinutes() != null && config.getTimeoutMinutes() > 0) {
                // 取最低级别的配置（可能有多个级别）
                ApprovalChainConfig existing = configMap.get(config.getDecisionType());
                if (existing == null || config.getApprovalLevel() < existing.getApprovalLevel()) {
                    configMap.put(config.getDecisionType(), config);
                }
            }
        }

        // 检查每条待审批记录
        for (DecisionAuditLog approval : pendingApprovals) {
            checkSingleApproval(approval, configMap, configs);
        }
    }

    /**
     * 检查单条审批记录是否超时
     */
    private void checkSingleApproval(DecisionAuditLog approval,
                                      Map<ApprovalChainConfig.DecisionType, ApprovalChainConfig> configMap,
                                      List<ApprovalChainConfig> allConfigs) {
        if (approval.getCreatedAt() == null) {
            return;
        }

        // 尝试匹配决策类型
        ApprovalChainConfig.DecisionType decisionType = mapToChainDecisionType(approval.getDecisionType());
        if (decisionType == null) {
            return;
        }

        ApprovalChainConfig config = configMap.get(decisionType);
        if (config == null || config.getTimeoutMinutes() == null) {
            return;
        }

        // 计算等待时间
        long waitingMinutes = ChronoUnit.MINUTES.between(approval.getCreatedAt(), LocalDateTime.now());

        if (waitingMinutes >= config.getTimeoutMinutes()) {
            // 已超时，执行处理
            handleTimeout(approval, config, waitingMinutes, allConfigs);
        } else if (waitingMinutes >= config.getTimeoutMinutes() * 0.8) {
            // 接近超时（80%），发送预警
            sendTimeoutWarning(approval, config, waitingMinutes);
        }
    }

    /**
     * 映射审计日志决策类型到审批链决策类型
     */
    private ApprovalChainConfig.DecisionType mapToChainDecisionType(DecisionAuditLog.DecisionType logType) {
        if (logType == null) {
            return null;
        }

        switch (logType) {
            case FORCE_INSERT:
                return ApprovalChainConfig.DecisionType.FORCE_INSERT;
            case APPROVAL:
            case RULE_EXECUTION:
                return ApprovalChainConfig.DecisionType.QUALITY_RELEASE;
            default:
                return null;
        }
    }

    /**
     * 处理审批超时
     */
    private void handleTimeout(DecisionAuditLog approval, ApprovalChainConfig config,
                               long waitingMinutes, List<ApprovalChainConfig> allConfigs) {
        log.info("审批超时: approvalId={}, 等待时间={}分钟, 超时配置={}分钟",
                approval.getId(), waitingMinutes, config.getTimeoutMinutes());

        // 检查是否有升级配置
        if (config.getEscalationConfigId() != null && !config.getEscalationConfigId().isEmpty()) {
            // 执行升级逻辑
            handleEscalation(approval, config, allConfigs);
        } else {
            // 无升级配置，发送超时通知
            sendTimeoutNotification(approval, config, waitingMinutes);
        }
    }

    /**
     * 处理审批升级
     */
    private void handleEscalation(DecisionAuditLog approval, ApprovalChainConfig currentConfig,
                                  List<ApprovalChainConfig> allConfigs) {
        // 查找升级配置
        Optional<ApprovalChainConfig> escalationConfig = allConfigs.stream()
                .filter(c -> c.getId().equals(currentConfig.getEscalationConfigId()))
                .findFirst();

        if (escalationConfig.isPresent()) {
            ApprovalChainConfig nextLevel = escalationConfig.get();
            log.info("审批升级: approvalId={}, 从级别 {} 升级到 {}",
                    approval.getId(), currentConfig.getApprovalLevel(), nextLevel.getApprovalLevel());

            // 发送升级通知
            sendEscalationNotification(approval, currentConfig, nextLevel);
        } else {
            log.warn("未找到升级配置: escalationConfigId={}", currentConfig.getEscalationConfigId());
            sendTimeoutNotification(approval, currentConfig, 0);
        }
    }

    /**
     * 发送超时预警通知
     */
    private void sendTimeoutWarning(DecisionAuditLog approval, ApprovalChainConfig config, long waitingMinutes) {
        String notificationKey = approval.getId() + "_warning";
        if (isInNotificationCooldown(notificationKey)) {
            return;
        }

        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "approval_timeout_warning");
            pushData.put("approvalId", approval.getId());
            pushData.put("decisionType", approval.getDecisionType());
            pushData.put("entityType", approval.getEntityType());
            pushData.put("entityId", approval.getEntityId());
            pushData.put("waitingMinutes", waitingMinutes);
            pushData.put("timeoutMinutes", config.getTimeoutMinutes());
            pushData.put("screen", "ApprovalDetail");

            long remainingMinutes = config.getTimeoutMinutes() - waitingMinutes;

            pushNotificationService.sendToFactory(
                    config.getFactoryId(),
                    "审批即将超时",
                    String.format("审批申请即将在 %d 分钟后超时，请及时处理", remainingMinutes),
                    pushData
            );

            recordNotification(notificationKey);
            log.info("已发送审批超时预警: approvalId={}, 剩余时间={}分钟", approval.getId(), remainingMinutes);

        } catch (Exception e) {
            log.warn("发送审批超时预警失败: approvalId={}, error={}", approval.getId(), e.getMessage());
        }
    }

    /**
     * 发送审批超时通知
     */
    private void sendTimeoutNotification(DecisionAuditLog approval, ApprovalChainConfig config, long waitingMinutes) {
        String notificationKey = approval.getId() + "_timeout";
        if (isInNotificationCooldown(notificationKey)) {
            return;
        }

        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "approval_timeout");
            pushData.put("approvalId", approval.getId());
            pushData.put("decisionType", approval.getDecisionType());
            pushData.put("entityType", approval.getEntityType());
            pushData.put("entityId", approval.getEntityId());
            pushData.put("waitingMinutes", waitingMinutes);
            pushData.put("screen", "ApprovalDetail");

            pushNotificationService.sendToFactory(
                    config.getFactoryId(),
                    "审批超时提醒",
                    String.format("审批申请已超时 %d 分钟，请及时处理", waitingMinutes - config.getTimeoutMinutes()),
                    pushData
            );

            recordNotification(notificationKey);
            log.info("已发送审批超时通知: approvalId={}", approval.getId());

        } catch (Exception e) {
            log.warn("发送审批超时通知失败: approvalId={}, error={}", approval.getId(), e.getMessage());
        }
    }

    /**
     * 发送审批升级通知
     */
    private void sendEscalationNotification(DecisionAuditLog approval,
                                            ApprovalChainConfig fromConfig,
                                            ApprovalChainConfig toConfig) {
        String notificationKey = approval.getId() + "_escalation_" + toConfig.getApprovalLevel();
        if (isInNotificationCooldown(notificationKey)) {
            return;
        }

        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "approval_escalation");
            pushData.put("approvalId", approval.getId());
            pushData.put("decisionType", approval.getDecisionType());
            pushData.put("entityType", approval.getEntityType());
            pushData.put("entityId", approval.getEntityId());
            pushData.put("fromLevel", fromConfig.getApprovalLevel());
            pushData.put("toLevel", toConfig.getApprovalLevel());
            pushData.put("screen", "ApprovalDetail");

            pushNotificationService.sendToFactory(
                    toConfig.getFactoryId(),
                    "审批升级通知",
                    String.format("审批申请已升级至%d级审批，请及时处理", toConfig.getApprovalLevel()),
                    pushData
            );

            recordNotification(notificationKey);
            log.info("已发送审批升级通知: approvalId={}, toLevel={}", approval.getId(), toConfig.getApprovalLevel());

        } catch (Exception e) {
            log.warn("发送审批升级通知失败: approvalId={}, error={}", approval.getId(), e.getMessage());
        }
    }

    /**
     * 检查是否在通知冷却期内
     */
    private boolean isInNotificationCooldown(String key) {
        Long lastTime = notifiedApprovals.get(key);
        return lastTime != null && System.currentTimeMillis() - lastTime < NOTIFICATION_COOLDOWN_MS;
    }

    /**
     * 记录通知发送时间
     */
    private void recordNotification(String key) {
        notifiedApprovals.put(key, System.currentTimeMillis());
    }

    /**
     * 清理过期的通知缓存
     */
    private void cleanExpiredNotifications() {
        long now = System.currentTimeMillis();
        notifiedApprovals.entrySet().removeIf(entry ->
                now - entry.getValue() > NOTIFICATION_COOLDOWN_MS * 4); // 1小时后清理
    }

    /**
     * 获取调度器状态
     */
    public Map<String, Object> getSchedulerStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("notificationCacheSize", notifiedApprovals.size());
        status.put("cooldownMinutes", NOTIFICATION_COOLDOWN_MS / 60000);
        return status;
    }

    /**
     * 手动触发检查（用于测试）
     */
    public void manualCheck() {
        checkApprovalTimeouts();
    }
}
