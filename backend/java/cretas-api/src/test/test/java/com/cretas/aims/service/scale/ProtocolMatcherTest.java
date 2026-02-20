package com.cretas.aims.service.scale;

import com.cretas.aims.dto.scale.ScaleDataParseResult;
import com.cretas.aims.entity.scale.ScaleBrandModel;
import com.cretas.aims.entity.scale.ScaleProtocolConfig;
import com.cretas.aims.repository.ScaleBrandModelRepository;
import com.cretas.aims.repository.ScaleProtocolConfigRepository;
import com.cretas.aims.service.ScaleProtocolAdapterService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * ProtocolMatcher 单元测试
 *
 * 测试覆盖:
 * - 品牌+型号匹配 (UT-PM-001~007)
 * - 帧模式分析 (UT-PM-010~014)
 * - 原始数据匹配
 * - 边界条件和异常处理
 *
 * @author Cretas Team
 * @since 2026-01-06
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ProtocolMatcher 协议匹配器测试")
class ProtocolMatcherTest {

    @Mock
    private ScaleProtocolConfigRepository protocolRepository;

    @Mock
    private ScaleBrandModelRepository brandModelRepository;

    @Mock
    private ScaleProtocolAdapterService protocolAdapterService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ProtocolMatcher protocolMatcher;

    // Test data
    private ScaleProtocolConfig keliD2008Protocol;
    private ScaleProtocolConfig keliGenericProtocol;
    private ScaleProtocolConfig toledoProtocol;
    private ScaleBrandModel keliD2008BrandModel;

    @BeforeEach
    void setUp() {
        // Setup test protocols
        keliD2008Protocol = createTestProtocol(
                "P001",
                "KELI_D2008_ASCII",
                "柯力D2008协议",
                "{\"frameType\":\"ASCII_FIXED\",\"startByte\":\"02\",\"endByte\":\"03\"}",
                ScaleProtocolConfig.ConnectionType.RS232
        );

        keliGenericProtocol = createTestProtocol(
                "P002",
                "KELI_GENERIC",
                "柯力通用协议",
                "{\"frameType\":\"ASCII_VARIABLE\"}",
                ScaleProtocolConfig.ConnectionType.RS232
        );

        toledoProtocol = createTestProtocol(
                "P003",
                "TOLEDO_IND570_ASCII",
                "托利多IND570协议",
                "{\"frameType\":\"ASCII_VARIABLE\",\"delimiter\":\",\"}",
                ScaleProtocolConfig.ConnectionType.RS485
        );

        // Setup test brand model
        keliD2008BrandModel = new ScaleBrandModel();
        keliD2008BrandModel.setId("BM001");
        keliD2008BrandModel.setBrandCode("KELI");
        keliD2008BrandModel.setModelCode("D2008");
        keliD2008BrandModel.setDefaultProtocolId("P001");
    }

    private ScaleProtocolConfig createTestProtocol(String id, String code, String name,
                                                    String frameFormat, ScaleProtocolConfig.ConnectionType connectionType) {
        ScaleProtocolConfig protocol = new ScaleProtocolConfig();
        protocol.setId(id);
        protocol.setProtocolCode(code);
        protocol.setProtocolName(name);
        protocol.setFrameFormat(frameFormat);
        protocol.setConnectionType(connectionType);
        protocol.setIsActive(true);
        protocol.setIsVerified(true);
        protocol.setIsBuiltin(true);
        return protocol;
    }

    // ==================== matchByBrandModel 测试 ====================

    @Nested
    @DisplayName("matchByBrandModel() 品牌型号匹配测试")
    class MatchByBrandModelTests {

