package com.cretas.aims.engine;

import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.entity.config.FactorySchedulerConfig;
import com.cretas.aims.repository.config.FactorySchedulerConfigRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Slf4j
@Component
@RequiredArgsConstructor
public class DynamicSchedulerService {

    private final FactorySchedulerConfigRepository schedulerRepo;
    private final TaskScheduler taskScheduler;
    private final ToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;

    private final Map<String, ScheduledFuture<?>> activeTasks = new ConcurrentHashMap<>();

    @PostConstruct
    public void loadSchedules() {
        List<FactorySchedulerConfig> configs = schedulerRepo.findByEnabledTrue();
        log.info("Loading {} dynamic scheduled tasks", configs.size());
        for (FactorySchedulerConfig config : configs) {
            scheduleTask(config);
        }
    }

    @PreDestroy
    public void shutdown() {
        activeTasks.values().forEach(f -> f.cancel(false));
        activeTasks.clear();
    }

    public void scheduleTask(FactorySchedulerConfig config) {
        String key = config.getFactoryId() + ":" + config.getTaskCode();
        ScheduledFuture<?> existing = activeTasks.get(key);
        if (existing != null) { existing.cancel(false); activeTasks.remove(key); }

        try {
            ScheduledFuture<?> future = taskScheduler.schedule(
                    () -> executeTask(config), new CronTrigger(config.getCronExpression()));
            activeTasks.put(key, future);
            log.info("Scheduled task: {} [{}] cron={}", key, config.getToolOrMethod(), config.getCronExpression());
        } catch (IllegalArgumentException e) {
            log.error("Invalid cron for {}: {} — {}", key, config.getCronExpression(), e.getMessage());
        }
    }

    public void reloadSchedule(String factoryId, String taskCode) {
        Optional<FactorySchedulerConfig> config = schedulerRepo.findByFactoryIdAndTaskCode(factoryId, taskCode);
        if (config.isPresent() && config.get().getEnabled()) {
            scheduleTask(config.get());
        } else {
            cancelTask(factoryId, taskCode);
        }
    }

    public void reloadAll() {
        activeTasks.values().forEach(f -> f.cancel(false));
        activeTasks.clear();
        loadSchedules();
    }

    public void cancelTask(String factoryId, String taskCode) {
        String key = factoryId + ":" + taskCode;
        ScheduledFuture<?> future = activeTasks.remove(key);
        if (future != null) { future.cancel(false); log.info("Cancelled: {}", key); }
    }

    public int getActiveTaskCount() { return activeTasks.size(); }

    private void executeTask(FactorySchedulerConfig config) {
        String toolOrMethod = config.getToolOrMethod();
        if (toolOrMethod == null || toolOrMethod.isBlank()) return;

        Optional<ToolExecutor> executor = toolRegistry.getExecutor(toolOrMethod);
        if (executor.isEmpty()) { log.warn("Scheduled tool not found: {}", toolOrMethod); return; }

        try {
            String argsJson = objectMapper.writeValueAsString(config.getParams());
            ToolCall toolCall = ToolCall.of("sched-" + config.getTaskCode(), toolOrMethod, argsJson);
            executor.get().execute(toolCall, Map.of("factoryId", config.getFactoryId()));
        } catch (Exception e) {
            log.error("Scheduled task {} failed: {}", config.getTaskCode(), e.getMessage(), e);
        }
    }
}
