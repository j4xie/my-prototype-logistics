package com.cretas.aims.config.datasource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.orm.jpa.EntityManagerFactoryBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import javax.persistence.EntityManagerFactory;
import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

// SmartBI MySQL entity imports (NOT postgres!)
import com.cretas.aims.entity.smartbi.AiAgentRule;
import com.cretas.aims.entity.smartbi.AiIntentConfig;
import com.cretas.aims.entity.smartbi.SkuComplexity;
import com.cretas.aims.entity.smartbi.SmartBiAlertThreshold;
import com.cretas.aims.entity.smartbi.SmartBiAnalysisCache;
import com.cretas.aims.entity.smartbi.SmartBiAnalysisConfig;
import com.cretas.aims.entity.smartbi.SmartBiBillingConfig;
import com.cretas.aims.entity.smartbi.SmartBiChartTemplate;
import com.cretas.aims.entity.smartbi.SmartBiDatasource;
import com.cretas.aims.entity.smartbi.SmartBiDepartmentData;
import com.cretas.aims.entity.smartbi.SmartBiDictionary;
import com.cretas.aims.entity.smartbi.SmartBiExcelUpload;
import com.cretas.aims.entity.smartbi.SmartBiFieldDefinition;
import com.cretas.aims.entity.smartbi.SmartBiFinanceData;
import com.cretas.aims.entity.smartbi.SmartBiIncentiveRule;
import com.cretas.aims.entity.smartbi.SmartBiMetricFormula;
import com.cretas.aims.entity.smartbi.SmartBiQueryHistory;
import com.cretas.aims.entity.smartbi.SmartBiSalesData;
import com.cretas.aims.entity.smartbi.SmartBiSchemaHistory;
import com.cretas.aims.entity.smartbi.SmartBiSkill;
import com.cretas.aims.entity.smartbi.SmartBiUsageRecord;

