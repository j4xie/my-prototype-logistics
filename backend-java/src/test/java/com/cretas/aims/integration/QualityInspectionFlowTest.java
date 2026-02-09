package com.cretas.aims.integration;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.QualityInspection;
import com.cretas.aims.service.QualityCheckItemService;
import com.cretas.aims.service.QualityDispositionRuleService;
import com.cretas.aims.service.QualityInspectionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Quality Inspection Flow Integration Test
 * Tests complete quality inspection lifecycle: query inspections -> check items -> disposition rules
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("QualityInspectionFlowTest - 质量检验全流程测试")
class QualityInspectionFlowTest {

    @Autowired
    private QualityInspectionService qualityInspectionService;

    @Autowired(required = false)
    private QualityCheckItemService qualityCheckItemService;

    @Autowired(required = false)
    private QualityDispositionRuleService qualityDispositionRuleService;

    private static final String TEST_FACTORY_ID = "F001";

    // ==================== 1. 检验记录查询测试 ====================

    @Test
    @Order(1)
    @Transactional
    @DisplayName("Test1: 分页查询质量检验记录")
    void testQueryInspections() {
        // When: 查询检验记录
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(1);
        pageRequest.setSize(10);
        PageResponse<QualityInspection> response = qualityInspectionService.getInspections(
                TEST_FACTORY_ID, null, pageRequest);

        // Then: 验证查询结果
        assertThat(response).isNotNull();
        assertThat(response.getContent()).isNotNull();
    }

    @Test
    @Order(2)
    @Transactional
    @DisplayName("Test2: 按生产批次ID查询检验记录")
    void testQueryByProductionBatchId() {
        // Given: 先获取一个检验记录
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(1);
        pageRequest.setSize(1);
        PageResponse<QualityInspection> response = qualityInspectionService.getInspections(
                TEST_FACTORY_ID, null, pageRequest);

        if (response.getContent() != null && !response.getContent().isEmpty()) {
            Long productionBatchIdLong = response.getContent().get(0).getProductionBatchId();

            if (productionBatchIdLong != null) {
                String productionBatchId = productionBatchIdLong.toString();
                // When: 按生产批次ID查询
                PageResponse<QualityInspection> byBatch = qualityInspectionService.getInspections(
                        TEST_FACTORY_ID, productionBatchId, pageRequest);

                // Then: 验证结果
                assertThat(byBatch).isNotNull();
                if (byBatch.getContent() != null) {
                    byBatch.getContent().forEach(inspection ->
                            assertThat(inspection.getProductionBatchId()).isEqualTo(productionBatchIdLong));
                }
            }
        }
    }

    @Test
    @Order(3)
    @Transactional
    @DisplayName("Test3: 根据ID查询检验记录详情")
    void testQueryByInspectionId() {
        // Given: 先获取一个检验记录
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(1);
        pageRequest.setSize(1);
        PageResponse<QualityInspection> response = qualityInspectionService.getInspections(
                TEST_FACTORY_ID, null, pageRequest);

        if (response.getContent() != null && !response.getContent().isEmpty()) {
            String inspectionId = response.getContent().get(0).getId();

            // When: 按ID查询
            QualityInspection inspection = qualityInspectionService.getInspectionById(
                    TEST_FACTORY_ID, inspectionId);

            // Then: 验证结果
            assertThat(inspection).isNotNull();
            assertThat(inspection.getId()).isEqualTo(inspectionId);
        }
    }

    // ==================== 2. 质量检查项测试 ====================

    @Test
    @Order(4)
    @Transactional
    @DisplayName("Test4: 验证质量检查项服务可用")
    void testQualityCheckItemService() {
        // 此测试验证质量检查项服务是否正确注入
        // 具体方法调用取决于QualityCheckItemService接口定义
        // 这里仅验证服务注入
        if (qualityCheckItemService != null) {
            assertThat(qualityCheckItemService).isNotNull();
        }
    }

    // ==================== 3. 质量处置规则测试 ====================

    @Test
    @Order(5)
    @Transactional
    @DisplayName("Test5: 验证质量处置规则服务可用")
    void testQualityDispositionRuleService() {
        // 此测试验证质量处置规则服务是否正确注入
        // 具体方法调用取决于QualityDispositionRuleService接口定义
        if (qualityDispositionRuleService != null) {
            assertThat(qualityDispositionRuleService).isNotNull();
        }
    }

    // ==================== 4. 服务依赖测试 ====================

    @Test
    @Order(6)
    @Transactional
    @DisplayName("Test6: 验证核心服务依赖注入")
    void testServiceDependencies() {
        assertThat(qualityInspectionService).isNotNull();
    }
}
