# 42. 设备激活 + 工厂绑定

**来源**: R3 Agent 1
**耗时**: 10 min

---

## 42.1 设备注册流程

### 42.1.1 初始注册
- 设备 (移动端/IoT) 首次启动调 `POST /api/mobile/activation/register`
- Body: `{deviceSn, deviceType, deviceModel}`
- 返: activation_token

### 42.1.2 绑定工厂
- 用 activation_token + factoryCode 调 `POST /api/mobile/activation/bind`
- 管理员在 `/system/whitelist` 预录 deviceSn

### 42.1.3 状态查询
- `GET /api/mobile/activation/status/{deviceId}`
- 返: pending / activated / revoked

---

## 42.2 设备撤销

### 场景
- 设备丢失 / 员工离职
- admin 在 `/system/devices` 撤销

### API
- `POST /devices/{id}/revoke`
- 撤销后 JWT 立即失效

---

## 42.3 设备管理

### 清单
- `GET /api/mobile/devices` 列表
- 字段: deviceSn / 绑定员工 / 最后活跃 / 状态

---

## 42.4 Checklist (8 项)

| # | 项 | 勾选 |
|---|---|------|
| 1 | 新设备注册 | ☐ |
| 2 | 工厂绑定 | ☐ |
| 3 | 状态查询 | ☐ |
| 4 | 白名单预录 | ☐ |
| 5 | 设备撤销 | ☐ |
| 6 | 撤销后 JWT 失效 | ☐ ⭐ |
| 7 | 设备列表 | ☐ |
| 8 | 最后活跃时间 | ☐ |
