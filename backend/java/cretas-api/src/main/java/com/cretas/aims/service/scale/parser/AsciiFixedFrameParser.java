package com.cretas.aims.service.scale.parser;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * Parser for ASCII fixed-length frame protocols.
 * Used by scales like Keli (KeliD2008) and Yaohua that output fixed-format ASCII strings.
 *
 * <p>Example frame format: +001240 kg S\r\n
 * <ul>
 *   <li>Position 0: Sign (+/-)</li>
 *   <li>Position 1-6: Weight value (6 digits)</li>
 *   <li>Position 7: Space</li>
 *   <li>Position 8-9: Unit (kg)</li>
 *   <li>Position 10: Space</li>
 *   <li>Position 11: Stability flag (S=stable, U=unstable)</li>
 *   <li>Position 12-13: CR LF</li>
 * </ul>
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
@Component
public class AsciiFixedFrameParser extends AbstractFrameParser {

    private static final String FRAME_TYPE = "ASCII_FIXED";

    @Override
    public String getFrameType() {
        return FRAME_TYPE;
    }

    @Override
    protected FrameValidationResult validateFrame(JsonNode format, byte[] rawData) {
        if (rawData == null || rawData.length == 0) {
            return FrameValidationResult.invalid("Raw data is empty");
        }

        // Get expected frame length from config
        int expectedLength = getIntValue(format, "frameLength", 0);
        int minLength = getIntValue(format, "minLength", 0);

        // Validate frame length
        if (expectedLength > 0 && rawData.length != expectedLength) {
            return FrameValidationResult.invalid(
                    String.format("Frame length mismatch: expected %d, actual %d", expectedLength, rawData.length)
            );
        }

        if (minLength > 0 && rawData.length < minLength) {
            return FrameValidationResult.invalid(
                    String.format("Frame too short: minimum %d, actual %d", minLength, rawData.length)
            );
        }

        // Validate all bytes are valid ASCII
        for (byte b : rawData) {
            if (b < 0x09 || (b > 0x0D && b < 0x20) || b > 0x7E) {
                // Allow tab (0x09), CR (0x0D), LF (0x0A), and printable ASCII (0x20-0x7E)
                return FrameValidationResult.invalid("Invalid ASCII character in frame");
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
        // For ASCII fixed frame, the entire raw data is the data segment
        // We may need to strip header/trailer if configured
        int headerLength = getIntValue(format, "headerLength", 0);
        int trailerLength = getIntValue(format, "trailerLength", 0);

        int start = headerLength;
        int end = rawData.length - trailerLength;

        if (start >= end) {
            log.warn("Invalid segment boundaries: start={}, end={}", start, end);
            return rawData;
        }

        return Arrays.copyOfRange(rawData, start, end);
    }

    @Override
    protected ParsedFrameData parseFrameData(JsonNode format, byte[] rawData, byte[] dataSegment) {
        String ascii = new String(rawData, StandardCharsets.US_ASCII);
        JsonNode fields = format.path("fields");

        ParsedFrameData.Builder builder = ParsedFrameData.builder();
        builder.unit("kg"); // Default unit

        for (JsonNode field : fields) {
            String name = field.path("name").asText();
            int start = field.path("start").asInt();
            int length = field.path("length").asInt();

            // Validate bounds
            if (start + length > ascii.length()) {
                log.warn("Field '{}' exceeds frame length: start={}, length={}, frameLength={}",
                        name, start, length, ascii.length());
                continue;
            }

            String value = ascii.substring(start, start + length);

            switch (name) {
                case "sign":
                    char signChar = value.charAt(0);
                    builder.sign(signChar == '-' ? '-' : '+');
                    break;

                case "weight":
                    BigDecimal weight = parseWeightValue(value, field);
                    builder.weight(weight);
                    break;

                case "unit":
                    String unit = value.trim();
                    if (!unit.isEmpty()) {
                        builder.unit(unit);
                    }
                    break;

                case "stable":
                    Boolean stable = parseStabilityFlag(value, field);
                    builder.stable(stable);
                    break;

                case "tare":
                case "tareWeight":
                    BigDecimal tare = parseWeightValue(value, field);
                    builder.tareWeight(tare);
                    break;

                case "gross":
                case "grossWeight":
                    BigDecimal gross = parseWeightValue(value, field);
                    builder.grossWeight(gross);
                    break;

                case "net":
                case "netWeight":
                    BigDecimal net = parseWeightValue(value, field);
                    builder.netWeight(net);
                    break;

                default:
                    log.debug("Unknown field type: {}", name);
            }
        }

        return builder.build();
    }

    /**
     * Parses a weight value from string, applying decimal places if configured.
     *
     * @param value Raw string value
     * @param field Field configuration node
     * @return Parsed BigDecimal weight
     */
    private BigDecimal parseWeightValue(String value, JsonNode field) {
        String weightStr = value.trim();
        if (weightStr.isEmpty()) {
            return null;
        }

        // Remove any non-numeric characters except decimal point and minus sign
        weightStr = weightStr.replaceAll("[^0-9.\\-]", "");
        if (weightStr.isEmpty() || weightStr.equals("-") || weightStr.equals(".")) {
            return BigDecimal.ZERO;
        }

        BigDecimal weight = new BigDecimal(weightStr);

        // Apply decimal places shift if configured
        int decimalPlaces = field.path("decimalPlaces").asInt(0);
        if (decimalPlaces > 0) {
            weight = weight.movePointLeft(decimalPlaces);
        }

        // Apply scale factor if configured
        double scaleFactor = field.path("scaleFactor").asDouble(1.0);
        if (scaleFactor != 1.0) {
            weight = weight.multiply(BigDecimal.valueOf(scaleFactor));
        }

        return weight;
    }

    /**
     * Parses the stability flag from string value.
     *
     * @param value Raw string value
     * @param field Field configuration node
     * @return Boolean indicating stability
     */
    private Boolean parseStabilityFlag(String value, JsonNode field) {
        String trimmed = value.trim();

        // Check for explicit mapping in configuration
        JsonNode mapping = field.path("mapping");
        if (!mapping.isMissingNode() && mapping.has(trimmed)) {
            return mapping.path(trimmed).asBoolean(false);
        }

        // Default interpretation
        return "S".equalsIgnoreCase(trimmed) ||
               "1".equals(trimmed) ||
               "STABLE".equalsIgnoreCase(trimmed) ||
               "TRUE".equalsIgnoreCase(trimmed);
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
        int dataEnd = checksumStart > 0 ? checksumStart : rawData.length;

        if (checksumStart < 0 || checksumStart >= rawData.length) {
            log.debug("Checksum position not configured, skipping verification");
            return true;
        }

        switch (checksumType.toUpperCase()) {
            case "XOR":
                return verifyXorChecksum(rawData, dataStart, dataEnd, checksumStart);
            case "SUM":
                return verifySumChecksum(rawData, dataStart, dataEnd, checksumStart);
            default:
                log.debug("Unsupported checksum type for ASCII_FIXED: {}", checksumType);
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
}
