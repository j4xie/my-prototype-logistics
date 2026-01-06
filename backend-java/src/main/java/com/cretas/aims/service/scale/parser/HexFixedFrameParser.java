package com.cretas.aims.service.scale.parser;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * Parser for HEX fixed-length frame protocols.
 * Used by industrial scales that output binary data with fixed byte positions.
 *
 * <p>Example frame format (16 bytes):
 * <ul>
 *   <li>Bytes 0-1: Header (0xAA 0x55)</li>
 *   <li>Byte 2: Command type</li>
 *   <li>Bytes 3-6: Weight value (32-bit integer, big-endian)</li>
 *   <li>Byte 7: Unit code</li>
 *   <li>Byte 8: Status flags (bit 0 = stable)</li>
 *   <li>Bytes 9-14: Reserved</li>
 *   <li>Byte 15: XOR checksum</li>
 * </ul>
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
@Component
public class HexFixedFrameParser extends AbstractFrameParser {

    private static final String FRAME_TYPE = "HEX_FIXED";

    @Override
    public String getFrameType() {
        return FRAME_TYPE;
    }

    @Override
    protected FrameValidationResult validateFrame(JsonNode format, byte[] rawData) {
        if (rawData == null || rawData.length == 0) {
            return FrameValidationResult.invalid("Raw data is empty");
        }

        // Validate frame length
        int expectedLength = getIntValue(format, "frameLength", 0);
        int minLength = getIntValue(format, "minLength", 1);

        if (expectedLength > 0 && rawData.length != expectedLength) {
            return FrameValidationResult.invalid(
                    String.format("Frame length mismatch: expected %d, actual %d", expectedLength, rawData.length)
            );
        }

        if (rawData.length < minLength) {
            return FrameValidationResult.invalid(
                    String.format("Frame too short: minimum %d, actual %d", minLength, rawData.length)
            );
        }

        // Validate header bytes if configured
        String headerHex = getStringValue(format, "header", "");
        if (!headerHex.isEmpty()) {
            byte[] expectedHeader = hexToBytes(headerHex);
            if (expectedHeader.length > 0 && rawData.length >= expectedHeader.length) {
                for (int i = 0; i < expectedHeader.length; i++) {
                    if (rawData[i] != expectedHeader[i]) {
                        return FrameValidationResult.invalid(
                                String.format("Header mismatch at byte %d: expected 0x%02X, actual 0x%02X",
                                        i, expectedHeader[i] & 0xFF, rawData[i] & 0xFF)
                        );
                    }
                }
            }
        }

        // Validate trailer bytes if configured
        String trailerHex = getStringValue(format, "trailer", "");
        if (!trailerHex.isEmpty()) {
            byte[] expectedTrailer = hexToBytes(trailerHex);
            if (expectedTrailer.length > 0 && rawData.length >= expectedTrailer.length) {
                int trailerStart = rawData.length - expectedTrailer.length;
                for (int i = 0; i < expectedTrailer.length; i++) {
                    if (rawData[trailerStart + i] != expectedTrailer[i]) {
                        return FrameValidationResult.invalid(
                                String.format("Trailer mismatch at byte %d: expected 0x%02X, actual 0x%02X",
                                        i, expectedTrailer[i] & 0xFF, rawData[trailerStart + i] & 0xFF)
                        );
                    }
                }
            }
        }

        // Check for required fields configuration
        JsonNode fields = format.path("fields");
        if (fields.isMissingNode() || !fields.isArray() || fields.size() == 0) {
            return FrameValidationResult.invalid("Frame format missing 'fields' configuration");
        }

        return FrameValidationResult.valid();
    }

    @Override
    protected byte[] extractDataSegment(JsonNode format, byte[] rawData) {
        int headerLength = getIntValue(format, "headerLength", 0);
        int trailerLength = getIntValue(format, "trailerLength", 0);
        int checksumLength = getIntValue(format, "checksumLength", 0);

        int start = headerLength;
        int end = rawData.length - trailerLength - checksumLength;

        if (start >= end) {
            log.warn("Invalid segment boundaries: start={}, end={}", start, end);
            return rawData;
        }

        return Arrays.copyOfRange(rawData, start, end);
    }

