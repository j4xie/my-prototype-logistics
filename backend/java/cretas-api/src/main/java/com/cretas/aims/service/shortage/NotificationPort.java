package com.cretas.aims.service.shortage;

import com.cretas.aims.service.shortage.dto.ShortageReport;

/**
 * 缺料告警通知 SPI (Sprint 2 Track E — S-MRP-1 / N31)
 *
 * <p>解耦目的: N31 (Track E) 不直接依赖 Sprint 1 Track B1 钉钉 PoC 的具体类
 * ({@code DingTalkSendService} 未在 main, signature 仍在演进)。
 *
 * <p>默认实现 {@link com.cretas.aims.service.shortage.impl.NoOpNotificationPort}
 * 仅打 log 不发外部调用 — 适用于本地 / CI / Track B1 未 ship 阶段。
 *
 * <p>Track B1 PR merge 后, 新建一个 {@code DingTalkNotificationPortAdapter}
 * (在 dingtalk 包内, Track B1 owner ship), wrap {@code DingTalkSendService}
 * 满足本接口。装上 {@code @Primary} 后自动替换 No-Op。
 */
public interface NotificationPort {

    /**
     * 发布缺料告警 (异步即可, 实现方决定是否阻塞)。
     *
     * @param factoryId 工厂 ID
     * @param report    缺料报告快照
     */
    void publishShortageAlert(String factoryId, ShortageReport report);
}
