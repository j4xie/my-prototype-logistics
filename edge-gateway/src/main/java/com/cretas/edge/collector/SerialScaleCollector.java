package com.cretas.edge.collector;

import com.cretas.edge.config.SerialPortConfig;
import com.cretas.edge.model.ScaleReading;
import com.cretas.edge.protocol.ScaleProtocolAdapter;
import com.fazecast.jSerialComm.SerialPort;
import com.fazecast.jSerialComm.SerialPortDataListener;
import com.fazecast.jSerialComm.SerialPortEvent;
import lombok.extern.slf4j.Slf4j;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 串口秤数据采集器实现
 *
 * 通过 RS232/RS485 串口采集电子秤数据
 */
@Slf4j
public class SerialScaleCollector implements ScaleCollector {

    private final SerialPortConfig.PortConfig portConfig;
    private final SerialPortConfig globalConfig;
    private final ScaleProtocolAdapter protocolAdapter;
    private final String factoryId;

    private SerialPort serialPort;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private ScheduledExecutorService scheduler;
    private DataCallback dataCallback;
    private ErrorCallback errorCallback;

    // 数据缓冲区
    private final ByteArrayOutputStream dataBuffer = new ByteArrayOutputStream();
    private static final int MAX_BUFFER_SIZE = 1024;

    public SerialScaleCollector(
            SerialPortConfig.PortConfig portConfig,
            SerialPortConfig globalConfig,
            ScaleProtocolAdapter protocolAdapter,
            String factoryId) {
        this.portConfig = portConfig;
        this.globalConfig = globalConfig;
        this.protocolAdapter = protocolAdapter;
        this.factoryId = factoryId;
    }

    @Override
    public void initialize() throws Exception {
        log.info("Initializing serial collector for device: {} on port: {}",
                portConfig.getDeviceId(), portConfig.getPortName());

        // 查找串口
        serialPort = findSerialPort(portConfig.getPortName());
        if (serialPort == null) {
            throw new RuntimeException("Serial port not found: " + portConfig.getPortName());
        }

        // 配置串口参数
        configureSerialPort();

        log.info("Serial collector initialized successfully for device: {}", portConfig.getDeviceId());
    }

    /**
     * 查找串口
     */
    private SerialPort findSerialPort(String portName) {
        SerialPort[] ports = SerialPort.getCommPorts();
        log.info("Available serial ports:");
        for (SerialPort port : ports) {
            log.info("  - {} ({})", port.getSystemPortName(), port.getDescriptivePortName());
            if (port.getSystemPortName().equals(portName) ||
                    port.getDescriptivePortName().contains(portName)) {
                return port;
            }
        }
        return null;
    }

    /**
     * 配置串口参数
     */
    private void configureSerialPort() {
        int baudRate = portConfig.getActualBaudRate(globalConfig.getDefaultBaudRate());
        int dataBits = portConfig.getActualDataBits(globalConfig.getDefaultDataBits());
        int stopBits = portConfig.getActualStopBits(globalConfig.getDefaultStopBits());
        int parity = parseParityString(portConfig.getActualParity(globalConfig.getDefaultParity()));

        serialPort.setBaudRate(baudRate);
        serialPort.setNumDataBits(dataBits);
        serialPort.setNumStopBits(stopBits);
        serialPort.setParity(parity);
        serialPort.setComPortTimeouts(
                SerialPort.TIMEOUT_READ_SEMI_BLOCKING,
                globalConfig.getReadTimeout(),
                0
        );

        log.info("Serial port configured: baud={}, dataBits={}, stopBits={}, parity={}",
                baudRate, dataBits, stopBits, portConfig.getActualParity(globalConfig.getDefaultParity()));
    }

    /**
     * 解析校验位字符串
     */
    private int parseParityString(String parity) {
        switch (parity.toUpperCase()) {
            case "ODD":
                return SerialPort.ODD_PARITY;
            case "EVEN":
                return SerialPort.EVEN_PARITY;
            case "MARK":
                return SerialPort.MARK_PARITY;
            case "SPACE":
                return SerialPort.SPACE_PARITY;
            case "NONE":
            default:
                return SerialPort.NO_PARITY;
        }
    }

    @Override
    public void start() {
        if (running.compareAndSet(false, true)) {
            log.info("Starting serial collector for device: {}", portConfig.getDeviceId());

            // 打开串口
            if (!serialPort.openPort()) {
                log.error("Failed to open serial port: {}", portConfig.getPortName());
                running.set(false);
                if (errorCallback != null) {
                    errorCallback.onError(portConfig.getDeviceId(),
                            new RuntimeException("Failed to open serial port"));
                }
                return;
            }

            // 添加数据监听器
            serialPort.addDataListener(new SerialDataListener());

            // 启动定时轮询（作为备用机制）
            scheduler = Executors.newSingleThreadScheduledExecutor();
            scheduler.scheduleAtFixedRate(
                    this::pollData,
                    globalConfig.getPollingInterval(),
                    globalConfig.getPollingInterval(),
                    TimeUnit.MILLISECONDS
            );

            log.info("Serial collector started for device: {}", portConfig.getDeviceId());
        }
    }

