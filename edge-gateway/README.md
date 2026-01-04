# Cretas Edge Gateway

边缘网关服务 - 工厂内网工控机数据采集与上报

## 功能概述

- **串口采集**: 通过 RS232/RS485 串口采集电子秤数据
- **协议解析**: 支持多种品牌电子秤协议（柯力、托利多、梅特勒等）
- **数据上报**: 通过 MQTT 协议实时上报数据到后端服务器
- **离线缓存**: 网络断开时自动缓存数据，恢复后自动重传
- **动态协议**: 支持从后端动态获取协议配置，无需重新部署

## 技术栈

| 组件 | 版本 |
|------|------|
| Java | 11 |
| Spring Boot | 2.7.15 |
| jSerialComm | 2.10.4 |
| Eclipse Paho MQTT | 1.2.5 |

## 项目结构

```
edge-gateway/
├── pom.xml                           # Maven 配置
├── README.md                         # 项目说明
├── src/main/java/com/cretas/edge/
│   ├── EdgeGatewayApplication.java   # Spring Boot 启动类
│   ├── config/
│   │   ├── MqttConfig.java           # MQTT 连接配置
│   │   └── SerialPortConfig.java     # 串口配置
│   ├── collector/
│   │   ├── ScaleCollector.java       # 秤数据采集接口
│   │   └── SerialScaleCollector.java # 串口秤采集实现
│   ├── protocol/
│   │   ├── ScaleProtocolAdapter.java # 协议适配器接口
│   │   ├── KeliD2008Adapter.java     # 柯力D2008适配器
│   │   └── DynamicProtocolAdapter.java # 动态协议适配器
│   ├── uploader/
│   │   └── MqttDataUploader.java     # MQTT 数据上报
│   └── model/
│       └── ScaleReading.java         # 称重数据模型
├── src/main/resources/
│   ├── application.yml               # 配置文件
│   └── logback.xml                   # 日志配置
└── src/test/java/                    # 测试目录
```

## 快速开始

### 1. 编译打包

```bash
cd edge-gateway
mvn clean package -DskipTests
```

### 2. 配置参数

编辑 `application.yml` 或通过环境变量配置：

```bash
# 必须配置
export FACTORY_ID=F001                    # 工厂ID
export MQTT_BROKER_URL=tcp://ip:1883      # MQTT Broker地址

# 串口配置
export SCALE_001_PORT=/dev/ttyUSB0        # Linux串口
# 或
export SCALE_001_PORT=COM1                # Windows串口
```

### 3. 运行

```bash
java -jar target/edge-gateway-1.0.0-SNAPSHOT.jar
```

## 配置说明

### MQTT 配置

```yaml
mqtt:
  enabled: true
  broker-url: tcp://139.196.165.140:1883
  username: ${MQTT_USERNAME:}
  password: ${MQTT_PASSWORD:}
  qos: 1                    # 消息质量等级
  topic-prefix: cretas/scale
  batch-size: 10            # 批量发送大小
  offline-queue-size: 10000 # 离线队列大小
```

### 串口配置

```yaml
serial:
  enabled: true
  default-baud-rate: 9600
  default-data-bits: 8
  default-stop-bits: 1
  default-parity: NONE
  polling-interval: 500     # 采集间隔(ms)

  ports:
    - device-id: scale-001
      port-name: COM1       # 或 /dev/ttyUSB0
      scale-brand: 柯力D2008
      protocol: KELI_D2008
      enabled: true
```

## 支持的协议

| 协议名称 | 品牌/型号 | 描述 |
|----------|-----------|------|
| KELI_D2008 | 柯力 D2008 | 连续输出模式，STX/ETX帧格式 |
| DYNAMIC | 自定义 | 通过JSON配置的动态协议 |

### 动态协议配置示例

```json
{
  "name": "CUSTOM_SCALE",
  "description": "自定义秤协议",
  "frameHeader": "02",
  "frameTerminator": "0D0A",
  "dataFormat": "ASCII",
  "weightPattern": "W([+-]?\\d+\\.?\\d*)\\s*(kg|g)?",
  "stableIndicator": "ST",
  "defaultUnit": "g",
  "requiresPolling": false
}
```

## MQTT 主题

| 主题 | 描述 |
|------|------|
| `cretas/scale/{factoryId}/{deviceId}/data` | 单条称重数据 |
| `cretas/scale/{factoryId}/{deviceId}/data/batch` | 批量称重数据 |
| `cretas/scale/{factoryId}/{deviceId}/status` | 设备状态 |
| `cretas/scale/{factoryId}/{deviceId}/command` | 服务器下发命令 |

## 数据格式

### ScaleReading (称重数据)

```json
{
  "readingId": "uuid",
  "factoryId": "F001",
  "deviceId": "scale-001",
  "portName": "COM1",
  "scaleBrand": "柯力D2008",
  "weightGrams": 1234.56,
  "weightUnit": "kg",
  "stable": true,
  "zero": false,
  "overload": false,
  "status": "NORMAL",
  "rawDataHex": "02 53 54 20...",
  "timestamp": "2024-01-01T12:00:00",
  "uploadedAt": "2024-01-01T12:00:01"
}
```

## 部署

### Linux (工控机)

1. 安装 Java 11:
   ```bash
   apt install openjdk-11-jre-headless
   ```

2. 设置串口权限:
   ```bash
   usermod -a -G dialout $USER
   ```

3. 创建 systemd 服务:
   ```bash
   # /etc/systemd/system/edge-gateway.service
   [Unit]
   Description=Cretas Edge Gateway
   After=network.target

   [Service]
   Type=simple
   User=cretas
   Environment="FACTORY_ID=F001"
   Environment="MQTT_BROKER_URL=tcp://server:1883"
   ExecStart=/usr/bin/java -jar /opt/edge-gateway/edge-gateway.jar
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

4. 启动服务:
   ```bash
   systemctl enable edge-gateway
   systemctl start edge-gateway
   ```

### Windows (工控机)

使用 NSSM (Non-Sucking Service Manager) 创建 Windows 服务：

```batch
nssm install EdgeGateway "C:\Program Files\Java\jdk-11\bin\java.exe"
nssm set EdgeGateway AppParameters "-jar C:\edge-gateway\edge-gateway.jar"
nssm set EdgeGateway AppDirectory "C:\edge-gateway"
nssm set EdgeGateway AppEnvironmentExtra "FACTORY_ID=F001" "MQTT_BROKER_URL=tcp://server:1883"
```

## 故障排除

### 串口无法打开

```bash
# Linux: 检查串口权限
ls -la /dev/ttyUSB*
# 添加用户到 dialout 组
sudo usermod -a -G dialout $USER
```

### MQTT 连接失败

```bash
# 检查网络连通性
ping mqtt-broker-ip
telnet mqtt-broker-ip 1883
```

### 查看日志

```bash
# 实时日志
tail -f logs/edge-gateway.log

# 错误日志
tail -f logs/edge-gateway-error.log

# 数据采集日志
tail -f logs/edge-gateway-data.log
```

## 开发

### 添加新协议

1. 实现 `ScaleProtocolAdapter` 接口
2. 添加 `@Component` 注解
3. 在配置中使用新协议名称

```java
@Component
public class NewScaleAdapter implements ScaleProtocolAdapter {
    @Override
    public String getProtocolName() {
        return "NEW_SCALE";
    }
    // ... 实现其他方法
}
```

### 运行测试

```bash
mvn test
```

## 许可证

Copyright (c) 2024 Cretas. All rights reserved.
