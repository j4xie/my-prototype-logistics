package com.cretas.aims.service.simulator;

import com.cretas.aims.dto.scale.SimulatorStatus;
import com.cretas.aims.dto.scale.VirtualScaleConfig;
import com.cretas.aims.entity.scale.ScaleProtocolConfig;
import com.cretas.aims.repository.ScaleProtocolConfigRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import javax.annotation.PreDestroy;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;

/**
 * 虚拟秤模拟器实现
 * 用于无硬件开发和测试场景
 *
 * 实现特性:
 * - 使用 ConcurrentHashMap 管理多个模拟器实例 (线程安全)
 * - 根据协议配置的 frame_format JSON 生成对应格式数据
 * - 支持 ASCII 定长帧、HEX 帧、Modbus RTU 帧
 * - 称重波动模拟: 目标值 +/- fluctuationPercent% 随机波动后稳定
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class VirtualScaleSimulatorImpl implements VirtualScaleSimulator {

    private final ScaleProtocolConfigRepository protocolRepository;
    private final ObjectMapper objectMapper;

    /**
     * 模拟器实例存储 (线程安全)
     */
    private final ConcurrentHashMap<String, SimulatorInstance> simulators = new ConcurrentHashMap<>();

    /**
     * 线程池用于异步称重模拟
     */
    private final ExecutorService executorService = Executors.newCachedThreadPool();

    /**
     * 随机数生成器
     */
    private final Random random = new Random();

    // ==================== 模拟器生命周期管理 ====================

    @Override
    public String startSimulator(String protocolId, VirtualScaleConfig config) {
        log.info("Starting virtual scale simulator with protocol: {}", protocolId);

        // 验证协议存在
        ScaleProtocolConfig protocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new IllegalArgumentException("协议不存在: " + protocolId));

        if (!Boolean.TRUE.equals(protocol.getIsActive())) {
            throw new IllegalArgumentException("协议未启用: " + protocolId);
        }

        // 生成模拟器ID
        String simulatorId = UUID.randomUUID().toString();

        // 更新配置的协议ID
        if (config.getProtocolId() == null) {
            config.setProtocolId(protocolId);
        }

        // 创建模拟器实例
        SimulatorInstance instance = new SimulatorInstance();
        instance.simulatorId = simulatorId;
        instance.config = config;
        instance.protocol = protocol;
        instance.status = SimulatorStatus.running(
                simulatorId,
                config.getSimulatorName(),
                protocolId,
                protocol.getProtocolName(),
                config
        );

        simulators.put(simulatorId, instance);
        log.info("Virtual scale simulator started: {} ({})", simulatorId, config.getSimulatorName());

        return simulatorId;
    }

    @Override
    public void stopSimulator(String simulatorId) {
        SimulatorInstance instance = simulators.remove(simulatorId);
        if (instance == null) {
            log.warn("Simulator not found: {}", simulatorId);
            return;
        }

        instance.status.setStatus(SimulatorStatus.Status.STOPPED);
        log.info("Virtual scale simulator stopped: {}", simulatorId);
    }

    @Override
    public void pauseSimulator(String simulatorId) {
        SimulatorInstance instance = getInstanceOrThrow(simulatorId);
        instance.status.setStatus(SimulatorStatus.Status.PAUSED);
        log.info("Virtual scale simulator paused: {}", simulatorId);
    }

    @Override
    public void resumeSimulator(String simulatorId) {
        SimulatorInstance instance = getInstanceOrThrow(simulatorId);
        instance.status.setStatus(SimulatorStatus.Status.RUNNING);
        log.info("Virtual scale simulator resumed: {}", simulatorId);
    }

    @Override
    public List<SimulatorStatus> getRunningSimulators() {
        List<SimulatorStatus> result = new ArrayList<>();
        for (SimulatorInstance instance : simulators.values()) {
            result.add(instance.status);
        }
        return result;
    }

    @Override
    public SimulatorStatus getSimulatorStatus(String simulatorId) {
        SimulatorInstance instance = simulators.get(simulatorId);
        return instance != null ? instance.status : null;
    }

    @Override
    public boolean isRunning(String simulatorId) {
        SimulatorInstance instance = simulators.get(simulatorId);
        return instance != null && instance.status.getStatus() == SimulatorStatus.Status.RUNNING;
    }

    @Override
    public void stopAllSimulators() {
        log.info("Stopping all virtual scale simulators...");
        for (String simulatorId : new ArrayList<>(simulators.keySet())) {
            stopSimulator(simulatorId);
        }
    }

    @Override
    public int getActiveSimulatorCount() {
        return simulators.size();
    }

    // ==================== 数据发送 ====================

    @Override
    public byte[] sendWeight(String simulatorId, BigDecimal weight, boolean stable) {
        SimulatorInstance instance = getInstanceOrThrow(simulatorId);

        if (instance.status.getStatus() != SimulatorStatus.Status.RUNNING) {
            throw new IllegalStateException("模拟器未运行: " + simulatorId);
        }

        String unit = instance.config.getDefaultUnit();
        byte[] frame = generateFrameInternal(instance.protocol, weight, unit, stable);

        // 更新状态
        instance.status.setLastWeightValue(weight);
        instance.status.setLastUnit(unit);
        instance.status.setLastStable(stable);
        instance.status.setLastSendTime(LocalDateTime.now());
        instance.status.setTotalFramesSent(instance.status.getTotalFramesSent() + 1);

        log.debug("Sent weight: {} {} (stable: {}) from simulator: {}",
                weight, unit, stable, simulatorId);

        return frame;
    }

    @Override
    @Async
    public void simulateWeighingProcess(String simulatorId, BigDecimal targetWeight) {
        executorService.submit(() -> {
            try {
                simulateWeighingProcessSync(simulatorId, targetWeight);
            } catch (Exception e) {
                log.error("Weighing process simulation failed: {}", e.getMessage(), e);
            }
        });
    }

    @Override
    public List<byte[]> simulateWeighingProcessSync(String simulatorId, BigDecimal targetWeight) {
        SimulatorInstance instance = getInstanceOrThrow(simulatorId);
        VirtualScaleConfig config = instance.config;
        List<byte[]> frames = new ArrayList<>();

        int steps = config.getStabilizationSteps();
        BigDecimal fluctuation = config.getFluctuationPercent().divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);
        int intervalMs = config.getStepIntervalMs();

        log.info("Starting weighing simulation: target={}, steps={}, fluctuation={}%",
                targetWeight, steps, config.getFluctuationPercent());

        for (int i = 0; i < steps; i++) {
            boolean isLastStep = (i == steps - 1);

            BigDecimal weight;
            if (isLastStep) {
                // 最后一步: 稳定在目标值
                weight = targetWeight;
            } else {
                // 波动阶段: 目标值 +/- fluctuation%，随步数递减
                double remainingFluctuation = fluctuation.doubleValue() * (1.0 - (double) i / steps);
                double offset = (random.nextDouble() * 2 - 1) * remainingFluctuation;
                weight = targetWeight.multiply(BigDecimal.ONE.add(new BigDecimal(offset)));
                weight = weight.setScale(config.getDecimalPlaces(), RoundingMode.HALF_UP);
            }

            byte[] frame = sendWeight(simulatorId, weight, isLastStep);
            frames.add(frame);

            // 等待间隔 (最后一步不需要等待)
            if (!isLastStep) {
                try {
                    Thread.sleep(intervalMs);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        log.info("Weighing simulation completed: {} frames generated", frames.size());
        return frames;
    }

    // ==================== 数据帧生成 ====================

    @Override
    public byte[] generateFrame(String protocolId, BigDecimal weight, String unit, boolean stable) {
        ScaleProtocolConfig protocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new IllegalArgumentException("协议不存在: " + protocolId));

        return generateFrameInternal(protocol, weight, unit, stable);
    }

    @Override
    public List<byte[]> generateTestDataset(String protocolId, int count) {
        return generateTestDataset(protocolId, count, BigDecimal.ZERO, new BigDecimal("1000"));
    }

    @Override
    public List<byte[]> generateTestDataset(String protocolId, int count, BigDecimal minWeight, BigDecimal maxWeight) {
        if (count <= 0 || count > 10000) {
            throw new IllegalArgumentException("生成数量必须在 1-10000 之间");
        }

        ScaleProtocolConfig protocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new IllegalArgumentException("协议不存在: " + protocolId));

        List<byte[]> dataset = new ArrayList<>(count);
        BigDecimal range = maxWeight.subtract(minWeight);

        for (int i = 0; i < count; i++) {
            // 随机生成重量
            double ratio = random.nextDouble();
            BigDecimal weight = minWeight.add(range.multiply(new BigDecimal(ratio)));
            weight = weight.setScale(2, RoundingMode.HALF_UP);

            // 随机稳定状态 (80%概率为稳定)
            boolean stable = random.nextDouble() > 0.2;

            byte[] frame = generateFrameInternal(protocol, weight, "kg", stable);
            dataset.add(frame);
        }

        log.info("Generated {} test frames for protocol: {}", count, protocolId);
        return dataset;
    }

    @Override
    public String frameToHex(byte[] frame) {
        if (frame == null) return "";
        StringBuilder sb = new StringBuilder();
        for (byte b : frame) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    // ==================== 内部实现 ====================

    /**
     * 根据协议配置生成数据帧
     */
    private byte[] generateFrameInternal(ScaleProtocolConfig protocol, BigDecimal weight, String unit, boolean stable) {
        try {
            String frameFormatJson = protocol.getFrameFormat();
            if (frameFormatJson == null || frameFormatJson.isEmpty()) {
                throw new IllegalStateException("协议帧格式未配置: " + protocol.getProtocolCode());
            }

            JsonNode formatNode = objectMapper.readTree(frameFormatJson);
            String frameType = formatNode.path("frameType").asText("ASCII_FIXED");

            switch (frameType) {
                case "ASCII_FIXED":
                    return generateAsciiFixedFrame(formatNode, weight, unit, stable);
                case "ASCII_VARIABLE":
                    return generateAsciiVariableFrame(formatNode, weight, unit, stable);
                case "HEX_FIXED":
                    return generateHexFixedFrame(formatNode, weight, unit, stable);
                case "MODBUS_RTU":
                    return generateModbusRtuFrame(formatNode, weight, protocol);
                default:
                    throw new IllegalArgumentException("不支持的帧类型: " + frameType);
            }

        } catch (Exception e) {
            log.error("Frame generation failed: {}", e.getMessage(), e);
            throw new RuntimeException("数据帧生成失败: " + e.getMessage(), e);
        }
    }

    /**
     * 生成 ASCII 定长帧
     * 格式示例: +001240 kg S\r\n
     */
    private byte[] generateAsciiFixedFrame(JsonNode format, BigDecimal weight, String unit, boolean stable) {
        JsonNode fields = format.path("fields");
        int frameLength = format.path("totalLength").asInt(20);

        char[] frame = new char[frameLength];
        Arrays.fill(frame, ' ');

        for (JsonNode field : fields) {
            String name = field.path("name").asText();
            int start = field.path("start").asInt();
            int length = field.path("length").asInt();

            String value;
            switch (name) {
                case "sign":
                    value = weight.signum() >= 0 ? "+" : "-";
                    break;
                case "weight":
                    int decimalPlaces = field.path("decimalPlaces").asInt(0);
                    BigDecimal absWeight = weight.abs();
                    if (decimalPlaces > 0) {
                        absWeight = absWeight.movePointRight(decimalPlaces);
                    }
                    value = String.format("%" + length + "d", absWeight.longValue());
                    break;
                case "unit":
                    value = String.format("%-" + length + "s", unit);
                    break;
                case "stable":
                    JsonNode mapping = field.path("mapping");
                    if (mapping.isObject()) {
                        // 反向查找: 根据boolean值找对应的字符
                        Iterator<Map.Entry<String, JsonNode>> it = mapping.fields();
                        value = stable ? "S" : " ";
                        while (it.hasNext()) {
                            Map.Entry<String, JsonNode> entry = it.next();
                            if (entry.getValue().asBoolean() == stable) {
                                value = entry.getKey();
                                break;
                            }
                        }
                    } else {
                        value = stable ? "S" : " ";
                    }
                    break;
                default:
                    continue;
            }

            // 填充到帧中
            for (int i = 0; i < Math.min(length, value.length()); i++) {
                if (start + i < frame.length) {
                    frame[start + i] = value.charAt(i);
                }
            }
        }

        // 添加行结束符
        String terminator = format.path("terminator").asText("\r\n");
        String result = new String(frame).trim() + terminator;

        return result.getBytes(StandardCharsets.US_ASCII);
    }

    /**
     * 生成 ASCII 变长帧
     */
    private byte[] generateAsciiVariableFrame(JsonNode format, BigDecimal weight, String unit, boolean stable) {
        String delimiter = format.path("delimiter").asText(",");
        String terminator = format.path("terminator").asText("\r\n");

        List<String> parts = new ArrayList<>();
        JsonNode fields = format.path("fields");

        for (JsonNode field : fields) {
            String name = field.path("name").asText();

            switch (name) {
                case "weight":
                    parts.add(weight.toPlainString());
                    break;
                case "unit":
                    parts.add(unit);
                    break;
                case "stable":
                    parts.add(stable ? "S" : "U");
                    break;
                default:
                    parts.add("");
            }
        }

        String result = String.join(delimiter, parts) + terminator;
        return result.getBytes(StandardCharsets.US_ASCII);
    }

    /**
     * 生成 HEX 定长帧
     */
    private byte[] generateHexFixedFrame(JsonNode format, BigDecimal weight, String unit, boolean stable) {
        int frameLength = format.path("totalLength").asInt(10);
        byte[] frame = new byte[frameLength];

        JsonNode fields = format.path("fields");

        for (JsonNode field : fields) {
            String name = field.path("name").asText();
            int start = field.path("start").asInt();
            int length = field.path("length").asInt();

            switch (name) {
                case "header":
                    String headerHex = field.path("value").asText("AA55");
                    byte[] headerBytes = hexToBytes(headerHex);
                    System.arraycopy(headerBytes, 0, frame, start, Math.min(length, headerBytes.length));
                    break;
                case "weight":
                    int decimalPlaces = field.path("decimalPlaces").asInt(0);
                    long rawValue = weight.movePointRight(decimalPlaces).longValue();
                    // 大端序写入
                    for (int i = 0; i < length; i++) {
                        frame[start + length - 1 - i] = (byte) (rawValue & 0xFF);
                        rawValue >>= 8;
                    }
                    break;
                case "unit":
                    byte[] unitBytes = unit.getBytes(StandardCharsets.US_ASCII);
                    System.arraycopy(unitBytes, 0, frame, start, Math.min(length, unitBytes.length));
                    break;
                case "stable":
                    frame[start] = (byte) (stable ? 0x01 : 0x00);
                    break;
            }
        }

        // 计算校验和
        String checksumType = format.path("checksumType").asText("NONE");
        int checksumPos = format.path("checksumPosition").asInt(-1);
        if (checksumPos >= 0 && !"NONE".equals(checksumType)) {
            byte checksum = calculateChecksum(frame, 0, checksumPos, checksumType);
            frame[checksumPos] = checksum;
        }

        return frame;
    }

    /**
     * 生成 Modbus RTU 帧
     */
    private byte[] generateModbusRtuFrame(JsonNode format, BigDecimal weight, ScaleProtocolConfig protocol) {
        // Modbus RTU 响应帧: [从站地址][功能码][字节数][数据...][CRC16]
        int slaveId = format.path("slaveId").asInt(1);
        int decimalPlaces = format.path("decimalPlaces").asInt(2);

        long rawValue = weight.movePointRight(decimalPlaces).longValue();

        // 构建帧 (假设4字节数据 = 2个寄存器)
        byte[] frame = new byte[9]; // 1 + 1 + 1 + 4 + 2
        frame[0] = (byte) slaveId;
        frame[1] = 0x03; // 功能码: 读保持寄存器
        frame[2] = 0x04; // 数据字节数

        // 数据 (大端序)
        frame[3] = (byte) ((rawValue >> 24) & 0xFF);
        frame[4] = (byte) ((rawValue >> 16) & 0xFF);
        frame[5] = (byte) ((rawValue >> 8) & 0xFF);
        frame[6] = (byte) (rawValue & 0xFF);

        // 计算 Modbus CRC16
        int crc = calculateModbusCrc(frame, 0, 7);
        frame[7] = (byte) (crc & 0xFF);        // CRC低字节
        frame[8] = (byte) ((crc >> 8) & 0xFF); // CRC高字节

        return frame;
    }

    /**
     * 计算校验和
     */
    private byte calculateChecksum(byte[] data, int start, int end, String type) {
        switch (type) {
            case "XOR":
                byte xor = 0;
                for (int i = start; i < end; i++) {
                    xor ^= data[i];
                }
                return xor;
            case "SUM":
                int sum = 0;
                for (int i = start; i < end; i++) {
                    sum += (data[i] & 0xFF);
                }
                return (byte) (sum & 0xFF);
            default:
                return 0;
        }
    }

    /**
     * 计算 Modbus CRC16
     */
    private int calculateModbusCrc(byte[] data, int start, int length) {
        int crc = 0xFFFF;
        for (int i = start; i < start + length; i++) {
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

    /**
     * 16进制字符串转字节数组
     */
    private byte[] hexToBytes(String hex) {
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

    /**
     * 获取模拟器实例或抛出异常
     */
    private SimulatorInstance getInstanceOrThrow(String simulatorId) {
        SimulatorInstance instance = simulators.get(simulatorId);
        if (instance == null) {
            throw new IllegalArgumentException("模拟器不存在: " + simulatorId);
        }
        return instance;
    }

    /**
     * 销毁时清理资源
     */
    @PreDestroy
    public void destroy() {
        log.info("Shutting down virtual scale simulator service...");
        stopAllSimulators();
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(5, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    // ==================== 内部类 ====================

    /**
     * 模拟器实例
     */
    private static class SimulatorInstance {
        String simulatorId;
        VirtualScaleConfig config;
        ScaleProtocolConfig protocol;
        SimulatorStatus status;
    }
}
