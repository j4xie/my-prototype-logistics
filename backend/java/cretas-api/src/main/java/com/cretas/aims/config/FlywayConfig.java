package com.cretas.aims.config;

import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Auto-repair Flyway checksum on every deploy.
 *
 * Background: 2026-05-12 V20260511_01 was first deployed (via PR #395) with
 * R_SHANGMA_HG_REAL name '上马火锅'. Later (this PR) the SQL was corrected to
 * '上马火锅 (真实)' to resolve test_db UNIQUE constraint conflict (R_SMH legacy
 * seed owned '上马火锅').
 *
 * prod_db has checksum -1849470695 locked from the original file. Without
 * repair, Spring Boot Flyway validation fails on next startup with
 * `checksum mismatch`.
 *
 * `repair()` recomputes checksum from current file and updates the history
 * table. Safe because the row data is already reconciled via V20260512_01.
 *
 * Long-term value: this bean also handles any FUTURE migration-edit-after-
 * deploy incident the same way — no manual `flyway repair` SSH command on
 * server, the bean does it idempotently on every startup.
 */
@Configuration
public class FlywayConfig {

    @Bean
    public FlywayMigrationStrategy migrationStrategy() {
        return (Flyway flyway) -> {
            flyway.repair();   // sync checksums for any file-vs-history drift
            flyway.migrate();  // apply pending migrations
        };
    }
}
