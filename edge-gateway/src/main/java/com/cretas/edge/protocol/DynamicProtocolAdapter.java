package com.cretas.edge.protocol;

import com.cretas.edge.model.ScaleReading;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 动态协议适配器
 *
 * 支持从后端动态获取协议配置，无需重新部署即可支持新的秤型号
 *
 * 配置格式示例:
 * {
 *   "name": "CUSTOM_SCALE",
 *   "description": "自定义秤协议",
 *   "frameHeader": "02",
 *   "frameTerminator": "0D0A",
 *   "dataFormat": "ASCII",
 *   "weightPattern": "W([+-]?\\d+\\.?\\d*)\\s*(kg|g|lb)?",
 *   "stableIndicator": "ST",
 *   "overloadIndicator": "OL",
 *   "defaultUnit": "g",
 *   "requiresPolling": false,
 *   "pollingCommand": null,
 *   "pollingInterval": 500
 * }
 */
@Slf4j
public class DynamicProtocolAdapter implements ScaleProtocolAdapter {

    private final ProtocolConfig config;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private Pattern weightPattern;

    @Data
    public static class ProtocolConfig {
        private String name;
        private String description;
        private String frameHeader;      // 十六进制字符串
        private String frameTerminator;  // 十六进制字符串
        private String dataFormat;       // ASCII, HEX, BINARY
        private String weightPattern;    // 正则表达式
        private String stableIndicator;
        private String overloadIndicator;
        private String defaultUnit;
        private boolean requiresPolling;
        private String pollingCommand;   // 十六进制字符串
        private int pollingInterval;
    }

    public DynamicProtocolAdapter(String configJson) throws Exception {
        this.config = objectMapper.readValue(configJson, ProtocolConfig.class);
        if (config.getWeightPattern() != null) {
            this.weightPattern = Pattern.compile(config.getWeightPattern());
        }
        log.info("Dynamic protocol adapter created: {}", config.getName());
    }

    public DynamicProtocolAdapter(ProtocolConfig config) {
        this.config = config;
        if (config.getWeightPattern() != null) {
            this.weightPattern = Pattern.compile(config.getWeightPattern());
        }
        log.info("Dynamic protocol adapter created: {}", config.getName());
    }

    public DynamicProtocolAdapter(JsonNode configNode) throws Exception {
        this.config = objectMapper.treeToValue(configNode, ProtocolConfig.class);
        if (config.getWeightPattern() != null) {
            this.weightPattern = Pattern.compile(config.getWeightPattern());
        }
        log.info("Dynamic protocol adapter created: {}", config.getName());
    }

    @Override
    public String getProtocolName() {
        return config.getName();
    }

    @Override
    public String getProtocolDescription() {
        return config.getDescription();
    }

