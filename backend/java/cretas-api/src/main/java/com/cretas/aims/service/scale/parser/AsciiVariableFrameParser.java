package com.cretas.aims.service.scale.parser;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

/**
 * Parser for ASCII variable-length frame protocols.
 * Used by scales that output delimited ASCII strings with variable field lengths.
 *
 * <p>Example frame format: W,123.45,kg,S\r\n
 * <ul>
 *   <li>Field 0: Command/Type identifier</li>
 *   <li>Field 1: Weight value</li>
 *   <li>Field 2: Unit</li>
 *   <li>Field 3: Stability flag</li>
 * </ul>
 *
 * <p>Configuration example:
 * <pre>{@code
 * {
 *   "frameType": "ASCII_VARIABLE",
 *   "delimiter": ",",
 *   "fields": [
 *     {"name": "weight", "index": 1},
 *     {"name": "unit", "index": 2},
 *     {"name": "stable", "index": 3}
 *   ]
 * }
 * }</pre>
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
@Component
public class AsciiVariableFrameParser extends AbstractFrameParser {

    private static final String FRAME_TYPE = "ASCII_VARIABLE";
    private static final String DEFAULT_DELIMITER = ",";

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
        int minLength = getIntValue(format, "minLength", 3);
        if (rawData.length < minLength) {
            return FrameValidationResult.invalid(
                    String.format("Frame too short: minimum %d, actual %d", minLength, rawData.length)
            );
        }

        // Validate ASCII content
        String ascii = new String(rawData, StandardCharsets.US_ASCII);
        String delimiter = getStringValue(format, "delimiter", DEFAULT_DELIMITER);

        // Check if delimiter exists in the data
        if (!ascii.contains(delimiter)) {
            return FrameValidationResult.invalid(
                    String.format("Delimiter '%s' not found in frame", delimiter)
            );
        }

        // Check for required fields configuration
        JsonNode fields = format.path("fields");
        if (fields.isMissingNode() || !fields.isArray() || fields.size() == 0) {
            return FrameValidationResult.invalid("Frame format missing 'fields' configuration");
        }

        // Validate minimum field count
        String[] parts = ascii.split(delimiter.equals(".") ? "\\." : delimiter);
        int minFields = getIntValue(format, "minFields", 1);
        if (parts.length < minFields) {
            return FrameValidationResult.invalid(
                    String.format("Insufficient fields: minimum %d, actual %d", minFields, parts.length)
            );
        }

        return FrameValidationResult.valid();
    }

    @Override
    protected byte[] extractDataSegment(JsonNode format, byte[] rawData) {
        // For variable-length frames, the entire data is the segment
        // We may strip prefix/suffix characters if configured
        String ascii = new String(rawData, StandardCharsets.US_ASCII);

        String prefix = getStringValue(format, "stripPrefix", "");
        String suffix = getStringValue(format, "stripSuffix", "");

        if (!prefix.isEmpty() && ascii.startsWith(prefix)) {
            ascii = ascii.substring(prefix.length());
        }

        if (!suffix.isEmpty() && ascii.endsWith(suffix)) {
            ascii = ascii.substring(0, ascii.length() - suffix.length());
        }

        // Trim whitespace and control characters
        ascii = ascii.trim();

        return ascii.getBytes(StandardCharsets.US_ASCII);
    }

    @Override
    protected ParsedFrameData parseFrameData(JsonNode format, byte[] rawData, byte[] dataSegment) {
        String ascii = new String(dataSegment, StandardCharsets.US_ASCII);
        String delimiter = getStringValue(format, "delimiter", DEFAULT_DELIMITER);

        // Handle regex special characters in delimiter
        String[] parts = ascii.split(escapeDelimiter(delimiter));

        JsonNode fields = format.path("fields");
        ParsedFrameData.Builder builder = ParsedFrameData.builder();
        builder.unit("kg"); // Default unit

        for (JsonNode field : fields) {
            String name = field.path("name").asText();
            int index = field.path("index").asInt(-1);

            if (index < 0 || index >= parts.length) {
                log.debug("Field '{}' index {} out of bounds (parts.length={})", name, index, parts.length);
                continue;
            }

            String value = parts[index].trim();

            switch (name) {
                case "sign":
                    char signChar = !value.isEmpty() ? value.charAt(0) : '+';
                    builder.sign(signChar == '-' ? '-' : '+');
                    break;

                case "weight":
                    BigDecimal weight = parseWeightValue(value, field);
                    builder.weight(weight);
                    break;

                case "unit":
                    if (!value.isEmpty()) {
                        builder.unit(normalizeUnit(value));
                    }
                    break;

                case "stable":
                    Boolean stable = parseStabilityFlag(value);
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
     * Escapes special regex characters in delimiter.
     */
    private String escapeDelimiter(String delimiter) {
        // Common delimiters that need escaping
        if (delimiter.equals(".")) return "\\.";
        if (delimiter.equals("|")) return "\\|";
        if (delimiter.equals("*")) return "\\*";
        if (delimiter.equals("+")) return "\\+";
        if (delimiter.equals("?")) return "\\?";
        if (delimiter.equals("^")) return "\\^";
        if (delimiter.equals("$")) return "\\$";
        if (delimiter.equals("(")) return "\\(";
        if (delimiter.equals(")")) return "\\)";
        if (delimiter.equals("[")) return "\\[";
        if (delimiter.equals("]")) return "\\]";
        if (delimiter.equals("{")) return "\\{";
        if (delimiter.equals("}")) return "\\}";
        if (delimiter.equals("\\")) return "\\\\";
        return delimiter;
    }

    /**
     * Parses a weight value from string.
     */
    private BigDecimal parseWeightValue(String value, JsonNode field) {
        if (value == null || value.isEmpty()) {
            return null;
        }

        try {
            // Handle sign embedded in value
            boolean negative = value.startsWith("-");
            String cleanValue = value.replaceAll("[^0-9.]", "");

            if (cleanValue.isEmpty()) {
                return BigDecimal.ZERO;
            }

            BigDecimal weight = new BigDecimal(cleanValue);

            // Apply decimal places if configured
            int decimalPlaces = field.path("decimalPlaces").asInt(0);
            if (decimalPlaces > 0) {
                weight = weight.movePointLeft(decimalPlaces);
            }

            // Apply scale factor if configured
            double scaleFactor = field.path("scaleFactor").asDouble(1.0);
            if (scaleFactor != 1.0) {
                weight = weight.multiply(BigDecimal.valueOf(scaleFactor));
            }

            if (negative) {
                weight = weight.negate();
            }

            return weight;

        } catch (NumberFormatException e) {
            log.warn("Failed to parse weight value: '{}'", value);
            return null;
        }
    }

    /**
     * Parses the stability flag from string value.
     */
    private Boolean parseStabilityFlag(String value) {
        if (value == null || value.isEmpty()) {
            return null;
        }

        String upper = value.toUpperCase();
        return "S".equals(upper) ||
               "1".equals(upper) ||
               "STABLE".equals(upper) ||
               "TRUE".equals(upper) ||
               "Y".equals(upper) ||
               "YES".equals(upper);
    }

    /**
     * Normalizes unit string to standard format.
     */
    private String normalizeUnit(String unit) {
        if (unit == null) return "kg";

        String lower = unit.toLowerCase().trim();
        switch (lower) {
            case "kg":
            case "kgs":
            case "kilogram":
            case "kilograms":
                return "kg";
            case "g":
            case "gram":
            case "grams":
                return "g";
            case "lb":
            case "lbs":
            case "pound":
            case "pounds":
                return "lb";
            case "oz":
            case "ounce":
            case "ounces":
                return "oz";
            case "t":
            case "ton":
            case "tons":
                return "t";
            default:
                return unit;
        }
    }

    @Override
    protected boolean verifyChecksum(JsonNode format, byte[] rawData) {
        // Variable-length ASCII frames typically don't use checksums
        // But we support it if configured
        String checksumType = getStringValue(format, "checksumType", "NONE");
        return "NONE".equals(checksumType);
    }
}
