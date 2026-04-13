package com.cretas.aims.scheduler;

import com.cretas.aims.entity.factory.FactoryMaterialRequisition;
import com.cretas.aims.entity.factory.FactoryMaterialRequisition.Status;
import com.cretas.aims.repository.factory.FactoryMaterialRequisitionRepository;
import com.cretas.aims.service.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * P1-5 车间仓当天清仓扫描 (v1 §2.9, 客户原话 3225s "鲜棉仓当天清仓").
 *
 * <p>每天 20:00 扫描所有 state 在 ISSUED 或 IN_USE 的 FactoryMaterialRequisition,
 * 如果是"今天之前"创建的 (说明跨天未 CLOSE) 则发警告日志. 主管根据日志决定人工
 * 处理或追加自动 CLOSE 逻辑.
 *
 * <p><b>简化版说明</b>: 当前系统 MaterialBatch 无 warehouseId 字段 (见 P0-5 B2
 * ADR), 所以"清仓"是业务流程提醒, 不是批次物理位移. FMR close 时 B1 已生成
 * return InternalTransfer 流水作为逻辑退料记录.
 *
 * <p><b>TODO</b>: 未来可扩展:
 * <ul>
 *   <li>发通知给 supervisor (钉钉/微信)</li>
 *   <li>自动 CLOSE 超过 N 天未关单的 FMR (需客户确认)</li>
 *   <li>按 warehouse type=WORKSHOP 过滤 (需 FactoryWarehouse 引入)</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FmrExpiryScanner {

    private final FactoryMaterialRequisitionRepository repository;
    private final NotificationService notificationService;

    /**
     * 每天 20:00 执行一次扫描.
     * cron format: 秒 分 时 日 月 周
     */
    @Scheduled(cron = "0 0 20 * * ?")
    public void scanUnclosedRequisitions() {
        LocalDateTime todayStart = LocalDateTime.of(java.time.LocalDate.now(), LocalTime.MIDNIGHT);
        List<Status> stuckStates = List.of(Status.ISSUED, Status.IN_USE);

        // Page through all factories (service 层按 factoryId 过滤, 这里用 repository 直接扫 all)
        List<FactoryMaterialRequisition> stuck = repository
                .findByStatusInAndCreatedAtBeforeAndDeletedAtIsNull(stuckStates, todayStart);

        if (stuck.isEmpty()) {
            log.info("[P1-5 FMR expiry scan] 20:00 daily scan — 无跨天未关单物料需求单");
            return;
        }

        log.warn("[P1-5 FMR expiry scan] 20:00 daily scan — 发现 {} 条跨天未关单物料需求单:", stuck.size());

        // P1-5: 按 factory 分组, 每个工厂单独发一条通知给车间主管
        Map<String, Integer> byFactory = new HashMap<>();
        for (FactoryMaterialRequisition mr : stuck) {
            log.warn("[P1-5 FMR expiry scan]   - factoryId={} no={} status={} createdAt={}",
                    mr.getFactoryId(), mr.getRequisitionNo(), mr.getStatus(), mr.getCreatedAt());
            byFactory.merge(mr.getFactoryId(), 1, Integer::sum);
        }
        for (Map.Entry<String, Integer> e : byFactory.entrySet()) {
            notificationService.notifyRole(
                    e.getKey(),
                    "WORKSHOP_SUPERVISOR",
                    "[鲜棉仓清仓] 跨天未关单物料需求单",
                    String.format("发现 %d 条跨天未关单物料需求单, 请检查是否需要手动 close 或追加退料流水.",
                            e.getValue())
            );
        }
    }
}
