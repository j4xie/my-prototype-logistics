package com.cretas.aims.service.shortage.impl;

import com.cretas.aims.service.shortage.NotificationPort;
import com.cretas.aims.service.shortage.dto.ShortageReport;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * 默认 No-Op 实现 — 仅打 log, 不发任何外部调用。
 *
 * <p>本 bean 通过 {@link ConditionalOnMissingBean} 在没有其他 {@link NotificationPort}
 * 实现时生效。Track B1 钉钉 PoC merge 后注册 Adapter (@Primary) 即可替换。
 */
@Component
@ConditionalOnMissingBean(NotificationPort.class)
public class NoOpNotificationPort implements NotificationPort {

    private static final Logger log = LoggerFactory.getLogger(NoOpNotificationPort.class);

    @Override
    public void publishShortageAlert(String factoryId, ShortageReport report) {
        if (report == null) {
            log.warn("[NotificationPort:NoOp] null report, skip — factoryId={}", factoryId);
            return;
        }
        log.info("[NotificationPort:NoOp] WOULD-send shortage alert — factoryId={}, salesOrderId={}, summary={}",
                factoryId, report.getSalesOrderId(), report.getSummary());
    }
}
