package com.cretas.aims.service.scale.parser;

import com.cretas.aims.dto.scale.ScaleDataParseResult;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Abstract template class for scale frame parsing.
 * Implements the Template Method Pattern for consistent parsing across different frame types.
 *
 * <p>Subclasses must implement:
 * <ul>
 *   <li>{@link #validateFrame(JsonNode, byte[])} - Validate frame structure</li>
 *   <li>{@link #extractDataSegment(JsonNode, byte[])} - Extract data segment from frame</li>
 *   <li>{@link #parseWeight(JsonNode, byte[])} - Parse weight value from data</li>
 *   <li>{@link #verifyChecksum(JsonNode, byte[])} - Verify frame checksum (optional)</li>
 * </ul>
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
public abstract class AbstractFrameParser {

    /**
     * Template method for parsing scale data frame.
     * Defines the algorithm structure while allowing subclasses to implement specific steps.
     *
     * @param format   JSON configuration defining the frame format
     * @param rawData  Raw byte data from the scale
     * @return ScaleDataParseResult containing parsed data or error information
     */
    public final ScaleDataParseResult parse(JsonNode format, byte[] rawData) {
        String frameType = getFrameType();
        log.debug("Parsing {} frame, data length: {} bytes", frameType, rawData != null ? rawData.length : 0);

        // Early null check for rawData
        if (rawData == null || rawData.length == 0) {
            return ScaleDataParseResult.failure(
                    ScaleDataParseResult.ERROR_INVALID_DATA_FORMAT,
                    "Raw data is null or empty"
            );
        }

        try {
            // Step 1: Validate frame format
            FrameValidationResult validation = validateFrame(format, rawData);
            if (!validation.isValid()) {
                log.warn("{} frame validation failed: {}", frameType, validation.getErrorMessage());
                return ScaleDataParseResult.failure(
                        ScaleDataParseResult.ERROR_INVALID_DATA_FORMAT,
                        validation.getErrorMessage()
                );
            }

            // Step 2: Extract data segment
            byte[] dataSegment = extractDataSegment(format, rawData);
            if (dataSegment == null || dataSegment.length == 0) {
                log.warn("{} data segment extraction failed", frameType);
                return ScaleDataParseResult.failure(
                        ScaleDataParseResult.ERROR_PARSE_FAILED,
                        "Failed to extract data segment"
                );
            }

            // Step 3: Parse weight and other values
            ParsedFrameData parsedData = parseFrameData(format, rawData, dataSegment);
            if (parsedData == null || parsedData.getWeight() == null) {
                log.warn("{} weight parsing failed", frameType);
                return ScaleDataParseResult.failure(
                        ScaleDataParseResult.ERROR_PARSE_FAILED,
                        "Failed to parse weight value"
                );
            }

            // Step 4: Verify checksum (optional - returns true if not implemented)
            if (!verifyChecksum(format, rawData)) {
                log.warn("{} checksum verification failed", frameType);
                return ScaleDataParseResult.builder()
                        .success(false)
                        .errorCode(ScaleDataParseResult.ERROR_CHECKSUM_FAILED)
                        .errorMessage("Checksum verification failed")
                        .checksumValid(false)
                        .timestamp(LocalDateTime.now())
                        .build();
            }

            // Build successful result
            return ScaleDataParseResult.builder()
                    .success(true)
                    .weight(parsedData.getWeight())
                    .unit(parsedData.getUnit() != null ? parsedData.getUnit() : "kg")
                    .stable(parsedData.getStable())
                    .tareWeight(parsedData.getTareWeight())
                    .grossWeight(parsedData.getGrossWeight())
                    .netWeight(parsedData.getNetWeight())
                    .checksumValid(true)
                    .frameLength(rawData.length)
                    .timestamp(LocalDateTime.now())
                    .build();

        } catch (NumberFormatException e) {
            log.error("{} number format error: {}", frameType, e.getMessage());
            return ScaleDataParseResult.failure(
                    ScaleDataParseResult.ERROR_PARSE_FAILED,
                    "Invalid number format: " + e.getMessage()
            );
        } catch (Exception e) {
            log.error("{} parsing exception: {}", frameType, e.getMessage(), e);
            return ScaleDataParseResult.failure(
                    ScaleDataParseResult.ERROR_PARSE_FAILED,
                    e.getMessage()
            );
        }
    }

    /**
     * Returns the frame type identifier for this parser.
     *
     * @return Frame type string (e.g., "ASCII_FIXED", "MODBUS_RTU")
     */
    public abstract String getFrameType();

    /**
     * Validates the frame format and raw data.
     * Checks if the data conforms to the expected frame structure.
     *
     * @param format  JSON configuration for the frame format
     * @param rawData Raw byte data to validate
     * @return FrameValidationResult indicating validity and any error messages
     */
    protected abstract FrameValidationResult validateFrame(JsonNode format, byte[] rawData);

    /**
     * Extracts the data segment from the raw frame.
     * Removes headers, trailers, and checksums to isolate the payload.
     *
     * @param format  JSON configuration for the frame format
     * @param rawData Raw byte data
     * @return Extracted data segment as byte array
     */
    protected abstract byte[] extractDataSegment(JsonNode format, byte[] rawData);

    /**
     * Parses the weight value from the data segment.
     *
     * @param format      JSON configuration for the frame format
     * @param rawData     Original raw data (for context if needed)
     * @param dataSegment Extracted data segment
     * @return Parsed weight as BigDecimal
     */
    protected abstract ParsedFrameData parseFrameData(JsonNode format, byte[] rawData, byte[] dataSegment);

    /**
     * Verifies the frame checksum if applicable.
     * Default implementation returns true (no checksum verification).
     *
     * @param format  JSON configuration for the frame format
     * @param rawData Raw byte data to verify
     * @return true if checksum is valid or not applicable, false otherwise
     */
    protected boolean verifyChecksum(JsonNode format, byte[] rawData) {
        // Default: no checksum verification
        return true;
    }

    // ==================== Utility Methods ====================

    /**
     * Converts byte array to hexadecimal string for logging.
     *
     * @param bytes Byte array to convert
     * @return Hexadecimal string representation
     */
    protected String bytesToHex(byte[] bytes) {
        if (bytes == null) return "";
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    /**
     * Safely gets an integer value from JsonNode with default.
     *
     * @param node         JsonNode to read from
     * @param fieldName    Field name
     * @param defaultValue Default value if field is missing
     * @return Integer value
     */
    protected int getIntValue(JsonNode node, String fieldName, int defaultValue) {
        return node.path(fieldName).asInt(defaultValue);
    }

    /**
     * Safely gets a string value from JsonNode with default.
     *
     * @param node         JsonNode to read from
     * @param fieldName    Field name
     * @param defaultValue Default value if field is missing
     * @return String value
     */
    protected String getStringValue(JsonNode node, String fieldName, String defaultValue) {
        return node.path(fieldName).asText(defaultValue);
    }

    // ==================== Inner Classes ====================

    /**
     * Result of frame validation.
     */
    public static class FrameValidationResult {
        private final boolean valid;
        private final String errorMessage;

        private FrameValidationResult(boolean valid, String errorMessage) {
            this.valid = valid;
            this.errorMessage = errorMessage;
        }

        public static FrameValidationResult valid() {
            return new FrameValidationResult(true, null);
        }

        public static FrameValidationResult invalid(String errorMessage) {
            return new FrameValidationResult(false, errorMessage);
        }

        public boolean isValid() {
            return valid;
        }

        public String getErrorMessage() {
            return errorMessage;
        }
    }

    /**
     * Container for parsed frame data.
     */
    public static class ParsedFrameData {
        private BigDecimal weight;
        private String unit;
        private Boolean stable;
        private BigDecimal tareWeight;
        private BigDecimal grossWeight;
        private BigDecimal netWeight;
        private char sign = '+';

        public ParsedFrameData() {}

        public BigDecimal getWeight() {
            return weight;
        }

        public void setWeight(BigDecimal weight) {
            this.weight = weight;
        }

        public String getUnit() {
            return unit;
        }

        public void setUnit(String unit) {
            this.unit = unit;
        }

        public Boolean getStable() {
            return stable;
        }

        public void setStable(Boolean stable) {
            this.stable = stable;
        }

        public BigDecimal getTareWeight() {
            return tareWeight;
        }

        public void setTareWeight(BigDecimal tareWeight) {
            this.tareWeight = tareWeight;
        }

        public BigDecimal getGrossWeight() {
            return grossWeight;
        }

        public void setGrossWeight(BigDecimal grossWeight) {
            this.grossWeight = grossWeight;
        }

        public BigDecimal getNetWeight() {
            return netWeight;
        }

        public void setNetWeight(BigDecimal netWeight) {
            this.netWeight = netWeight;
        }

        public char getSign() {
            return sign;
        }

        public void setSign(char sign) {
            this.sign = sign;
        }

        /**
         * Applies the sign to the weight value.
         */
        public void applySign() {
            if (weight != null && sign == '-') {
                weight = weight.negate();
            }
        }

        /**
         * Builder pattern for ParsedFrameData.
         */
        public static Builder builder() {
            return new Builder();
        }

        public static class Builder {
            private final ParsedFrameData data = new ParsedFrameData();

            public Builder weight(BigDecimal weight) {
                data.setWeight(weight);
                return this;
            }

            public Builder unit(String unit) {
                data.setUnit(unit);
                return this;
            }

            public Builder stable(Boolean stable) {
                data.setStable(stable);
                return this;
            }

            public Builder tareWeight(BigDecimal tareWeight) {
                data.setTareWeight(tareWeight);
                return this;
            }

            public Builder grossWeight(BigDecimal grossWeight) {
                data.setGrossWeight(grossWeight);
                return this;
            }

            public Builder netWeight(BigDecimal netWeight) {
                data.setNetWeight(netWeight);
                return this;
            }

            public Builder sign(char sign) {
                data.setSign(sign);
                return this;
            }

            public ParsedFrameData build() {
                data.applySign();
                return data;
            }
        }
    }
}
