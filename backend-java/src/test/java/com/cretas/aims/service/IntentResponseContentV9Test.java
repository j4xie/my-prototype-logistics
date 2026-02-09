package com.cretas.aims.service;

import com.cretas.aims.config.IntentCompositionConfig;
import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.handler.HRIntentHandler;
import com.cretas.aims.service.handler.MaterialIntentHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * v9.0 意图响应内容综合测试 - 100个高难度测试用例
 *
 * 测试重点：不仅测试意图识别准确性，更测试响应内容的完整性和质量
 *
 * 覆盖场景：
 * 1. 响应状态验证 (15个)
 * 2. 响应消息质量 (15个)
 * 3. 结果数据结构 (20个)
 * 4. 多维度组合响应 (15个)
 * 5. 错误处理质量 (15个)
 * 6. 边界条件 (10个)
 * 7. 自然语言响应格式 (10个)
 */
@DisplayName("v9.0 意图响应内容综合测试 - 100个高难度用例")
class IntentResponseContentV9Test {

    private TwoStageIntentClassifier classifier;
    private IntentCompositionConfig compositionConfig;

    @BeforeEach
    void setUp() {
        compositionConfig = new IntentCompositionConfig();
        compositionConfig.init();
        classifier = new TwoStageIntentClassifier(compositionConfig, null, null, null);
    }

    // ==================== 响应状态验证 (15个) ====================

    @Nested
    @DisplayName("响应状态验证测试")
    class ResponseStatusTests {

        @ParameterizedTest(name = "[{index}] 状态验证: {0}")
        @DisplayName("基础响应状态验证")
        @CsvSource({
                "查询今天考勤, ATTENDANCE, QUERY, true",
                "查询原料入库, MATERIAL, QUERY, true",
                "查询质检记录, QUALITY, QUERY, true",
                "查询设备状态, EQUIPMENT, QUERY, true",
                "查询生产批次, PROCESSING, QUERY, true",
                "查询发货记录, SHIPMENT, QUERY, true",
                "查询告警信息, ALERT, QUERY, true",
                "新增入库记录, MATERIAL, CREATE, true",
                "新增质检记录, QUALITY, CREATE, true",
                "处理告警, ALERT, UPDATE, true"
        })
        void testBasicResponseStatus(String input, String expectedDomain, String expectedAction, boolean shouldSucceed) {
            TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);

