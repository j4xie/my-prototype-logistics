package com.cretas.aims.service.scale;

import com.cretas.aims.dto.scale.ScaleDataParseResult;
import com.cretas.aims.entity.scale.ScaleBrandModel;
import com.cretas.aims.entity.scale.ScaleProtocolConfig;
import com.cretas.aims.repository.ScaleBrandModelRepository;
import com.cretas.aims.repository.ScaleProtocolConfigRepository;
import com.cretas.aims.service.ScaleProtocolAdapterService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Unified Protocol Matcher Service
 *
 * Centralizes all protocol matching logic from:
 * - ScaleProtocolAdapterServiceImpl.autoDetectProtocol()
 * - ScaleIntentHandler.findBestMatchingProtocol()
 *
 * Provides multiple matching strategies:
 * 1. By raw data (byte pattern analysis)
 * 2. By brand/model (naming convention matching)
 * 3. By frame pattern (structure analysis)
 * 4. By checksum validation
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProtocolMatcher {

    private final ScaleProtocolConfigRepository protocolRepository;
    private final ScaleBrandModelRepository brandModelRepository;
    private final ScaleProtocolAdapterService protocolAdapterService;
    private final ObjectMapper objectMapper;

    // Common frame delimiters
    private static final byte STX = 0x02;  // Start of text
    private static final byte ETX = 0x03;  // End of text
    private static final byte CR = 0x0D;   // Carriage return
    private static final byte LF = 0x0A;   // Line feed

    // Modbus function codes
    private static final byte MODBUS_READ_HOLDING = 0x03;
    private static final byte MODBUS_READ_INPUT = 0x04;

    // ==================== Protocol Match Result ====================

    /**
     * Protocol matching result
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProtocolMatchResult {
        /**
         * Protocol ID
         */
        private String protocolId;

        /**
         * Protocol code (e.g., KELI_D2008_ASCII)
         */
        private String protocolCode;

        /**
         * Protocol name (display)
         */
        private String protocolName;

        /**
         * Match confidence (0-100)
         */
        private Integer confidence;

        /**
         * Match method used
         */
        private MatchMethod matchMethod;

        /**
         * Whether protocol is verified
         */
        private Boolean isVerified;

        /**
         * Whether protocol is builtin
         */
        private Boolean isBuiltin;

        /**
         * Match reason description
         */
        private String matchReason;

        /**
         * Test parse result (if available)
         */
        private ScaleDataParseResult testParseResult;

        /**
         * Additional match metadata
         */
        private Map<String, Object> metadata;
    }

    /**
     * Match method enumeration
     */
    public enum MatchMethod {
        EXACT_BRAND_MODEL,    // Exact brand + model match
        BRAND_ONLY,           // Brand pattern match
        BRAND_MODEL_DEFAULT,  // Brand model default protocol
        RAW_DATA_PARSE,       // Successfully parsed raw data
        FRAME_PATTERN,        // Frame structure pattern match
        CHECKSUM_VALIDATION,  // Checksum validation success
        SAMPLE_DATA_MATCH     // Matched against sample data
    }

    // ==================== Main Matching Methods ====================

    /**
     * Match protocol by raw data bytes
     * Attempts to parse data with all active protocols and ranks by success
     *
     * @param rawData Raw byte data from scale
     * @return List of matches sorted by confidence (highest first)
     */
    public List<ProtocolMatchResult> matchByRawData(byte[] rawData) {
        if (rawData == null || rawData.length == 0) {
            return Collections.emptyList();
        }

        List<ProtocolMatchResult> results = new ArrayList<>();
        List<ScaleProtocolConfig> activeProtocols = protocolRepository.findByIsActiveTrue();

        for (ScaleProtocolConfig protocol : activeProtocols) {
            ProtocolMatchResult match = tryMatchWithProtocol(protocol, rawData);
            if (match != null && match.getConfidence() > 0) {
                results.add(match);
            }
        }

        // Sort by confidence descending, then by verification status
        results.sort((a, b) -> {
            int confCompare = b.getConfidence().compareTo(a.getConfidence());
            if (confCompare != 0) return confCompare;

            // Prefer verified protocols
            if (Boolean.TRUE.equals(b.getIsVerified()) && !Boolean.TRUE.equals(a.getIsVerified())) return 1;
            if (Boolean.TRUE.equals(a.getIsVerified()) && !Boolean.TRUE.equals(b.getIsVerified())) return -1;

            // Prefer builtin protocols
            if (Boolean.TRUE.equals(b.getIsBuiltin()) && !Boolean.TRUE.equals(a.getIsBuiltin())) return 1;
            if (Boolean.TRUE.equals(a.getIsBuiltin()) && !Boolean.TRUE.equals(b.getIsBuiltin())) return -1;

            return 0;
        });

        return results;
    }

    /**
     * Match protocol by brand and model
     * Uses naming convention: BRAND_MODEL_TYPE
     *
     * @param brand Brand code (e.g., KELI, YAOHUA)
     * @param model Model code (e.g., D2008, XK3190)
     * @return Best matching result or null
     */
    public ProtocolMatchResult matchByBrandModel(String brand, String model) {
        return matchByBrandModel(brand, model, null);
    }

    /**
     * Match protocol by brand and model with factory context
     *
     * @param brand     Brand code
     * @param model     Model code (optional)
     * @param factoryId Factory ID for factory-specific protocols
     * @return Best matching result or null
     */
    public ProtocolMatchResult matchByBrandModel(String brand, String model, String factoryId) {
        if (brand == null || brand.isEmpty()) {
            return null;
        }

        String brandCode = normalizeBrandCode(brand);

        log.debug("Protocol match by brand/model: brand={}, model={}, factoryId={}",
                brandCode, model, factoryId);

        // Strategy 1: Exact brand + model match
        if (model != null && !model.isEmpty()) {
            List<ScaleProtocolConfig> exactMatches = protocolRepository
                    .findByBrandModelPattern(brandCode, model.toUpperCase(), factoryId);

            if (!exactMatches.isEmpty()) {
                ScaleProtocolConfig best = exactMatches.get(0);
                log.info("Protocol matched [EXACT_BRAND_MODEL]: code={}, name={}",
                        best.getProtocolCode(), best.getProtocolName());

                return ProtocolMatchResult.builder()
                        .protocolId(best.getId())
                        .protocolCode(best.getProtocolCode())
                        .protocolName(best.getProtocolName())
                        .confidence(95)
                        .matchMethod(MatchMethod.EXACT_BRAND_MODEL)
                        .isVerified(best.getIsVerified())
                        .isBuiltin(best.getIsBuiltin())
                        .matchReason("Exact brand + model match")
                        .build();
            }
        }

        // Strategy 2: Brand-only match
        List<ScaleProtocolConfig> brandMatches = protocolRepository
                .findByBrandCodePattern(brandCode, factoryId);

        if (!brandMatches.isEmpty()) {
            ScaleProtocolConfig best = brandMatches.get(0);
            log.info("Protocol matched [BRAND_ONLY]: code={}, name={}",
                    best.getProtocolCode(), best.getProtocolName());

            return ProtocolMatchResult.builder()
                    .protocolId(best.getId())
                    .protocolCode(best.getProtocolCode())
                    .protocolName(best.getProtocolName())
                    .confidence(75)
                    .matchMethod(MatchMethod.BRAND_ONLY)
                    .isVerified(best.getIsVerified())
                    .isBuiltin(best.getIsBuiltin())
                    .matchReason("Brand pattern match")
                    .build();
        }

        // Strategy 3: Use brand model default protocol
        if (model != null && !model.isEmpty()) {
            Optional<ScaleBrandModel> brandModelOpt = brandModelRepository
                    .findByBrandCodeAndModelCode(brandCode, model.toUpperCase());

            if (brandModelOpt.isPresent() && brandModelOpt.get().getDefaultProtocolId() != null) {
                String defaultProtocolId = brandModelOpt.get().getDefaultProtocolId();
                Optional<ScaleProtocolConfig> defaultProtocol = protocolRepository.findById(defaultProtocolId);

                if (defaultProtocol.isPresent()) {
                    ScaleProtocolConfig protocol = defaultProtocol.get();
                    log.info("Protocol matched [BRAND_MODEL_DEFAULT]: code={}, name={}",
                            protocol.getProtocolCode(), protocol.getProtocolName());

                    return ProtocolMatchResult.builder()
                            .protocolId(protocol.getId())
                            .protocolCode(protocol.getProtocolCode())
                            .protocolName(protocol.getProtocolName())
                            .confidence(80)
                            .matchMethod(MatchMethod.BRAND_MODEL_DEFAULT)
                            .isVerified(protocol.getIsVerified())
                            .isBuiltin(protocol.getIsBuiltin())
                            .matchReason("Brand model default protocol")
                            .metadata(Map.of("brandModelId", brandModelOpt.get().getId()))
                            .build();
                }
            }
        }

        log.warn("Protocol match failed: no matching protocol for brand={}, model={}", brandCode, model);
        return null;
    }

    /**
     * Match protocol by frame pattern analysis
     * Analyzes frame structure without attempting full parse
     *
     * @param hexData Hex string representation of data
     * @return List of matches sorted by confidence
     */
    public List<ProtocolMatchResult> matchByFramePattern(String hexData) {
        if (hexData == null || hexData.isEmpty()) {
            return Collections.emptyList();
        }

        byte[] rawData = hexToBytes(hexData);
        return matchByFramePattern(rawData);
    }

    /**
     * Match protocol by frame pattern (byte array version)
     */
    public List<ProtocolMatchResult> matchByFramePattern(byte[] rawData) {
        if (rawData == null || rawData.length == 0) {
            return Collections.emptyList();
        }

        List<ProtocolMatchResult> results = new ArrayList<>();

        // Analyze frame characteristics
        FrameAnalysis analysis = analyzeFrame(rawData);

        List<ScaleProtocolConfig> candidates = protocolRepository.findByIsActiveTrue();

        for (ScaleProtocolConfig protocol : candidates) {
            int confidence = calculateFramePatternConfidence(protocol, analysis);
            if (confidence > 30) {
                results.add(ProtocolMatchResult.builder()
                        .protocolId(protocol.getId())
                        .protocolCode(protocol.getProtocolCode())
                        .protocolName(protocol.getProtocolName())
                        .confidence(confidence)
                        .matchMethod(MatchMethod.FRAME_PATTERN)
                        .isVerified(protocol.getIsVerified())
                        .isBuiltin(protocol.getIsBuiltin())
                        .matchReason("Frame pattern analysis")
                        .metadata(Map.of(
                                "frameType", analysis.frameType,
                                "hasDelimiters", analysis.hasDelimiters,
                                "length", rawData.length
                        ))
                        .build());
            }
        }

        results.sort((a, b) -> b.getConfidence().compareTo(a.getConfidence()));
        return results;
    }

    /**
     * Get best protocol match using all available methods
     * Combines results from multiple matching strategies
     *
     * @param rawData   Raw data (optional)
     * @param brand     Brand code (optional)
     * @param model     Model code (optional)
     * @param factoryId Factory ID (optional)
     * @return Best matching protocol or null
     */
    public ProtocolMatchResult getBestMatch(byte[] rawData, String brand, String model, String factoryId) {
        List<ProtocolMatchResult> allMatches = new ArrayList<>();

        // Try brand/model match first (most reliable if available)
        if (brand != null && !brand.isEmpty()) {
            ProtocolMatchResult brandMatch = matchByBrandModel(brand, model, factoryId);
            if (brandMatch != null) {
                allMatches.add(brandMatch);
            }
        }

        // Try raw data match
        if (rawData != null && rawData.length > 0) {
            allMatches.addAll(matchByRawData(rawData));
        }

        if (allMatches.isEmpty()) {
            return null;
        }

        // Return highest confidence match
        return allMatches.stream()
                .max(Comparator.comparingInt(ProtocolMatchResult::getConfidence))
                .orElse(null);
    }

    // ==================== Frame Analysis ====================

    /**
     * Frame analysis result
     */
    @Data
    private static class FrameAnalysis {
        String frameType = "UNKNOWN";      // ASCII, BINARY, MODBUS, etc.
        boolean hasDelimiters = false;     // STX/ETX or CR/LF
        boolean hasChecksum = false;
        boolean isPrintableAscii = false;
        boolean looksLikeModbus = false;
        int weightFieldLength = 0;
        String detectedUnit = null;
        byte startByte = 0;
        byte endByte = 0;
    }

    /**
     * Analyze frame structure
     */
    private FrameAnalysis analyzeFrame(byte[] rawData) {
        FrameAnalysis analysis = new FrameAnalysis();

        if (rawData == null || rawData.length == 0) {
            return analysis;
        }

        // Check for delimiters
        if (rawData[0] == STX) {
            analysis.hasDelimiters = true;
            analysis.startByte = STX;
            if (rawData.length > 1) {
                byte lastByte = rawData[rawData.length - 1];
                byte secondLastByte = rawData.length > 2 ? rawData[rawData.length - 2] : 0;

                if (lastByte == ETX || secondLastByte == ETX) {
                    analysis.endByte = ETX;
                }
            }
        }

        // Check for CR/LF terminator
        if (rawData.length >= 2) {
            byte lastByte = rawData[rawData.length - 1];
            byte secondLastByte = rawData[rawData.length - 2];

            if ((lastByte == LF && secondLastByte == CR) || lastByte == CR || lastByte == LF) {
                analysis.hasDelimiters = true;
            }
        }

        // Check if printable ASCII
        int printableCount = 0;
        for (byte b : rawData) {
            if ((b >= 0x20 && b <= 0x7E) || b == CR || b == LF || b == STX || b == ETX) {
                printableCount++;
            }
        }
        analysis.isPrintableAscii = (printableCount * 100 / rawData.length) > 80;

        // Check for Modbus RTU pattern
        if (rawData.length >= 5 && !analysis.isPrintableAscii) {
            byte functionCode = rawData[1];
            if (functionCode == MODBUS_READ_HOLDING || functionCode == MODBUS_READ_INPUT) {
                analysis.looksLikeModbus = true;
                analysis.frameType = "MODBUS_RTU";
            }
        }

        // Determine frame type
        if (analysis.looksLikeModbus) {
            analysis.frameType = "MODBUS_RTU";
        } else if (analysis.isPrintableAscii) {
            if (analysis.hasDelimiters && analysis.startByte == STX) {
                analysis.frameType = "ASCII_FIXED";
            } else {
                analysis.frameType = "ASCII_VARIABLE";
            }
        } else {
            analysis.frameType = "HEX_FIXED";
        }

        // Try to detect unit
        String ascii = new String(rawData, StandardCharsets.US_ASCII);
        if (ascii.contains("kg") || ascii.contains("KG")) {
            analysis.detectedUnit = "kg";
        } else if (ascii.contains("g") || ascii.contains("G")) {
            analysis.detectedUnit = "g";
        } else if (ascii.contains("lb") || ascii.contains("LB")) {
            analysis.detectedUnit = "lb";
        }

        return analysis;
    }

    /**
     * Calculate confidence based on frame pattern match
     */
    private int calculateFramePatternConfidence(ScaleProtocolConfig protocol, FrameAnalysis analysis) {
        int confidence = 0;

        try {
            String frameFormatStr = protocol.getFrameFormat();
            if (frameFormatStr == null || frameFormatStr.isEmpty()) {
                return 0;
            }

            JsonNode frameFormat = objectMapper.readTree(frameFormatStr);
            String protocolFrameType = frameFormat.path("frameType").asText("ASCII_FIXED");

            // Frame type match
            if (analysis.frameType.equals(protocolFrameType)) {
                confidence += 40;
            } else if (analysis.frameType.startsWith("ASCII") && protocolFrameType.startsWith("ASCII")) {
                confidence += 20;
            }

            // Connection type match
            if (analysis.looksLikeModbus &&
                (protocol.getConnectionType() == ScaleProtocolConfig.ConnectionType.MODBUS_RTU ||
                 protocol.getConnectionType() == ScaleProtocolConfig.ConnectionType.MODBUS_TCP)) {
                confidence += 30;
            }

            // Delimiter match
            if (analysis.hasDelimiters) {
                String startByte = frameFormat.path("startByte").asText();
                if (startByte != null && !startByte.isEmpty()) {
                    confidence += 15;
                }
            }

            // Unit detection match
            if (analysis.detectedUnit != null) {
                confidence += 10;
            }

        } catch (Exception e) {
            log.debug("Error calculating frame pattern confidence: {}", e.getMessage());
        }

        return Math.min(confidence, 85); // Cap at 85 for pattern-only match
    }

    // ==================== Protocol Testing ====================

    /**
     * Try to match data with a specific protocol
     */
    private ProtocolMatchResult tryMatchWithProtocol(ScaleProtocolConfig protocol, byte[] rawData) {
        try {
            String hexData = bytesToHex(rawData);
            ScaleDataParseResult parseResult = protocolAdapterService.dryRunParse(protocol.getId(), hexData);

            if (parseResult != null && parseResult.isSuccess()) {
                int confidence = evaluateParseConfidence(parseResult);

                return ProtocolMatchResult.builder()
                        .protocolId(protocol.getId())
                        .protocolCode(protocol.getProtocolCode())
                        .protocolName(protocol.getProtocolName())
                        .confidence(confidence)
                        .matchMethod(MatchMethod.RAW_DATA_PARSE)
                        .isVerified(protocol.getIsVerified())
                        .isBuiltin(protocol.getIsBuiltin())
                        .matchReason(confidence >= 90 ? "Data parsed successfully with valid values" : "Data parsed with partial validation")
                        .testParseResult(parseResult)
                        .build();
            }

        } catch (Exception e) {
            log.debug("Protocol {} failed to parse data: {}", protocol.getProtocolCode(), e.getMessage());
        }

        return null;
    }

    /**
     * Evaluate parse result confidence
     */
    private int evaluateParseConfidence(ScaleDataParseResult result) {
        int confidence = 50; // Base score for successful parse

        // Weight value reasonableness (0-100000 kg)
        if (result.getWeight() != null) {
            BigDecimal weight = result.getWeight().abs();
            if (weight.compareTo(BigDecimal.ZERO) >= 0 &&
                weight.compareTo(new BigDecimal("100000")) <= 0) {
                confidence += 20;
            }
        }

        // Valid unit
        if (result.getUnit() != null) {
            String unit = result.getUnit().toLowerCase();
            if (unit.equals("kg") || unit.equals("g") || unit.equals("lb") || unit.equals("oz") || unit.equals("t")) {
                confidence += 15;
            }
        }

        // Stability flag present
        if (result.getStable() != null) {
            confidence += 15;
        }

        return Math.min(confidence, 100);
    }

    // ==================== Utility Methods ====================

    /**
     * Normalize brand code (handle aliases)
     */
    private String normalizeBrandCode(String brand) {
        if (brand == null) {
            return null;
        }

        // Common brand aliases (Chinese to English code)
        Map<String, String> aliases = Map.ofEntries(
                Map.entry("keli", "KELI"),
                Map.entry("yaohua", "YAOHUA"),
                Map.entry("xice", "XICE"),
                Map.entry("yizheng", "YIZHENG"),
                Map.entry("mettler", "METTLER"),
                Map.entry("toledo", "TOLEDO"),
                Map.entry("sartorius", "SARTORIUS"),
                Map.entry("ohaus", "OHAUS")
        );

        String lowerBrand = brand.toLowerCase().trim();

        // Check aliases
        if (aliases.containsKey(lowerBrand)) {
            return aliases.get(lowerBrand);
        }

        // Return uppercase version
        return brand.toUpperCase().trim();
    }

    /**
     * Convert byte array to hex string
     */
    public String bytesToHex(byte[] bytes) {
        if (bytes == null) return "";
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    /**
     * Convert hex string to byte array
     */
    public byte[] hexToBytes(String hex) {
        if (hex == null || hex.isEmpty()) return new byte[0];
        hex = hex.replaceAll("\\s", "").toUpperCase();
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }

    // ==================== Convenience Methods ====================

    /**
     * Quick match by hex data string
     */
    public List<ProtocolMatchResult> matchByHexData(String hexData) {
        return matchByRawData(hexToBytes(hexData));
    }

    /**
     * Get protocol by ID
     */
    public Optional<ScaleProtocolConfig> getProtocolById(String protocolId) {
        return protocolRepository.findById(protocolId);
    }

    /**
     * Get protocol by code
     */
    public Optional<ScaleProtocolConfig> getProtocolByCode(String protocolCode) {
        return protocolRepository.findByProtocolCode(protocolCode);
    }

    /**
     * Check if a protocol exists and is active
     */
    public boolean isProtocolActive(String protocolId) {
        return protocolRepository.findById(protocolId)
                .map(p -> Boolean.TRUE.equals(p.getIsActive()))
                .orElse(false);
    }
}
