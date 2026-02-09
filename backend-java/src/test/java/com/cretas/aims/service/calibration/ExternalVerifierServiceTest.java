package com.cretas.aims.service.calibration;

import com.cretas.aims.service.calibration.impl.ExternalVerifierServiceImpl;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * ExternalVerifierService 单元测试
 *
 * 基于 CRITIC 论文核心思想：LLM 自我纠错需要依赖外部工具的反馈
 * 本测试验证外部验证器的各种场景
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ExternalVerifierService 单元测试")
class ExternalVerifierServiceTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private ExternalVerifierServiceImpl externalVerifierService;

    // ==================== 数据可用性验证测试 ====================

    @Nested
    @DisplayName("数据可用性验证 (verifyDataAvailability)")
    class DataAvailabilityTests {

        @Test
        @DisplayName("场景1: 查询到数据时返回成功")
        void verifyDataAvailability_WithData_ReturnsSuccess() {
            // Given
            String factoryId = "F001";
            String tableName = "material_batches";
            Map<String, Object> conditions = Map.of("batch_number", "MB-001");

            when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), (Object[]) any()))
                    .thenReturn(5);

            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyDataAvailability(factoryId, tableName, conditions);

            // Then
            assertTrue(result.hasData());
            assertEquals(5, result.recordCount());
            assertEquals("DATA_AVAILABLE", result.dataStatus());
            assertNotNull(result.suggestion());
            System.out.println("✅ 场景1通过: 找到数据时返回正确结果");
        }

        @Test
        @DisplayName("场景2: 查询无数据时返回空结果")
        void verifyDataAvailability_NoData_ReturnsEmpty() {
            // Given
            String factoryId = "F001";
            String tableName = "material_batches";
            Map<String, Object> conditions = Map.of("batch_number", "NOT-EXIST");

            when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), (Object[]) any()))
                    .thenReturn(0);

            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyDataAvailability(factoryId, tableName, conditions);

            // Then
            assertFalse(result.hasData());
            assertEquals(0, result.recordCount());
            assertEquals("NO_DATA_FOUND", result.dataStatus());
            System.out.println("✅ 场景2通过: 无数据时返回空结果");
        }

        @Test
        @DisplayName("场景3: 非法表名被拒绝")
        void verifyDataAvailability_InvalidTable_ReturnsError() {
            // Given
            String factoryId = "F001";
            String tableName = "users; DROP TABLE material_batches;--";  // SQL 注入尝试
            Map<String, Object> conditions = Map.of();

            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyDataAvailability(factoryId, tableName, conditions);

            // Then
            assertFalse(result.hasData());
            assertTrue(result.dataStatus().contains("INVALID_TABLE"));
            System.out.println("✅ 场景3通过: SQL注入攻击被阻止");
        }

        @Test
        @DisplayName("场景4: 数据库异常时返回错误")
        void verifyDataAvailability_DatabaseError_ReturnsError() {
            // Given
            String factoryId = "F001";
            String tableName = "material_batches";

            when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), (Object[]) any()))
                    .thenThrow(new RuntimeException("Connection refused"));

            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyDataAvailability(factoryId, tableName, null);

            // Then
            assertFalse(result.hasData());
            assertTrue(result.dataStatus().contains("VERIFICATION_ERROR"));
            System.out.println("✅ 场景4通过: 数据库错误被正确处理");
        }

        @Test
        @DisplayName("场景5: 空条件查询")
        void verifyDataAvailability_NullConditions_Works() {
            // Given
            String factoryId = "F001";
            String tableName = "quality_inspections";

            when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), (Object[]) any()))
                    .thenReturn(100);

            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyDataAvailability(factoryId, tableName, null);

            // Then
            assertTrue(result.hasData());
            assertEquals(100, result.recordCount());
            System.out.println("✅ 场景5通过: 空条件查询正常工作");
        }
    }

    // ==================== 时间范围验证测试 ====================

    @Nested
    @DisplayName("时间范围数据验证 (verifyTimeRangeData)")
    class TimeRangeTests {

        @Test
        @DisplayName("场景1: 时间范围内有数据")
        void verifyTimeRangeData_WithData_ReturnsSuccess() {
            // Given
            String factoryId = "F001";
            String tableName = "material_batches";
            LocalDate startDate = LocalDate.of(2026, 1, 1);
            LocalDate endDate = LocalDate.of(2026, 1, 31);

            when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(), any(), any()))
                    .thenReturn(50);

            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyTimeRangeData(factoryId, tableName, startDate, endDate);

            // Then
            assertTrue(result.hasData());
            assertEquals(50, result.recordCount());
            assertTrue(result.suggestion().contains("50 条记录"));
            System.out.println("✅ 时间范围场景1通过: 有数据时返回正确结果");
        }

        @Test
        @DisplayName("场景2: 时间范围内无数据但表有历史数据")
        void verifyTimeRangeData_NoDataInRange_SuggestsAlternative() {
            // Given
            String factoryId = "F001";
            String tableName = "material_batches";
            LocalDate startDate = LocalDate.of(2099, 1, 1);  // 未来日期
            LocalDate endDate = LocalDate.of(2099, 12, 31);

            when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(), any(), any()))
                    .thenReturn(0);

            Map<String, Object> suggestResult = new HashMap<>();
            suggestResult.put("min_date", "2025-01-01 00:00:00");
            suggestResult.put("max_date", "2026-01-19 12:00:00");
            suggestResult.put("total", 1000L);

            when(jdbcTemplate.queryForMap(anyString(), any()))
                    .thenReturn(suggestResult);

            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyTimeRangeData(factoryId, tableName, startDate, endDate);

            // Then
            assertFalse(result.hasData());
            assertEquals("NO_DATA_IN_RANGE", result.dataStatus());
            assertTrue(result.suggestion().contains("调整查询范围"));
            assertEquals("2025-01-01 00:00:00", result.contextInfo().get("availableMinDate"));
            System.out.println("✅ 时间范围场景2通过: 无数据时提供可用时间范围建议");
        }

        @Test
        @DisplayName("场景3: 表完全为空")
        void verifyTimeRangeData_EmptyTable_ReturnsEmpty() {
            // Given
            String factoryId = "F001";
            String tableName = "inventory_records";
            LocalDate startDate = LocalDate.of(2026, 1, 1);
            LocalDate endDate = LocalDate.of(2026, 1, 31);

            when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(), any(), any()))
                    .thenReturn(0);

            Map<String, Object> emptyResult = new HashMap<>();
            emptyResult.put("min_date", null);
            emptyResult.put("max_date", null);
            emptyResult.put("total", 0L);

            when(jdbcTemplate.queryForMap(anyString(), any()))
                    .thenReturn(emptyResult);

            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyTimeRangeData(factoryId, tableName, startDate, endDate);

            // Then
            assertFalse(result.hasData());
            assertEquals("TABLE_EMPTY", result.dataStatus());
            assertTrue(result.suggestion().contains("没有任何数据"));
            System.out.println("✅ 时间范围场景3通过: 空表被正确检测");
        }
    }

    // ==================== 参数格式验证测试 ====================

    @Nested
    @DisplayName("参数格式验证 (verifyParameterFormat)")
    class ParameterFormatTests {

        @ParameterizedTest
        @DisplayName("场景1: 日期格式验证")
        @CsvSource({
                "2026-01-19, true",
                "2026-1-19, false",
                "01-19-2026, false",
                "2026/01/19, false",
                "invalid, false"
        })
        void verifyParameterFormat_DateFormat(String dateValue, boolean expectedValid) {
            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyParameterFormat("startDate", dateValue, "date");

            // Then
            assertEquals(expectedValid, result.hasData());
            System.out.println("✅ 日期格式验证: " + dateValue + " -> " + (expectedValid ? "有效" : "无效"));
        }

        @ParameterizedTest
        @DisplayName("场景2: 数字格式验证")
        @CsvSource({
                "123, true",
                "123.45, true",
                "-50, true",
                "abc, false",
                "12.34.56, false"
        })
        void verifyParameterFormat_NumberFormat(String numValue, boolean expectedValid) {
            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyParameterFormat("quantity", numValue, "number");

            // Then
            assertEquals(expectedValid, result.hasData());
            System.out.println("✅ 数字格式验证: " + numValue + " -> " + (expectedValid ? "有效" : "无效"));
        }

        @ParameterizedTest
        @DisplayName("场景3: 正数验证")
        @CsvSource({
                "100, true",
                "0.5, true",
                "0, false",
                "-10, false",
                "abc, false"
        })
        void verifyParameterFormat_PositiveNumber(String numValue, boolean expectedValid) {
            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyParameterFormat("count", numValue, "positive_number");

            // Then
            assertEquals(expectedValid, result.hasData());
            System.out.println("✅ 正数验证: " + numValue + " -> " + (expectedValid ? "有效" : "无效"));
        }

        @Test
        @DisplayName("场景4: 空值验证")
        void verifyParameterFormat_NullValue_ReturnsError() {
            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyParameterFormat("batchNumber", null, "string");

            // Then
            assertFalse(result.hasData());
            assertEquals("NULL_VALUE", result.dataStatus());
            assertTrue(result.suggestion().contains("参数值为空"));
            System.out.println("✅ 场景4通过: 空值被正确检测");
        }

        @Test
        @DisplayName("场景5: 未知格式类型默认通过")
        void verifyParameterFormat_UnknownFormat_PassesThrough() {
            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyParameterFormat("customField", "anyValue", "custom_format");

            // Then
            assertTrue(result.hasData());
            assertEquals("DATA_AVAILABLE", result.dataStatus());
            System.out.println("✅ 场景5通过: 未知格式类型默认通过");
        }
    }

    // ==================== 上下文信息收集测试 ====================

    @Nested
    @DisplayName("上下文信息收集 (collectContextInfo)")
    class ContextCollectionTests {

        @Test
        @DisplayName("场景1: 物料批次工具上下文收集")
        void collectContextInfo_MaterialBatchTool_CollectsInfo() {
            // Given
            String factoryId = "F001";
            String toolName = "material_batch_query";

            when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any()))
                    .thenReturn(500);

            List<Map<String, Object>> recentBatches = List.of(
                    Map.of("batch_number", "MB-001", "created_at", "2026-01-19"),
                    Map.of("batch_number", "MB-002", "created_at", "2026-01-18")
            );
            doReturn(recentBatches).when(jdbcTemplate).queryForList(contains("ORDER BY"), (Object) any());

            Map<String, Object> dateRange = Map.of(
                    "earliest", "2025-01-01",
                    "latest", "2026-01-19"
            );
            when(jdbcTemplate.queryForMap(contains("MIN"), any()))
                    .thenReturn(dateRange);

            // When
            Map<String, Object> context = externalVerifierService.collectContextInfo(
                    factoryId, toolName, Map.of("batchNumber", "MB-001"));

            // Then
            assertEquals(factoryId, context.get("factoryId"));
            assertEquals(toolName, context.get("toolName"));
            assertEquals(500, context.get("totalRecords"));
            assertNotNull(context.get("collectedAt"));
            System.out.println("✅ 场景1通过: 物料批次上下文收集成功");
        }

        @Test
        @DisplayName("场景2: 库存查询工具上下文收集")
        void collectContextInfo_InventoryTool_CollectsInfo() {
            // Given
            String factoryId = "F001";
            String toolName = "inventory_query";

            when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any()))
                    .thenReturn(1000);

            // When
            Map<String, Object> context = externalVerifierService.collectContextInfo(
                    factoryId, toolName, Map.of());

            // Then
            assertEquals(1000, context.get("totalRecords"));
            System.out.println("✅ 场景2通过: 库存上下文收集成功");
        }

        @Test
        @DisplayName("场景3: 未知工具返回通用上下文")
        void collectContextInfo_UnknownTool_ReturnsGenericContext() {
            // Given
            String factoryId = "F001";
            String toolName = "unknown_tool";

            // When
            Map<String, Object> context = externalVerifierService.collectContextInfo(
                    factoryId, toolName, Map.of());

            // Then
            assertEquals(factoryId, context.get("factoryId"));
            assertEquals(toolName, context.get("toolName"));
            assertEquals("通用上下文，无特定工具信息", context.get("note"));
            System.out.println("✅ 场景3通过: 未知工具返回通用上下文");
        }

        @Test
        @DisplayName("场景4: 数据库异常时上下文仍然返回")
        void collectContextInfo_DatabaseError_StillReturnsContext() {
            // Given
            String factoryId = "F001";
            String toolName = "material_batch_query";

            when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any()))
                    .thenThrow(new RuntimeException("DB Error"));

            // When
            Map<String, Object> context = externalVerifierService.collectContextInfo(
                    factoryId, toolName, Map.of());

            // Then
            assertEquals(factoryId, context.get("factoryId"));
            assertEquals(toolName, context.get("toolName"));
            // 注：内部方法有自己的 try-catch，会吞掉异常，不会添加 contextError
            // 但基本上下文信息仍然返回
            assertNotNull(context.get("collectedAt"));
            System.out.println("✅ 场景4通过: 数据库错误时仍返回基本上下文");
        }
    }

    // ==================== 综合工具调用验证测试 ====================

    @Nested
    @DisplayName("综合工具调用验证 (verifyToolCall)")
    class ToolCallVerificationTests {

        @Test
        @DisplayName("场景1: 数据未找到错误分析")
        void verifyToolCall_DataNotFound_ProvidesSuggestion() {
            // Given
            String factoryId = "F001";
            String toolName = "material_batch_query";
            String errorMessage = "批次 MB-NOT-EXIST 未找到";

            when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any()))
                    .thenReturn(100);

            List<Map<String, Object>> recentBatches = List.of(
                    Map.of("batch_number", "MB-001", "created_at", "2026-01-19")
            );
            doReturn(recentBatches).when(jdbcTemplate).queryForList(anyString(), (Object) any());

            Map<String, Object> dateRange = Map.of(
                    "earliest", "2025-06-01",
                    "latest", "2026-01-19"
            );
            when(jdbcTemplate.queryForMap(anyString(), any()))
                    .thenReturn(dateRange);

            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyToolCall(factoryId, toolName,
                            Map.of("batchNumber", "MB-NOT-EXIST"), errorMessage);

            // Then
            assertTrue(result.hasData());  // 表中有其他数据
            assertTrue(result.suggestion().contains("数据未找到") ||
                    result.suggestion().contains("调整"));
            assertEquals(errorMessage, result.contextInfo().get("originalError"));
            System.out.println("✅ 场景1通过: 数据未找到错误提供有用建议");
        }

        @Test
        @DisplayName("场景2: 格式错误分析")
        void verifyToolCall_FormatError_ProvidesSuggestion() {
            // Given
            String factoryId = "F001";
            String toolName = "inventory_query";
            String errorMessage = "日期格式错误: 01-19-2026";

            when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any()))
                    .thenReturn(50);

            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyToolCall(factoryId, toolName,
                            Map.of("startDate", "01-19-2026"), errorMessage);

            // Then
            assertTrue(result.suggestion().contains("格式"));
            System.out.println("✅ 场景2通过: 格式错误提供格式建议");
        }

        @Test
        @DisplayName("场景3: 权限错误分析")
        void verifyToolCall_PermissionError_ProvidesSuggestion() {
            // Given
            String factoryId = "F001";
            String toolName = "quality_inspection_query";
            String errorMessage = "Access denied: 无权访问此工厂数据";

            when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any()))
                    .thenReturn(0);

            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyToolCall(factoryId, toolName, Map.of(), errorMessage);

            // Then
            assertTrue(result.suggestion().contains("权限"));
            System.out.println("✅ 场景3通过: 权限错误提供权限建议");
        }

        @Test
        @DisplayName("场景4: 超时错误分析")
        void verifyToolCall_TimeoutError_ProvidesSuggestion() {
            // Given
            String factoryId = "F001";
            String toolName = "production_plan_query";
            String errorMessage = "Query timeout: 执行超时";

            when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any()))
                    .thenReturn(10000);

            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyToolCall(factoryId, toolName, Map.of(), errorMessage);

            // Then
            assertTrue(result.suggestion().contains("超时") || result.suggestion().contains("缩小"));
            System.out.println("✅ 场景4通过: 超时错误提供优化建议");
        }

        @Test
        @DisplayName("场景5: 未知错误分析")
        void verifyToolCall_UnknownError_ProvidesGenericSuggestion() {
            // Given
            String factoryId = "F001";
            String toolName = "unknown_tool";
            String errorMessage = "Something went wrong";

            // When
            ExternalVerifierService.VerificationResult result =
                    externalVerifierService.verifyToolCall(factoryId, toolName, Map.of(), errorMessage);

            // Then
            assertNotNull(result.suggestion());
            assertTrue(result.suggestion().contains("检查参数") || result.suggestion().contains("联系管理员"));
            System.out.println("✅ 场景5通过: 未知错误返回通用建议");
        }
    }

    // ==================== VerificationResult 记录类测试 ====================

    @Nested
    @DisplayName("VerificationResult 记录类测试")
    class VerificationResultTests {

        @Test
        @DisplayName("场景1: 静态工厂方法 empty()")
        void verificationResult_Empty_CreatesCorrectly() {
            // When
            ExternalVerifierService.VerificationResult result =
                    ExternalVerifierService.VerificationResult.empty("TEST_REASON");

            // Then
            assertFalse(result.hasData());
            assertEquals(0, result.recordCount());
            assertEquals("TEST_REASON", result.dataStatus());
            assertTrue(result.contextInfo().isEmpty());
            assertNull(result.suggestion());
            System.out.println("✅ 场景1通过: empty() 工厂方法正确");
        }

        @Test
        @DisplayName("场景2: 静态工厂方法 withData()")
        void verificationResult_WithData_CreatesCorrectly() {
            // Given
            Map<String, Object> context = Map.of("key", "value");

            // When
            ExternalVerifierService.VerificationResult result =
                    ExternalVerifierService.VerificationResult.withData(10, context, "测试建议");

            // Then
            assertTrue(result.hasData());
            assertEquals(10, result.recordCount());
            assertEquals("DATA_AVAILABLE", result.dataStatus());
            assertEquals("value", result.contextInfo().get("key"));
            assertEquals("测试建议", result.suggestion());
            System.out.println("✅ 场景2通过: withData() 工厂方法正确");
        }
    }
}
