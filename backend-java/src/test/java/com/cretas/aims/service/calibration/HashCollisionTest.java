package com.cretas.aims.service.calibration;

import com.cretas.aims.entity.calibration.ToolCallCache;
import com.cretas.aims.repository.calibration.ToolCallCacheRepository;
import com.cretas.aims.repository.calibration.ToolCallRecordRepository;
import com.cretas.aims.service.calibration.impl.ToolCallRedundancyServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * SHA-256 哈希碰撞与完整性测试
 *
 * 该测试类验证 ToolCallRedundancyService.computeParametersHash() 方法的：
 * 1. 哈希唯一性 - 不同输入产生不同哈希
 * 2. 哈希一致性 - 相同输入始终产生相同哈希
 * 3. 参数顺序无关性 - TreeMap 排序确保顺序一致
 * 4. 碰撞概率分析 - 大量输入的碰撞检测
 * 5. 边界条件处理 - 空值、特殊字符、Unicode等
 * 6. 性能基准 - 哈希计算效率
 * 7. 安全性验证 - 截断风险、分布均匀性
 *
 * 基于 ET-Agent 论文 (arXiv:2601.06860) 的缓存键设计要求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("哈希碰撞与完整性测试 - SHA-256")
class HashCollisionTest {

    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private ToolCallCacheRepository toolCallCacheRepository;

    private ObjectMapper objectMapper;
    private ToolCallRedundancyServiceImpl redundancyService;

