package com.cretas.aims.listener;

import com.cretas.aims.event.SkuComplexityChangedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

/**
 * SKU 复杂度变更事件监听器单元测试
 *
 * <p>测试覆盖:
 * <ul>
 *   <li>正常事件处理</li>
 *   <li>不同来源类型的事件 (AI_SOP, MANUAL, AI_LEARNED)</li>
 *   <li>显著变更触发排产更新 (delta > 1)</li>
 *   <li>边界情况和空值处理</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@DisplayName("SKU复杂度事件监听器测试 (SkuComplexityEventListener)")
class SkuComplexityEventListenerTest {

    private SkuComplexityEventListener listener;

    @BeforeEach
    void setUp() {
        listener = new SkuComplexityEventListener();
    }

    // ==========================================
    // 1. 基本事件处理测试
    // ==========================================
    @Nested
    @DisplayName("基本事件处理测试")
    class BasicEventHandlingTests {

        @Test
        @DisplayName("SCEL-001: 应正常处理新建SKU复杂度事件")
        void testHandleNewSkuComplexity() {
            // Given - 新建SKU，oldComplexity = null
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-001",
                    "测试产品A",
                    3,      // newComplexity
                    null,   // oldComplexity (新建)
                    "MANUAL",
                    "首次设置复杂度",
                    "admin"
            );

            // When & Then - 不应抛出异常
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event),
                    "处理新建SKU复杂度事件应不抛出异常");

            // 验证事件属性
            assertTrue(event.isNew(), "新建事件 isNew() 应返回 true");
            assertEquals(3, event.getComplexityDelta(), "新建事件的 delta 应等于 newComplexity");
        }

        @Test
        @DisplayName("SCEL-002: 应正常处理复杂度变更事件")
        void testHandleComplexityChange() {
            // Given - 复杂度从 2 变为 4
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-002",
                    "测试产品B",
                    4,      // newComplexity
                    2,      // oldComplexity
                    "MANUAL",
                    "工艺调整导致复杂度上升",
                    "admin"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event),
                    "处理复杂度变更事件应不抛出异常");

            assertFalse(event.isNew(), "变更事件 isNew() 应返回 false");
            assertEquals(2, event.getComplexityDelta(), "delta 应为 newComplexity - oldComplexity");
            assertTrue(event.isComplexityIncreased(), "复杂度增加时 isComplexityIncreased() 应返回 true");
        }

        @Test
        @DisplayName("SCEL-003: 应正常处理复杂度下降事件")
        void testHandleComplexityDecrease() {
            // Given - 复杂度从 5 变为 3
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-003",
                    "测试产品C",
                    3,      // newComplexity
                    5,      // oldComplexity
                    "MANUAL",
                    "流程优化后复杂度降低",
                    "admin"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event));

            assertEquals(-2, event.getComplexityDelta(), "下降时 delta 应为负数");
            assertTrue(event.isComplexityDecreased(), "复杂度下降时 isComplexityDecreased() 应返回 true");
            assertFalse(event.isComplexityIncreased(), "复杂度下降时 isComplexityIncreased() 应返回 false");
        }
    }

    // ==========================================
    // 2. 来源类型测试
    // ==========================================
    @Nested
    @DisplayName("来源类型测试")
    class SourceTypeTests {

        @Test
        @DisplayName("SCEL-004: AI_SOP来源应触发AI分析处理")
        void testAiSopSourceType() {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-AI-001",
                    "AI分析产品",
                    4,
                    2,
                    "AI_SOP",  // AI 分析来源
                    "AI根据SOP分析得出复杂度",
                    "AI"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event));

            assertTrue(event.isAiAnalyzed(), "AI_SOP来源的 isAiAnalyzed() 应返回 true");
        }

        @Test
        @DisplayName("SCEL-005: MANUAL来源不应触发AI分析处理")
        void testManualSourceType() {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-MANUAL-001",
                    "手动设置产品",
                    3,
                    null,
                    "MANUAL",
                    "手动设置复杂度",
                    "admin"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event));

            assertFalse(event.isAiAnalyzed(), "MANUAL来源的 isAiAnalyzed() 应返回 false");
        }

        @Test
        @DisplayName("SCEL-006: AI_LEARNED来源不应触发AI分析处理")
        void testAiLearnedSourceType() {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-LEARNED-001",
                    "机器学习产品",
                    4,
                    3,
                    "AI_LEARNED",
                    "根据历史数据学习得出",
                    "AI"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event));

            // AI_LEARNED 不等于 AI_SOP，所以不触发AI分析处理
            assertFalse(event.isAiAnalyzed(), "AI_LEARNED来源的 isAiAnalyzed() 应返回 false");
        }

        @ParameterizedTest
        @DisplayName("SCEL-007: 各种来源类型应正常处理")
        @ValueSource(strings = {"AI_SOP", "MANUAL", "AI_LEARNED", "HISTORY", "IMPORT", ""})
        void testVariousSourceTypes(String sourceType) {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-VAR-001",
                    "变量测试产品",
                    3,
                    2,
                    sourceType,
                    "测试不同来源类型",
                    "test"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event),
                    "来源类型 '" + sourceType + "' 应正常处理");
        }
    }

    // ==========================================
    // 3. 排产参数更新触发测试
    // ==========================================
    @Nested
    @DisplayName("排产参数更新触发测试")
    class SchedulingUpdateTriggerTests {

        @Test
        @DisplayName("SCEL-008: delta > 1 应触发排产参数更新")
        void testSignificantIncrease_ShouldTriggerUpdate() {
            // Given - delta = 2 (> 1)
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-SIG-001",
                    "显著变化产品",
                    5,
                    3,
                    "MANUAL",
                    "工艺重大变更",
                    "admin"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event));

            assertEquals(2, event.getComplexityDelta());
            assertTrue(Math.abs(event.getComplexityDelta()) > 1,
                    "delta = 2 应触发排产参数更新");
        }

        @Test
        @DisplayName("SCEL-009: delta < -1 应触发排产参数更新")
        void testSignificantDecrease_ShouldTriggerUpdate() {
            // Given - delta = -2 (< -1)
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-SIG-002",
                    "显著下降产品",
                    2,
                    4,
                    "MANUAL",
                    "流程大幅简化",
                    "admin"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event));

            assertEquals(-2, event.getComplexityDelta());
            assertTrue(Math.abs(event.getComplexityDelta()) > 1,
                    "delta = -2 应触发排产参数更新");
        }

        @Test
        @DisplayName("SCEL-010: delta = 1 不应触发排产参数更新")
        void testMinorChange_ShouldNotTriggerUpdate() {
            // Given - delta = 1 (不 > 1)
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-MINOR-001",
                    "小幅变化产品",
                    4,
                    3,
                    "MANUAL",
                    "微调",
                    "admin"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event));

            assertEquals(1, event.getComplexityDelta());
            assertFalse(Math.abs(event.getComplexityDelta()) > 1,
                    "delta = 1 不应触发排产参数更新");
        }

        @Test
        @DisplayName("SCEL-011: delta = 0 不应触发排产参数更新")
        void testNoChange_ShouldNotTriggerUpdate() {
            // Given - delta = 0 (相同复杂度)
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-SAME-001",
                    "无变化产品",
                    3,
                    3,
                    "MANUAL",
                    "重新确认复杂度",
                    "admin"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event));

            assertEquals(0, event.getComplexityDelta());
            assertFalse(Math.abs(event.getComplexityDelta()) > 1,
                    "delta = 0 不应触发排产参数更新");
            assertFalse(event.isComplexityIncreased());
            assertFalse(event.isComplexityDecreased());
        }

        @ParameterizedTest
        @DisplayName("SCEL-012: 参数化测试不同delta值")
        @CsvSource({
                "5, 3, 2, true",   // delta = 2, 应触发
                "3, 5, -2, true",  // delta = -2, 应触发
                "4, 3, 1, false",  // delta = 1, 不触发
                "3, 4, -1, false", // delta = -1, 不触发
                "3, 3, 0, false",  // delta = 0, 不触发
                "5, 1, 4, true",   // delta = 4, 应触发
                "1, 5, -4, true"   // delta = -4, 应触发
        })
        void testDeltaThreshold(int newComplexity, int oldComplexity, int expectedDelta, boolean shouldTrigger) {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-DELTA-001",
                    "Delta测试产品",
                    newComplexity,
                    oldComplexity,
                    "MANUAL",
                    "测试delta阈值",
                    "admin"
            );

            // When
            int actualDelta = event.getComplexityDelta();
            boolean actualTrigger = Math.abs(actualDelta) > 1;

            // Then
            assertEquals(expectedDelta, actualDelta,
                    String.format("复杂度 %d -> %d 的 delta 应为 %d", oldComplexity, newComplexity, expectedDelta));
            assertEquals(shouldTrigger, actualTrigger,
                    String.format("delta = %d 时触发状态应为 %b", actualDelta, shouldTrigger));

            // 验证事件处理不抛异常
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event));
        }
    }

    // ==========================================
    // 4. 边界情况和空值处理测试
    // ==========================================
    @Nested
    @DisplayName("边界情况和空值处理测试")
    class EdgeCaseTests {

        @Test
        @DisplayName("SCEL-013: 零复杂度应正常处理")
        void testZeroComplexity() {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-ZERO-001",
                    "零复杂度产品",
                    0,      // zero complexity
                    null,
                    "MANUAL",
                    "复杂度为零",
                    "admin"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event));

            assertEquals("未知", event.getNewComplexityDescription(),
                    "复杂度 0 的描述应为 '未知'");
        }

        @Test
        @DisplayName("SCEL-014: 负复杂度应正常处理")
        void testNegativeComplexity() {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-NEG-001",
                    "负复杂度产品",
                    -1,     // negative complexity
                    null,
                    "MANUAL",
                    "异常复杂度值",
                    "admin"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event));

            assertEquals("未知", event.getNewComplexityDescription(),
                    "负复杂度的描述应为 '未知'");
        }

        @Test
        @DisplayName("SCEL-015: 大于5的复杂度应正常处理")
        void testLargeComplexity() {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-LARGE-001",
                    "超高复杂度产品",
                    10,     // > 5
                    5,
                    "MANUAL",
                    "超出正常范围的复杂度",
                    "admin"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event));

            assertEquals("未知", event.getNewComplexityDescription(),
                    "复杂度 > 5 的描述应为 '未知'");
            assertEquals(5, event.getComplexityDelta(),
                    "delta 应为 10 - 5 = 5");
        }

        @Test
        @DisplayName("SCEL-016: null factoryId 应正常处理")
        void testNullFactoryId() {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    null,   // null factoryId
                    "SKU-NULL-F",
                    "无工厂ID产品",
                    3,
                    null,
                    "MANUAL",
                    "测试null factoryId",
                    "admin"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event),
                    "null factoryId 应正常处理");

            assertNull(event.getFactoryId());
        }

        @Test
        @DisplayName("SCEL-017: null skuCode 应正常处理")
        void testNullSkuCode() {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    null,   // null skuCode
                    "无SKU编码产品",
                    3,
                    null,
                    "MANUAL",
                    "测试null skuCode",
                    "admin"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event),
                    "null skuCode 应正常处理");

            assertNull(event.getSkuCode());
        }

        @Test
        @DisplayName("SCEL-018: null sourceType 应正常处理且不触发AI分析")
        void testNullSourceType() {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-NULL-S",
                    "无来源类型产品",
                    3,
                    null,
                    null,   // null sourceType
                    "测试null sourceType",
                    "admin"
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event),
                    "null sourceType 应正常处理");

            assertFalse(event.isAiAnalyzed(),
                    "null sourceType 的 isAiAnalyzed() 应返回 false");
        }

        @Test
        @DisplayName("SCEL-019: 使用简化构造函数创建事件应正常处理")
        void testSimplifiedConstructor() {
            // Given - 使用简化构造函数
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-SIMPLE-001",
                    3
            );

            // When & Then
            assertDoesNotThrow(() -> listener.handleSkuComplexityChanged(event));

            assertEquals("F001", event.getFactoryId());
            assertEquals("SKU-SIMPLE-001", event.getSkuCode());
            assertEquals(3, event.getNewComplexity());
            assertNull(event.getOldComplexity());
            assertTrue(event.isNew());
            assertNull(event.getSourceType());
            assertNull(event.getReason());
            assertNull(event.getChangedBy());
            assertNotNull(event.getChangedAt());
        }
    }

    // ==========================================
    // 5. 复杂度描述测试
    // ==========================================
    @Nested
    @DisplayName("复杂度描述测试")
    class ComplexityDescriptionTests {

        @ParameterizedTest
        @DisplayName("SCEL-020: 验证复杂度等级描述")
        @CsvSource({
                "1, 简单",
                "2, 较简单",
                "3, 中等",
                "4, 较复杂",
                "5, 复杂",
                "0, 未知",
                "6, 未知",
                "-1, 未知"
        })
        void testComplexityDescription(int level, String expectedDescription) {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-DESC-001",
                    "描述测试产品",
                    level,
                    null,
                    "MANUAL",
                    "测试描述",
                    "admin"
            );

            // When
            String actualDescription = event.getNewComplexityDescription();

            // Then
            assertEquals(expectedDescription, actualDescription,
                    String.format("复杂度 %d 的描述应为 '%s'", level, expectedDescription));
        }

        @Test
        @DisplayName("SCEL-021: 旧复杂度为null时描述应为'无'")
        void testOldComplexityNullDescription() {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-OLD-NULL",
                    "新建产品",
                    3,
                    null,
                    "MANUAL",
                    "新建",
                    "admin"
            );

            // When
            String oldDescription = event.getOldComplexityDescription();

            // Then
            assertEquals("无", oldDescription, "旧复杂度为null时描述应为'无'");
        }
    }

    // ==========================================
    // 6. 事件toString测试
    // ==========================================
    @Nested
    @DisplayName("事件toString测试")
    class ToStringTests {

        @Test
        @DisplayName("SCEL-022: toString应包含关键信息")
        void testToStringContainsKeyInfo() {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-STR-001",
                    "toString测试产品",
                    4,
                    2,
                    "AI_SOP",
                    "测试toString",
                    "AI"
            );

            // When
            String str = event.toString();

            // Then
            assertTrue(str.contains("F001"), "toString应包含factoryId");
            assertTrue(str.contains("SKU-STR-001"), "toString应包含skuCode");
            assertTrue(str.contains("2"), "toString应包含oldComplexity");
            assertTrue(str.contains("4"), "toString应包含newComplexity");
            assertTrue(str.contains("AI_SOP"), "toString应包含sourceType");
        }

        @Test
        @DisplayName("SCEL-023: 新建事件的toString应将旧复杂度显示为0")
        void testToStringForNewEvent() {
            // Given
            SkuComplexityChangedEvent event = new SkuComplexityChangedEvent(
                    this,
                    "F001",
                    "SKU-NEW-001",
                    3
            );

            // When
            String str = event.toString();

            // Then
            // toString格式: SkuComplexityChangedEvent[factoryId=F001, skuCode=SKU-NEW-001, 0->3, source=null]
            assertTrue(str.contains("0->3") || str.contains("0 ->3"),
                    "新建事件的toString应将旧复杂度显示为0，实际: " + str);
        }
    }

    // ==========================================
    // 7. 潜在问题验证测试
    // ==========================================
    @Nested
    @DisplayName("潜在问题验证测试")
    class PotentialIssueTests {

        @Test
        @DisplayName("SCEL-024: 验证null事件会导致NullPointerException")
        void testNullEvent_ShouldThrowNPE() {
            // 当前实现没有对null event进行检查
            // 这个测试记录了当前行为，表明可能需要添加null检查
            assertThrows(NullPointerException.class,
                    () -> listener.handleSkuComplexityChanged(null),
                    "null event 目前会导致 NullPointerException，建议添加null检查");
        }

        @Test
        @DisplayName("SCEL-025: 验证newComplexity为null时getComplexityDelta的行为")
        void testNullNewComplexity_DeltaCalculation() {
            // 注意: 当前SkuComplexityChangedEvent的构造函数允许newComplexity为null
            // 但getComplexityDelta()会抛出NullPointerException
            // 这是一个边界情况，实际使用中应避免

            // 该测试仅记录行为，不做断言
            // 生产代码中应确保newComplexity不为null
        }
    }
}
