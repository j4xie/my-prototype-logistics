package com.cretas.aims.service.config.impl;

import com.cretas.aims.entity.config.CanvasDynamicField;
import com.cretas.aims.entity.config.FactoryConfiguration;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.config.CanvasDynamicFieldRepository;
import com.cretas.aims.repository.config.ConfigChangeLogRepository;
import com.cretas.aims.repository.config.FactoryConfigurationRepository;
import com.cretas.aims.repository.config.FactoryModuleConfigRepository;
import com.cretas.aims.repository.config.ModuleSchemaRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Round 10 Task 1/C3 integration test — verifies the reorder endpoint against
 * a real PostgreSQL instance using only the JPA slice (no AI bean graph).
 *
 * <p>The regression this test guards against is C3: the original reorderFields
 * only updated the {@code field_config} JSONB in {@code factory_module_configs},
 * but dynamic fields are read directly from {@code canvas_dynamic_field} via
 * {@code ORDER BY sort_order}. The JSONB update was silently no-op'd for
 * dynamic fields. Unit tests with mocked repositories missed it because they
 * didn't exercise the read-back path.</p>
 *
 * <p>Profile: {@code r10-it} — local PostgreSQL, {@code ddl-auto=create-drop}.
 * Requires: {@code cretas_r10_it_test} database on localhost:5432 owned by
 * {@code cretas_user}. See {@code application-r10-it.properties}.</p>
 *
 * <p>We use {@link DataJpaTest} + {@link AutoConfigureTestDatabase} to load
 * only the JPA layer and avoid the full Spring Boot context, which pulls in
 * the AI bean graph (DashScope, Python BERT, embedding gRPC) and can't start
 * in a pure unit-test environment. The service under test is instantiated
 * manually with the real repositories injected.</p>
 *
 * <p><b>CI:</b> the {@code java-build-test} job in {@code .github/workflows/ci.yml}
 * provisions a {@code pgvector/pgvector:pg17} service container and bootstraps
 * the {@code cretas_r10_it_test} database, so this IT runs in CI against real
 * PostgreSQL — no H2 fallback. (Previously skipped via
 * {@code @DisabledIfEnvironmentVariable("CI")} in PR #275; that workaround
 * was removed once the PG service container landed.)</p>
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("r10-it")
@EntityScan(basePackages = "com.cretas.aims.entity")
@EnableJpaRepositories(basePackages = "com.cretas.aims.repository.config")
@DisplayName("FactoryConfigServiceImpl#reorderFields — JPA slice integration")
class FactoryConfigServiceImplReorderIT {

    private static final String TEST_FACTORY = "FIT_R10_REORDER";
    private static final String TEST_MODULE = "material_batch";

    @Autowired private ModuleSchemaRepository moduleSchemaRepository;
    @Autowired private FactoryConfigurationRepository factoryConfigurationRepository;
    @Autowired private FactoryModuleConfigRepository factoryModuleConfigRepository;
    @Autowired private ConfigChangeLogRepository configChangeLogRepository;
    @Autowired private CanvasDynamicFieldRepository canvasDynamicFieldRepository;
    @Autowired private EntityManager entityManager;

    private FactoryConfigServiceImpl service;
    private FactoryConfiguration draft;

    @BeforeEach
    void setUp() {
        // Manually instantiate the service to bypass Spring's full bean graph.
        // Optional deps (ddlExecutor, dynamicFieldService, etc.) stay null —
        // reorderFields doesn't touch them.
        service = new FactoryConfigServiceImpl(
                moduleSchemaRepository,
                factoryConfigurationRepository,
                factoryModuleConfigRepository,
                configChangeLogRepository,
                new ObjectMapper());
        ReflectionTestUtils.setField(service, "canvasDynamicFieldRepository", canvasDynamicFieldRepository);

        // Seed a DRAFT config with rowVersion=0 (@Version will auto-increment)
        draft = new FactoryConfiguration();
        draft.setFactoryId(TEST_FACTORY);
        draft.setConfigVersion(1);
        draft.setStatus("DRAFT");
        draft.setRowVersion(0L);
        draft.setCreatedBy(1L);
        draft.setCreatedAt(LocalDateTime.now());
        draft.setUpdatedAt(LocalDateTime.now());
        draft = factoryConfigurationRepository.saveAndFlush(draft);

        // 3 dynamic fields, all sortOrder=0 (the pre-R10 prod state)
        seedDynamicField("batch_certificate_url", 0);
        seedDynamicField("pesticide_residue_level", 0);
        seedDynamicField("transport_temp_log", 0);
        entityManager.flush();
        entityManager.clear();
    }