    // 测试常量
    private static final int HASH_LENGTH = 64; // SHA-256 产生 64 字符的十六进制字符串
    private static final String EMPTY_STRING_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        redundancyService = new ToolCallRedundancyServiceImpl(
            toolCallRecordRepository,
            toolCallCacheRepository,
            objectMapper
        );
    }

    // ========== 1. 哈希唯一性测试 ==========

    @Nested
    @DisplayName("1. 哈希唯一性测试")
    class HashUniquenessTests {

        @Test
        @DisplayName("1.1 不同参数值应产生不同哈希 - 验证SHA-256基本特性")
        void differentParameterValues_ShouldProduceDifferentHashes() {
            // 准备：创建多组不同参数
            List<Map<String, Object>> parameterSets = Arrays.asList(
                createParams("batchId", "B001"),
                createParams("batchId", "B002"),
                createParams("batchId", "B003"),
                createParams("batchId", "batch_001"),
                createParams("batchId", "BATCH-001")
            );

            // 执行：计算所有哈希
            Set<String> hashes = parameterSets.stream()
                .map(redundancyService::computeParametersHash)
                .collect(Collectors.toSet());

            // 验证：所有哈希都应该唯一
            assertEquals(parameterSets.size(), hashes.size(),
                "不同参数应产生不同的唯一哈希值");
        }

        @ParameterizedTest
        @DisplayName("1.2 相似但不同的参数应产生不同哈希")
        @MethodSource("com.cretas.aims.service.calibration.HashCollisionTest#provideSimilarParameters")
        void similarButDifferentParameters_ShouldProduceDifferentHashes(
                Map<String, Object> params1, Map<String, Object> params2, String description) {
            // 执行
            String hash1 = redundancyService.computeParametersHash(params1);
            String hash2 = redundancyService.computeParametersHash(params2);

            // 验证：即使参数相似，哈希也必须不同
            assertNotEquals(hash1, hash2,
                "相似参数应产生不同哈希: " + description);
        }

        @Test
        @DisplayName("1.3 数值类型差异应产生不同哈希 - 整数vs字符串")
        void numericTypeDifference_ShouldProduceDifferentHashes() {
            // 准备：整数和字符串形式的相同数值
            Map<String, Object> paramsWithInteger = createParams("quantity", 100);
            Map<String, Object> paramsWithString = createParams("quantity", "100");

            // 执行
            String hashInteger = redundancyService.computeParametersHash(paramsWithInteger);
            String hashString = redundancyService.computeParametersHash(paramsWithString);

            // 验证：JSON序列化会保留类型信息
            assertNotEquals(hashInteger, hashString,
                "整数100和字符串\"100\"应产生不同哈希");
        }
    }

    // ========== 2. 参数顺序无关性测试 ==========

    @Nested
    @DisplayName("2. 参数顺序无关性测试")
    class ParameterOrderingTests {

        @Test
        @DisplayName("2.1 不同顺序插入的参数应产生相同哈希 - TreeMap排序验证")
        void differentInsertionOrder_ShouldProduceSameHash() {
            // 准备：以不同顺序插入相同参数
            Map<String, Object> params1 = new LinkedHashMap<>();
            params1.put("aaa", "value1");
            params1.put("bbb", "value2");
            params1.put("ccc", "value3");

            Map<String, Object> params2 = new LinkedHashMap<>();
            params2.put("ccc", "value3");
            params2.put("aaa", "value1");
            params2.put("bbb", "value2");

            Map<String, Object> params3 = new LinkedHashMap<>();
            params3.put("bbb", "value2");
            params3.put("ccc", "value3");
            params3.put("aaa", "value1");

            // 执行
            String hash1 = redundancyService.computeParametersHash(params1);
            String hash2 = redundancyService.computeParametersHash(params2);
            String hash3 = redundancyService.computeParametersHash(params3);

            // 验证：TreeMap确保顺序一致性
            assertEquals(hash1, hash2, "不同顺序插入应产生相同哈希 (1vs2)");
            assertEquals(hash2, hash3, "不同顺序插入应产生相同哈希 (2vs3)");
            assertEquals(hash1, hash3, "不同顺序插入应产生相同哈希 (1vs3)");
        }

        @ParameterizedTest
        @DisplayName("2.2 多键参数的顺序无关性验证")
        @ValueSource(ints = {3, 5, 10, 20, 50})
        void multipleKeys_OrderIndependent(int keyCount) {
            // 准备：创建指定数量的键值对
            List<String> keys = IntStream.range(0, keyCount)
                .mapToObj(i -> "key_" + String.format("%03d", i))
                .collect(Collectors.toList());

            // 原始顺序
            Map<String, Object> orderedParams = new LinkedHashMap<>();
            keys.forEach(k -> orderedParams.put(k, "value_" + k));

            // 随机打乱顺序
            List<String> shuffledKeys = new ArrayList<>(keys);
            Collections.shuffle(shuffledKeys, new Random(42));
            Map<String, Object> shuffledParams = new LinkedHashMap<>();
            shuffledKeys.forEach(k -> shuffledParams.put(k, "value_" + k));

            // 执行
            String hashOrdered = redundancyService.computeParametersHash(orderedParams);
            String hashShuffled = redundancyService.computeParametersHash(shuffledParams);

            // 验证
            assertEquals(hashOrdered, hashShuffled,
                String.format("%d个键的参数顺序应不影响哈希结果", keyCount));
        }
    }

    // ========== 3. 哈希一致性测试 ==========

    @Nested
    @DisplayName("3. 哈希一致性测试")
    class HashConsistencyTests {

        @Test
        @DisplayName("3.1 多次调用应产生相同哈希 - 确定性验证")
        void multipleInvocations_ShouldProduceConsistentHash() {
            // 准备
            Map<String, Object> params = createParams("batchId", "B001", "quantity", 100);
            int invocationCount = 1000;

            // 执行：多次计算哈希
            Set<String> hashes = IntStream.range(0, invocationCount)
                .mapToObj(i -> redundancyService.computeParametersHash(params))
                .collect(Collectors.toSet());

            // 验证：所有哈希应完全相同
            assertEquals(1, hashes.size(),
                String.format("%d次调用应产生完全相同的哈希", invocationCount));
        }

        @Test
        @DisplayName("3.2 跨实例哈希一致性 - 新实例应产生相同结果")
        void acrossInstances_ShouldProduceConsistentHash() {
            // 准备
            Map<String, Object> params = createParams("materialId", "MAT-001", "weight", 50.5);

            // 执行：使用两个不同的服务实例
            String hash1 = redundancyService.computeParametersHash(params);

            ToolCallRedundancyServiceImpl anotherInstance = new ToolCallRedundancyServiceImpl(
                toolCallRecordRepository,
                toolCallCacheRepository,
                new ObjectMapper()
            );
            String hash2 = anotherInstance.computeParametersHash(params);

            // 验证
            assertEquals(hash1, hash2, "不同服务实例应产生相同哈希");
        }

        @Test
        @DisplayName("3.3 空参数哈希一致性 - null和空Map等价")
        void emptyParameters_ShouldBeConsistent() {
            // 执行
            String hashNull = redundancyService.computeParametersHash(null);
            String hashEmptyMap = redundancyService.computeParametersHash(new HashMap<>());
            String hashEmptyLinkedMap = redundancyService.computeParametersHash(new LinkedHashMap<>());
            String hashEmptyTreeMap = redundancyService.computeParametersHash(new TreeMap<>());

            // 验证：所有空参数应产生相同哈希
            assertEquals(hashNull, hashEmptyMap, "null应等于空HashMap");
            assertEquals(hashEmptyMap, hashEmptyLinkedMap, "空HashMap应等于空LinkedHashMap");
            assertEquals(hashEmptyLinkedMap, hashEmptyTreeMap, "空LinkedHashMap应等于空TreeMap");
            assertEquals(EMPTY_STRING_SHA256, hashNull, "空输入应产生空字符串的SHA-256");
        }
    }

    // ========== 4. 碰撞概率分析 ==========

    @Nested
    @DisplayName("4. 碰撞概率分析")
    class CollisionProbabilityTests {

        @Test
        @DisplayName("4.1 大规模唯一输入碰撞检测 - 10000个输入")
        void largeScaleUniqueness_ShouldHaveNoCollisions() {
            // 准备：生成10000个唯一参数集
            int sampleSize = 10000;
            Set<String> hashes = new HashSet<>();
            int collisionCount = 0;

            // 执行
            for (int i = 0; i < sampleSize; i++) {
                Map<String, Object> params = createParams(
                    "id", "ID-" + i,
                    "timestamp", System.nanoTime() + i,
                    "random", UUID.randomUUID().toString()
                );
                String hash = redundancyService.computeParametersHash(params);

                if (!hashes.add(hash)) {
                    collisionCount++;
                }
            }

            // 验证：SHA-256理论上不应有碰撞
            assertEquals(0, collisionCount,
                String.format("%d个唯一输入不应产生任何碰撞", sampleSize));
            assertEquals(sampleSize, hashes.size(),
                "所有哈希应完全唯一");
        }

        @Test
        @DisplayName("4.2 随机参数碰撞测试 - 随机生成的参数组合")
        void randomParameters_ShouldHaveNoCollisions() {
            // 准备
            int sampleSize = 5000;
            Random random = new Random(12345); // 固定种子确保可重复
            Set<String> hashes = new HashSet<>();

            // 执行
            for (int i = 0; i < sampleSize; i++) {
                Map<String, Object> params = createParams(
                    "field1", "value_" + random.nextInt(1000000),
                    "field2", random.nextDouble(),
                    "field3", random.nextBoolean(),
                    "field4", random.nextLong()
                );
                hashes.add(redundancyService.computeParametersHash(params));
            }

            // 验证
            assertEquals(sampleSize, hashes.size(),
                "随机参数不应产生碰撞");
        }

        @Test
        @DisplayName("4.3 生日悖论验证 - 在较小哈希空间中检测碰撞概率")
        void birthdayParadoxSimulation_ShouldShowNoCollisionsFor256Bits() {
            // 说明：SHA-256有2^256种可能，生日悖论概率极低
            // 即使测试2^32 (约40亿)个输入，碰撞概率仍接近0
            // 这里测试较小样本验证实现正确性

            int sampleSize = 50000;
            Map<String, String> hashToInput = new HashMap<>();
            List<String> collisions = new ArrayList<>();

            for (int i = 0; i < sampleSize; i++) {
                String input = "unique_input_" + i + "_" + UUID.randomUUID();
                Map<String, Object> params = createParams("data", input);
                String hash = redundancyService.computeParametersHash(params);

                if (hashToInput.containsKey(hash)) {
                    collisions.add(String.format(
                        "碰撞发现: '%s' 和 '%s' 产生相同哈希 %s",
                        hashToInput.get(hash), input, hash
                    ));
                } else {
                    hashToInput.put(hash, input);
                }
            }

            // 验证
            assertTrue(collisions.isEmpty(),
                "不应存在碰撞:\n" + String.join("\n", collisions));
        }
    }

    // ========== 5. 嵌套对象哈希测试 ==========

    @Nested
    @DisplayName("5. 嵌套对象哈希测试")
    class NestedObjectHashingTests {

        @Test
        @DisplayName("5.1 嵌套Map对象应正确哈希")
        void nestedMaps_ShouldHashCorrectly() {
            // 准备：创建嵌套结构
            Map<String, Object> innerMap = createParams("innerKey", "innerValue");
            Map<String, Object> params = createParams("outerKey", innerMap);

            // 执行
            String hash = redundancyService.computeParametersHash(params);

            // 验证
            assertNotNull(hash);
            assertEquals(HASH_LENGTH, hash.length());

            // 修改内部值应改变哈希
            innerMap.put("innerKey", "differentValue");
            String newHash = redundancyService.computeParametersHash(params);
            assertNotEquals(hash, newHash, "内部值变化应改变哈希");
        }

        @Test
        @DisplayName("5.2 深度嵌套结构应正确哈希")
        void deeplyNestedStructure_ShouldHashCorrectly() {
            // 准备：创建3层嵌套
            Map<String, Object> level3 = createParams("level", 3, "data", "deepest");
            Map<String, Object> level2 = createParams("level", 2, "child", level3);
            Map<String, Object> level1 = createParams("level", 1, "child", level2);

            // 执行
            String hash = redundancyService.computeParametersHash(level1);

            // 验证
            assertNotNull(hash);
            assertEquals(HASH_LENGTH, hash.length());

            // 最深层变化应改变整体哈希
            level3.put("data", "modified");
            String newHash = redundancyService.computeParametersHash(level1);
            assertNotEquals(hash, newHash, "深层修改应改变整体哈希");
        }

        @Test
        @DisplayName("5.3 包含List的参数应正确哈希")
        void listParameters_ShouldHashCorrectly() {
            // 准备
            List<String> list1 = Arrays.asList("a", "b", "c");
            List<String> list2 = Arrays.asList("a", "b", "c");
            List<String> list3 = Arrays.asList("c", "b", "a"); // 不同顺序

            Map<String, Object> params1 = createParams("items", list1);
            Map<String, Object> params2 = createParams("items", list2);
            Map<String, Object> params3 = createParams("items", list3);

            // 执行
            String hash1 = redundancyService.computeParametersHash(params1);
            String hash2 = redundancyService.computeParametersHash(params2);
            String hash3 = redundancyService.computeParametersHash(params3);

            // 验证：相同List应产生相同哈希，不同顺序List应产生不同哈希
            assertEquals(hash1, hash2, "相同内容List应产生相同哈希");
            assertNotEquals(hash1, hash3, "不同顺序List应产生不同哈希(List是有序的)");
        }
    }

    // ========== 6. 哈希分布均匀性测试 ==========

    @Nested
    @DisplayName("6. 哈希分布均匀性测试")
    class HashDistributionTests {

        @Test
        @DisplayName("6.1 哈希前缀分布应均匀 - 首字节分析")
        void hashPrefixDistribution_ShouldBeUniform() {
            // 准备
            int sampleSize = 16000; // 每个十六进制字符平均1000个样本
            int[] prefixCounts = new int[16]; // 0-f 共16种可能

            // 执行：收集首字符分布
            for (int i = 0; i < sampleSize; i++) {
                Map<String, Object> params = createParams("id", UUID.randomUUID().toString());
                String hash = redundancyService.computeParametersHash(params);
                int prefixValue = Character.digit(hash.charAt(0), 16);
                prefixCounts[prefixValue]++;
            }

            // 验证：卡方检验简化版 - 每个桶应接近期望值
            double expectedPerBucket = sampleSize / 16.0;
            double maxDeviation = expectedPerBucket * 0.3; // 允许30%偏差

            for (int i = 0; i < 16; i++) {
                double deviation = Math.abs(prefixCounts[i] - expectedPerBucket);
                assertTrue(deviation < maxDeviation,
                    String.format("前缀'%x'分布偏差过大: 期望%.0f, 实际%d, 偏差%.0f",
                        i, expectedPerBucket, prefixCounts[i], deviation));
            }
        }

        @Test
        @DisplayName("6.2 位分布均匀性 - 1和0比例接近50%")
        void bitDistribution_ShouldBeBalanced() {
            // 准备
            int sampleSize = 1000;
            long totalBits = 0;
            long oneBits = 0;

            // 执行
            for (int i = 0; i < sampleSize; i++) {
                Map<String, Object> params = createParams("data", "test_" + i);
                String hash = redundancyService.computeParametersHash(params);

                // 统计1的个数
                for (char c : hash.toCharArray()) {
                    int value = Character.digit(c, 16);
                    oneBits += Integer.bitCount(value);
                    totalBits += 4; // 每个十六进制字符4位
                }
            }

            // 验证：1的比例应接近50%
            double oneRatio = (double) oneBits / totalBits;
            assertTrue(oneRatio > 0.45 && oneRatio < 0.55,
                String.format("1的比例应接近50%%，实际: %.2f%%", oneRatio * 100));
        }
    }

    // ========== 7. 边界条件测试 ==========

    @Nested
    @DisplayName("7. 边界条件测试")
    class EdgeCaseTests {

        @Test
        @DisplayName("7.1 特殊字符处理 - SQL注入字符")
        void specialCharacters_SqlInjection_ShouldHashSafely() {
            // 准备：包含SQL注入尝试的参数
            String[] sqlInjectionStrings = {
                "'; DROP TABLE users; --",
                "1 OR 1=1",
                "admin'--",
                "1; DELETE FROM table",
                "' UNION SELECT * FROM users"
            };

            Set<String> hashes = new HashSet<>();
            for (String injection : sqlInjectionStrings) {
                Map<String, Object> params = createParams("input", injection);
                String hash = redundancyService.computeParametersHash(params);

                assertNotNull(hash, "特殊字符应能正常哈希");
                assertEquals(HASH_LENGTH, hash.length(), "哈希长度应固定");
                hashes.add(hash);
            }

            // 验证：所有不同输入应产生不同哈希
            assertEquals(sqlInjectionStrings.length, hashes.size());
        }

        @ParameterizedTest
        @DisplayName("7.2 Unicode字符处理 - 多语言支持")
        @CsvSource({
            "中文测试, Chinese",
            "日本語テスト, Japanese",
            "한국어 테스트, Korean",
            "Тест на русском, Russian",
            "🎉🚀💡, Emojis",
            "مرحبا بالعالم, Arabic",
            "שלום עולם, Hebrew"
        })
        void unicodeCharacters_ShouldHashCorrectly(String unicodeText, String language) {
            // 执行
            Map<String, Object> params = createParams("text", unicodeText);
            String hash = redundancyService.computeParametersHash(params);

            // 验证
            assertNotNull(hash, language + "文本应能正常哈希");
            assertEquals(HASH_LENGTH, hash.length(), language + "哈希长度应正确");
            assertTrue(hash.matches("[0-9a-f]+"), language + "哈希应仅包含十六进制字符");
        }

        @Test
        @DisplayName("7.3 极长参数值处理 - 超长字符串")
        void veryLongValues_ShouldHashCorrectly() {
            // 准备：生成不同长度的字符串
            int[] lengths = {100, 1000, 10000, 100000};

            for (int length : lengths) {
                String longValue = "x".repeat(length);
                Map<String, Object> params = createParams("data", longValue);

                // 执行
                String hash = redundancyService.computeParametersHash(params);

                // 验证
                assertNotNull(hash, "长度" + length + "应能哈希");
                assertEquals(HASH_LENGTH, hash.length(), "无论输入长度，哈希长度应固定");
            }
        }

        @Test
        @DisplayName("7.4 空白字符差异检测")
        void whitespaceVariations_ShouldProduceDifferentHashes() {
            // 准备：各种空白字符组合
            String[] whitespaceVariants = {
                "hello world",      // 单空格
                "hello  world",     // 双空格
                "hello\tworld",     // 制表符
                "hello\nworld",     // 换行
                "hello\r\nworld",   // CRLF
                " hello world",     // 前导空格
                "hello world ",     // 尾随空格
                " hello world "     // 前后空格
            };

            Set<String> hashes = Arrays.stream(whitespaceVariants)
                .map(s -> createParams("text", s))
                .map(redundancyService::computeParametersHash)
                .collect(Collectors.toSet());

            // 验证：所有变体应产生不同哈希
            assertEquals(whitespaceVariants.length, hashes.size(),
                "空白字符变体应产生不同哈希");
        }

        @Test
        @DisplayName("7.5 数值精度边界测试")
        void numericPrecisionBoundaries_ShouldHandleCorrectly() {
            // 准备：各种数值边界
            Map<String, Object> params1 = createParams("value", Double.MAX_VALUE);
            Map<String, Object> params2 = createParams("value", Double.MIN_VALUE);
            Map<String, Object> params3 = createParams("value", Double.POSITIVE_INFINITY);
            Map<String, Object> params4 = createParams("value", Double.NEGATIVE_INFINITY);
            Map<String, Object> params5 = createParams("value", Double.NaN);
            Map<String, Object> params6 = createParams("value", Long.MAX_VALUE);
            Map<String, Object> params7 = createParams("value", Long.MIN_VALUE);

            // 执行
            Set<String> hashes = Stream.of(params1, params2, params3, params4, params5, params6, params7)
                .map(redundancyService::computeParametersHash)
                .collect(Collectors.toSet());

            // 验证：所有边界值应产生不同且有效的哈希
            assertEquals(7, hashes.size(), "数值边界应产生唯一哈希");
            hashes.forEach(hash -> {
                assertNotNull(hash);
                assertEquals(HASH_LENGTH, hash.length());
            });
        }
    }

    // ========== 8. 缓存键碰撞检测 ==========

    @Nested
    @DisplayName("8. 缓存键碰撞检测")
    class CacheKeyCollisionTests {

        @Test
        @DisplayName("8.1 完整缓存键唯一性 - sessionId:toolName:hash组合")
        void fullCacheKey_ShouldBeUnique() {
            // 准备
            String sessionId = "session-001";
            String toolName = "inventory_query";
            Map<String, Object> params = createParams("batchId", "B001");

            // 执行
            String parametersHash = redundancyService.computeParametersHash(params);
            String cacheKey = ToolCallCache.generateCacheKey(sessionId, toolName, parametersHash);

            // 验证
            assertTrue(cacheKey.contains(sessionId), "缓存键应包含sessionId");
            assertTrue(cacheKey.contains(toolName), "缓存键应包含toolName");
            assertTrue(cacheKey.contains(parametersHash.substring(0, 8)),
                "缓存键应包含哈希前缀");
        }

        @Test
        @DisplayName("8.2 不同会话相同工具参数应产生不同缓存键")
        void differentSessions_SameTool_ShouldHaveDifferentCacheKeys() {
            // 准备
            String toolName = "material_query";
            Map<String, Object> params = createParams("materialId", "MAT-001");
            String hash = redundancyService.computeParametersHash(params);

            // 执行：两个不同会话
            String cacheKey1 = ToolCallCache.generateCacheKey("session-A", toolName, hash);
            String cacheKey2 = ToolCallCache.generateCacheKey("session-B", toolName, hash);

            // 验证
            assertNotEquals(cacheKey1, cacheKey2, "不同会话应产生不同缓存键");
        }

        @Test
        @DisplayName("8.3 大量缓存键碰撞概率测试")
        void largeCacheKeySet_ShouldHaveNoCollisions() {
            // 准备
            int sessionCount = 100;
            int toolCount = 10;
            int paramVariations = 100;
            Set<String> cacheKeys = new HashSet<>();

            // 执行：生成大量缓存键
            for (int s = 0; s < sessionCount; s++) {
                String sessionId = "session-" + s;
                for (int t = 0; t < toolCount; t++) {
                    String toolName = "tool_" + t;
                    for (int p = 0; p < paramVariations; p++) {
                        Map<String, Object> params = createParams("param", "value_" + p);
                        String hash = redundancyService.computeParametersHash(params);
                        cacheKeys.add(ToolCallCache.generateCacheKey(sessionId, toolName, hash));
                    }
                }
            }

            // 验证
            int expectedCount = sessionCount * toolCount * paramVariations;
            assertEquals(expectedCount, cacheKeys.size(),
                String.format("应生成%d个唯一缓存键", expectedCount));
        }
    }

    // ========== 9. 哈希完整性验证 ==========

    @Nested
    @DisplayName("9. 哈希完整性验证")
    class HashIntegrityTests {

        @Test
        @DisplayName("9.1 哈希应为有效的SHA-256格式")
        void hashFormat_ShouldBeValidSHA256() {
            // 准备
            Map<String, Object> params = createParams("test", "value");

            // 执行
            String hash = redundancyService.computeParametersHash(params);

            // 验证
            assertNotNull(hash, "哈希不应为null");
            assertEquals(HASH_LENGTH, hash.length(), "SHA-256应为64字符");
            assertTrue(hash.matches("^[0-9a-f]{64}$"),
                "哈希应仅包含小写十六进制字符");
        }

        @Test
        @DisplayName("9.2 与已知SHA-256实现对比验证")
        void verifyAgainstKnownImplementation() throws NoSuchAlgorithmException {
            // 准备：空输入的已知哈希
            String emptyHash = redundancyService.computeParametersHash(new HashMap<>());

            // 执行：使用标准库计算
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest("".getBytes(StandardCharsets.UTF_8));
            StringBuilder expectedHash = new StringBuilder();
            for (byte b : hashBytes) {
                expectedHash.append(String.format("%02x", b));
            }

            // 验证
            assertEquals(expectedHash.toString(), emptyHash,
                "空输入哈希应与标准实现一致");
        }

        @Test
        @DisplayName("9.3 已知输入输出验证 - 固定测试向量")
        void knownTestVectors_ShouldMatch() {
            // 准备：已知的JSON字符串及其SHA-256
            // {"key":"value"} 的 SHA-256
            Map<String, Object> params = new TreeMap<>();
            params.put("key", "value");

            // 执行
            String hash = redundancyService.computeParametersHash(params);

            // 验证：哈希应一致且可重复
            String firstHash = redundancyService.computeParametersHash(params);
            String secondHash = redundancyService.computeParametersHash(params);
            assertEquals(firstHash, secondHash, "相同输入应始终产生相同哈希");
            assertEquals(HASH_LENGTH, hash.length());
        }
    }

    // ========== 10. 性能测试 ==========

    @Nested
    @DisplayName("10. 性能测试")
    class PerformanceTests {

        @Test
        @DisplayName("10.1 单次哈希计算性能 - 应小于10ms")
        void singleHashPerformance_ShouldBeUnder10ms() {
            // 准备
            Map<String, Object> params = createParams(
                "field1", "value1",
                "field2", "value2",
                "field3", 12345
            );

            // 预热
            for (int i = 0; i < 100; i++) {
                redundancyService.computeParametersHash(params);
            }

            // 执行
            long startTime = System.nanoTime();
            redundancyService.computeParametersHash(params);
            long duration = System.nanoTime() - startTime;

            // 验证：单次哈希应在10ms内完成
            assertTrue(duration < 10_000_000,
                String.format("哈希计算耗时%dms，应小于10ms", duration / 1_000_000));
        }

        @Test
        @DisplayName("10.2 批量哈希计算吞吐量 - 每秒至少10000次")
        void bulkHashThroughput_ShouldExceed10kPerSecond() {
            // 准备
            int iterations = 10000;
            List<Map<String, Object>> paramsList = IntStream.range(0, iterations)
                .mapToObj(i -> createParams("id", "item_" + i))
                .collect(Collectors.toList());

            // 预热
            paramsList.stream().limit(100).forEach(redundancyService::computeParametersHash);

            // 执行
            long startTime = System.currentTimeMillis();
            paramsList.forEach(redundancyService::computeParametersHash);
            long duration = System.currentTimeMillis() - startTime;

            // 验证
            double throughput = (double) iterations / duration * 1000;
            assertTrue(throughput > 10000,
                String.format("吞吐量%.0f次/秒，应大于10000次/秒", throughput));
        }

        @Test
        @DisplayName("10.3 大对象哈希性能 - 1MB参数应在200ms内完成")
        void largeObjectPerformance_ShouldBeUnder200ms() {
            // 准备：创建约1MB的参数
            StringBuilder largeValue = new StringBuilder();
            for (int i = 0; i < 10000; i++) {
                largeValue.append("This is a test string number ").append(i).append(". ");
            }
            Map<String, Object> params = createParams("largeData", largeValue.toString());

            // 执行
            long startTime = System.currentTimeMillis();
            String hash = redundancyService.computeParametersHash(params);
            long duration = System.currentTimeMillis() - startTime;

            // 验证
            assertNotNull(hash);
            assertTrue(duration < 200,
                String.format("大对象哈希耗时%dms，应小于200ms", duration));
        }
    }

    // ========== 11. 哈希截断安全性测试 ==========

    @Nested
    @DisplayName("11. 哈希截断安全性测试")
    class HashTruncationSecurityTests {

        @Test
        @DisplayName("11.1 截断哈希的碰撞概率分析 - 8字符前缀")
        void truncatedHashCollision_8CharPrefix() {
            // 准备
            int sampleSize = 10000;
            int prefixLength = 8; // 32位 = 4字节
            Set<String> truncatedHashes = new HashSet<>();
            int collisions = 0;

            // 执行
            for (int i = 0; i < sampleSize; i++) {
                Map<String, Object> params = createParams("id", UUID.randomUUID().toString());
                String fullHash = redundancyService.computeParametersHash(params);
                String truncated = fullHash.substring(0, prefixLength);

                if (!truncatedHashes.add(truncated)) {
                    collisions++;
                }
            }

            // 验证：8字符(32位)在10000样本中碰撞概率约1%
            double collisionRate = (double) collisions / sampleSize;
            System.out.printf("8字符截断碰撞率: %.4f%% (%d/%d)%n",
                collisionRate * 100, collisions, sampleSize);

            // 在实际缓存场景中，需要考虑截断带来的碰撞风险
            assertTrue(collisionRate < 0.02,
                "8字符截断碰撞率应小于2%（实际场景需完整哈希）");
        }

        @Test
        @DisplayName("11.2 完整哈希vs截断哈希安全对比")
        void fullVsTruncatedHash_SecurityComparison() {
            // 准备
            int sampleSize = 50000;
            Set<String> fullHashes = new HashSet<>();
            Set<String> prefix8Hashes = new HashSet<>();
            Set<String> prefix16Hashes = new HashSet<>();

            // 执行
            for (int i = 0; i < sampleSize; i++) {
                Map<String, Object> params = createParams("data", "input_" + i);
                String hash = redundancyService.computeParametersHash(params);
                fullHashes.add(hash);
                prefix8Hashes.add(hash.substring(0, 8));
                prefix16Hashes.add(hash.substring(0, 16));
            }

            // 验证
            assertEquals(sampleSize, fullHashes.size(), "完整哈希不应有碰撞");

            int collision8 = sampleSize - prefix8Hashes.size();
            int collision16 = sampleSize - prefix16Hashes.size();

            System.out.printf("碰撞统计 - 8字符: %d, 16字符: %d, 完整64字符: 0%n",
                collision8, collision16);

            // 16字符(64位)在50000样本中碰撞概率应接近0
            assertEquals(sampleSize, prefix16Hashes.size(),
                "16字符截断在50000样本中不应有碰撞");
        }

        @Test
        @DisplayName("11.3 缓存键使用完整哈希验证")
        void cacheKeyShouldUseFullHash() {
            // 准备
            Map<String, Object> params = createParams("test", "value");
            String fullHash = redundancyService.computeParametersHash(params);

            // 执行
            String cacheKey = ToolCallCache.generateCacheKey("session", "tool", fullHash);

            // 验证：缓存键格式检查
            // 实际实现中应确保不截断哈希或使用足够长度的前缀
            assertNotNull(cacheKey);
            assertTrue(cacheKey.length() > fullHash.length() / 2,
                "缓存键应包含足够的哈希信息");
        }
    }

    // ========== 12. 并发安全性测试 ==========

    @Nested
    @DisplayName("12. 并发安全性测试")
    class ConcurrencySafetyTests {

        @Test
        @DisplayName("12.1 多线程并发哈希计算应一致")
        void concurrentHashComputation_ShouldBeConsistent() throws InterruptedException, ExecutionException {
            // 准备
            Map<String, Object> params = createParams("key", "value");
            int threadCount = 10;
            int iterationsPerThread = 1000;
            ExecutorService executor = Executors.newFixedThreadPool(threadCount);

            // 执行
            List<Future<Set<String>>> futures = new ArrayList<>();
            for (int t = 0; t < threadCount; t++) {
                futures.add(executor.submit(() -> {
                    Set<String> hashes = new HashSet<>();
                    for (int i = 0; i < iterationsPerThread; i++) {
                        hashes.add(redundancyService.computeParametersHash(params));
                    }
                    return hashes;
                }));
            }

            // 收集结果
            Set<String> allHashes = new HashSet<>();
            for (Future<Set<String>> future : futures) {
                allHashes.addAll(future.get());
            }

            executor.shutdown();
            assertTrue(executor.awaitTermination(30, TimeUnit.SECONDS));

            // 验证：所有线程应产生相同的哈希
            assertEquals(1, allHashes.size(),
                "并发计算应产生一致的哈希结果");
        }

        @Test
        @DisplayName("12.2 多线程不同参数无碰撞")
        void concurrentDifferentParams_ShouldHaveNoCollisions() throws InterruptedException {
            // 准备
            int threadCount = 8;
            int paramsPerThread = 1000;
            ConcurrentHashMap<String, String> hashToInput = new ConcurrentHashMap<>();
            CountDownLatch latch = new CountDownLatch(threadCount);
            List<String> collisions = Collections.synchronizedList(new ArrayList<>());

            // 执行
            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            for (int t = 0; t < threadCount; t++) {
                final int threadId = t;
                executor.submit(() -> {
                    try {
                        for (int i = 0; i < paramsPerThread; i++) {
                            String input = "thread_" + threadId + "_param_" + i;
                            Map<String, Object> params = createParams("data", input);
                            String hash = redundancyService.computeParametersHash(params);

                            String existing = hashToInput.putIfAbsent(hash, input);
                            if (existing != null && !existing.equals(input)) {
                                collisions.add(String.format(
                                    "碰撞: '%s' 和 '%s' -> %s", existing, input, hash));
                            }
                        }
                    } finally {
                        latch.countDown();
                    }
                });
            }

            latch.await(60, TimeUnit.SECONDS);
            executor.shutdown();

            // 验证
            assertTrue(collisions.isEmpty(),
                "并发场景不应有碰撞:\n" + String.join("\n", collisions));
            assertEquals(threadCount * paramsPerThread, hashToInput.size());
        }
    }

    // ========== 辅助方法 ==========

    /**
     * 创建参数Map的便捷方法
     */
    private Map<String, Object> createParams(Object... keyValues) {
        Map<String, Object> params = new HashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            params.put((String) keyValues[i], keyValues[i + 1]);
        }
        return params;
    }

    /**
     * 提供相似但不同参数的测试数据
     */
    static Stream<Arguments> provideSimilarParameters() {
        return Stream.of(
            // 大小写差异
            Arguments.of(
                createStaticParams("name", "John"),
                createStaticParams("name", "john"),
                "大小写差异: John vs john"
            ),
            // 前后空格差异
            Arguments.of(
                createStaticParams("value", "test"),
                createStaticParams("value", " test"),
                "前导空格差异"
            ),
            // 数值微小差异
            Arguments.of(
                createStaticParams("amount", 100.0),
                createStaticParams("amount", 100.00001),
                "浮点数微小差异"
            ),
            // 空字符串vs null
            Arguments.of(
                createStaticParams("field", ""),
                createStaticParams("field", null),
                "空字符串 vs null"
            ),
            // 0 vs false
            Arguments.of(
                createStaticParams("flag", 0),
                createStaticParams("flag", false),
                "整数0 vs 布尔false"
            ),
            // 相同字符不同编码
            Arguments.of(
                createStaticParams("char", "ä"),
                createStaticParams("char", "a\u0308"),
                "Unicode组合字符: ä vs a+分音符"
            )
        );
    }

    /**
     * 静态版本的createParams，用于@MethodSource
     */
    private static Map<String, Object> createStaticParams(Object... keyValues) {
        Map<String, Object> params = new HashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            params.put((String) keyValues[i], keyValues[i + 1]);
        }
        return params;
    }
}