    @Override
    protected ParsedFrameData parseFrameData(JsonNode format, byte[] rawData, byte[] dataSegment) {
        JsonNode fields = format.path("fields");
        String byteOrderStr = getStringValue(format, "byteOrder", "BIG_ENDIAN");
        ByteOrder byteOrder = "LITTLE_ENDIAN".equals(byteOrderStr) ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN;

        ParsedFrameData.Builder builder = ParsedFrameData.builder();
        builder.unit("kg"); // Default unit

        for (JsonNode field : fields) {
            String name = field.path("name").asText();
            int start = field.path("start").asInt();
            int length = field.path("length").asInt();

            // Validate bounds against raw data (fields reference positions in full frame)
            if (start + length > rawData.length) {
                log.warn("Field '{}' exceeds frame length: start={}, length={}, frameLength={}",
                        name, start, length, rawData.length);
                continue;
            }

            byte[] fieldBytes = Arrays.copyOfRange(rawData, start, start + length);

            switch (name) {
                case "sign":
                    // Sign can be a dedicated byte or a bit in status
                    builder.sign((fieldBytes[0] & 0x80) != 0 ? '-' : '+');
                    break;

                case "weight":
                    BigDecimal weight = parseNumericField(fieldBytes, field, byteOrder);
                    builder.weight(weight);
                    break;

                case "unit":
                    String unit = parseUnitField(fieldBytes, field);
                    builder.unit(unit);
                    break;

                case "stable":
                case "status":
                    Boolean stable = parseStatusField(fieldBytes, field);
                    builder.stable(stable);
                    break;

                case "tare":
                case "tareWeight":
                    BigDecimal tare = parseNumericField(fieldBytes, field, byteOrder);
                    builder.tareWeight(tare);
                    break;

                case "gross":
                case "grossWeight":
                    BigDecimal gross = parseNumericField(fieldBytes, field, byteOrder);
                    builder.grossWeight(gross);
                    break;

                case "net":
                case "netWeight":
                    BigDecimal net = parseNumericField(fieldBytes, field, byteOrder);
                    builder.netWeight(net);
                    break;

                default:
                    log.debug("Unknown field type: {}", name);
            }
        }

        return builder.build();
    }

    /**
     * Parses a numeric field from bytes.
     */
    private BigDecimal parseNumericField(byte[] fieldBytes, JsonNode field, ByteOrder byteOrder) {
        if (fieldBytes == null || fieldBytes.length == 0) {
            return null;
        }

        String dataType = field.path("dataType").asText("INTEGER");
        long rawValue;

        switch (dataType.toUpperCase()) {
            case "FLOAT":
                if (fieldBytes.length >= 4) {
                    ByteBuffer buffer = ByteBuffer.wrap(fieldBytes).order(byteOrder);
                    float floatValue = buffer.getFloat();
                    return BigDecimal.valueOf(floatValue);
                }
                rawValue = parseIntegerValue(fieldBytes, byteOrder);
                break;

            case "DOUBLE":
                if (fieldBytes.length >= 8) {
                    ByteBuffer buffer = ByteBuffer.wrap(fieldBytes).order(byteOrder);
                    double doubleValue = buffer.getDouble();
                    return BigDecimal.valueOf(doubleValue);
                }
                rawValue = parseIntegerValue(fieldBytes, byteOrder);
                break;

            case "BCD":
                // BCD (Binary Coded Decimal) parsing
                rawValue = parseBcdValue(fieldBytes);
                break;

            case "INTEGER":
            default:
                // Parse as integer (big-endian by default)
                rawValue = parseIntegerValue(fieldBytes, byteOrder);
                break;
        }

        // Handle signed values
        boolean isSigned = field.path("signed").asBoolean(false);
        if (isSigned) {
            int bitCount = fieldBytes.length * 8;
            long signBit = 1L << (bitCount - 1);
            if ((rawValue & signBit) != 0) {
                rawValue = rawValue - (signBit << 1);
            }
        }

        BigDecimal value = BigDecimal.valueOf(rawValue);

        // Apply decimal places
        int decimalPlaces = field.path("decimalPlaces").asInt(0);
        if (decimalPlaces > 0) {
            value = value.movePointLeft(decimalPlaces);
        }

        // Apply scale factor
        double scaleFactor = field.path("scaleFactor").asDouble(1.0);
        if (scaleFactor != 1.0) {
            value = value.multiply(BigDecimal.valueOf(scaleFactor));
        }

        return value;
    }

