package com.cretas.aims.dto.smartbi;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue #318 (Rule 17.1 anti-pattern fix, 2026-05-11).
 *
 * <p>POST {@code /api/mobile/{factoryId}/smart-bi/data-sources} 之前对 {@code connectionConfig=""}
 * 返通用 500 "数据处理失败" — Hibernate 写 PostgreSQL JSON 列时 PSQLException 被 controller
 * {@code catch (Exception)} 吞成 generic 500。本测试验证 {@code @NotBlank} 注解就位,
 * 由 {@code @Valid} + GlobalExceptionHandler 链路转 400 + 明确字段提示。
 *
 * <p>覆盖 3 个 NotBlank 触发路径 (null / "" / "  ") + 1 个合法值 happy path,
 * 不改 PUT (无 {@code @Valid}) 的行为。
 *
 * @see com.cretas.aims.controller.SmartBIConfigController#createDataSource
 * @see com.cretas.aims.exception.GlobalExceptionHandler#handleValidationException
 */
class DataSourceDTOValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDownValidator() {
        if (factory != null) {
            factory.close();
        }
    }

    @Test
    void connectionConfig_null_violatesNotBlank() {
        DataSourceDTO dto = baseValid().connectionConfig(null).build();

        Set<ConstraintViolation<DataSourceDTO>> violations = validator.validate(dto);

        assertThat(violations)
                .as("connectionConfig=null 应触发 @NotBlank")
                .anyMatch(v -> "connectionConfig".equals(v.getPropertyPath().toString())
                        && "数据源连接配置不能为空".equals(v.getMessage()));
    }

    @Test
    void connectionConfig_emptyString_violatesNotBlank() {
        DataSourceDTO dto = baseValid().connectionConfig("").build();

        Set<ConstraintViolation<DataSourceDTO>> violations = validator.validate(dto);

        assertThat(violations)
                .as("connectionConfig=\"\" 应触发 @NotBlank (Issue #318 root cause)")
                .anyMatch(v -> "connectionConfig".equals(v.getPropertyPath().toString())
                        && "数据源连接配置不能为空".equals(v.getMessage()));
    }

    @Test
    void connectionConfig_whitespaceOnly_violatesNotBlank() {
        DataSourceDTO dto = baseValid().connectionConfig("   ").build();

        Set<ConstraintViolation<DataSourceDTO>> violations = validator.validate(dto);

        assertThat(violations)
                .as("connectionConfig=\"   \" 应触发 @NotBlank (防 client trim 后空)")
                .anyMatch(v -> "connectionConfig".equals(v.getPropertyPath().toString())
                        && "数据源连接配置不能为空".equals(v.getMessage()));
    }

    @Test
    void connectionConfig_validJsonString_passesValidation() {
        DataSourceDTO dto = baseValid()
                .connectionConfig("{\"url\":\"jdbc:postgresql://localhost:5432/db\"}")
                .build();

        Set<ConstraintViolation<DataSourceDTO>> violations = validator.validate(dto);

        assertThat(violations)
                .as("合法 JSON connectionConfig 不应触发 @NotBlank,happy path 200 不受影响")
                .noneMatch(v -> "connectionConfig".equals(v.getPropertyPath().toString()));
    }

    /** Minimum-viable DTO carrier; consumer overrides one field per test. */
    private static DataSourceDTO.DataSourceDTOBuilder baseValid() {
        return DataSourceDTO.builder()
                .factoryId("F001")
                .name("test-source")
                .code("TEST_SRC")
                .type("DATABASE")
                .connectionConfig("{}")
                .refreshInterval(60)
                .isActive(true);
    }
}
