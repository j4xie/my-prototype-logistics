package com.cretas.aims.service.scale.parser;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;

/**
 * Parser for Modbus RTU frame protocols.
 * Used by industrial scales that communicate via Modbus RTU protocol.
 *
 * <p>Modbus RTU Frame Structure:
 * <ul>
 *   <li>Byte 0: Slave Address (1-247)</li>
 *   <li>Byte 1: Function Code (03=Read Holding Registers, 04=Read Input Registers)</li>
 *   <li>Byte 2: Byte Count (for response)</li>
 *   <li>Bytes 3-N: Register Data</li>
 *   <li>Last 2 Bytes: CRC16 (LSB first)</li>
 * </ul>
 *
 * <p>Common Function Codes:
 * <ul>
 *   <li>0x03: Read Holding Registers</li>
 *   <li>0x04: Read Input Registers</li>
 *   <li>0x06: Write Single Register</li>
 *   <li>0x10: Write Multiple Registers</li>
 * </ul>
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
@Component
public class ModbusRtuFrameParser extends AbstractFrameParser {

    private static final String FRAME_TYPE = "MODBUS_RTU";

    // Modbus constants
    private static final int MIN_FRAME_LENGTH = 5; // SlaveId + FunctionCode + ByteCount + CRC16
    private static final int FUNCTION_READ_HOLDING_REGISTERS = 0x03;
    private static final int FUNCTION_READ_INPUT_REGISTERS = 0x04;
    private static final int CRC_LENGTH = 2;

    @Override
    public String getFrameType() {
        return FRAME_TYPE;
    }

    @Override
    protected FrameValidationResult validateFrame(JsonNode format, byte[] rawData) {
        if (rawData == null || rawData.length == 0) {
            return FrameValidationResult.invalid("Raw data is empty");
        }

        // Minimum length check
        if (rawData.length < MIN_FRAME_LENGTH) {
            return FrameValidationResult.invalid(
                    String.format("Modbus frame too short: minimum %d bytes, actual %d bytes",
                            MIN_FRAME_LENGTH, rawData.length)
            );
        }

        // Validate slave address (1-247, 0 is broadcast)
        int slaveId = rawData[0] & 0xFF;
        int expectedSlaveId = getIntValue(format, "slaveId", -1);
        if (expectedSlaveId >= 0 && slaveId != expectedSlaveId) {
            return FrameValidationResult.invalid(
                    String.format("Slave ID mismatch: expected %d, actual %d", expectedSlaveId, slaveId)
            );
        }

        // Validate function code
        int functionCode = rawData[1] & 0xFF;
        int expectedFunctionCode = getIntValue(format, "functionCode", -1);
        if (expectedFunctionCode >= 0 && functionCode != expectedFunctionCode) {
            return FrameValidationResult.invalid(
                    String.format("Function code mismatch: expected %d, actual %d",
                            expectedFunctionCode, functionCode)
            );
        }

        // Check if this is a response to read registers (03 or 04)
        if (functionCode == FUNCTION_READ_HOLDING_REGISTERS || functionCode == FUNCTION_READ_INPUT_REGISTERS) {
            int byteCount = rawData[2] & 0xFF;
            int expectedLength = 3 + byteCount + CRC_LENGTH;

            if (rawData.length != expectedLength) {
                return FrameValidationResult.invalid(
                        String.format("Frame length mismatch: expected %d (byteCount=%d), actual %d",
                                expectedLength, byteCount, rawData.length)
                );
            }
        }

        // Check for exception response (function code with high bit set)
        if ((functionCode & 0x80) != 0) {
            int exceptionCode = rawData.length > 2 ? (rawData[2] & 0xFF) : 0;
            return FrameValidationResult.invalid(
                    String.format("Modbus exception response: function=%02X, exception=%02X",
                            functionCode, exceptionCode)
            );
        }

        return FrameValidationResult.valid();
    }

    @Override
    protected byte[] extractDataSegment(JsonNode format, byte[] rawData) {
        int functionCode = rawData[1] & 0xFF;

        // For read register responses, extract register data
        if (functionCode == FUNCTION_READ_HOLDING_REGISTERS || functionCode == FUNCTION_READ_INPUT_REGISTERS) {
            int byteCount = rawData[2] & 0xFF;
            if (rawData.length >= 3 + byteCount + CRC_LENGTH) {
                return Arrays.copyOfRange(rawData, 3, 3 + byteCount);
            }
        }

        // For other function codes, return data after function code
        int headerLength = 2; // SlaveId + FunctionCode
        int dataLength = rawData.length - headerLength - CRC_LENGTH;
        if (dataLength > 0) {
            return Arrays.copyOfRange(rawData, headerLength, headerLength + dataLength);
        }

        return new byte[0];
    }

    @Override
    protected ParsedFrameData parseFrameData(JsonNode format, byte[] rawData, byte[] dataSegment) {
        ParsedFrameData.Builder builder = ParsedFrameData.builder();
        builder.unit("kg");
        builder.stable(true); // Modbus typically implies stable reading

        if (dataSegment == null || dataSegment.length == 0) {
            log.warn("Empty data segment for Modbus frame");
            return builder.build();
        }

        // Parse weight from register data
        int weightRegisterOffset = getIntValue(format, "weightRegisterOffset", 0);
        int weightRegisterCount = getIntValue(format, "weightRegisterCount", 2);
        int decimalPlaces = getIntValue(format, "decimalPlaces", 2);
        String byteOrderStr = getStringValue(format, "byteOrder", "BIG_ENDIAN");
        String wordOrderStr = getStringValue(format, "wordOrder", "HIGH_WORD_FIRST");

        // Each Modbus register is 2 bytes
        int byteOffset = weightRegisterOffset * 2;
        int byteLength = weightRegisterCount * 2;

        if (byteOffset + byteLength <= dataSegment.length) {
            byte[] weightBytes = Arrays.copyOfRange(dataSegment, byteOffset, byteOffset + byteLength);

            // Handle word order (for 32-bit values spanning 2 registers)
            if (weightBytes.length >= 4 && "LOW_WORD_FIRST".equals(wordOrderStr)) {
                // Swap high and low words
                byte[] swapped = new byte[4];
                swapped[0] = weightBytes[2];
                swapped[1] = weightBytes[3];
                swapped[2] = weightBytes[0];
                swapped[3] = weightBytes[1];
                weightBytes = swapped;
            }

            // Parse value based on data type
            String dataType = getStringValue(format, "dataType", "INTEGER");
            BigDecimal weight = parseWeightValue(weightBytes, dataType, byteOrderStr, decimalPlaces);
            builder.weight(weight);
        } else {
            log.warn("Weight register offset {} + count {} exceeds data segment length {}",
                    weightRegisterOffset, weightRegisterCount, dataSegment.length / 2);
        }

        // Parse additional fields if configured
        JsonNode additionalFields = format.path("additionalFields");
        if (!additionalFields.isMissingNode() && additionalFields.isArray()) {
            for (JsonNode field : additionalFields) {
                String name = field.path("name").asText();
                int registerOffset = field.path("registerOffset").asInt();
                int registerCount = field.path("registerCount").asInt(1);
                int fieldDecimalPlaces = field.path("decimalPlaces").asInt(0);

                int fieldByteOffset = registerOffset * 2;
                int fieldByteLength = registerCount * 2;

                if (fieldByteOffset + fieldByteLength <= dataSegment.length) {
                    byte[] fieldBytes = Arrays.copyOfRange(dataSegment, fieldByteOffset,
                            fieldByteOffset + fieldByteLength);
                    BigDecimal value = parseWeightValue(fieldBytes, "INTEGER", byteOrderStr, fieldDecimalPlaces);

                    switch (name) {
                        case "tare":
                        case "tareWeight":
                            builder.tareWeight(value);
                            break;
                        case "gross":
                        case "grossWeight":
                            builder.grossWeight(value);
                            break;
                        case "net":
                        case "netWeight":
                            builder.netWeight(value);
                            break;
                        case "stable":
                        case "status":
                            builder.stable(value != null && value.intValue() == 1);
                            break;
                    }
                }
            }
        }

        // Parse unit from register if configured
        int unitRegisterOffset = getIntValue(format, "unitRegisterOffset", -1);
        if (unitRegisterOffset >= 0 && unitRegisterOffset * 2 < dataSegment.length) {
            int unitCode = dataSegment[unitRegisterOffset * 2] & 0xFF;
            String unit = mapUnitCode(unitCode, format);
            builder.unit(unit);
        }

        return builder.build();
    }

    /**
     * Parses weight value from bytes based on data type.
     */
    private BigDecimal parseWeightValue(byte[] bytes, String dataType, String byteOrderStr, int decimalPlaces) {
        if (bytes == null || bytes.length == 0) {
            return BigDecimal.ZERO;
        }

        ByteOrder byteOrder = "LITTLE_ENDIAN".equals(byteOrderStr) ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN;

        long rawValue;

        switch (dataType.toUpperCase()) {
            case "FLOAT":
                if (bytes.length >= 4) {
                    ByteBuffer buffer = ByteBuffer.wrap(bytes).order(byteOrder);
                    float floatValue = buffer.getFloat();
                    return BigDecimal.valueOf(floatValue);
                }
                break;

            case "DOUBLE":
                if (bytes.length >= 8) {
                    ByteBuffer buffer = ByteBuffer.wrap(bytes).order(byteOrder);
                    double doubleValue = buffer.getDouble();
                    return BigDecimal.valueOf(doubleValue);
                }
                break;

            case "INT16":
            case "SHORT":
                if (bytes.length >= 2) {
                    ByteBuffer buffer = ByteBuffer.wrap(bytes).order(byteOrder);
                    short shortValue = buffer.getShort();
                    rawValue = shortValue;
                    return applyDecimalPlaces(rawValue, decimalPlaces);
                }
                break;

            case "UINT16":
                if (bytes.length >= 2) {
                    rawValue = ((bytes[0] & 0xFF) << 8) | (bytes[1] & 0xFF);
                    if (byteOrder == ByteOrder.LITTLE_ENDIAN) {
                        rawValue = ((bytes[1] & 0xFF) << 8) | (bytes[0] & 0xFF);
                    }
                    return applyDecimalPlaces(rawValue, decimalPlaces);
                }
                break;

            case "INT32":
            case "INTEGER":
            default:
                rawValue = parseInteger(bytes, byteOrder);
                return applyDecimalPlaces(rawValue, decimalPlaces);
        }

        return BigDecimal.ZERO;
    }

    /**
     * Parses integer value from bytes.
     */
    private long parseInteger(byte[] bytes, ByteOrder byteOrder) {
        long value = 0;
        if (byteOrder == ByteOrder.BIG_ENDIAN) {
            for (byte b : bytes) {
                value = (value << 8) | (b & 0xFF);
            }
        } else {
            for (int i = bytes.length - 1; i >= 0; i--) {
                value = (value << 8) | (bytes[i] & 0xFF);
            }
        }
        return value;
    }

    /**
     * Applies decimal places to raw value.
     */
    private BigDecimal applyDecimalPlaces(long rawValue, int decimalPlaces) {
        BigDecimal value = BigDecimal.valueOf(rawValue);
        if (decimalPlaces > 0) {
            value = value.movePointLeft(decimalPlaces);
        }
        return value;
    }

    /**
     * Maps unit code to unit string.
     */
    private String mapUnitCode(int unitCode, JsonNode format) {
        JsonNode unitMapping = format.path("unitMapping");
        if (!unitMapping.isMissingNode()) {
            String codeKey = String.valueOf(unitCode);
            if (unitMapping.has(codeKey)) {
                return unitMapping.path(codeKey).asText("kg");
            }
        }

        // Default mapping
        switch (unitCode) {
            case 0:
            case 1:
                return "kg";
            case 2:
                return "g";
            case 3:
                return "lb";
            case 4:
                return "oz";
            case 5:
                return "t";
            default:
                return "kg";
        }
    }

    @Override
    protected boolean verifyChecksum(JsonNode format, byte[] rawData) {
        if (rawData == null || rawData.length < MIN_FRAME_LENGTH) {
            return false;
        }

        // Calculate CRC16 for data (excluding last 2 CRC bytes)
        int dataLength = rawData.length - CRC_LENGTH;
        int calculatedCrc = calculateModbusCrc(rawData, 0, dataLength);

        // Extract CRC from frame (LSB first in Modbus RTU)
        int receivedCrcLow = rawData[dataLength] & 0xFF;
        int receivedCrcHigh = rawData[dataLength + 1] & 0xFF;
        int receivedCrc = receivedCrcLow | (receivedCrcHigh << 8);

        boolean valid = calculatedCrc == receivedCrc;
        if (!valid) {
            log.warn("Modbus CRC mismatch: calculated=0x{}, received=0x{}",
                    String.format("%04X", calculatedCrc), String.format("%04X", receivedCrc));
        }
        return valid;
    }

    /**
     * Calculates Modbus CRC16.
     * Uses polynomial 0xA001 (bit-reversed 0x8005).
     *
     * @param data   Data bytes
     * @param offset Start offset
     * @param length Number of bytes
     * @return CRC16 value
     */
    private int calculateModbusCrc(byte[] data, int offset, int length) {
        int crc = 0xFFFF;
        for (int i = offset; i < offset + length && i < data.length; i++) {
            crc ^= (data[i] & 0xFF);
            for (int j = 0; j < 8; j++) {
                if ((crc & 0x0001) != 0) {
                    crc = (crc >> 1) ^ 0xA001;
                } else {
                    crc = crc >> 1;
                }
            }
        }
        return crc;
    }

    // ==================== Utility Methods for Modbus Commands ====================

    /**
     * Creates a Modbus read registers request frame.
     *
     * @param slaveId        Slave address
     * @param functionCode   Function code (03 or 04)
     * @param startAddress   Starting register address
     * @param registerCount  Number of registers to read
     * @return Request frame bytes
     */
    public static byte[] createReadRequest(int slaveId, int functionCode, int startAddress, int registerCount) {
        byte[] frame = new byte[8];
        frame[0] = (byte) slaveId;
        frame[1] = (byte) functionCode;
        frame[2] = (byte) ((startAddress >> 8) & 0xFF);
        frame[3] = (byte) (startAddress & 0xFF);
        frame[4] = (byte) ((registerCount >> 8) & 0xFF);
        frame[5] = (byte) (registerCount & 0xFF);

        // Calculate CRC
        int crc = calculateStaticCrc(frame, 0, 6);
        frame[6] = (byte) (crc & 0xFF);        // CRC Low
        frame[7] = (byte) ((crc >> 8) & 0xFF); // CRC High

        return frame;
    }

    private static int calculateStaticCrc(byte[] data, int offset, int length) {
        int crc = 0xFFFF;
        for (int i = offset; i < offset + length && i < data.length; i++) {
            crc ^= (data[i] & 0xFF);
            for (int j = 0; j < 8; j++) {
                if ((crc & 0x0001) != 0) {
                    crc = (crc >> 1) ^ 0xA001;
                } else {
                    crc = crc >> 1;
                }
            }
        }
        return crc;
    }
}