/**
 * Primary DataSource Configuration (MySQL)
 *
 * Handles all existing business data:
 * - User authentication
 * - Factory management
 * - Traceability data
 * - Original SmartBI data (fixed schema)
 *
 * Excludes: repository.smartbi.postgres package (handled by SmartBIPostgresDataSourceConfig)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Configuration
@EnableTransactionManagement
@EnableJpaRepositories(
    basePackages = {
        "com.cretas.aims.repository"
    },
    excludeFilters = @org.springframework.context.annotation.ComponentScan.Filter(
        type = org.springframework.context.annotation.FilterType.REGEX,
        pattern = "com\\.cretas\\.aims\\.repository\\.smartbi\\.postgres\\..*"
    ),
    entityManagerFactoryRef = "primaryEntityManagerFactory",
    transactionManagerRef = "primaryTransactionManager"
)
public class PrimaryDataSourceConfig {

    static {
        System.out.println("======= PrimaryDataSourceConfig CLASS LOADED =======");
    }

    public PrimaryDataSourceConfig() {
        System.out.println("======= PrimaryDataSourceConfig CONSTRUCTOR =======");
    }

    @Value("${spring.jpa.properties.hibernate.dialect:org.hibernate.dialect.PostgreSQL10Dialect}")
    private String hibernateDialect;

    @Value("${spring.jpa.hibernate.ddl-auto:validate}")
    private String ddlAuto;

    @Value("${spring.jpa.show-sql:false}")
    private String showSql;

    /**
     * Primary DataSource Properties
     */
    @Primary
    @Bean(name = "primaryDataSourceProperties")
    @ConfigurationProperties(prefix = "spring.datasource")
    public DataSourceProperties primaryDataSourceProperties() {
        System.out.println("======= Creating primaryDataSourceProperties =======");
        return new DataSourceProperties();
    }

    /**
     * Primary DataSource (MySQL)
     */
    @Primary
    @Bean(name = "primaryDataSource")
    public DataSource primaryDataSource(
            @Qualifier("primaryDataSourceProperties") DataSourceProperties properties) {
        System.out.println("======= Creating primaryDataSource =======");
        System.out.println("URL: " + properties.getUrl());
        System.out.println("Username: " + properties.getUsername());
        DataSource ds = properties.initializeDataSourceBuilder().build();
        System.out.println("======= primaryDataSource created: " + ds.getClass().getName() + " =======");
        return ds;
    }

    /**
     * Primary EntityManagerFactory (MySQL)
     */
    @Primary
    @Bean(name = "primaryEntityManagerFactory")
    public LocalContainerEntityManagerFactoryBean primaryEntityManagerFactory(
            EntityManagerFactoryBuilder builder,
            @Qualifier("primaryDataSource") DataSource dataSource) {
        System.out.println("======= Creating primaryEntityManagerFactory =======");
        System.out.println("Hibernate dialect: " + hibernateDialect);
        System.out.println("DDL auto: " + ddlAuto);

        Map<String, Object> properties = new HashMap<>();
        properties.put("hibernate.dialect", hibernateDialect);
        properties.put("hibernate.hbm2ddl.auto", ddlAuto);
        properties.put("hibernate.show_sql", showSql);
        properties.put("hibernate.format_sql", "false");

        // IMPORTANT: List all entity packages EXCEPT smartbi.postgres
        // The smartbi.postgres entities are handled by SmartBIPostgresDataSourceConfig
        //
        // Solution: Use Class references for SmartBI MySQL entities.
        // When packages() receives Class<?> arguments, it only scans the package
        // containing that class, NOT its subpackages.
        //
        // All other packages have no PostgreSQL subpackages, so we can use string names.
        System.out.println("======= Building EntityManagerFactory with builder =======");
        try {
            LocalContainerEntityManagerFactoryBean result = builder
            .dataSource(dataSource)
            .packages(
                // Root entity package (entities not in subfolders)
                "com.cretas.aims.entity",
                // Core entity packages (no subpackage conflicts)
                "com.cretas.aims.entity.aps",
                "com.cretas.aims.entity.bom",
                "com.cretas.aims.entity.cache",
                "com.cretas.aims.entity.calibration",
                "com.cretas.aims.entity.common",
                "com.cretas.aims.entity.config",
                "com.cretas.aims.entity.conversation",
                "com.cretas.aims.entity.dahua",
                "com.cretas.aims.entity.decoration",
                "com.cretas.aims.entity.enums",
                "com.cretas.aims.entity.intent",
                "com.cretas.aims.entity.iot",
                "com.cretas.aims.entity.isapi",
                "com.cretas.aims.entity.learning",
                "com.cretas.aims.entity.ml",
                "com.cretas.aims.entity.rules",
                "com.cretas.aims.entity.scale",
                "com.cretas.aims.entity.tool",
                "com.cretas.aims.entity.voice",
                // SmartBI MySQL entities - explicitly list the package
                // NOTE: postgres subpackage will be excluded by SmartBIPostgresDataSourceConfig
                // which has its own EntityManagerFactory. The entities in postgres subpackage
                // use @Table annotations that reference PostgreSQL tables, so even if they
                // are scanned by MySQL EMF, they won't conflict at runtime.
                "com.cretas.aims.entity.smartbi"
            )
            .persistenceUnit("primary")
            .properties(properties)
            .build();
            System.out.println("======= EntityManagerFactory built successfully =======");
            return result;
        } catch (Exception e) {
            System.out.println("======= EntityManagerFactory build FAILED =======");
            System.out.println("Exception: " + e.getClass().getName());
            System.out.println("Message: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    /**
     * Primary TransactionManager (MySQL)
     */
    @Primary
    @Bean(name = "primaryTransactionManager")
    public PlatformTransactionManager primaryTransactionManager(
            @Qualifier("primaryEntityManagerFactory") EntityManagerFactory entityManagerFactory) {
        System.out.println("======= Creating primaryTransactionManager =======");
        JpaTransactionManager txManager = new JpaTransactionManager(entityManagerFactory);
        System.out.println("======= primaryTransactionManager created =======");
        return txManager;
    }
}