        @Test
        @DisplayName("UT-PM-001: 品牌+型号完全匹配")
        void testExactBrandModelMatch() {
            // Given
            when(protocolRepository.findByBrandModelPattern(eq("KELI"), eq("D2008"), isNull()))
                    .thenReturn(List.of(keliD2008Protocol));

            // When
            ProtocolMatcher.ProtocolMatchResult result = protocolMatcher.matchByBrandModel("KELI", "D2008");

            // Then
            assertNotNull(result);
            assertEquals("P001", result.getProtocolId());
            assertEquals("KELI_D2008_ASCII", result.getProtocolCode());
            assertEquals(95, result.getConfidence());
            assertEquals(ProtocolMatcher.MatchMethod.EXACT_BRAND_MODEL, result.getMatchMethod());
            assertEquals("Exact brand + model match", result.getMatchReason());

            verify(protocolRepository).findByBrandModelPattern("KELI", "D2008", null);
        }

        @Test
        @DisplayName("UT-PM-002: 仅品牌匹配")
        void testBrandOnlyMatch() {
            // Given - no exact match, but brand match exists
            when(protocolRepository.findByBrandModelPattern(eq("KELI"), eq("UNKNOWN"), isNull()))
                    .thenReturn(Collections.emptyList());
            when(protocolRepository.findByBrandCodePattern(eq("KELI"), isNull()))
                    .thenReturn(List.of(keliGenericProtocol));

            // When
            ProtocolMatcher.ProtocolMatchResult result = protocolMatcher.matchByBrandModel("KELI", "UNKNOWN");

            // Then
            assertNotNull(result);
            assertEquals("P002", result.getProtocolId());
            assertEquals(75, result.getConfidence());
            assertEquals(ProtocolMatcher.MatchMethod.BRAND_ONLY, result.getMatchMethod());
            assertEquals("Brand pattern match", result.getMatchReason());
        }

        @Test
        @DisplayName("UT-PM-003: 品牌有默认协议")
        void testBrandModelDefaultProtocol() {
            // Given - no exact or brand match, but default protocol exists
            when(protocolRepository.findByBrandModelPattern(eq("KELI"), eq("D2008"), isNull()))
                    .thenReturn(Collections.emptyList());
            when(protocolRepository.findByBrandCodePattern(eq("KELI"), isNull()))
                    .thenReturn(Collections.emptyList());
            when(brandModelRepository.findByBrandCodeAndModelCode("KELI", "D2008"))
                    .thenReturn(Optional.of(keliD2008BrandModel));
            when(protocolRepository.findById("P001"))
                    .thenReturn(Optional.of(keliD2008Protocol));

            // When
            ProtocolMatcher.ProtocolMatchResult result = protocolMatcher.matchByBrandModel("KELI", "D2008");

            // Then
            assertNotNull(result);
            assertEquals("P001", result.getProtocolId());
            assertEquals(80, result.getConfidence());
            assertEquals(ProtocolMatcher.MatchMethod.BRAND_MODEL_DEFAULT, result.getMatchMethod());
            assertEquals("Brand model default protocol", result.getMatchReason());
            assertNotNull(result.getMetadata());
            assertEquals("BM001", result.getMetadata().get("brandModelId"));
        }

