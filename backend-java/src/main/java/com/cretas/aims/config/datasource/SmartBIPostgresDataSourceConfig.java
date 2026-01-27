package com.cretas.aims.config.datasource;

import com.zaxxer.hikari.HikariDataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.orm.jpa.EntityManagerFactoryBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import javax.persistence.EntityManagerFactory;
import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

/**
 * SmartBI PostgreSQL DataSource Configuration
 *
 * Secondary datasource for SmartBI dynamic data storage:
 * - JSONB support for flexible schema
 * - GIN indexes for efficient JSON queries
 * - Dynamic field storage without fixed table structure
 *
 * Tables:
 * - smart_bi_dynamic_data: Row-level JSONB storage
 * - smart_bi_pg_field_definitions: Field definitions per upload
 * - smart_bi_pg_excel_uploads: Upload metadata
 * - smart_bi_pg_analysis_results: AI analysis results
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Slf4j
@Configuration
@EnableTransactionManagement
@ConditionalOnProperty(name = "smartbi.postgres.enabled", havingValue = "true", matchIfMissing = false)
public class SmartBIPostgresDataSourceConfig {

    @Value("${smartbi.postgres.enabled:false}")
    private boolean postgresEnabled;

    @Value("${smartbi.postgres.url:}")
    private String jdbcUrl;

    @Value("${smartbi.postgres.username:}")
    private String username;

    @Value("${smartbi.postgres.password:}")
    private String password;

    @Value("${smartbi.postgres.driver-class-name:org.postgresql.Driver}")
    private String driverClassName;

    @Value("${smartbi.postgres.hikari.pool-name:SmartBIPostgresPool}")
    private String poolName;

    @Value("${smartbi.postgres.hikari.maximum-pool-size:10}")
    private int maxPoolSize;

    @Value("${smartbi.postgres.hikari.minimum-idle:2}")
    private int minIdle;

    @Value("${smartbi.postgres.hikari.idle-timeout:600000}")
    private long idleTimeout;

    @Value("${smartbi.postgres.hikari.max-lifetime:1800000}")
    private long maxLifetime;

    @Value("${smartbi.postgres.hikari.connection-timeout:30000}")
    private long connectionTimeout;

    /**
     * SmartBI PostgreSQL DataSource with HikariCP
     */
    @Bean(name = "smartbiPostgresDataSource")
    @ConditionalOnProperty(name = "smartbi.postgres.enabled", havingValue = "true")
    public DataSource smartbiPostgresDataSource() {
        log.info("Creating SmartBI PostgreSQL DataSource: {}", jdbcUrl);

        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(jdbcUrl);
        dataSource.setUsername(username);
        dataSource.setPassword(password);
        dataSource.setDriverClassName(driverClassName);

        // HikariCP configuration
        dataSource.setPoolName(poolName);
        dataSource.setMaximumPoolSize(maxPoolSize);
        dataSource.setMinimumIdle(minIdle);
        dataSource.setIdleTimeout(idleTimeout);
        dataSource.setMaxLifetime(maxLifetime);
        dataSource.setConnectionTimeout(connectionTimeout);

        // PostgreSQL-specific settings
        dataSource.addDataSourceProperty("cachePrepStmts", "true");
        dataSource.addDataSourceProperty("prepStmtCacheSize", "250");
        dataSource.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");

        return dataSource;
    }

    /**
     * SmartBI PostgreSQL EntityManagerFactory
     */
    @Bean(name = "smartbiPostgresEntityManagerFactory")
    @ConditionalOnProperty(name = "smartbi.postgres.enabled", havingValue = "true")
    public LocalContainerEntityManagerFactoryBean smartbiPostgresEntityManagerFactory(
            EntityManagerFactoryBuilder builder,
            @Qualifier("smartbiPostgresDataSource") DataSource dataSource) {
        Map<String, Object> properties = new HashMap<>();

        // PostgreSQL dialect
        properties.put("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect");

        // Auto-create tables on startup (for development)
        properties.put("hibernate.hbm2ddl.auto", "update");

        // Show SQL for debugging
        properties.put("hibernate.show_sql", "true");
        properties.put("hibernate.format_sql", "true");

        // JSONB type registration (via hibernate-types)
        properties.put("hibernate.types.print.banner", "false");

        return builder
            .dataSource(dataSource)
            .packages("com.cretas.aims.entity.smartbi.postgres")
            .persistenceUnit("smartbiPostgres")
            .properties(properties)
            .build();
    }

    /**
     * SmartBI PostgreSQL TransactionManager
     */
    @Bean(name = "smartbiPostgresTransactionManager")
    @ConditionalOnProperty(name = "smartbi.postgres.enabled", havingValue = "true")
    public PlatformTransactionManager smartbiPostgresTransactionManager(
            @Qualifier("smartbiPostgresEntityManagerFactory") EntityManagerFactory entityManagerFactory) {
        return new JpaTransactionManager(entityManagerFactory);
    }

    /**
     * Nested configuration for JPA Repositories - only enabled when PostgreSQL is enabled
     */
    @Configuration
    @ConditionalOnProperty(name = "smartbi.postgres.enabled", havingValue = "true")
    @EnableJpaRepositories(
        basePackages = "com.cretas.aims.repository.smartbi.postgres",
        entityManagerFactoryRef = "smartbiPostgresEntityManagerFactory",
        transactionManagerRef = "smartbiPostgresTransactionManager"
    )
    static class SmartBIPostgresRepositoryConfig {
    }
}
