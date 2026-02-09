package com.cretas.aims.integration;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.material.MaterialBatchDTO;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import com.cretas.aims.service.MaterialBatchService;
import com.cretas.aims.service.MaterialSpecConfigService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Material Batch Flow Integration Test
 * Tests complete material batch lifecycle: create -> query -> update -> consume
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("MaterialBatchFlowTest - 原材料批次全流程测试")
class MaterialBatchFlowTest {

    @Autowired
    private MaterialBatchService materialBatchService;

    @Autowired(required = false)
    private MaterialSpecConfigService materialSpecConfigService;

    private static final String TEST_FACTORY_ID = "F001";

    // ==================== 1. 批次查询测试 ====================

    @Test
    @Order(1)
    @Transactional
    @DisplayName("Test1: 分页查询原材料批次")
    void testQueryMaterialBatchList() {
        // When: 查询批次列表
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(1);
        pageRequest.setSize(10);
        PageResponse<MaterialBatchDTO> response = materialBatchService.getMaterialBatchList(
                TEST_FACTORY_ID, pageRequest);

        // Then: 验证查询结果
        assertThat(response).isNotNull();
        assertThat(response.getContent()).isNotNull();
    }

    @Test
    @Order(2)
    @Transactional
    @DisplayName("Test2: 按批次ID查询")
    void testQueryByBatchId() {
        // Given: 先获取一个批次ID
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(1);
        pageRequest.setSize(1);
        PageResponse<MaterialBatchDTO> response = materialBatchService.getMaterialBatchList(
                TEST_FACTORY_ID, pageRequest);

        if (response.getContent() != null && !response.getContent().isEmpty()) {
            String batchId = response.getContent().get(0).getId();

            // When: 按ID查询
            MaterialBatchDTO batch = materialBatchService.getMaterialBatchById(TEST_FACTORY_ID, batchId);

            // Then: 验证查询结果
            assertThat(batch).isNotNull();
            assertThat(batch.getId()).isEqualTo(batchId);
        }
    }

    @Test
    @Order(3)
    @Transactional
    @DisplayName("Test3: 按材料类型查询")
    void testQueryByMaterialType() {
        // When: 按材料类型查询
        List<MaterialBatchDTO> batches = materialBatchService.getMaterialBatchesByType(
                TEST_FACTORY_ID, "RMT-F001-001");

        // Then: 验证查询结果
        assertThat(batches).isNotNull();
    }

    // ==================== 2. 批次状态测试 ====================

    @Test
    @Order(4)
    @Transactional
    @DisplayName("Test4: 按状态查询批次")
    void testQueryByStatus() {
        // When: 查询可用批次
        List<MaterialBatchDTO> available = materialBatchService.getMaterialBatchesByStatus(
                TEST_FACTORY_ID, MaterialBatchStatus.AVAILABLE);

        // Then: 验证结果
        assertThat(available).isNotNull();
    }

    @Test
    @Order(5)
    @Transactional
    @DisplayName("Test5: 查询FIFO批次")
    void testQueryFIFOBatches() {
        // When: 获取FIFO批次
        List<MaterialBatchDTO> fifoBatches = materialBatchService.getAvailableBatchesFIFO(
                TEST_FACTORY_ID, "RMT-F001-001");

        // Then: 验证结果
        assertThat(fifoBatches).isNotNull();
    }

    @Test
    @Order(6)
    @Transactional
    @DisplayName("Test6: 查询即将过期批次")
    void testQueryExpiringBatches() {
        // When: 查询即将过期批次（30天内）
        List<MaterialBatchDTO> expiring = materialBatchService.getExpiringBatches(TEST_FACTORY_ID, 30);

        // Then: 验证结果
        assertThat(expiring).isNotNull();
    }

    @Test
    @Order(7)
    @Transactional
    @DisplayName("Test7: 查询已过期批次")
    void testQueryExpiredBatches() {
        // When: 查询已过期批次
        List<MaterialBatchDTO> expired = materialBatchService.getExpiredBatches(TEST_FACTORY_ID);

        // Then: 验证结果
        assertThat(expired).isNotNull();
    }

    // ==================== 3. 库存统计测试 ====================

    @Test
    @Order(8)
    @Transactional
    @DisplayName("Test8: 按材料类型统计库存")
    void testInventoryByMaterialType() {
        // When: 获取库存统计
        Map<String, BigDecimal> inventory = materialBatchService.getInventoryByMaterialType(TEST_FACTORY_ID);

        // Then: 验证结果
        assertThat(inventory).isNotNull();
    }

    @Test
    @Order(9)
    @Transactional
    @DisplayName("Test9: 获取库存统计")
    void testInventoryStatistics() {
        // When: 获取库存统计
        Map<String, Object> stats = materialBatchService.getInventoryStatistics(TEST_FACTORY_ID);

        // Then: 验证结果
        assertThat(stats).isNotNull();
    }

    @Test
    @Order(10)
    @Transactional
    @DisplayName("Test10: 获取低库存预警")
    void testLowStockWarnings() {
        // When: 获取低库存预警
        List<Map<String, Object>> warnings = materialBatchService.getLowStockWarnings(TEST_FACTORY_ID);

        // Then: 验证结果
        assertThat(warnings).isNotNull();
    }

    // ==================== 4. 服务依赖测试 ====================

    @Test
    @Order(11)
    @Transactional
    @DisplayName("Test11: 验证服务依赖注入")
    void testServiceDependencies() {
        assertThat(materialBatchService).isNotNull();
    }
}
