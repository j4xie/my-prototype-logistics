package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.entity.config.ApprovalChainConfig.DecisionType;
import com.cretas.aims.entity.config.ApprovalWorkflow;
import com.cretas.aims.entity.config.ApprovalWorkflowEdge;
import com.cretas.aims.entity.config.ApprovalWorkflowNode;
import com.cretas.aims.entity.workflow.ApprovalHistory;
import com.cretas.aims.entity.workflow.ApprovalHistory.HistoryAction;
import com.cretas.aims.entity.workflow.ApprovalWorkflowInstance;
import com.cretas.aims.entity.workflow.ApprovalWorkflowInstance.InstanceStatus;
import com.cretas.aims.repository.workflow.ApprovalHistoryRepository;
import com.cretas.aims.repository.workflow.ApprovalWorkflowInstanceRepository;
import com.cretas.aims.service.ApprovalWorkflowService;
import com.cretas.aims.service.workflow.SandboxedSpelEvaluator;
import com.cretas.aims.service.workflow.SandboxedSpelEvaluator.SpelEvaluationFailure;
import com.cretas.aims.service.workflow.WorkflowEngineService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Workflow engine 实现 — Phase 1 B.3 skeleton.
 *
 * <p><b>已实现</b>:
 * <ul>
 *   <li>{@link #startWorkflow} — 创建 instance + 写 PG + Redis + START history.
 *       Walk 简化: 沿 priority-asc outgoing 走到第一个 approval/end 节点
 *       (B.4 会完整实现 condition/parallel 分支评估)</li>
 *   <li>{@link #evaluateCondition} — {@link SandboxedSpelEvaluator} 封装</li>
 *   <li>{@link #rebuildRedisFromPg} — {@code @EventListener(ApplicationReadyEvent)} 恢复 RUNNING 实例到 Redis</li>
 *   <li>{@link #getCurrentInstance / @link #getHistory} — 直接 repo 调用</li>
 * </ul>
 *
 * <p><b>待 B.4 完成</b>:
 * <ul>
 *   <li>{@link #transitionNode} — 完整 DAG advance (condition / parallel / join)</li>
 *   <li>{@link #cancel} — set CANCELLED + history</li>
 * </ul>
 *
 * <p><b>Redis 策略</b>: {@code RedisTemplate<String, Object>} ({@code redisObjectTemplate}
 * bean in CacheConfig) 配置 GenericJackson2JsonRedisSerializer, 可直接序列化
 * {@link ApprovalWorkflowInstance}. Redis fail-open: 操作失败仅 log warning,
 * PG 是 source of truth.
 *
 * @since 2026-05-18
 */
@Service
@Slf4j
public class WorkflowEngineServiceImpl implements WorkflowEngineService {

    /** Redis key 前缀 — {@code aw:instance:{instanceId}}. */
    private static final String REDIS_KEY_PREFIX = "aw:instance:";

    /** Redis TTL — 终态后 24h 自动清理 (PG 保留作历史). */
    private static final Duration REDIS_RUNNING_TTL = Duration.ofDays(7);

    private final ApprovalWorkflowInstanceRepository instanceRepository;
    private final ApprovalHistoryRepository historyRepository;
    private final ApprovalWorkflowService workflowService;
    private final SandboxedSpelEvaluator spelEvaluator;

    /**
     * Optional Redis — 当 RedisAutoConfiguration excluded (e.g. local pg profile)
     * 时为 NULL. 所有 Redis 操作 null-guard, fail-open.
     */
    private final RedisTemplate<String, Object> redisTemplate;

    @Autowired
    public WorkflowEngineServiceImpl(
            ApprovalWorkflowInstanceRepository instanceRepository,
            ApprovalHistoryRepository historyRepository,
            ApprovalWorkflowService workflowService,
            SandboxedSpelEvaluator spelEvaluator,
            @org.springframework.beans.factory.annotation.Autowired(required = false)
            RedisTemplate<String, Object> redisTemplate) {
        this.instanceRepository = instanceRepository;
        this.historyRepository = historyRepository;
        this.workflowService = workflowService;
        this.spelEvaluator = spelEvaluator;
        this.redisTemplate = redisTemplate;
    }

    // ==================== Public API ====================

    @Override
    @Transactional
    public ApprovalWorkflowInstance startWorkflow(String factoryId,
                                                  String moduleCode,
                                                  String businessEntityId,
                                                  Map<String, Object> contextJson,
                                                  Long initiatorUserId) {
        Objects.requireNonNull(factoryId, "factoryId must not be null");
        Objects.requireNonNull(moduleCode, "moduleCode must not be null");
        Objects.requireNonNull(businessEntityId, "businessEntityId must not be null");

        // 1. moduleCode → DecisionType
        DecisionType decisionType = mapModuleCodeToDecisionType(moduleCode);

        // 2. 取 active workflow
        ApprovalWorkflow workflow = workflowService
                .getActiveByDecisionType(factoryId, decisionType)
                .orElseThrow(() -> new IllegalArgumentException(String.format(
                        "无 active 审批工作流 — factoryId=%s, moduleCode=%s, decisionType=%s. " +
                        "请在 Canvas 审批 Tab 中创建并发布 workflow.",
                        factoryId, moduleCode, decisionType)));

        // 3. 解析 graph (B.4 完整 walk 用)
        List<ApprovalWorkflowNode> nodes = workflowService.deserializeNodes(workflow.getNodesJson());
        List<ApprovalWorkflowEdge> edges = workflowService.deserializeEdges(workflow.getEdgesJson());

        // 4. 创建实例 — UUID id
        String instanceId = UUID.randomUUID().toString();
        Map<String, Object> safeContext = contextJson == null
                ? new HashMap<>()
                : new HashMap<>(contextJson);

        ApprovalWorkflowInstance instance = ApprovalWorkflowInstance.builder()
                .id(instanceId)
                .factoryId(factoryId)
                .workflowId(workflow.getId())
                .moduleCode(moduleCode)
                .businessEntityId(businessEntityId)
                .status(InstanceStatus.RUNNING)
                .currentNodeIds(new ArrayList<>())
                .contextJson(safeContext)
                .initiatedBy(initiatorUserId)
                .initiatedAt(LocalDateTime.now())
                .build();

        // 5. Walk: 从 startNode 沿 priority-asc 走到第一个 approval/end 节点.
        //    B.3 skeleton — 不评估 condition (B.4 完整实现). 仅取首个 outgoing edge.
        String firstActiveNodeId = walkToFirstHumanNode(workflow.getStartNodeId(), nodes, edges);
        if (firstActiveNodeId != null) {
            instance.getCurrentNodeIds().add(firstActiveNodeId);
        }

        // 6. 持久化 PG
        ApprovalWorkflowInstance saved = instanceRepository.save(instance);

        // 7. 写入 Redis (fail-open)
        writeRedis(saved);

        // 8. 写 START history
        writeHistory(saved.getFactoryId(), saved.getId(),
                workflow.getStartNodeId() == null ? "start" : workflow.getStartNodeId(),
                HistoryAction.START, null, null,
                "workflow 启动 — businessEntityId=" + businessEntityId, null);

        log.info("启动 workflow 实例 - instanceId={}, factoryId={}, moduleCode={}, " +
                        "businessEntityId={}, workflowId={}, firstActive={}",
                saved.getId(), factoryId, moduleCode, businessEntityId,
                workflow.getId(), firstActiveNodeId);

        return saved;
    }

    @Override
    @Transactional
    public ApprovalWorkflowInstance transitionNode(String instanceId,
                                                   Long actorId,
                                                   String actorRole,
                                                   HistoryAction action,
                                                   String notes) {
        // B.4: 完整 DAG advance — evaluate outgoing condition, 走 first true,
        // 处理 parallel fan-out / join arrival counting / approval submission /
        // requiredApprovers 累积 / rejection rollback / timeout escalation.
        throw new UnsupportedOperationException(
                "transitionNode 待 Phase 1 B.4 实现 (DAG advance 引擎). " +
                "当前 B.3 仅完成持久化层骨架.");
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ApprovalWorkflowInstance> getCurrentInstance(String factoryId,
                                                                 String moduleCode,
                                                                 String businessEntityId) {
        return instanceRepository.findByFactoryIdAndModuleCodeAndBusinessEntityId(
                factoryId, moduleCode, businessEntityId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ApprovalHistory> getHistory(String factoryId, String instanceId) {
        return historyRepository.findByFactoryIdAndInstanceIdOrderByCreatedAtAsc(
                factoryId, instanceId);
    }

    @Override
    public boolean evaluateCondition(String spelExpression, Map<String, Object> context) {
        if (spelExpression == null || spelExpression.isBlank()) {
            // 空 condition = 总是走 (per ApprovalWorkflowEdge javadoc).
            return true;
        }
        try {
            // SpEL #context.xxx — variables map 单 key 'context' 绑定整 map.
            Map<String, Object> variables = new HashMap<>();
            variables.put("context", context == null ? Map.of() : context);
            return spelEvaluator.evaluateBoolean(spelExpression, variables);
        } catch (SpelEvaluationFailure e) {
            log.warn("SpEL 评估失败, 视为 false - spel={}, error={}",
                    spelExpression, e.getMessage());
            return false;
        }
    }

    @Override
    @Transactional
    public ApprovalWorkflowInstance cancel(String instanceId,
                                           Long cancellerUserId,
                                           String reason) {
        // B.4: 完整 cancel 流程 — load instance, status check (must be RUNNING),
        // set CANCELLED + completedAt, evict Redis, write CANCEL history.
        throw new UnsupportedOperationException(
                "cancel 待 Phase 1 B.4 实现. 当前 B.3 仅完成持久化层骨架.");
    }

    /**
     * 启动 hook — 从 PG 拉所有 RUNNING 实例重建 Redis state.
     *
     * <p>{@code ApplicationReadyEvent} = Spring context 完全启动后触发, repository
     * 已 ready. Redis 不可用时 (null) 静默跳过.
     */
    @Override
    @EventListener(ApplicationReadyEvent.class)
    public void rebuildRedisFromPg() {
        if (redisTemplate == null) {
            log.info("Redis 未配置, 跳过 workflow 实例重建");
            return;
        }

        try {
            List<ApprovalWorkflowInstance> runningInstances =
                    instanceRepository.findByStatus(InstanceStatus.RUNNING);

            int restored = 0;
            for (ApprovalWorkflowInstance instance : runningInstances) {
                try {
                    writeRedis(instance);
                    restored++;
                } catch (Exception inner) {
                    log.warn("重建单个实例失败 (跳过) - instanceId={}, error={}",
                            instance.getId(), inner.getMessage());
                }
            }
            log.info("启动重建 Redis workflow 实例 - 总数={}, 成功={}",
                    runningInstances.size(), restored);
        } catch (Exception e) {
            // Fail-open — 重建失败不阻塞 Spring 启动.
            log.error("Redis workflow 实例重建失败, 业务降级到 PG 直读 - error={}",
                    e.getMessage(), e);
        }
    }

    // ==================== Internal helpers ====================

    /**
     * moduleCode → DecisionType 映射.
     *
     * <p>Phase 1: PURCHASE_ORDER / SALES_ORDER. Phase B+ 扩展时直接加 case.
     */
    private DecisionType mapModuleCodeToDecisionType(String moduleCode) {
        switch (moduleCode) {
            case "PURCHASE_ORDER":
                return DecisionType.PURCHASE_ORDER_APPROVAL;
            case "SALES_ORDER":
                return DecisionType.SALES_ORDER_APPROVAL;
            default:
                throw new IllegalArgumentException(
                        "未支持的 moduleCode: " + moduleCode +
                        " (Phase 1 仅 PURCHASE_ORDER / SALES_ORDER)");
        }
    }

    /**
     * B.3 简化 walk — 从 startNodeId 沿 priority-asc 首个 outgoing 走到
     * 第一个 approval/end 节点. 不评估 condition (B.4 完整实现).
     *
     * <p>遇 condition/parallel/notify 时, 仅取首个 outgoing 继续. 这意味着
     * skeleton 阶段所有 instance 都走"主路径" — production 使用前必须 B.4 落地.
     *
     * @return 首个 human/end 节点 id, 或 null 若 graph 无法 walk (异常 graph)
     */
    private String walkToFirstHumanNode(String startNodeId,
                                        List<ApprovalWorkflowNode> nodes,
                                        List<ApprovalWorkflowEdge> edges) {
        if (startNodeId == null) {
            log.warn("workflow startNodeId 为空, 实例 currentNodeIds 留空");
            return null;
        }

        // 索引: nodeId → node, source → outgoing edges (priority ASC)
        Map<String, ApprovalWorkflowNode> nodeIndex = new HashMap<>();
        for (ApprovalWorkflowNode n : nodes) {
            nodeIndex.put(n.getId(), n);
        }
        Map<String, List<ApprovalWorkflowEdge>> outgoing = new HashMap<>();
        for (ApprovalWorkflowEdge e : edges) {
            outgoing.computeIfAbsent(e.getSource(), k -> new ArrayList<>()).add(e);
        }
        for (List<ApprovalWorkflowEdge> list : outgoing.values()) {
            list.sort(Comparator.comparingInt(e ->
                    e.getPriority() == null ? Integer.MAX_VALUE : e.getPriority()));
        }

        // 防环 (B.3 不评估 condition, 但 graph validation 已禁环 — 防御性)
        Set<String> visited = new HashSet<>();
        String current = startNodeId;
        int safetyHop = 0;
        while (current != null && safetyHop++ < 100) {
            if (!visited.add(current)) {
                log.warn("walk 检测到环, 停止 - nodeId={}", current);
                return current;
            }
            ApprovalWorkflowNode node = nodeIndex.get(current);
            if (node == null) {
                log.warn("walk 遇未知 nodeId - {}", current);
                return null;
            }
            String type = node.getType();
            if ("approval".equals(type) || "end".equals(type)) {
                return current;
            }
            // start / condition / parallel / notify / join → 取首个 outgoing (B.3 简化)
            List<ApprovalWorkflowEdge> next = outgoing.get(current);
            if (next == null || next.isEmpty()) {
                log.warn("walk 遇无 outgoing 节点, 停止 - nodeId={}, type={}", current, type);
                return current;
            }
            current = next.get(0).getTarget();
        }
        log.warn("walk hop 超限 (>100), 停止 - last={}", current);
        return current;
    }

    /**
     * 写入 Redis hot cache. Fail-open — 失败仅 log warn.
     *
     * <p>Key: {@code aw:instance:{instanceId}} / Value: instance JSON
     * (via GenericJackson2JsonRedisSerializer in CacheConfig).
     */
    private void writeRedis(ApprovalWorkflowInstance instance) {
        if (redisTemplate == null) {
            return;
        }
        try {
            String key = REDIS_KEY_PREFIX + instance.getId();
            redisTemplate.opsForValue().set(key, instance, REDIS_RUNNING_TTL);
        } catch (Exception e) {
            log.warn("Redis 写入失败 (PG 已落地, 业务继续) - instanceId={}, error={}",
                    instance.getId(), e.getMessage());
        }
    }

    /**
     * 写 history 记录 — append-only.
     */
    private void writeHistory(String factoryId, String instanceId, String nodeId,
                              HistoryAction action, Long actorId, String actorRole,
                              String notes, Integer durationSeconds) {
        ApprovalHistory history = ApprovalHistory.builder()
                .factoryId(factoryId)
                .instanceId(instanceId)
                .nodeId(nodeId)
                .action(action)
                .actorId(actorId)
                .actorRole(actorRole)
                .notes(notes)
                .durationSeconds(durationSeconds)
                .createdAt(LocalDateTime.now())
                .build();
        historyRepository.save(history);
    }
}
