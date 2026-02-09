# Cretas IoT 基础设施部署指南

## 快速开始

### 1. 启动 EMQX (开发环境)

```bash
cd backend-java/docker
docker-compose -f docker-compose-iot.yml up -d emqx
```

### 2. 验证服务

```bash
# 检查容器状态
docker ps | grep cretas-emqx

# 查看日志
docker logs cretas-emqx -f

# 测试MQTT连接 (需安装 mosquitto-clients)
mosquitto_pub -h localhost -p 1883 -t "test" -m "hello"
mosquitto_sub -h localhost -p 1883 -t "test"
```

### 3. 访问 Dashboard

- URL: http://localhost:18083
- 用户名: `admin`
- 密码: `public`

---

## MQTT 主题设计

### 设备上行数据

| 主题 | 说明 | 消息格式 |
|------|------|---------|
| `cretas/{factoryId}/device/{deviceId}/data` | 称重/传感器数据 | JSON |
| `cretas/{factoryId}/device/{deviceId}/status` | 设备状态 | JSON |
| `cretas/{factoryId}/device/{deviceId}/heartbeat` | 心跳 | JSON |

### 平台下行指令

| 主题 | 说明 |
|------|------|
| `cretas/{factoryId}/device/{deviceId}/command` | 配置/重启等指令 |

### 消息格式示例

```json
// 称重数据
{
  "deviceId": "SCALE-001",
  "type": "WEIGHT",
  "timestamp": "2026-01-04T10:30:00Z",
  "data": {
    "weight": 25.5,
    "unit": "kg",
    "stable": true,
    "operatorId": 22
  }
}

// 设备状态
{
  "deviceId": "SCALE-001",
  "status": "ONLINE",
  "signal": -65,
  "battery": 85,
  "timestamp": "2026-01-04T10:30:00Z"
}

// 心跳
{
  "deviceId": "SCALE-001",
  "uptime": 3600,
  "timestamp": "2026-01-04T10:30:00Z"
}
```

---

## 生产环境配置

### 1. 修改默认密码

编辑 `docker-compose-iot.yml`:

```yaml
environment:
  - EMQX_DASHBOARD__DEFAULT_PASSWORD=your-strong-password
```

### 2. 禁用匿名连接

```yaml
environment:
  - EMQX_ALLOW_ANONYMOUS=false
```

### 3. 启用认证

在 EMQX Dashboard 中配置:
- 访问控制 → 认证 → 添加内置数据库认证
- 添加客户端凭证

### 4. 配置 SSL/TLS

挂载证书文件:

```yaml
volumes:
  - ./certs/server.pem:/opt/emqx/etc/certs/server.pem:ro
  - ./certs/server.key:/opt/emqx/etc/certs/server.key:ro
```

---

## Spring Boot 集成

### Maven 依赖

```xml
<dependency>
    <groupId>org.eclipse.paho</groupId>
    <artifactId>org.eclipse.paho.client.mqttv3</artifactId>
    <version>1.2.5</version>
</dependency>
<dependency>
    <groupId>org.springframework.integration</groupId>
    <artifactId>spring-integration-mqtt</artifactId>
</dependency>
```

### 配置文件

```yaml
mqtt:
  broker: tcp://localhost:1883
  client-id: cretas-backend-${random.uuid}
  username: ""
  password: ""
  topics:
    - cretas/+/device/+/data
    - cretas/+/device/+/status
    - cretas/+/device/+/heartbeat
```

---

## 故障排查

### EMQX 无法启动

```bash
# 检查端口占用
lsof -i :1883
lsof -i :18083

# 重启容器
docker-compose -f docker-compose-iot.yml restart emqx
```

### 连接被拒绝

1. 检查 `EMQX_ALLOW_ANONYMOUS` 设置
2. 检查 ACL 规则 (`emqx/acl.conf`)
3. 查看 EMQX 日志: `docker logs cretas-emqx`

---

## 性能调优

### 客户端连接数

EMQX 开源版默认支持百万级连接，对于50+设备完全足够。

### 消息吞吐

- 开发环境: 默认配置即可
- 生产环境: 根据实际称重频率调整 `max_mqueue_len`

---

## 相关文档

- [EMQX 官方文档](https://www.emqx.io/docs/zh/latest/)
- [Eclipse Paho Java](https://eclipse.org/paho/index.php?page=clients/java/index.php)
- [Spring Integration MQTT](https://docs.spring.io/spring-integration/reference/mqtt.html)
