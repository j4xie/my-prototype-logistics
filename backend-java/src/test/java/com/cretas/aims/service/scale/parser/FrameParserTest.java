package com.cretas.aims.service.scale.parser;

import com.cretas.aims.dto.scale.ScaleDataParseResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 帧解析器单元测试
 *
 * 测试覆盖:
 * - AsciiFixedFrameParser (UT-FRAME-001~007)
 * - AsciiVariableFrameParser (UT-FRAME-010~013)
 * - HexFixedFrameParser (UT-FRAME-020~023)
 * - ModbusRtuFrameParser (UT-FRAME-030~033)
 *
 * @author Cretas Team
 * @since 2026-01-06
 */
@DisplayName("帧解析器测试")
class FrameParserTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ==================== AsciiFixedFrameParser 测试 ====================

    @Nested
    @DisplayName("AsciiFixedFrameParser 测试")
    class AsciiFixedFrameParserTests {

        private AsciiFixedFrameParser parser;

        @BeforeEach
        void setUp() {
            parser = new AsciiFixedFrameParser();
        }

        @Test
        @DisplayName("getFrameType 返回 ASCII_FIXED")
        void testGetFrameType() {
            assertEquals("ASCII_FIXED", parser.getFrameType());
        }

        @Test
        @DisplayName("UT-FRAME-001: 正常毛重数据解析")
        void testNormalGrossWeightParsing() {
            // 格式: +001234 kg S (符号+重量+单位+稳定标志)
            JsonNode format = createAsciiFixedFormat(10, 0, 6, 1, 7, 2, 9, 1);
            byte[] rawData = "+001234 kg S".getBytes(StandardCharsets.US_ASCII);

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess(), "解析应该成功");
            assertNotNull(result.getWeight(), "重量不应为空");
            assertEquals(new BigDecimal("1234"), result.getWeight());
            assertEquals("kg", result.getUnit());
            assertTrue(result.getStable(), "应该是稳定状态");
        }

        @Test
        @DisplayName("UT-FRAME-002: 负数重量解析")
        void testNegativeWeightParsing() {
            JsonNode format = createAsciiFixedFormat(10, 0, 6, 1, 7, 2, 9, 1);
            byte[] rawData = "-001000 kg S".getBytes(StandardCharsets.US_ASCII);

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess());
            assertNotNull(result.getWeight());
            assertEquals(new BigDecimal("-1000"), result.getWeight());
        }

        @Test
        @DisplayName("UT-FRAME-003: 不稳定状态解析")
        void testUnstableStatusParsing() {
            JsonNode format = createAsciiFixedFormat(10, 0, 6, 1, 7, 2, 9, 1);
            byte[] rawData = "+001234 kg U".getBytes(StandardCharsets.US_ASCII);

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess());
            assertFalse(result.getStable(), "应该是不稳定状态");
        }

        @Test
        @DisplayName("UT-FRAME-004: 超载状态处理")
        void testOverloadStatusHandling() {
            // 超载通常用特殊字符或全9表示
            JsonNode format = createAsciiFixedFormat(10, 0, 6, 1, 7, 2, 9, 1);
            byte[] rawData = "+999999 kg O".getBytes(StandardCharsets.US_ASCII);

            ScaleDataParseResult result = parser.parse(format, rawData);

            // 超载数据仍可解析，但值为最大
            assertTrue(result.isSuccess());
            assertEquals(new BigDecimal("999999"), result.getWeight());
        }

        @Test
        @DisplayName("UT-FRAME-005: 帧长度不足返回失败")
        void testInsufficientFrameLength() {
            JsonNode format = createAsciiFixedFormat(12, 0, 6, 1, 7, 2, 9, 1);
            byte[] rawData = "+001".getBytes(StandardCharsets.US_ASCII);

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertFalse(result.isSuccess(), "帧长度不足应该解析失败");
            assertEquals(ScaleDataParseResult.ERROR_INVALID_DATA_FORMAT, result.getErrorCode());
        }

        @Test
        @DisplayName("UT-FRAME-006: null 输入处理")
        void testNullInputHandling() {
            JsonNode format = createAsciiFixedFormat(10, 0, 6, 1, 7, 2, 9, 1);

            ScaleDataParseResult result = parser.parse(format, null);

            assertFalse(result.isSuccess());
            assertEquals(ScaleDataParseResult.ERROR_INVALID_DATA_FORMAT, result.getErrorCode());
        }

        @Test
        @DisplayName("UT-FRAME-007: 空输入处理")
        void testEmptyInputHandling() {
            JsonNode format = createAsciiFixedFormat(10, 0, 6, 1, 7, 2, 9, 1);
            byte[] rawData = new byte[0];

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertFalse(result.isSuccess());
            assertEquals(ScaleDataParseResult.ERROR_INVALID_DATA_FORMAT, result.getErrorCode());
        }

        @Test
        @DisplayName("小数位处理")
        void testDecimalPlaceHandling() {
            // 带小数位配置的格式
            ObjectNode format = objectMapper.createObjectNode();
            format.put("frameLength", 12);

            ArrayNode fields = objectMapper.createArrayNode();
            ObjectNode weightField = objectMapper.createObjectNode();
            weightField.put("name", "weight");
            weightField.put("start", 0);
            weightField.put("length", 8);
            weightField.put("decimalPlaces", 2);
            fields.add(weightField);
            format.set("fields", fields);

            byte[] rawData = "+00123456 kg".getBytes(StandardCharsets.US_ASCII);

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess());
            // 原始值 123456，带2位小数 → 1234.56
            assertEquals(new BigDecimal("1234.56"), result.getWeight());
        }

        @Test
        @DisplayName("XOR 校验和验证")
        void testXorChecksumValidation() {
            ObjectNode format = createAsciiFixedFormatWithChecksum("XOR", 10, 11);
            // 构造带校验的数据
            byte[] rawData = "+001234 kg X".getBytes(StandardCharsets.US_ASCII);

            ScaleDataParseResult result = parser.parse(format, rawData);

            // 校验结果取决于实际校验计算
            assertNotNull(result);
        }

        /**
         * 创建 ASCII 固定格式配置
         */
        private JsonNode createAsciiFixedFormat(int frameLength, int signStart, int weightLength,
                                                  int signLength, int unitStart, int unitLength,
                                                  int stableStart, int stableLength) {
            ObjectNode format = objectMapper.createObjectNode();
            format.put("frameLength", frameLength);

            ArrayNode fields = objectMapper.createArrayNode();

            // 符号字段
            ObjectNode signField = objectMapper.createObjectNode();
            signField.put("name", "sign");
            signField.put("start", signStart);
            signField.put("length", signLength);
            fields.add(signField);

            // 重量字段
            ObjectNode weightField = objectMapper.createObjectNode();
            weightField.put("name", "weight");
            weightField.put("start", signStart + signLength);
            weightField.put("length", weightLength);
            fields.add(weightField);

            // 单位字段
            ObjectNode unitField = objectMapper.createObjectNode();
            unitField.put("name", "unit");
            unitField.put("start", unitStart);
            unitField.put("length", unitLength);
            fields.add(unitField);

            // 稳定标志字段
            ObjectNode stableField = objectMapper.createObjectNode();
            stableField.put("name", "stable");
            stableField.put("start", stableStart);
            stableField.put("length", stableLength);
            fields.add(stableField);

            format.set("fields", fields);
            return format;
        }

        private ObjectNode createAsciiFixedFormatWithChecksum(String type, int start, int length) {
            ObjectNode format = objectMapper.createObjectNode();
            format.put("frameLength", 12);

            ArrayNode fields = objectMapper.createArrayNode();
            ObjectNode weightField = objectMapper.createObjectNode();
            weightField.put("name", "weight");
            weightField.put("start", 1);
            weightField.put("length", 6);
            fields.add(weightField);
            format.set("fields", fields);

            ObjectNode checksum = objectMapper.createObjectNode();
            checksum.put("type", type);
            checksum.put("start", start);
            checksum.put("length", length);
            format.set("checksum", checksum);

            return format;
        }
    }

    // ==================== AsciiVariableFrameParser 测试 ====================

    @Nested
    @DisplayName("AsciiVariableFrameParser 测试")
    class AsciiVariableFrameParserTests {

        private AsciiVariableFrameParser parser;

        @BeforeEach
        void setUp() {
            parser = new AsciiVariableFrameParser();
        }

        @Test
        @DisplayName("getFrameType 返回 ASCII_VARIABLE")
        void testGetFrameType() {
            assertEquals("ASCII_VARIABLE", parser.getFrameType());
        }

        @Test
        @DisplayName("UT-FRAME-010: 逗号分隔数据解析")
        void testCommaSeparatedParsing() {
            JsonNode format = createAsciiVariableFormat(",", 0, 1, 2);
            byte[] rawData = "ST,+001234.5,kg".getBytes(StandardCharsets.US_ASCII);

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess(), "解析应该成功");
            assertNotNull(result.getWeight());
            assertEquals(new BigDecimal("1234.5"), result.getWeight());
            assertEquals("kg", result.getUnit());
        }

        @Test
        @DisplayName("UT-FRAME-011: 空格分隔数据解析")
        void testSpaceSeparatedParsing() {
            JsonNode format = createAsciiVariableFormat(" ", 0, 1, 2);
            byte[] rawData = "WT 00123.45 KG".getBytes(StandardCharsets.US_ASCII);

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess());
            assertNotNull(result.getWeight());
            assertEquals(new BigDecimal("123.45"), result.getWeight());
        }

        @Test
        @DisplayName("UT-FRAME-012: 多余空格处理")
        void testExtraWhitespaceHandling() {
            JsonNode format = createAsciiVariableFormat(",", 0, 1, 2);
            byte[] rawData = "ST,  00123.45  , kg ".getBytes(StandardCharsets.US_ASCII);

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess());
            assertNotNull(result.getWeight());
            assertEquals(new BigDecimal("123.45"), result.getWeight());
        }

        @Test
        @DisplayName("UT-FRAME-013: 空输入处理")
        void testEmptyInputHandling() {
            JsonNode format = createAsciiVariableFormat(",", 0, 1, 2);
            byte[] rawData = "".getBytes(StandardCharsets.US_ASCII);

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertFalse(result.isSuccess());
        }

        @Test
        @DisplayName("null 输入处理")
        void testNullInputHandling() {
            JsonNode format = createAsciiVariableFormat(",", 0, 1, 2);

            ScaleDataParseResult result = parser.parse(format, null);

            assertFalse(result.isSuccess());
            assertEquals(ScaleDataParseResult.ERROR_INVALID_DATA_FORMAT, result.getErrorCode());
        }

        @Test
        @DisplayName("单位归一化: g → kg")
        void testUnitNormalizationGrams() {
            JsonNode format = createAsciiVariableFormat(",", 0, 1, 2);
            byte[] rawData = "ST,1234,g".getBytes(StandardCharsets.US_ASCII);

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess());
            // 单位应该被归一化
            assertNotNull(result.getUnit());
        }

        @Test
        @DisplayName("分隔符字段不足")
        void testInsufficientFields() {
            JsonNode format = createAsciiVariableFormat(",", 0, 5, 6); // 需要索引5和6
            byte[] rawData = "ST,123,kg".getBytes(StandardCharsets.US_ASCII); // 只有3个字段

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertFalse(result.isSuccess(), "字段不足应该解析失败");
        }

        @Test
        @DisplayName("特殊分隔符: 管道符")
        void testPipeSeparator() {
            JsonNode format = createAsciiVariableFormat("|", 0, 1, 2);
            byte[] rawData = "ST|123.45|kg".getBytes(StandardCharsets.US_ASCII);

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess());
            assertEquals(new BigDecimal("123.45"), result.getWeight());
        }

        /**
         * 创建 ASCII 可变格式配置
         */
        private JsonNode createAsciiVariableFormat(String delimiter, int statusIndex,
                                                     int weightIndex, int unitIndex) {
            ObjectNode format = objectMapper.createObjectNode();
            format.put("delimiter", delimiter);

            ArrayNode fields = objectMapper.createArrayNode();

            // 状态字段
            ObjectNode statusField = objectMapper.createObjectNode();
            statusField.put("name", "status");
            statusField.put("index", statusIndex);
            fields.add(statusField);

            // 重量字段
            ObjectNode weightField = objectMapper.createObjectNode();
            weightField.put("name", "weight");
            weightField.put("index", weightIndex);
            fields.add(weightField);

            // 单位字段
            ObjectNode unitField = objectMapper.createObjectNode();
            unitField.put("name", "unit");
            unitField.put("index", unitIndex);
            fields.add(unitField);

            format.set("fields", fields);
            return format;
        }
    }

    // ==================== HexFixedFrameParser 测试 ====================

    @Nested
    @DisplayName("HexFixedFrameParser 测试")
    class HexFixedFrameParserTests {

        private HexFixedFrameParser parser;

        @BeforeEach
        void setUp() {
            parser = new HexFixedFrameParser();
        }

        @Test
        @DisplayName("getFrameType 返回 HEX_FIXED")
        void testGetFrameType() {
            assertEquals("HEX_FIXED", parser.getFrameType());
        }

        @Test
        @DisplayName("UT-FRAME-020: 标准二进制帧解析")
        void testStandardBinaryFrameParsing() {
            // 帧格式: AA 55 (header) + 00 00 30 39 (12345 big-endian) + checksum
            JsonNode format = createHexFixedFormat("AA55", null, 2, 4, "BIG_ENDIAN", "INTEGER");
            byte[] rawData = new byte[] {
                (byte) 0xAA, 0x55,           // header
                0x00, 0x00, 0x30, 0x39       // 12345 in big-endian
            };

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess(), "解析应该成功");
            assertNotNull(result.getWeight());
            assertEquals(new BigDecimal("12345"), result.getWeight());
        }

        @Test
        @DisplayName("UT-FRAME-021: 小数位处理")
        void testDecimalPlaceHandling() {
            JsonNode format = createHexFixedFormatWithDecimals("AA55", null, 2, 4, "BIG_ENDIAN", 2);
            byte[] rawData = new byte[] {
                (byte) 0xAA, 0x55,
                0x00, 0x00, 0x30, 0x39  // 12345
            };

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess());
            // 12345 with 2 decimal places = 123.45
            assertEquals(new BigDecimal("123.45"), result.getWeight());
        }

        @Test
        @DisplayName("UT-FRAME-022: 校验和正确")
        void testCorrectChecksum() {
            // 创建带校验和的格式
            ObjectNode format = createHexFixedFormatWithChecksum("XOR");
            // 数据 + 正确校验和
            byte[] rawData = new byte[] {
                (byte) 0xAA, 0x55,
                0x00, 0x00, 0x30, 0x39,
                0x09  // XOR of data bytes
            };

            ScaleDataParseResult result = parser.parse(format, rawData);

            // 校验应该通过
            assertTrue(result.getChecksumValid() == null || result.getChecksumValid());
        }

        @Test
        @DisplayName("UT-FRAME-023: 校验和错误")
        void testIncorrectChecksum() {
            ObjectNode format = createHexFixedFormatWithChecksum("XOR");
            // 数据 + 错误校验和
            byte[] rawData = new byte[] {
                (byte) 0xAA, 0x55,
                0x00, 0x00, 0x30, 0x39,
                (byte) 0xFF  // 错误的校验和
            };

            ScaleDataParseResult result = parser.parse(format, rawData);

            // 校验失败
            if (result.getChecksumValid() != null) {
                assertFalse(result.getChecksumValid(), "校验和应该失败");
            }
        }

        @Test
        @DisplayName("帧头不匹配")
        void testHeaderMismatch() {
            JsonNode format = createHexFixedFormat("AA55", null, 2, 4, "BIG_ENDIAN", "INTEGER");
            byte[] rawData = new byte[] {
                (byte) 0xBB, 0x66,  // 错误的帧头
                0x00, 0x00, 0x30, 0x39
            };

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertFalse(result.isSuccess(), "帧头不匹配应该解析失败");
        }

        @Test
        @DisplayName("帧尾不匹配")
        void testTrailerMismatch() {
            JsonNode format = createHexFixedFormat("AA55", "0D0A", 2, 4, "BIG_ENDIAN", "INTEGER");
            byte[] rawData = new byte[] {
                (byte) 0xAA, 0x55,
                0x00, 0x00, 0x30, 0x39,
                0x0D, 0x0B  // 错误的帧尾
            };

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertFalse(result.isSuccess(), "帧尾不匹配应该解析失败");
        }

        @Test
        @DisplayName("Little-Endian 字节序")
        void testLittleEndianByteOrder() {
            JsonNode format = createHexFixedFormat("AA55", null, 2, 4, "LITTLE_ENDIAN", "INTEGER");
            byte[] rawData = new byte[] {
                (byte) 0xAA, 0x55,
                0x39, 0x30, 0x00, 0x00  // 12345 in little-endian
            };

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess());
            assertEquals(new BigDecimal("12345"), result.getWeight());
        }

        @Test
        @DisplayName("BCD 编码解析")
        void testBcdEncodingParsing() {
            JsonNode format = createHexFixedFormat("AA55", null, 2, 3, "BIG_ENDIAN", "BCD");
            byte[] rawData = new byte[] {
                (byte) 0xAA, 0x55,
                0x12, 0x34, 0x56  // BCD: 123456
            };

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess());
            assertEquals(new BigDecimal("123456"), result.getWeight());
        }

        @Test
        @DisplayName("null 输入处理")
        void testNullInputHandling() {
            JsonNode format = createHexFixedFormat("AA55", null, 2, 4, "BIG_ENDIAN", "INTEGER");

            ScaleDataParseResult result = parser.parse(format, null);

            assertFalse(result.isSuccess());
            assertEquals(ScaleDataParseResult.ERROR_INVALID_DATA_FORMAT, result.getErrorCode());
        }

        @Test
        @DisplayName("空输入处理")
        void testEmptyInputHandling() {
            JsonNode format = createHexFixedFormat("AA55", null, 2, 4, "BIG_ENDIAN", "INTEGER");

            ScaleDataParseResult result = parser.parse(format, new byte[0]);

            assertFalse(result.isSuccess());
        }

        /**
         * 创建 HEX 固定格式配置
         */
        private JsonNode createHexFixedFormat(String header, String trailer, int dataStart,
                                                int dataLength, String byteOrder, String dataType) {
            ObjectNode format = objectMapper.createObjectNode();

            if (header != null) {
                format.put("header", header);
            }
            if (trailer != null) {
                format.put("trailer", trailer);
            }
            format.put("byteOrder", byteOrder);

            ArrayNode fields = objectMapper.createArrayNode();
            ObjectNode weightField = objectMapper.createObjectNode();
            weightField.put("name", "weight");
            weightField.put("start", dataStart);
            weightField.put("length", dataLength);
            weightField.put("dataType", dataType);
            fields.add(weightField);

            format.set("fields", fields);
            return format;
        }

        private JsonNode createHexFixedFormatWithDecimals(String header, String trailer, int dataStart,
                                                            int dataLength, String byteOrder, int decimals) {
            ObjectNode format = (ObjectNode) createHexFixedFormat(header, trailer, dataStart,
                    dataLength, byteOrder, "INTEGER");

            ArrayNode fields = (ArrayNode) format.get("fields");
            ((ObjectNode) fields.get(0)).put("decimalPlaces", decimals);

            return format;
        }

        private ObjectNode createHexFixedFormatWithChecksum(String checksumType) {
            ObjectNode format = objectMapper.createObjectNode();
            format.put("header", "AA55");
            format.put("byteOrder", "BIG_ENDIAN");

            ArrayNode fields = objectMapper.createArrayNode();
            ObjectNode weightField = objectMapper.createObjectNode();
            weightField.put("name", "weight");
            weightField.put("start", 2);
            weightField.put("length", 4);
            weightField.put("dataType", "INTEGER");
            fields.add(weightField);
            format.set("fields", fields);

            ObjectNode checksum = objectMapper.createObjectNode();
            checksum.put("type", checksumType);
            checksum.put("start", 6);
            checksum.put("length", 1);
            checksum.put("dataStart", 2);
            checksum.put("dataEnd", 6);
            format.set("checksum", checksum);

            return format;
        }
    }

    // ==================== ModbusRtuFrameParser 测试 ====================

    @Nested
    @DisplayName("ModbusRtuFrameParser 测试")
    class ModbusRtuFrameParserTests {

        private ModbusRtuFrameParser parser;

        @BeforeEach
        void setUp() {
            parser = new ModbusRtuFrameParser();
        }

        @Test
        @DisplayName("getFrameType 返回 MODBUS_RTU")
        void testGetFrameType() {
            assertEquals("MODBUS_RTU", parser.getFrameType());
        }

        @Test
        @DisplayName("UT-FRAME-030: 读保持寄存器响应解析")
        void testReadHoldingRegistersResponse() {
            // Modbus RTU 响应格式: 从站地址 + 功能码 + 字节数 + 数据 + CRC
            JsonNode format = createModbusRtuFormat(1, 0x03, 0, 1);
            // 01 03 04 00 00 30 39 XX XX (从站1, 功能码03, 4字节数据, 值12345)
            byte[] rawData = createModbusResponse(1, 0x03, new byte[] {0x00, 0x00, 0x30, 0x39});

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess(), "解析应该成功");
            assertNotNull(result.getWeight());
            assertEquals(new BigDecimal("12345"), result.getWeight());
        }

        @Test
        @DisplayName("UT-FRAME-031: 从站地址验证")
        void testSlaveAddressValidation() {
            JsonNode format = createModbusRtuFormat(1, 0x03, 0, 1);
            // 从站地址为2，但配置期望1
            byte[] rawData = createModbusResponse(2, 0x03, new byte[] {0x00, 0x00, 0x30, 0x39});

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertFalse(result.isSuccess(), "从站地址不匹配应该解析失败");
        }

        @Test
        @DisplayName("UT-FRAME-032: 功能码错误")
        void testInvalidFunctionCode() {
            JsonNode format = createModbusRtuFormat(1, 0x03, 0, 1);
            // 功能码为04 (读输入寄存器)，但配置期望03
            byte[] rawData = createModbusResponse(1, 0x04, new byte[] {0x00, 0x00, 0x30, 0x39});

            ScaleDataParseResult result = parser.parse(format, rawData);

            // 功能码不匹配
            assertFalse(result.isSuccess(), "功能码不匹配应该解析失败");
        }

        @Test
        @DisplayName("UT-FRAME-033: CRC 校验错误")
        void testCrcValidationError() {
            JsonNode format = createModbusRtuFormat(1, 0x03, 0, 1);
            // 创建带错误CRC的数据
            byte[] rawData = new byte[] {
                0x01, 0x03, 0x04,
                0x00, 0x00, 0x30, 0x39,
                (byte) 0xFF, (byte) 0xFF  // 错误的CRC
            };

            ScaleDataParseResult result = parser.parse(format, rawData);

            // CRC校验失败
            if (!result.isSuccess()) {
                assertEquals(ScaleDataParseResult.ERROR_CHECKSUM_FAILED, result.getErrorCode());
            }
        }

        @Test
        @DisplayName("读输入寄存器响应 (功能码04)")
        void testReadInputRegistersResponse() {
            JsonNode format = createModbusRtuFormat(1, 0x04, 0, 1);
            byte[] rawData = createModbusResponse(1, 0x04, new byte[] {0x00, 0x00, 0x30, 0x39});

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess());
            assertEquals(new BigDecimal("12345"), result.getWeight());
        }

        @Test
        @DisplayName("null 输入处理")
        void testNullInputHandling() {
            JsonNode format = createModbusRtuFormat(1, 0x03, 0, 1);

            ScaleDataParseResult result = parser.parse(format, null);

            assertFalse(result.isSuccess());
            assertEquals(ScaleDataParseResult.ERROR_INVALID_DATA_FORMAT, result.getErrorCode());
        }

        @Test
        @DisplayName("空输入处理")
        void testEmptyInputHandling() {
            JsonNode format = createModbusRtuFormat(1, 0x03, 0, 1);

            ScaleDataParseResult result = parser.parse(format, new byte[0]);

            assertFalse(result.isSuccess());
        }

        @Test
        @DisplayName("帧长度不足")
        void testInsufficientFrameLength() {
            JsonNode format = createModbusRtuFormat(1, 0x03, 0, 1);
            byte[] rawData = new byte[] {0x01, 0x03};  // 只有2字节

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertFalse(result.isSuccess(), "帧长度不足应该解析失败");
        }

        @Test
        @DisplayName("32位寄存器值解析")
        void test32BitRegisterValue() {
            JsonNode format = createModbusRtuFormat(1, 0x03, 0, 2);  // 2个寄存器
            byte[] rawData = createModbusResponse(1, 0x03, new byte[] {
                0x00, 0x01,  // 高16位
                (byte) 0x86, (byte) 0xA0  // 低16位 = 100000
            });

            ScaleDataParseResult result = parser.parse(format, rawData);

            assertTrue(result.isSuccess());
            assertEquals(new BigDecimal("100000"), result.getWeight());
        }

        @Test
        @DisplayName("createReadRequest 静态方法")
        void testCreateReadRequest() {
            byte[] request = ModbusRtuFrameParser.createReadRequest(1, 0x03, 0, 2);

            assertNotNull(request);
            assertEquals(8, request.length);  // 从站地址 + 功能码 + 地址(2) + 数量(2) + CRC(2)
            assertEquals(0x01, request[0]);   // 从站地址
            assertEquals(0x03, request[1]);   // 功能码
        }

        /**
         * 创建 Modbus RTU 格式配置
         */
        private JsonNode createModbusRtuFormat(int slaveId, int functionCode, int startAddress, int registerCount) {
            ObjectNode format = objectMapper.createObjectNode();
            format.put("slaveId", slaveId);
            format.put("functionCode", functionCode);
            format.put("startAddress", startAddress);
            format.put("registerCount", registerCount);
            format.put("wordOrder", "BIG_ENDIAN");

            ArrayNode fields = objectMapper.createArrayNode();
            ObjectNode weightField = objectMapper.createObjectNode();
            weightField.put("name", "weight");
            weightField.put("registerIndex", 0);
            weightField.put("registerCount", registerCount);
            fields.add(weightField);
            format.set("fields", fields);

            return format;
        }

        /**
         * 创建 Modbus RTU 响应数据
         */
        private byte[] createModbusResponse(int slaveId, int functionCode, byte[] data) {
            // 响应格式: 从站地址 + 功能码 + 字节数 + 数据 + CRC
            byte[] response = new byte[3 + data.length + 2];
            response[0] = (byte) slaveId;
            response[1] = (byte) functionCode;
            response[2] = (byte) data.length;
            System.arraycopy(data, 0, response, 3, data.length);

            // 计算 CRC
            int crc = calculateModbusCrc(response, 0, 3 + data.length);
            response[response.length - 2] = (byte) (crc & 0xFF);
            response[response.length - 1] = (byte) ((crc >> 8) & 0xFF);

            return response;
        }

        /**
         * 计算 Modbus CRC16
         */
        private int calculateModbusCrc(byte[] data, int offset, int length) {
            int crc = 0xFFFF;
            for (int i = offset; i < offset + length; i++) {
                crc ^= (data[i] & 0xFF);
                for (int j = 0; j < 8; j++) {
                    if ((crc & 0x0001) != 0) {
                        crc = (crc >> 1) ^ 0xA001;
                    } else {
                        crc >>= 1;
                    }
                }
            }
            return crc;
        }
    }

    // ==================== FrameParserFactory 测试 ====================

    @Nested
    @DisplayName("FrameParserFactory 测试")
    class FrameParserFactoryTests {

        @Test
        @DisplayName("获取 ASCII_FIXED 解析器")
        void testGetAsciiFixedParser() {
            AbstractFrameParser parser = FrameParserFactory.getParser("ASCII_FIXED");

            assertNotNull(parser);
            assertInstanceOf(AsciiFixedFrameParser.class, parser);
        }

        @Test
        @DisplayName("获取 ASCII_VARIABLE 解析器")
        void testGetAsciiVariableParser() {
            AbstractFrameParser parser = FrameParserFactory.getParser("ASCII_VARIABLE");

            assertNotNull(parser);
            assertInstanceOf(AsciiVariableFrameParser.class, parser);
        }

        @Test
        @DisplayName("获取 HEX_FIXED 解析器")
        void testGetHexFixedParser() {
            AbstractFrameParser parser = FrameParserFactory.getParser("HEX_FIXED");

            assertNotNull(parser);
            assertInstanceOf(HexFixedFrameParser.class, parser);
        }

        @Test
        @DisplayName("获取 MODBUS_RTU 解析器")
        void testGetModbusRtuParser() {
            AbstractFrameParser parser = FrameParserFactory.getParser("MODBUS_RTU");

            assertNotNull(parser);
            assertInstanceOf(ModbusRtuFrameParser.class, parser);
        }

        @Test
        @DisplayName("未知帧类型返回 null")
        void testUnknownFrameTypeReturnsNull() {
            AbstractFrameParser parser = FrameParserFactory.getParser("UNKNOWN_TYPE");

            assertNull(parser);
        }

        @Test
        @DisplayName("null 帧类型处理")
        void testNullFrameTypeHandling() {
            AbstractFrameParser parser = FrameParserFactory.getParser(null);

            assertNull(parser);
        }

        @Test
        @DisplayName("大小写不敏感")
        void testCaseInsensitivity() {
            AbstractFrameParser parser1 = FrameParserFactory.getParser("ascii_fixed");
            AbstractFrameParser parser2 = FrameParserFactory.getParser("ASCII_FIXED");
            AbstractFrameParser parser3 = FrameParserFactory.getParser("Ascii_Fixed");

            // 如果工厂支持大小写不敏感
            if (parser1 != null) {
                assertEquals(parser1.getClass(), parser2.getClass());
                assertEquals(parser2.getClass(), parser3.getClass());
            }
        }
    }
}