        @Test
        @DisplayName("UT-PM-005: 无任何匹配")
        void testNoMatch() {
            // Given - all strategies fail
            when(protocolRepository.findByBrandModelPattern(any(), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(protocolRepository.findByBrandCodePattern(any(), any()))
                    .thenReturn(Collections.emptyList());
            when(brandModelRepository.findByBrandCodeAndModelCode(any(), any()))
                    .thenReturn(Optional.empty());

            // When
            ProtocolMatcher.ProtocolMatchResult result = protocolMatcher.matchByBrandModel("UNKNOWN", "UNKNOWN");

            // Then
            assertNull(result);
        }

        @ParameterizedTest
        @DisplayName("UT-PM-006: 品牌别名匹配")
        @CsvSource({
                "keli, D2008",       // lowercase
                "KELI, d2008",       // lowercase model
                "Keli, D2008",       // mixed case
                "  KELI  , D2008"    // with whitespace
        })
        void testBrandAliasMatch(String brand, String model) {
            // Given
            when(protocolRepository.findByBrandModelPattern(eq("KELI"), anyString(), isNull()))
                    .thenReturn(List.of(keliD2008Protocol));

            // When
            ProtocolMatcher.ProtocolMatchResult result = protocolMatcher.matchByBrandModel(brand, model);

            // Then
            assertNotNull(result);
            assertEquals("KELI_D2008_ASCII", result.getProtocolCode());
            assertEquals(95, result.getConfidence());
        }

        @Test
        @DisplayName("UT-PM-007: 优先级正确性 (精确匹配 > 品牌匹配 > 默认协议)")
        void testMatchPriority() {
            // Given - all strategies would return results
            when(protocolRepository.findByBrandModelPattern(eq("KELI"), eq("D2008"), isNull()))
                    .thenReturn(List.of(keliD2008Protocol));

            // When
            ProtocolMatcher.ProtocolMatchResult result = protocolMatcher.matchByBrandModel("KELI", "D2008");

            // Then - should return exact match first
            assertNotNull(result);
            assertEquals(ProtocolMatcher.MatchMethod.EXACT_BRAND_MODEL, result.getMatchMethod());
            assertEquals(95, result.getConfidence());

            // Verify brand-only and default were not called (short-circuit)
            verify(protocolRepository, never()).findByBrandCodePattern(any(), any());
            verify(brandModelRepository, never()).findByBrandCodeAndModelCode(any(), any());
        }

        @ParameterizedTest
        @DisplayName("null 或空品牌返回 null")
        @NullAndEmptySource
        void testNullOrEmptyBrand(String brand) {
            ProtocolMatcher.ProtocolMatchResult result = protocolMatcher.matchByBrandModel(brand, "D2008");
            assertNull(result);
        }

        @Test
        @DisplayName("带工厂ID的匹配")
        void testMatchWithFactoryId() {
            // Given
            when(protocolRepository.findByBrandModelPattern("KELI", "D2008", "F001"))
                    .thenReturn(List.of(keliD2008Protocol));

            // When
            ProtocolMatcher.ProtocolMatchResult result = protocolMatcher.matchByBrandModel("KELI", "D2008", "F001");

            // Then
            assertNotNull(result);
            assertEquals("P001", result.getProtocolId());

            verify(protocolRepository).findByBrandModelPattern("KELI", "D2008", "F001");
        }
    }

    // ==================== matchByFramePattern 测试 ====================

    @Nested
    @DisplayName("matchByFramePattern() 帧模式分析测试")
    class MatchByFramePatternTests {

        @Test
        @DisplayName("UT-PM-010: ASCII 固定帧检测 (02开头03结尾)")
        void testAsciiFixedFrameDetection() {
            // Given - STX (02) ... ETX (03) frame
            byte[] rawData = new byte[]{0x02, 0x2B, 0x30, 0x30, 0x31, 0x32, 0x33, 0x03};

            when(protocolRepository.findByIsActiveTrue())
                    .thenReturn(List.of(keliD2008Protocol, keliGenericProtocol));

            // When
            List<ProtocolMatcher.ProtocolMatchResult> results = protocolMatcher.matchByFramePattern(rawData);

            // Then
            assertFalse(results.isEmpty());
            ProtocolMatcher.ProtocolMatchResult best = results.get(0);
            assertEquals(ProtocolMatcher.MatchMethod.FRAME_PATTERN, best.getMatchMethod());
            assertTrue(best.getConfidence() > 0);

            // Verify metadata contains frame analysis
            assertNotNull(best.getMetadata());
            assertTrue(best.getMetadata().containsKey("frameType"));
        }

        @Test
        @DisplayName("UT-PM-011: ASCII 可变帧检测 (逗号/空格分隔)")
        void testAsciiVariableFrameDetection() {
            // Given - CSV format: "ST,GS,+001234.5,kg"
            String csvData = "ST,GS,+001234.5,kg";
            byte[] rawData = csvData.getBytes();

            when(protocolRepository.findByIsActiveTrue())
                    .thenReturn(List.of(keliGenericProtocol, toledoProtocol));

            // When
            List<ProtocolMatcher.ProtocolMatchResult> results = protocolMatcher.matchByFramePattern(rawData);

            // Then
            assertFalse(results.isEmpty());
            ProtocolMatcher.ProtocolMatchResult best = results.get(0);
            assertNotNull(best.getMetadata());
        }

        @Test
        @DisplayName("UT-PM-012: 二进制帧检测 (非ASCII)")
        void testHexFixedFrameDetection() {
            // Given - Binary frame with non-printable bytes
            byte[] rawData = new byte[]{(byte)0xAA, (byte)0x55, 0x00, 0x00, 0x30, 0x39, (byte)0xCE, (byte)0xD7};

            ScaleProtocolConfig hexProtocol = createTestProtocol(
                    "P004",
                    "GENERIC_HEX",
                    "通用二进制协议",
                    "{\"frameType\":\"HEX_FIXED\"}",
                    ScaleProtocolConfig.ConnectionType.RS485
            );

            when(protocolRepository.findByIsActiveTrue())
                    .thenReturn(List.of(hexProtocol));

            // When
            List<ProtocolMatcher.ProtocolMatchResult> results = protocolMatcher.matchByFramePattern(rawData);

            // Then
            assertFalse(results.isEmpty());
        }

        @Test
        @DisplayName("UT-PM-013: Modbus RTU 检测 (功能码03/04)")
        void testModbusRtuFrameDetection() {
            // Given - Modbus RTU response: 01 03 04 00 00 30 39 XX XX
            byte[] rawData = new byte[]{0x01, 0x03, 0x04, 0x00, 0x00, 0x30, 0x39, (byte)0xAB, (byte)0xCD};

            ScaleProtocolConfig modbusProtocol = createTestProtocol(
                    "P005",
                    "GENERIC_MODBUS",
                    "Modbus通用协议",
                    "{\"frameType\":\"MODBUS_RTU\"}",
                    ScaleProtocolConfig.ConnectionType.MODBUS_RTU
            );

            when(protocolRepository.findByIsActiveTrue())
                    .thenReturn(List.of(modbusProtocol));

            // When
            List<ProtocolMatcher.ProtocolMatchResult> results = protocolMatcher.matchByFramePattern(rawData);

            // Then
            assertFalse(results.isEmpty());
            ProtocolMatcher.ProtocolMatchResult best = results.get(0);
            assertNotNull(best.getMetadata());
            assertEquals("MODBUS_RTU", best.getMetadata().get("frameType"));
        }

        @Test
        @DisplayName("UT-PM-014: 无法识别的数据")
        void testUnrecognizableData() {
            // Given - Random noise data
            byte[] rawData = new byte[]{0x00, 0x01, 0x02, 0x03};

            // No protocols that match this pattern
            when(protocolRepository.findByIsActiveTrue())
                    .thenReturn(Collections.emptyList());

            // When
            List<ProtocolMatcher.ProtocolMatchResult> results = protocolMatcher.matchByFramePattern(rawData);

            // Then
            assertTrue(results.isEmpty());
        }

        @Test
        @DisplayName("Hex字符串输入")
        void testHexStringInput() {
            // Given
            String hexData = "02 2B 30 30 31 32 33 03";
            when(protocolRepository.findByIsActiveTrue())
                    .thenReturn(List.of(keliD2008Protocol));

            // When
            List<ProtocolMatcher.ProtocolMatchResult> results = protocolMatcher.matchByFramePattern(hexData);

            // Then
            assertFalse(results.isEmpty());
        }

        @ParameterizedTest
        @DisplayName("null 或空数据返回空列表")
        @NullAndEmptySource
        void testNullOrEmptyData(String hexData) {
            List<ProtocolMatcher.ProtocolMatchResult> results = protocolMatcher.matchByFramePattern(hexData);
            assertTrue(results.isEmpty());
        }

        @Test
        @DisplayName("空字节数组返回空列表")
        void testEmptyByteArray() {
            List<ProtocolMatcher.ProtocolMatchResult> results = protocolMatcher.matchByFramePattern(new byte[0]);
            assertTrue(results.isEmpty());
        }
    }

    // ==================== matchByRawData 测试 ====================

    @Nested
    @DisplayName("matchByRawData() 原始数据匹配测试")
    class MatchByRawDataTests {

        @Test
        @DisplayName("UT-PM-004: 原始数据解析成功")
        void testRawDataParseSuccess() {
            // Given
            byte[] rawData = new byte[]{0x02, 0x2B, 0x30, 0x30, 0x31, 0x32, 0x33, 0x03};
            String hexData = "022B30303132333303";

            ScaleDataParseResult parseResult = new ScaleDataParseResult();
            parseResult.setSuccess(true);
            parseResult.setWeight(new BigDecimal("12345"));
            parseResult.setUnit("kg");
            parseResult.setStable(true);

            when(protocolRepository.findByIsActiveTrue())
                    .thenReturn(List.of(keliD2008Protocol));
            when(protocolAdapterService.dryRunParse(eq("P001"), anyString()))
                    .thenReturn(parseResult);

            // When
            List<ProtocolMatcher.ProtocolMatchResult> results = protocolMatcher.matchByRawData(rawData);

            // Then
            assertFalse(results.isEmpty());
            ProtocolMatcher.ProtocolMatchResult best = results.get(0);
            assertEquals("P001", best.getProtocolId());
            assertEquals(ProtocolMatcher.MatchMethod.RAW_DATA_PARSE, best.getMatchMethod());
            assertTrue(best.getConfidence() >= 50);
            assertNotNull(best.getTestParseResult());
        }

        @Test
        @DisplayName("解析结果包含合理重量值时置信度更高")
        void testConfidenceBoostForReasonableWeight() {
            // Given
            byte[] rawData = new byte[]{0x02, 0x2B, 0x30, 0x30, 0x31, 0x32, 0x33, 0x03};

            ScaleDataParseResult goodResult = new ScaleDataParseResult();
            goodResult.setSuccess(true);
            goodResult.setWeight(new BigDecimal("1234.5")); // Reasonable weight
            goodResult.setUnit("kg");                        // Valid unit
            goodResult.setStable(true);                      // Stability flag

            when(protocolRepository.findByIsActiveTrue())
                    .thenReturn(List.of(keliD2008Protocol));
            when(protocolAdapterService.dryRunParse(any(), any()))
                    .thenReturn(goodResult);

            // When
            List<ProtocolMatcher.ProtocolMatchResult> results = protocolMatcher.matchByRawData(rawData);

            // Then
            assertFalse(results.isEmpty());
            assertTrue(results.get(0).getConfidence() >= 85); // High confidence for complete result
        }

        @Test
        @DisplayName("解析失败时不返回结果")
        void testParseFailureReturnsEmpty() {
            // Given
            byte[] rawData = new byte[]{0x01, 0x02, 0x03};

            ScaleDataParseResult failResult = new ScaleDataParseResult();
            failResult.setSuccess(false);

            when(protocolRepository.findByIsActiveTrue())
                    .thenReturn(List.of(keliD2008Protocol));
            when(protocolAdapterService.dryRunParse(any(), any()))
                    .thenReturn(failResult);

            // When
            List<ProtocolMatcher.ProtocolMatchResult> results = protocolMatcher.matchByRawData(rawData);

            // Then
            assertTrue(results.isEmpty());
        }

        @Test
        @DisplayName("结果按置信度排序 (验证优先)")
        void testResultsSortedByConfidenceAndVerification() {
            // Given
            byte[] rawData = new byte[]{0x02, 0x2B, 0x30, 0x30, 0x31, 0x32, 0x33, 0x03};

            ScaleProtocolConfig unverifiedProtocol = createTestProtocol(
                    "P010", "UNVERIFIED", "未验证协议",
                    "{\"frameType\":\"ASCII_FIXED\"}", ScaleProtocolConfig.ConnectionType.RS232);
            unverifiedProtocol.setIsVerified(false);
            unverifiedProtocol.setIsBuiltin(false);

            ScaleDataParseResult parseResult = new ScaleDataParseResult();
            parseResult.setSuccess(true);
            parseResult.setWeight(new BigDecimal("1000"));
            parseResult.setUnit("kg");
            parseResult.setStable(true);

            when(protocolRepository.findByIsActiveTrue())
                    .thenReturn(List.of(unverifiedProtocol, keliD2008Protocol));
            when(protocolAdapterService.dryRunParse(any(), any()))
                    .thenReturn(parseResult);

            // When
            List<ProtocolMatcher.ProtocolMatchResult> results = protocolMatcher.matchByRawData(rawData);

            // Then
            assertEquals(2, results.size());
            // Verified protocol should come first when confidence is equal
            assertTrue(results.get(0).getIsVerified());
        }

        @ParameterizedTest
        @DisplayName("null 或空数据返回空列表")
        @NullAndEmptySource
        void testNullOrEmptyRawData(byte[] rawData) {
            List<ProtocolMatcher.ProtocolMatchResult> results = protocolMatcher.matchByRawData(rawData);
            assertTrue(results.isEmpty());
        }
    }

    // ==================== getBestMatch 测试 ====================

    @Nested
    @DisplayName("getBestMatch() 综合匹配测试")
    class GetBestMatchTests {

        @Test
        @DisplayName("品牌型号优先于原始数据")
        void testBrandModelTakesPrecedence() {
            // Given
            byte[] rawData = new byte[]{0x02, 0x2B, 0x30, 0x30, 0x31, 0x32, 0x33, 0x03};

            when(protocolRepository.findByBrandModelPattern(eq("KELI"), eq("D2008"), isNull()))
                    .thenReturn(List.of(keliD2008Protocol));
            // Also set up raw data match (lower confidence)
            when(protocolRepository.findByIsActiveTrue())
                    .thenReturn(List.of(keliGenericProtocol));

            ScaleDataParseResult parseResult = new ScaleDataParseResult();
            parseResult.setSuccess(true);
            parseResult.setWeight(new BigDecimal("1000"));

            when(protocolAdapterService.dryRunParse(any(), any()))
                    .thenReturn(parseResult);

            // When
            ProtocolMatcher.ProtocolMatchResult result = protocolMatcher.getBestMatch(
                    rawData, "KELI", "D2008", null);

            // Then
            assertNotNull(result);
            assertEquals(95, result.getConfidence()); // Brand model match confidence
            assertEquals(ProtocolMatcher.MatchMethod.EXACT_BRAND_MODEL, result.getMatchMethod());
        }

        @Test
        @DisplayName("仅有原始数据时使用数据匹配")
        void testRawDataWhenNoBrandModel() {
            // Given
            byte[] rawData = new byte[]{0x02, 0x2B, 0x30, 0x30, 0x31, 0x32, 0x33, 0x03};

            when(protocolRepository.findByIsActiveTrue())
                    .thenReturn(List.of(keliD2008Protocol));

            ScaleDataParseResult parseResult = new ScaleDataParseResult();
            parseResult.setSuccess(true);
            parseResult.setWeight(new BigDecimal("1000"));
            parseResult.setUnit("kg");
            parseResult.setStable(true);

            when(protocolAdapterService.dryRunParse(any(), any()))
                    .thenReturn(parseResult);

            // When
            ProtocolMatcher.ProtocolMatchResult result = protocolMatcher.getBestMatch(
                    rawData, null, null, null);

            // Then
            assertNotNull(result);
            assertEquals(ProtocolMatcher.MatchMethod.RAW_DATA_PARSE, result.getMatchMethod());
        }

        @Test
        @DisplayName("所有匹配失败时返回 null")
        void testNoMatchReturnsNull() {
            // Given - no brand, no raw data
            when(protocolRepository.findByIsActiveTrue())
                    .thenReturn(Collections.emptyList());

            // When
            ProtocolMatcher.ProtocolMatchResult result = protocolMatcher.getBestMatch(
                    null, null, null, null);

            // Then
            assertNull(result);
        }
    }

    // ==================== Utility Methods 测试 ====================

    @Nested
    @DisplayName("工具方法测试")
    class UtilityMethodsTests {

        @Test
        @DisplayName("bytesToHex 正常转换")
        void testBytesToHex() {
            byte[] input = new byte[]{0x02, (byte)0xAB, (byte)0xCD, 0x03};
            String result = protocolMatcher.bytesToHex(input);
            assertEquals("02ABCD03", result);
        }

        @Test
        @DisplayName("bytesToHex null 输入")
        void testBytesToHexNull() {
            String result = protocolMatcher.bytesToHex(null);
            assertEquals("", result);
        }

        @Test
        @DisplayName("hexToBytes 正常转换")
        void testHexToBytes() {
            String input = "02ABCD03";
            byte[] result = protocolMatcher.hexToBytes(input);
            assertArrayEquals(new byte[]{0x02, (byte)0xAB, (byte)0xCD, 0x03}, result);
        }

        @Test
        @DisplayName("hexToBytes 带空格转换")
        void testHexToBytesWithSpaces() {
            String input = "02 AB CD 03";
            byte[] result = protocolMatcher.hexToBytes(input);
            assertArrayEquals(new byte[]{0x02, (byte)0xAB, (byte)0xCD, 0x03}, result);
        }

        @Test
        @DisplayName("hexToBytes null 或空输入")
        void testHexToBytesNullOrEmpty() {
            assertArrayEquals(new byte[0], protocolMatcher.hexToBytes(null));
            assertArrayEquals(new byte[0], protocolMatcher.hexToBytes(""));
        }

        @Test
        @DisplayName("matchByHexData 便捷方法")
        void testMatchByHexData() {
            // Given
            String hexData = "022B30303132333303";
            when(protocolRepository.findByIsActiveTrue())
                    .thenReturn(List.of(keliD2008Protocol));

            ScaleDataParseResult parseResult = new ScaleDataParseResult();
            parseResult.setSuccess(true);
            parseResult.setWeight(new BigDecimal("1000"));

            when(protocolAdapterService.dryRunParse(any(), any()))
                    .thenReturn(parseResult);

            // When
            List<ProtocolMatcher.ProtocolMatchResult> results = protocolMatcher.matchByHexData(hexData);

            // Then
            assertFalse(results.isEmpty());
        }
    }

    // ==================== Protocol Query 测试 ====================

    @Nested
    @DisplayName("协议查询方法测试")
    class ProtocolQueryTests {

        @Test
        @DisplayName("getProtocolById 找到协议")
        void testGetProtocolByIdFound() {
            when(protocolRepository.findById("P001"))
                    .thenReturn(Optional.of(keliD2008Protocol));

            Optional<ScaleProtocolConfig> result = protocolMatcher.getProtocolById("P001");

            assertTrue(result.isPresent());
            assertEquals("KELI_D2008_ASCII", result.get().getProtocolCode());
        }

        @Test
        @DisplayName("getProtocolById 未找到协议")
        void testGetProtocolByIdNotFound() {
            when(protocolRepository.findById("INVALID"))
                    .thenReturn(Optional.empty());

            Optional<ScaleProtocolConfig> result = protocolMatcher.getProtocolById("INVALID");

            assertTrue(result.isEmpty());
        }

        @Test
        @DisplayName("getProtocolByCode 找到协议")
        void testGetProtocolByCodeFound() {
            when(protocolRepository.findByProtocolCode("KELI_D2008_ASCII"))
                    .thenReturn(Optional.of(keliD2008Protocol));

            Optional<ScaleProtocolConfig> result = protocolMatcher.getProtocolByCode("KELI_D2008_ASCII");

            assertTrue(result.isPresent());
            assertEquals("P001", result.get().getId());
        }

        @Test
        @DisplayName("isProtocolActive 活跃协议")
        void testIsProtocolActiveTrue() {
            when(protocolRepository.findById("P001"))
                    .thenReturn(Optional.of(keliD2008Protocol));

            boolean result = protocolMatcher.isProtocolActive("P001");

            assertTrue(result);
        }

        @Test
        @DisplayName("isProtocolActive 非活跃协议")
        void testIsProtocolActiveFalse() {
            keliD2008Protocol.setIsActive(false);
            when(protocolRepository.findById("P001"))
                    .thenReturn(Optional.of(keliD2008Protocol));

            boolean result = protocolMatcher.isProtocolActive("P001");

            assertFalse(result);
        }

        @Test
        @DisplayName("isProtocolActive 协议不存在")
        void testIsProtocolActiveNotFound() {
            when(protocolRepository.findById("INVALID"))
                    .thenReturn(Optional.empty());

            boolean result = protocolMatcher.isProtocolActive("INVALID");

            assertFalse(result);
        }
    }

    // ==================== MatchMethod Enum 测试 ====================

    @Nested
    @DisplayName("MatchMethod 枚举测试")
    class MatchMethodEnumTests {

        @Test
        @DisplayName("所有匹配方法都有定义")
        void testAllMatchMethodsDefined() {
            ProtocolMatcher.MatchMethod[] methods = ProtocolMatcher.MatchMethod.values();

            assertTrue(methods.length >= 5); // At least 5 methods defined

            // Verify key methods exist
            assertNotNull(ProtocolMatcher.MatchMethod.EXACT_BRAND_MODEL);
            assertNotNull(ProtocolMatcher.MatchMethod.BRAND_ONLY);
            assertNotNull(ProtocolMatcher.MatchMethod.BRAND_MODEL_DEFAULT);
            assertNotNull(ProtocolMatcher.MatchMethod.RAW_DATA_PARSE);
            assertNotNull(ProtocolMatcher.MatchMethod.FRAME_PATTERN);
        }
    }

    // ==================== ProtocolMatchResult 测试 ====================

    @Nested
    @DisplayName("ProtocolMatchResult DTO测试")
    class ProtocolMatchResultTests {

        @Test
        @DisplayName("Builder 模式创建结果")
        void testBuilderPattern() {
            ProtocolMatcher.ProtocolMatchResult result = ProtocolMatcher.ProtocolMatchResult.builder()
                    .protocolId("P001")
                    .protocolCode("KELI_D2008_ASCII")
                    .protocolName("柯力D2008协议")
                    .confidence(95)
                    .matchMethod(ProtocolMatcher.MatchMethod.EXACT_BRAND_MODEL)
                    .isVerified(true)
                    .isBuiltin(true)
                    .matchReason("Test match")
                    .build();

            assertEquals("P001", result.getProtocolId());
            assertEquals("KELI_D2008_ASCII", result.getProtocolCode());
            assertEquals(95, result.getConfidence());
            assertTrue(result.getIsVerified());
        }

        @Test
        @DisplayName("无参构造器")
        void testNoArgsConstructor() {
            ProtocolMatcher.ProtocolMatchResult result = new ProtocolMatcher.ProtocolMatchResult();
            assertNull(result.getProtocolId());
            assertNull(result.getConfidence());
        }
    }
}