            // 验证分类成功
            assertTrue(result.isSuccessful(), "Classification should succeed for: " + input);
            assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain());
            assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction());

            // 验证响应构建必要字段
            assertNotNull(result.getComposedIntent(), "Composed intent should not be null");
            assertNotNull(result.getTimeScope(), "TimeScope should not be null");
            assertNotNull(result.getModifiers(), "Modifiers should not be null");
        }

        @Test
        @DisplayName("UNKNOWN 域的响应状态")
        void testUnknownDomainStatus() {
            String input = "今天天气怎么样";
            TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);

            assertEquals(TwoStageIntentClassifier.ClassifiedDomain.UNKNOWN, result.getDomain());
            // UNKNOWN domain should still have a composed intent
            assertNotNull(result.getComposedIntent());
            assertTrue(result.getComposedIntent().startsWith("UNKNOWN"));
        }

        @ParameterizedTest
        @DisplayName("高置信度响应验证")
        @ValueSource(strings = {
                "查询今天的考勤记录",
                "新增原料入库",
                "统计本月质检合格率",
                "查看设备运行状态",
                "处理这个告警"
        })
        void testHighConfidenceResponse(String input) {
            TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);

            // 明确意图应该有较高置信度
            assertTrue(result.getConfidence() >= 0.7,
                    "Confidence should be >= 0.7 for clear intent: " + input);
        }
    }

    // ==================== 响应消息质量 (15个) ====================

    @Nested
    @DisplayName("响应消息质量测试")
    class ResponseMessageQualityTests {

        @ParameterizedTest(name = "[{index}] 消息质量: {0} -> {1}")
        @DisplayName("意图名称可读性")
        @CsvSource({
                "查询考勤, ATTENDANCE_TODAY",
                "统计考勤, ATTENDANCE_STATS",
                "谁没来, ATTENDANCE_ANOMALY",
                "查张三考勤, ATTENDANCE_HISTORY",
                "本月考勤, ATTENDANCE_MONTHLY",
                "查原料入库, MATERIAL_BATCH_QUERY",
                "明天要到的原料, MATERIAL_INCOMING",
                "查质检记录, QUALITY_CHECK_QUERY",
                "质检统计, QUALITY_STATS",
                "关键质检项, QUALITY_CRITICAL_ITEMS",
                "查设备状态, EQUIPMENT_STATUS",
                "设备统计, EQUIPMENT_STATS",
                "告警列表, ALERT_LIST",
                "紧急告警, ALERT_CRITICAL",
                "告警统计, ALERT_STATS"
        })
        void testIntentNameReadability(String input, String expectedIntent) {
            TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);

            assertEquals(expectedIntent, result.getComposedIntent(),
                    "Intent should match for: " + input);

            // 验证意图代码格式 (DOMAIN_ACTION 或 DOMAIN_MODIFIER_ACTION)
            String intent = result.getComposedIntent();
            assertTrue(intent.matches("[A-Z]+_[A-Z_]+"),
                    "Intent format should be DOMAIN_ACTION: " + intent);
        }

        @Test
        @DisplayName("时间范围消息准确性")
        void testTimeScopeMessageAccuracy() {
            // 过去时态
            TwoStageIntentClassifier.TwoStageResult pastResult = classifier.classify("昨天的入库记录");
            assertEquals("PAST", pastResult.getTimeScope());

            // 当前时态
            TwoStageIntentClassifier.TwoStageResult presentResult = classifier.classify("今天的考勤");
            assertEquals("PRESENT", presentResult.getTimeScope());

            // 未来时态
            TwoStageIntentClassifier.TwoStageResult futureResult = classifier.classify("明天要到的原料");
            assertEquals("FUTURE", futureResult.getTimeScope());
        }

        @Test
        @DisplayName("修饰语准确传递")
        void testModifierAccuracy() {
            // STATS 修饰语
            TwoStageIntentClassifier.TwoStageResult statsResult = classifier.classify("统计考勤人数");
            assertTrue(statsResult.getModifiers().contains("STATS"),
                    "Should contain STATS modifier");

            // ANOMALY 修饰语
            TwoStageIntentClassifier.TwoStageResult anomalyResult = classifier.classify("谁今天没来");
            assertTrue(anomalyResult.getModifiers().contains("ANOMALY"),
                    "Should contain ANOMALY modifier");

            // PERSONAL 修饰语
            TwoStageIntentClassifier.TwoStageResult personalResult = classifier.classify("查张三的考勤");
            assertTrue(personalResult.getModifiers().contains("PERSONAL"),
                    "Should contain PERSONAL modifier");
        }
    }

    // ==================== 结果数据结构 (20个) ====================

    @Nested
    @DisplayName("结果数据结构测试")
    class ResultDataStructureTests {

        @ParameterizedTest(name = "[{index}] 数据结构: {0}")
        @DisplayName("分类结果完整性")
        @CsvSource({
                "查询今天谁来了",
                "统计本月考勤数据",
                "查询7天内的入库记录",
                "明天要到的原料批次",
                "质检合格率统计",
                "设备运行情况",
                "最近的发货记录",
                "系统告警列表",
                "供应商信息",
                "客户订单查询"
        })
        void testResultDataCompleteness(String input) {
            TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);

            // 验证所有必要字段
            assertAll("Result completeness for: " + input,
                    () -> assertNotNull(result.getDomain(), "Domain should not be null"),
                    () -> assertNotNull(result.getAction(), "Action should not be null"),
                    () -> assertNotNull(result.getComposedIntent(), "ComposedIntent should not be null"),
                    () -> assertNotNull(result.getTimeScope(), "TimeScope should not be null"),
                    () -> assertNotNull(result.getTargetScope(), "TargetScope should not be null"),
                    () -> assertNotNull(result.getModifiers(), "Modifiers should not be null"),
                    () -> assertTrue(result.getConfidence() > 0, "Confidence should be positive")
            );
        }

        @Test
        @DisplayName("多修饰语数据结构")
        void testMultiModifierDataStructure() {
            // 同时包含 STATS 和 ANOMALY
            TwoStageIntentClassifier.TwoStageResult result = classifier.classify("统计缺勤人数");

            Set<String> modifiers = result.getModifiers();
            assertNotNull(modifiers);
            // 至少有一个修饰语
            assertFalse(modifiers.isEmpty(), "Should have at least one modifier");
        }

        @ParameterizedTest
        @DisplayName("领域特定数据结构")
        @CsvSource({
                "考勤, ATTENDANCE",
                "入库, MATERIAL",
                "质检, QUALITY",
                "设备, EQUIPMENT",
                "生产, PROCESSING",
                "发货, SHIPMENT",
                "告警, ALERT",
                "供应商, SUPPLIER",
                "客户, CUSTOMER"
        })
        void testDomainSpecificDataStructure(String keyword, String expectedDomain) {
            String input = "查询" + keyword + "记录";
            TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);

            assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain());
            // 验证意图包含领域前缀
            assertTrue(result.getComposedIntent().startsWith(expectedDomain),
                    "Intent should start with domain: " + expectedDomain);
        }
    }

    // ==================== 多维度组合响应 (15个) ====================

    @Nested
    @DisplayName("多维度组合响应测试")
    class MultiDimensionResponseTests {

        @ParameterizedTest(name = "[{index}] 组合: {0}")
        @DisplayName("Domain + Action + Modifier 组合")
        @CsvSource({
                "统计今天缺勤人数, ATTENDANCE, QUERY, ANOMALY",
                "统计本月考勤数据, ATTENDANCE, QUERY, STATS",
                "查张三的考勤历史, ATTENDANCE, QUERY, PERSONAL",
                "查本月考勤, ATTENDANCE, QUERY, MONTHLY",
                "统计质检合格率, QUALITY, QUERY, STATS",
                "关键质检项目, QUALITY, QUERY, CRITICAL",
                "统计设备数量, EQUIPMENT, QUERY, STATS",
                "统计告警数量, ALERT, QUERY, STATS",
                "紧急告警, ALERT, QUERY, CRITICAL",
                "明天要到的物料, MATERIAL, QUERY, FUTURE"
        })
        void testDomainActionModifierCombination(String input, String expectedDomain,
                                                  String expectedAction, String expectedModifier) {
            TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);

            assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                    "Domain mismatch for: " + input);
            assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                    "Action mismatch for: " + input);
            assertTrue(result.getModifiers().contains(expectedModifier),
                    "Should contain modifier " + expectedModifier + " for: " + input);
        }

        @Test
        @DisplayName("时间维度组合测试")
        void testTimeDimensionCombination() {
            Map<String, String> timeTests = Map.of(
                    "昨天的考勤记录", "PAST",
                    "今天的入库情况", "PRESENT",
                    "明天要到的原料", "FUTURE",
                    "上周的质检数据", "PAST",
                    "下周的生产计划", "FUTURE"
            );

            for (Map.Entry<String, String> entry : timeTests.entrySet()) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(entry.getKey());
                assertEquals(entry.getValue(), result.getTimeScope(),
                        "TimeScope mismatch for: " + entry.getKey());
            }
        }

        @Test
        @DisplayName("范围维度组合测试")
        void testScopeDimensionCombination() {
            // 个人范围
            TwoStageIntentClassifier.TwoStageResult personalResult = classifier.classify("我的考勤记录");
            assertEquals("PERSONAL", personalResult.getTargetScope());

            // 部门范围
            TwoStageIntentClassifier.TwoStageResult deptResult = classifier.classify("部门考勤统计");
            assertEquals("DEPARTMENTAL", deptResult.getTargetScope());

            // 全体范围 (默认)
            TwoStageIntentClassifier.TwoStageResult allResult = classifier.classify("考勤统计");
            assertEquals("ALL", allResult.getTargetScope());
        }
    }

    // ==================== 错误处理质量 (15个) ====================

    @Nested
    @DisplayName("错误处理质量测试")
    class ErrorHandlingQualityTests {

        @ParameterizedTest(name = "[{index}] 模糊输入: {0}")
        @DisplayName("模糊输入处理")
        @ValueSource(strings = {
                "帮我看看",
                "查一下",
                "怎么样",
                "情况如何",
                "有什么",
                "弄一下",
                "搞一下",
                "处理一下"
        })
        void testAmbiguousInputHandling(String input) {
            TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);

            // 模糊输入应该返回 UNKNOWN 或低置信度
            if (result.getDomain() == TwoStageIntentClassifier.ClassifiedDomain.UNKNOWN) {
                assertNotNull(result.getComposedIntent());
            } else {
                // 如果识别到领域，置信度应该相对较低
                assertTrue(result.getConfidence() <= 0.9,
                        "Confidence for ambiguous input should not be too high: " + input);
            }
        }

        @Test
        @DisplayName("空输入处理")
        void testEmptyInputHandling() {
            TwoStageIntentClassifier.TwoStageResult result = classifier.classify("");

            assertEquals(TwoStageIntentClassifier.ClassifiedDomain.UNKNOWN, result.getDomain());
            assertNotNull(result.getComposedIntent());
        }

        @Test
        @DisplayName("特殊字符输入处理")
        void testSpecialCharacterHandling() {
            String[] specialInputs = {
                    "查询考勤!!!",
                    "入库记录？？？",
                    "设备状态...",
                    "告警@#$%",
                    "质检<>记录"
            };

            for (String input : specialInputs) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                // 应该能够忽略特殊字符并正常分类
                assertNotNull(result.getDomain(), "Should handle special characters in: " + input);
                assertNotNull(result.getComposedIntent());
            }
        }

        @Test
        @DisplayName("超长输入处理")
        void testLongInputHandling() {
            String longInput = "请帮我查询一下今天上午8点到下午6点之间所有员工的考勤打卡记录，" +
                    "包括正常打卡、迟到、早退、缺勤的详细情况，并且统计各部门的出勤率，" +
                    "同时标注出有异常情况的员工名单";

            TwoStageIntentClassifier.TwoStageResult result = classifier.classify(longInput);

            // 长输入应该能正常处理
            assertNotNull(result.getDomain());
            assertNotNull(result.getComposedIntent());
            assertTrue(result.isSuccessful());
        }

        @Test
        @DisplayName("重复关键词处理")
        void testRepeatedKeywordsHandling() {
            String input = "考勤考勤考勤查询考勤";
            TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);

            assertEquals(TwoStageIntentClassifier.ClassifiedDomain.ATTENDANCE, result.getDomain());
            assertEquals(TwoStageIntentClassifier.ClassifiedAction.QUERY, result.getAction());
        }
    }

    // ==================== 边界条件 (10个) ====================

    @Nested
    @DisplayName("边界条件测试")
    class BoundaryConditionTests {

        @Test
        @DisplayName("单字输入")
        void testSingleCharacterInput() {
            String[] singleChars = {"查", "看", "找", "加", "建"};

            for (String input : singleChars) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                // 单字应该返回 UNKNOWN 或有响应
                assertNotNull(result);
                assertNotNull(result.getDomain());
            }
        }

        @Test
        @DisplayName("数字输入")
        void testNumericInput() {
            String[] numericInputs = {"12345", "100", "2024", "123abc"};

            for (String input : numericInputs) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                assertNotNull(result);
                // 纯数字应该是 UNKNOWN
                if (!input.contains("abc")) {
                    assertEquals(TwoStageIntentClassifier.ClassifiedDomain.UNKNOWN, result.getDomain());
                }
            }
        }

        @Test
        @DisplayName("英文输入")
        void testEnglishInput() {
            String[] englishInputs = {"query attendance", "check inventory", "show alerts"};

            for (String input : englishInputs) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                // 英文输入可能无法识别
                assertNotNull(result);
                assertNotNull(result.getComposedIntent());
            }
        }

        @ParameterizedTest
        @DisplayName("临界时间表达")
        @CsvSource({
                "刚刚的入库, PRESENT",
                "马上要到的原料, FUTURE",
                "一会儿的计划, FUTURE",
                "刚才的考勤, PRESENT"
        })
        void testBorderlineTimeExpressions(String input, String expectedTimeScope) {
            TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
            assertEquals(expectedTimeScope, result.getTimeScope(),
                    "TimeScope mismatch for: " + input);
        }
    }

    // ==================== 自然语言响应格式 (10个) ====================

    @Nested
    @DisplayName("自然语言响应格式测试")
    class NaturalLanguageFormatTests {

        @Test
        @DisplayName("意图代码命名规范")
        void testIntentCodeNamingConvention() {
            String[] testInputs = {
                    "查询考勤",
                    "统计入库",
                    "新增质检",
                    "处理告警",
                    "更新设备"
            };

            for (String input : testInputs) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                String intent = result.getComposedIntent();

                // 验证命名规范: DOMAIN_ACTION 或 DOMAIN_MODIFIER
                assertTrue(intent.matches("[A-Z]+_[A-Z_]+"),
                        "Intent should follow naming convention: " + intent);

                // 不应该包含小写字母
                assertFalse(intent.chars().anyMatch(Character::isLowerCase),
                        "Intent should be uppercase: " + intent);

                // 不应该包含连续下划线
                assertFalse(intent.contains("__"),
                        "Intent should not have double underscores: " + intent);
            }
        }

        @Test
        @DisplayName("领域关键词匹配一致性")
        void testDomainKeywordConsistency() {
            Map<String, TwoStageIntentClassifier.ClassifiedDomain> keywordDomainMap = Map.of(
                    "考勤", TwoStageIntentClassifier.ClassifiedDomain.ATTENDANCE,
                    "打卡", TwoStageIntentClassifier.ClassifiedDomain.ATTENDANCE,
                    "入库", TwoStageIntentClassifier.ClassifiedDomain.MATERIAL,
                    "原料", TwoStageIntentClassifier.ClassifiedDomain.MATERIAL,
                    "质检", TwoStageIntentClassifier.ClassifiedDomain.QUALITY,
                    "设备", TwoStageIntentClassifier.ClassifiedDomain.EQUIPMENT,
                    "生产", TwoStageIntentClassifier.ClassifiedDomain.PROCESSING,
                    "发货", TwoStageIntentClassifier.ClassifiedDomain.SHIPMENT,
                    "告警", TwoStageIntentClassifier.ClassifiedDomain.ALERT
            );

            for (Map.Entry<String, TwoStageIntentClassifier.ClassifiedDomain> entry : keywordDomainMap.entrySet()) {
                String input = "查询" + entry.getKey();
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                assertEquals(entry.getValue(), result.getDomain(),
                        "Domain mismatch for keyword: " + entry.getKey());
            }
        }

        @Test
        @DisplayName("操作关键词匹配一致性")
        void testActionKeywordConsistency() {
            Map<String, TwoStageIntentClassifier.ClassifiedAction> keywordActionMap = Map.of(
                    "查询考勤", TwoStageIntentClassifier.ClassifiedAction.QUERY,
                    "新增入库", TwoStageIntentClassifier.ClassifiedAction.CREATE,
                    "登记质检", TwoStageIntentClassifier.ClassifiedAction.CREATE,
                    "处理告警", TwoStageIntentClassifier.ClassifiedAction.UPDATE,
                    "更新设备", TwoStageIntentClassifier.ClassifiedAction.UPDATE
            );

            for (Map.Entry<String, TwoStageIntentClassifier.ClassifiedAction> entry : keywordActionMap.entrySet()) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(entry.getKey());
                assertEquals(entry.getValue(), result.getAction(),
                        "Action mismatch for: " + entry.getKey());
            }
        }
    }

    // ==================== 复杂场景响应测试 (额外10个) ====================

    @Nested
    @DisplayName("复杂场景响应测试")
    class ComplexScenarioResponseTests {

        @Test
        @DisplayName("多意图混合输入")
        void testMultiIntentMixedInput() {
            // 包含多个可能意图的输入
            String input = "查询今天考勤并统计缺勤人数";
            TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);

            // 应该识别出主要意图
            assertEquals(TwoStageIntentClassifier.ClassifiedDomain.ATTENDANCE, result.getDomain());
            assertNotNull(result.getComposedIntent());
        }

        @Test
        @DisplayName("条件查询响应")
        void testConditionalQueryResponse() {
            String[] conditionalInputs = {
                    "查询合格率大于90%的质检记录",
                    "找出缺勤超过3次的员工",
                    "统计库存低于100的原料",
                    "查看运行超过8小时的设备"
            };

            for (String input : conditionalInputs) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                assertNotNull(result.getDomain());
                assertEquals(TwoStageIntentClassifier.ClassifiedAction.QUERY, result.getAction());
            }
        }

        @Test
        @DisplayName("时间范围查询响应")
        void testTimeRangeQueryResponse() {
            String[] timeRangeInputs = {
                    "查询最近7天的考勤",
                    "统计本月入库数量",
                    "查看上周的质检记录",
                    "今年的发货统计"
            };

            for (String input : timeRangeInputs) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                assertNotNull(result.getDomain());
                assertNotNull(result.getTimeScope());
            }
        }

        @Test
        @DisplayName("跨领域查询优先级")
        void testCrossDomainPriority() {
            // 测试当输入包含多个领域关键词时的处理
            String input = "入库的原料质检";
            TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);

            // 应该选择一个主领域
            assertNotNull(result.getDomain());
            assertNotEquals(TwoStageIntentClassifier.ClassifiedDomain.UNKNOWN, result.getDomain());
        }

        @Test
        @DisplayName("否定表达响应")
        void testNegationExpressionResponse() {
            String[] negationInputs = {
                    "哪些人没来",
                    "什么设备没有运行",
                    "哪些原料还没入库"
            };

            for (String input : negationInputs) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                // 否定表达应该正常处理
                assertNotNull(result.getDomain());
                assertEquals(TwoStageIntentClassifier.ClassifiedAction.QUERY, result.getAction());
            }
        }

        @Test
        @DisplayName("语气词处理")
        void testModalParticleHandling() {
            String[] modalInputs = {
                    "今天考勤怎么样啊",
                    "帮我查下入库吧",
                    "看看设备呢"
            };

            for (String input : modalInputs) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                assertNotNull(result.getDomain());
                assertNotEquals(TwoStageIntentClassifier.ClassifiedDomain.UNKNOWN, result.getDomain(),
                        "Should recognize domain despite modal particles: " + input);
            }
        }

        @Test
        @DisplayName("时间+统计组合")
        void testTimeStatsCombination() {
            Map<String, String> timeStatsInputs = Map.of(
                    "本月考勤统计", "ATTENDANCE_STATS",
                    "上周质检汇总", "QUALITY_STATS",
                    "今天入库数量", "MATERIAL_BATCH_QUERY",
                    "本周设备统计", "EQUIPMENT_STATS"
            );

            for (Map.Entry<String, String> entry : timeStatsInputs.entrySet()) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(entry.getKey());
                assertEquals(entry.getValue(), result.getComposedIntent(),
                        "Intent mismatch for: " + entry.getKey());
            }
        }

        @Test
        @DisplayName("创建操作响应一致性")
        void testCreateActionResponseConsistency() {
            String[] createInputs = {
                    "新增入库记录",
                    "添加质检数据",
                    "登记发货单",
                    "录入客户信息"
            };

            for (String input : createInputs) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                assertEquals(TwoStageIntentClassifier.ClassifiedAction.CREATE, result.getAction(),
                        "Should be CREATE action for: " + input);
                assertTrue(result.getComposedIntent().endsWith("_CREATE"),
                        "Intent should end with _CREATE for: " + input);
            }
        }

        @Test
        @DisplayName("更新操作响应一致性")
        void testUpdateActionResponseConsistency() {
            String[] updateInputs = {
                    "处理告警",
                    "更新设备状态",
                    "完成生产批次"
            };

            for (String input : updateInputs) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                assertEquals(TwoStageIntentClassifier.ClassifiedAction.UPDATE, result.getAction(),
                        "Should be UPDATE action for: " + input);
            }
        }

        @Test
        @DisplayName("置信度区间验证")
        void testConfidenceRangeValidation() {
            String[] testInputs = {
                    "查询考勤",
                    "帮我看看",
                    "入库",
                    "今天谁来了"
            };

            for (String input : testInputs) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                // 置信度应该在0-1之间
                assertTrue(result.getConfidence() >= 0.0 && result.getConfidence() <= 1.0,
                        "Confidence should be between 0 and 1 for: " + input);
            }
        }

        @Test
        @DisplayName("TargetScope 默认值")
        void testTargetScopeDefaults() {
            // 没有明确范围指示的查询应该默认 ALL
            String[] generalInputs = {
                    "查询考勤",
                    "入库记录",
                    "质检统计"
            };

            for (String input : generalInputs) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                assertEquals("ALL", result.getTargetScope(),
                        "Default TargetScope should be ALL for: " + input);
            }
        }

        @Test
        @DisplayName("Modifiers 为空集合而非 null")
        void testModifiersNeverNull() {
            String[] testInputs = {
                    "查询考勤",
                    "帮我看看",
                    "12345",
                    ""
            };

            for (String input : testInputs) {
                TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
                assertNotNull(result.getModifiers(),
                        "Modifiers should never be null for: " + input);
            }
        }
    }
}