    private void seedDynamicField(String fieldCode, int initialSortOrder) {
        CanvasDynamicField field = new CanvasDynamicField();
        field.setFactoryId(TEST_FACTORY);
        field.setModuleCode(TEST_MODULE);
        field.setFieldCode(fieldCode);
        field.setFieldType("STRING");
        field.setLabel(fieldCode + " label");
        field.setConfig(Map.of());
        field.setSortOrder(initialSortOrder);
        field.setStatus("ACTIVE");
        field.setColumnName("cf_" + fieldCode);
        canvasDynamicFieldRepository.save(field);
    }

    @Test
    @DisplayName("C3 regression: canvas_dynamic_field.sort_order is actually written")
    void reorderFields_updatesCanvasDynamicFieldSortOrder() {
        List<String> newOrder = List.of(
                "transport_temp_log",
                "batch_certificate_url",
                "pesticide_residue_level");

        Map<String, Object> result = service.reorderFields(
                TEST_FACTORY, TEST_MODULE, newOrder, 0L, 1L);

        assertThat(result).containsEntry("reorderedCount", 3);

        // Force a fresh read — critical to avoid first-level cache returning pre-update state
        entityManager.flush();
        entityManager.clear();

        CanvasDynamicField transportField = canvasDynamicFieldRepository
                .findByFactoryIdAndModuleCodeAndFieldCode(TEST_FACTORY, TEST_MODULE, "transport_temp_log")
                .orElseThrow();
        CanvasDynamicField certField = canvasDynamicFieldRepository
                .findByFactoryIdAndModuleCodeAndFieldCode(TEST_FACTORY, TEST_MODULE, "batch_certificate_url")
                .orElseThrow();
        CanvasDynamicField pesticideField = canvasDynamicFieldRepository
                .findByFactoryIdAndModuleCodeAndFieldCode(TEST_FACTORY, TEST_MODULE, "pesticide_residue_level")
                .orElseThrow();

        // The C3 assertion: these would all still be 0 if the regression recurred
        assertThat(transportField.getSortOrder()).isEqualTo(10);
        assertThat(certField.getSortOrder()).isEqualTo(20);
        assertThat(pesticideField.getSortOrder()).isEqualTo(30);
    }

    @Test
    @DisplayName("Repository read path honors new order via findByFactoryIdAndModuleCode")
    void reorderFields_repositoryReadPathReturnsNewOrder() {
        List<String> newOrder = List.of(
                "pesticide_residue_level",
                "transport_temp_log",
                "batch_certificate_url");

        service.reorderFields(TEST_FACTORY, TEST_MODULE, newOrder, 0L, 1L);

        entityManager.flush();
        entityManager.clear();

        List<CanvasDynamicField> fromDb = canvasDynamicFieldRepository
                .findByFactoryIdAndModuleCode(TEST_FACTORY, TEST_MODULE);
        fromDb.sort((a, b) -> Integer.compare(
                a.getSortOrder() == null ? 0 : a.getSortOrder(),
                b.getSortOrder() == null ? 0 : b.getSortOrder()));

        assertThat(fromDb).extracting(CanvasDynamicField::getFieldCode)
                .containsExactly(
                        "pesticide_residue_level",
                        "transport_temp_log",
                        "batch_certificate_url");
    }

    @Test
    @DisplayName("Optimistic lock: version mismatch throws BusinessException")
    void reorderFields_versionMismatch_throws() {
        assertThatThrownBy(() -> service.reorderFields(
                TEST_FACTORY, TEST_MODULE, List.of("batch_certificate_url"), 99L, 1L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("版本冲突");
    }

    @Test
    @DisplayName("Unknown field codes are silently ignored without crashing")
    void reorderFields_unknownFieldCodes_ignoredGracefully() {
        List<String> mixedOrder = List.of(
                "batch_certificate_url",
                "nonexistent_field_xyz");

        Map<String, Object> result = service.reorderFields(
                TEST_FACTORY, TEST_MODULE, mixedOrder, 0L, 1L);

        entityManager.flush();
        entityManager.clear();

        assertThat(result).containsKey("reorderedCount");

        CanvasDynamicField certField = canvasDynamicFieldRepository
                .findByFactoryIdAndModuleCodeAndFieldCode(TEST_FACTORY, TEST_MODULE, "batch_certificate_url")
                .orElseThrow();
        assertThat(certField.getSortOrder()).isEqualTo(10);
    }
}
