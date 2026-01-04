package com.cretas.edge.protocol;

import com.cretas.edge.model.ScaleReading;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

/**
 * 柯力 D2008 系列电子秤协议适配器
 *
 * 协议说明：
 * - 连续输出模式，无需发送命令
 * - 数据帧格式: STX (02H) + 数据 + ETX (03H) + BCC
 * - 数据格式: 状态位(2字节) + 重量值(8字节) + 单位(2字节)
 *
 * 示例数据帧:
 * 02 53 54 20 20 20 31 32 33 2E 34 35 6B 67 03 XX
 * STX ST       1  2  3  .  4  5  k  g  ETX BCC
 */
@Slf4j
@Component
public class KeliD2008Adapter implements ScaleProtocolAdapter {

    private static final byte STX = 0x02;  // 帧头
    private static final byte ETX = 0x03;  // 帧尾

    private static final int MIN_FRAME_LENGTH = 14;  // 最小帧长度
    private static final int MAX_FRAME_LENGTH = 32;  // 最大帧长度

    @Override
    public String getProtocolName() {
        return "KELI_D2008";
    }

    @Override
    public String getProtocolDescription() {
        return "柯力 D2008 系列电子秤协议 (RS232/RS485)";
    }

    @Override
    public Optional<ScaleReading> parse(byte[] rawData) {
        if (!isValidFrame(rawData)) {
            log.debug("Invalid frame received");
            return Optional.empty();
        }

        try {
            // 提取数据部分（去掉 STX 和 ETX+BCC）
            int dataStart = 1;  // 跳过 STX
            int dataEnd = findETXPosition(rawData);
            if (dataEnd <= dataStart) {
                return Optional.empty();
            }

            byte[] dataSection = new byte[dataEnd - dataStart];
            System.arraycopy(rawData, dataStart, dataSection, 0, dataSection.length);

            return parseDataSection(dataSection);
        } catch (Exception e) {
            log.error("Error parsing Keli D2008 data: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 解析数据段
     */
    private Optional<ScaleReading> parseDataSection(byte[] data) {
        String dataStr = new String(data, StandardCharsets.US_ASCII).trim();
        log.debug("Parsing data section: [{}]", dataStr);

        ScaleReading.ScaleReadingBuilder builder = ScaleReading.builder();

        // 解析状态位（前2个字符）
        if (dataStr.length() >= 2) {
            char status1 = dataStr.charAt(0);
            char status2 = dataStr.charAt(1);

            // 解析稳定状态
            builder.stable(status1 == 'S' || status1 == 's');

            // 解析特殊状态
            if (status2 == 'Z' || status2 == 'z') {
                builder.zero(true);
            }
            if (status2 == 'O' || status2 == 'o') {
                builder.overload(true);
                builder.status(ScaleReading.ReadingStatus.OVERLOAD);
            }
        }

        // 解析重量值和单位
        String weightPart = dataStr.substring(2).trim();
        BigDecimal weight = parseWeight(weightPart, builder);

        if (weight != null) {
            builder.weightGrams(weight);
            builder.rawWeight(weight);
            if (builder.build().getStatus() == null) {
                builder.status(ScaleReading.ReadingStatus.NORMAL);
            }
        } else {
            builder.status(ScaleReading.ReadingStatus.ERROR);
            builder.errorMessage("Failed to parse weight value");
        }

        return Optional.of(builder.build());
    }

    /**
     * 解析重量值
     */
    private BigDecimal parseWeight(String weightStr, ScaleReading.ScaleReadingBuilder builder) {
        try {
            // 分离数字和单位
            StringBuilder numberPart = new StringBuilder();
            StringBuilder unitPart = new StringBuilder();

            boolean inNumber = true;
            for (char c : weightStr.toCharArray()) {
                if (inNumber && (Character.isDigit(c) || c == '.' || c == '-' || c == '+' || c == ' ')) {
                    if (c != ' ') {
                        numberPart.append(c);
                    }
                } else {
                    inNumber = false;
                    unitPart.append(c);
                }
            }

            String unit = unitPart.toString().trim().toLowerCase();
            builder.weightUnit(unit);

            BigDecimal rawValue = new BigDecimal(numberPart.toString().trim());

            // 统一转换为克
            switch (unit) {
                case "kg":
                    return rawValue.multiply(BigDecimal.valueOf(1000));
                case "lb":
                    return rawValue.multiply(BigDecimal.valueOf(453.592));
                case "oz":
                    return rawValue.multiply(BigDecimal.valueOf(28.3495));
                case "g":
                default:
                    return rawValue;
            }
        } catch (NumberFormatException e) {
            log.error("Failed to parse weight: {}", weightStr);
            return null;
        }
    }

    @Override
    public boolean isValidFrame(byte[] data) {
        if (data == null || data.length < MIN_FRAME_LENGTH) {
            return false;
        }

        // 检查帧头
        if (data[0] != STX) {
            return false;
        }

        // 查找帧尾
        int etxPos = findETXPosition(data);
        if (etxPos < 0) {
            return false;
        }

        // 校验 BCC（如果有）
        if (data.length > etxPos + 1) {
            byte bcc = data[etxPos + 1];
            byte calculatedBcc = calculateBCC(data, 1, etxPos);
            if (bcc != calculatedBcc) {
                log.debug("BCC mismatch: expected={}, actual={}", calculatedBcc, bcc);
                // 某些情况下可能没有 BCC，这里只记录警告
            }
        }

        return true;
    }

    /**
     * 查找 ETX 位置
     */
    private int findETXPosition(byte[] data) {
        for (int i = 1; i < data.length; i++) {
            if (data[i] == ETX) {
                return i;
            }
        }
        return -1;
    }

    /**
     * 计算 BCC 校验码
     */
    private byte calculateBCC(byte[] data, int start, int end) {
        byte bcc = 0;
        for (int i = start; i <= end && i < data.length; i++) {
            bcc ^= data[i];
        }
        return bcc;
    }

    @Override
    public int findFrameEnd(byte[] data) {
        if (data == null || data.length == 0) {
            return -1;
        }

        // 查找帧头
        int startPos = -1;
        for (int i = 0; i < data.length; i++) {
            if (data[i] == STX) {
                startPos = i;
                break;
            }
        }

        if (startPos < 0) {
            return -1;
        }

        // 查找帧尾
        for (int i = startPos + MIN_FRAME_LENGTH - 2; i < data.length; i++) {
            if (data[i] == ETX) {
                // 返回完整帧的结束位置（包含 BCC）
                int frameEnd = (i + 1 < data.length) ? i + 2 : i + 1;
                return Math.min(frameEnd, data.length);
            }
        }

        return -1;
    }

    @Override
    public byte[] generateCommand(CommandType command) {
        // 柯力 D2008 是连续输出模式，不需要发送命令
        // 但某些型号支持命令模式
        switch (command) {
            case ZERO:
                return new byte[]{0x5A};  // 'Z' 清零
            case TARE:
                return new byte[]{0x54};  // 'T' 去皮
            case READ:
            case STATUS:
            default:
                return null;
        }
    }

    @Override
    public boolean requiresPolling() {
        return false;  // 连续输出模式
    }

    @Override
    public int getRecommendedPollingInterval() {
        return 100;  // 100ms，仅供参考
    }

    @Override
    public byte[] getFrameHeader() {
        return new byte[]{STX};
    }

    @Override
    public byte[] getFrameTerminator() {
        return new byte[]{ETX};
    }
}