    @Override
    public Optional<ScaleReading> parse(byte[] rawData) {
        if (!isValidFrame(rawData)) {
            return Optional.empty();
        }

        try {
            String dataStr = extractDataString(rawData);
            return parseDataString(dataStr);
        } catch (Exception e) {
            log.error("Error parsing data with dynamic protocol {}: {}",
                    config.getName(), e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 提取数据字符串
     */
    private String extractDataString(byte[] rawData) {
        byte[] header = hexToBytes(config.getFrameHeader());
        byte[] terminator = hexToBytes(config.getFrameTerminator());

        int startPos = findBytes(rawData, header, 0);
        int endPos = findBytes(rawData, terminator, startPos + header.length);

        if (startPos < 0 || endPos < 0) {
            return new String(rawData, StandardCharsets.US_ASCII);
        }

        int dataStart = startPos + header.length;
        int dataLength = endPos - dataStart;

        byte[] dataSection = new byte[dataLength];
        System.arraycopy(rawData, dataStart, dataSection, 0, dataLength);

        if ("ASCII".equalsIgnoreCase(config.getDataFormat())) {
            return new String(dataSection, StandardCharsets.US_ASCII);
        } else if ("HEX".equalsIgnoreCase(config.getDataFormat())) {
            return bytesToHex(dataSection);
        } else {
            return new String(dataSection, StandardCharsets.US_ASCII);
        }
    }

    /**
     * 解析数据字符串
     */
    private Optional<ScaleReading> parseDataString(String dataStr) {
        log.debug("Parsing data string: [{}]", dataStr);

        ScaleReading.ScaleReadingBuilder builder = ScaleReading.builder();

        // 检查稳定指示器
        if (config.getStableIndicator() != null) {
            builder.stable(dataStr.contains(config.getStableIndicator()));
        }

        // 检查超载指示器
        if (config.getOverloadIndicator() != null &&
                dataStr.contains(config.getOverloadIndicator())) {
            builder.overload(true);
            builder.status(ScaleReading.ReadingStatus.OVERLOAD);
        }

        // 使用正则表达式提取重量
        if (weightPattern != null) {
            Matcher matcher = weightPattern.matcher(dataStr);
            if (matcher.find()) {
                String weightValue = matcher.group(1);
                String unit = matcher.groupCount() > 1 ? matcher.group(2) : config.getDefaultUnit();

                if (unit == null || unit.isEmpty()) {
                    unit = config.getDefaultUnit() != null ? config.getDefaultUnit() : "g";
                }

                try {
                    BigDecimal rawWeight = new BigDecimal(weightValue);
                    BigDecimal weightGrams = convertToGrams(rawWeight, unit);

                    builder.rawWeight(rawWeight);
                    builder.weightGrams(weightGrams);
                    builder.weightUnit(unit);
                    if (builder.build().getStatus() == null) {
                        builder.status(ScaleReading.ReadingStatus.NORMAL);
                    }
                } catch (NumberFormatException e) {
                    builder.status(ScaleReading.ReadingStatus.ERROR);
                    builder.errorMessage("Invalid weight value: " + weightValue);
                }
            } else {
                builder.status(ScaleReading.ReadingStatus.ERROR);
                builder.errorMessage("Weight pattern not matched");
            }
        } else {
            builder.status(ScaleReading.ReadingStatus.ERROR);
            builder.errorMessage("No weight pattern configured");
        }

        return Optional.of(builder.build());
    }

    /**
     * 转换为克
     */
    private BigDecimal convertToGrams(BigDecimal value, String unit) {
        if (unit == null) {
            return value;
        }
        switch (unit.toLowerCase()) {
            case "kg":
                return value.multiply(BigDecimal.valueOf(1000));
            case "lb":
                return value.multiply(BigDecimal.valueOf(453.592));
            case "oz":
                return value.multiply(BigDecimal.valueOf(28.3495));
            case "g":
            default:
                return value;
        }
    }

    @Override
    public boolean isValidFrame(byte[] data) {
        if (data == null || data.length == 0) {
            return false;
        }

        byte[] header = hexToBytes(config.getFrameHeader());
        byte[] terminator = hexToBytes(config.getFrameTerminator());

        if (header.length > 0 && findBytes(data, header, 0) < 0) {
            return false;
        }

        if (terminator.length > 0 && findBytes(data, terminator, 0) < 0) {
            return false;
        }

        return true;
    }

    @Override
    public int findFrameEnd(byte[] data) {
        if (data == null || data.length == 0) {
            return -1;
        }

        byte[] terminator = hexToBytes(config.getFrameTerminator());
        if (terminator.length == 0) {
            return -1;
        }

        int pos = findBytes(data, terminator, 0);
        if (pos >= 0) {
            return pos + terminator.length;
        }
        return -1;
    }

    @Override
    public byte[] generateCommand(CommandType command) {
        if (command == CommandType.READ && config.getPollingCommand() != null) {
            return hexToBytes(config.getPollingCommand());
        }
        return null;
    }

    @Override
    public boolean requiresPolling() {
        return config.isRequiresPolling();
    }

    @Override
    public int getRecommendedPollingInterval() {
        return config.getPollingInterval() > 0 ? config.getPollingInterval() : 500;
    }

    @Override
    public byte[] getFrameHeader() {
        return hexToBytes(config.getFrameHeader());
    }

    @Override
    public byte[] getFrameTerminator() {
        return hexToBytes(config.getFrameTerminator());
    }

    // ========== 工具方法 ==========

    /**
     * 十六进制字符串转字节数组
     */
    private byte[] hexToBytes(String hex) {
        if (hex == null || hex.isEmpty()) {
            return new byte[0];
        }
        hex = hex.replaceAll("\\s+", "");
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }

    /**
     * 字节数组转十六进制字符串
     */
    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    /**
     * 在数据中查找字节序列
     */
    private int findBytes(byte[] data, byte[] pattern, int startPos) {
        if (pattern.length == 0) {
            return startPos;
        }
        outer:
        for (int i = startPos; i <= data.length - pattern.length; i++) {
            for (int j = 0; j < pattern.length; j++) {
                if (data[i + j] != pattern[j]) {
                    continue outer;
                }
            }
            return i;
        }
        return -1;
    }
}