    @Override
    public void stop() {
        if (running.compareAndSet(true, false)) {
            log.info("Stopping serial collector for device: {}", portConfig.getDeviceId());

            if (scheduler != null) {
                scheduler.shutdown();
                try {
                    if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                        scheduler.shutdownNow();
                    }
                } catch (InterruptedException e) {
                    scheduler.shutdownNow();
                    Thread.currentThread().interrupt();
                }
            }

            if (serialPort != null && serialPort.isOpen()) {
                serialPort.removeDataListener();
                serialPort.closePort();
            }

            log.info("Serial collector stopped for device: {}", portConfig.getDeviceId());
        }
    }

    @Override
    public boolean isRunning() {
        return running.get();
    }

    @Override
    public Optional<ScaleReading> readOnce() {
        if (serialPort == null || !serialPort.isOpen()) {
            return Optional.of(ScaleReading.errorReading(
                    portConfig.getDeviceId(), "Serial port not open"));
        }

        try {
            byte[] buffer = new byte[256];
            int bytesRead = serialPort.readBytes(buffer, buffer.length);

            if (bytesRead > 0) {
                byte[] data = new byte[bytesRead];
                System.arraycopy(buffer, 0, data, 0, bytesRead);
                return parseData(data);
            }
        } catch (Exception e) {
            log.error("Error reading from serial port: {}", e.getMessage());
            return Optional.of(ScaleReading.errorReading(
                    portConfig.getDeviceId(), "Read error: " + e.getMessage()));
        }

        return Optional.empty();
    }

    /**
     * 定时轮询数据
     */
    private void pollData() {
        try {
            Optional<ScaleReading> reading = readOnce();
            reading.ifPresent(this::notifyData);
        } catch (Exception e) {
            log.error("Error polling data from device {}: {}",
                    portConfig.getDeviceId(), e.getMessage());
            if (errorCallback != null) {
                errorCallback.onError(portConfig.getDeviceId(), e);
            }
        }
    }

    /**
     * 解析数据
     */
    private Optional<ScaleReading> parseData(byte[] data) {
        try {
            Optional<ScaleReading> reading = protocolAdapter.parse(data);
            if (reading.isPresent()) {
                ScaleReading sr = reading.get();
                // 填充额外信息
                sr.setReadingId(UUID.randomUUID().toString());
                sr.setFactoryId(factoryId);
                sr.setDeviceId(portConfig.getDeviceId());
                sr.setPortName(portConfig.getPortName());
                sr.setScaleBrand(portConfig.getScaleBrand());
                sr.setTimestamp(LocalDateTime.now());
                sr.setRawDataHex(bytesToHex(data));
                return Optional.of(sr);
            }
        } catch (Exception e) {
            log.error("Error parsing data from device {}: {}",
                    portConfig.getDeviceId(), e.getMessage());
        }
        return Optional.empty();
    }

    /**
     * 字节数组转十六进制字符串
     */
    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X ", b));
        }
        return sb.toString().trim();
    }

    /**
     * 通知数据回调
     */
    private void notifyData(ScaleReading reading) {
        if (dataCallback != null) {
            try {
                dataCallback.onData(reading);
            } catch (Exception e) {
                log.error("Error in data callback: {}", e.getMessage());
            }
        }
    }

    @Override
    public String getDeviceId() {
        return portConfig.getDeviceId();
    }

    @Override
    public String getCollectorType() {
        return "SERIAL";
    }

    @Override
    public String getStatusDescription() {
        if (!running.get()) {
            return "STOPPED";
        }
        if (serialPort == null) {
            return "NOT_INITIALIZED";
        }
        if (!serialPort.isOpen()) {
            return "PORT_CLOSED";
        }
        return "RUNNING";
    }

    @Override
    public void setDataCallback(DataCallback callback) {
        this.dataCallback = callback;
    }

    @Override
    public void setErrorCallback(ErrorCallback callback) {
        this.errorCallback = callback;
    }

    /**
     * 串口数据监听器
     */
    private class SerialDataListener implements SerialPortDataListener {
        @Override
        public int getListeningEvents() {
            return SerialPort.LISTENING_EVENT_DATA_AVAILABLE;
        }

        @Override
        public void serialEvent(SerialPortEvent event) {
            if (event.getEventType() != SerialPort.LISTENING_EVENT_DATA_AVAILABLE) {
                return;
            }

            int available = serialPort.bytesAvailable();
            if (available <= 0) {
                return;
            }

            byte[] buffer = new byte[available];
            int bytesRead = serialPort.readBytes(buffer, available);

            if (bytesRead > 0) {
                // 添加到缓冲区
                synchronized (dataBuffer) {
                    dataBuffer.write(buffer, 0, bytesRead);

                    // 检查是否有完整的数据帧
                    byte[] allData = dataBuffer.toByteArray();
                    int frameEnd = protocolAdapter.findFrameEnd(allData);

                    if (frameEnd > 0) {
                        byte[] frameData = new byte[frameEnd];
                        System.arraycopy(allData, 0, frameData, 0, frameEnd);

                        // 处理数据帧
                        Optional<ScaleReading> reading = parseData(frameData);
                        reading.ifPresent(SerialScaleCollector.this::notifyData);

                        // 清理已处理的数据
                        dataBuffer.reset();
                        if (allData.length > frameEnd) {
                            dataBuffer.write(allData, frameEnd, allData.length - frameEnd);
                        }
                    }

                    // 防止缓冲区溢出
                    if (dataBuffer.size() > MAX_BUFFER_SIZE) {
                        log.warn("Data buffer overflow, clearing...");
                        dataBuffer.reset();
                    }
                }
            }
        }
    }
}
