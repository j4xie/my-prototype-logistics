package com.cretas.aims.scheduler;

import com.cretas.aims.entity.FactoryFeatureConfig;
import com.cretas.aims.entity.ProcessTask;
import com.cretas.aims.entity.enums.ProcessTaskStatus;
import com.cretas.aims.repository.FactoryFeatureConfigRepository;
import com.cretas.aims.repository.ProcessTaskRepository;
import com.cretas.aims.service.ProcessWorkReportingService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ProcessTaskCalibrationScheduler {

    private static final Logger log = LoggerFactory.getLogger(ProcessTaskCalibrationScheduler.class);
    private final ProcessWorkReportingService processWorkReportingService;
    private final FactoryFeatureConfigRepository featureConfigRepository;
    private final ProcessTaskRepository processTaskRepository;

    /**
     * Hourly calibration: reconcile completedQuantity/pendingQuantity with actual report SUMs.
     * Dynamically queries all factories with PROCESS mode enabled.
     */
    @Scheduled(cron = "0 0 * * * *")
    public void calibrateTaskQuantities() {
        log.info("Starting hourly process task calibration");

        List<String> factoryIds = getProcessModeFactories();
        if (factoryIds.isEmpty()) {
            log.info("No factories with PROCESS mode, skipping calibration");
            return;
        }

        for (String factoryId : factoryIds) {
            try {
                processWorkReportingService.calibrateTaskQuantities(factoryId);
                // P2-7: Detect overdue tasks (expectedEndDate < today, still active)
                detectOverdueTasks(factoryId);
            } catch (Exception e) {
                log.error("Calibration failed for factory {}: {}", factoryId, e.getMessage(), e);
            }
        }
        log.info("Hourly process task calibration completed for {} factories", factoryIds.size());
    }

    /**
     * P2-7: Log warning for tasks past expectedEndDate that are still active.
     * Future: could push notifications or update a status flag.
     */
    private void detectOverdueTasks(String factoryId) {
        List<ProcessTask> active = processTaskRepository.findActiveTasksForCalibration(factoryId);
        LocalDate today = LocalDate.now();
        for (ProcessTask task : active) {
            if (task.getExpectedEndDate() != null && task.getExpectedEndDate().isBefore(today)) {
                log.warn("OVERDUE task detected: id={}, processName={}, expectedEnd={}, status={}, factory={}",
                        task.getId(), task.getWorkProcessId(), task.getExpectedEndDate(),
                        task.getStatus(), factoryId);
            }
        }
    }

    private List<String> getProcessModeFactories() {
        try {
            return featureConfigRepository.findAll().stream()
                    .filter(fc -> "production".equals(fc.getModuleId()))
                    .filter(fc -> fc.getConfig() != null && "PROCESS".equals(fc.getConfig().get("mode")))
                    .map(FactoryFeatureConfig::getFactoryId)
                    .distinct()
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Failed to query PROCESS mode factories, falling back to F001: {}", e.getMessage());
            return List.of("F001");
        }
    }
}
