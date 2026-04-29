package com.cretas.aims.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.time.Duration;

/**
 * ShedLock distributed lock for @Scheduled methods.
 *
 * <p>Background: Production runs blue-green Java instances (ports 10010 + 10020).
 * During overlap (or when a stale green process is left behind by a failed deploy),
 * both JVMs fire the same @Scheduled cron at the same tick. For schedulers that
 * write to the database with find-then-save patterns, this caused
 * {@code duplicate key value violates unique constraint} errors (Apr 15 2026 incident
 * with BehaviorCalibrationScheduler.calculateToolReliabilityStats).
 *
 * <p>With ShedLock, any {@code @Scheduled @SchedulerLock(name = "X")} method will
 * insert/update a row in the {@code shedlock} table. Only the instance that wins
 * the row lock runs the job; the other sees a live lock and skips silently.
 *
 * <p>Defaults (can be overridden per-method with @SchedulerLock args):
 * <ul>
 *   <li>{@code defaultLockAtMostFor = PT30M} — if a run takes longer than 30
 *   minutes, the lock is released so other instances can retry. This caps the
 *   "stuck JVM holds lock forever" failure mode.</li>
 *   <li>{@code defaultLockAtLeastFor = PT10S} — even if the run finishes in
 *   100ms, the lock is held for at least 10s so rapid-fire schedulers can't
 *   double-run due to clock skew.</li>
 * </ul>
 *
 * <p>Schedulers whose side effects are purely in-memory (health polls, cache
 * eviction) do NOT need @SchedulerLock — every JVM should run them.
 *
 * @since 2026-04-15
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT30M", defaultLockAtLeastFor = "PT10S")
public class ShedLockConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(
            JdbcTemplateLockProvider.Configuration.builder()
                .withJdbcTemplate(new JdbcTemplate(dataSource))
                .usingDbTime()
                .build()
        );
    }
}
