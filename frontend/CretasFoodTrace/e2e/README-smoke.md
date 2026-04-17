# Mobile Smoke Test (P2.11)

## 一键跑

```bash
# 前置: APK 已装到设备/模拟器, Maestro 已安装 (https://maestro.mobile.dev)

cd frontend/CretasFoodTrace
maestro test e2e/smoke-p2-11.yaml
```

## 期望

- 应用启动 → Landing 页出现 "Login" 按钮
- 点 Login → 用户名/密码 → 登录成功弹窗
- 首页显示 "快捷操作"
- 点工时上报 → 进入模块 (验证网络 OK)
- 返回首页

## 截图位置

Maestro 会存到 `~/.maestro/tests/<run-id>/`:
- `smoke-01-landing.png`
- `smoke-02-home.png`
- `smoke-03-module.png`
- `smoke-04-back-home.png`

## APK 必须指向 test 环境

编译前确认 `frontend/CretasFoodTrace/.env.local`:

```
EXPO_PUBLIC_API_URL=http://139.196.165.140:8097
```

(不是默认 `http://localhost:3010` 也不是 `10010`, Cretas 后端网关是 8097)

## FAIL 时排查

- `Login` 按钮没出现 → APK 里 env 还是 localhost, 重编
- `登录成功` 超时 → 检查 test Java 10011 是否活: `ssh root@47.100.235.168 'curl -s localhost:10011/api/mobile/health'`
- `快捷操作` 不显示 → 登录 token 解析失败, 检查 JWT_SECRET 一致
- 模块点击无响应 → 开发者模式查看 React DevTools console

## 手动快速验证

如果没装 Maestro, 手动验 4 步:

1. 打开 APK → 点 Login
2. 输 `factory_admin1` / `123456` → 登录
3. 首页看到 "快捷操作" 卡片
4. 点任意模块, 不崩溃即 PASS