    /**
     * Parses integer value from bytes.
     */
    private long parseIntegerValue(byte[] bytes, ByteOrder byteOrder) {
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
     * Parses BCD (Binary Coded Decimal) value from bytes.
     */
    private long parseBcdValue(byte[] bytes) {
        long value = 0;
        for (byte b : bytes) {
            int high = (b >> 4) & 0x0F;
            int low = b & 0x0F;
            value = value * 100 + high * 10 + low;
        }
        return value;
    }

    /**
     * Parses unit field from bytes.
     */
    private String parseUnitField(byte[] fieldBytes, JsonNode field) {
        // Check for unit code mapping
        JsonNode mapping = field.path("mapping");
        if (!mapping.isMissingNode() && fieldBytes.length > 0) {
            int unitCode = fieldBytes[0] & 0xFF;
            String codeKey = String.valueOf(unitCode);
            if (mapping.has(codeKey)) {
                return mapping.path(codeKey).asText("kg");
            }
        }

        // Try to parse as ASCII
        String ascii = new String(fieldBytes, StandardCharsets.US_ASCII).trim();
        if (!ascii.isEmpty() && ascii.matches("[a-zA-Z]+")) {
            return ascii.toLowerCase();
        }

        return "kg";
    }

    /**
     * Parses status/stable field from bytes.
     */
    private Boolean parseStatusField(byte[] fieldBytes, JsonNode field) {
        if (fieldBytes == null || fieldBytes.length == 0) {
            return null;
        }

        // Check for bit position
        int bitPosition = field.path("bitPosition").asInt(0);
        if (bitPosition >= 0 && bitPosition < 8) {
            return ((fieldBytes[0] >> bitPosition) & 0x01) == 1;
        }

        // Default: bit 0 indicates stability
        return (fieldBytes[0] & 0x01) == 1;
    }

    @Override
    protected boolean verifyChecksum(JsonNode format, byte[] rawData) {
        String checksumType = getStringValue(format, "checksumType", "NONE");
        if ("NONE".equals(checksumType)) {
            return true;
        }

        int checksumStart = getIntValue(format, "checksumStart", -1);
        int checksumLength = getIntValue(format, "checksumLength", 1);
        int dataStart = getIntValue(format, "dataStart", 0);
        int dataEnd = checksumStart > 0 ? checksumStart : rawData.length - checksumLength;

        if (checksumStart < 0) {
            checksumStart = rawData.length - checksumLength;
        }

        if (checksumStart >= rawData.length) {
            log.warn("Checksum position {} exceeds frame length {}", checksumStart, rawData.length);
            return true;
        }

        switch (checksumType.toUpperCase()) {
            case "XOR":
                return verifyXorChecksum(rawData, dataStart, dataEnd, checksumStart);
            case "SUM":
            case "CHECKSUM":
                return verifySumChecksum(rawData, dataStart, dataEnd, checksumStart);
            case "CRC16":
                return verifyCrc16Checksum(rawData, dataStart, dataEnd, checksumStart);
            case "MODBUS_CRC":
                return verifyModbusCrc(rawData, dataStart, dataEnd, checksumStart);
            default:
                log.debug("Unsupported checksum type: {}", checksumType);
                return true;
        }
    }

    private boolean verifyXorChecksum(byte[] data, int dataStart, int dataEnd, int checksumPos) {
        byte calculated = 0;
        for (int i = dataStart; i < dataEnd && i < data.length; i++) {
            calculated ^= data[i];
        }
        return calculated == data[checksumPos];
    }

    private boolean verifySumChecksum(byte[] data, int dataStart, int dataEnd, int checksumPos) {
        int sum = 0;
        for (int i = dataStart; i < dataEnd && i < data.length; i++) {
            sum += (data[i] & 0xFF);
        }
        byte calculated = (byte) (sum & 0xFF);
        return calculated == data[checksumPos];
    }

    private boolean verifyCrc16Checksum(byte[] data, int dataStart, int dataEnd, int checksumPos) {
        int crc = 0xFFFF;
        for (int i = dataStart; i < dataEnd && i < data.length; i++) {
            crc ^= (data[i] & 0xFF);
            for (int j = 0; j < 8; j++) {
                if ((crc & 0x0001) != 0) {
                    crc = (crc >> 1) ^ 0xA001;
                } else {
                    crc = crc >> 1;
                }
            }
        }

        int expectedLow = data[checksumPos] & 0xFF;
        int expectedHigh = (checksumPos + 1 < data.length) ? (data[checksumPos + 1] & 0xFF) : 0;
        int expected = expectedLow | (expectedHigh << 8);

        return crc == expected;
    }

    private boolean verifyModbusCrc(byte[] data, int dataStart, int dataEnd, int checksumPos) {
        return verifyCrc16Checksum(data, dataStart, dataEnd, checksumPos);
    }

    /**
     * Converts hex string to byte array.
     */
    private byte[] hexToBytes(String hex) {
        if (hex == null || hex.isEmpty()) return new byte[0];
        hex = hex.replaceAll("\\s", "").replaceAll("0x", "").toUpperCase();
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }
}
