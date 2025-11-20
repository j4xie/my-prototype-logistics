# iOS模拟器连接问题排查指南

## 问题：模拟器无法连接到Expo开发服务器

**错误信息：**
```
Error: xcrun simctl openurl ... exp://172.20.10.11:8081 exited with non-zero code: 60
Simulator device failed to open exp://172.20.10.11:8081.
Operation timed out
```

## 原因分析

1. **端口不匹配**：项目配置使用端口 `3010`，但系统尝试连接 `8081`
2. **开发服务器未启动**：端口3010未被占用
3. **网络连接问题**：模拟器无法访问主机的开发服务器

## 解决方案

### 方案1：使用正确的端口启动开发服务器（推荐）

```bash
cd frontend/CretasFoodTrace
npm start
# 或明确指定端口
npx expo start --port 3010
```

然后在模拟器中手动打开：
```
exp://172.20.10.11:3010
```

### 方案2：清除缓存并重新启动

```bash
cd frontend/CretasFoodTrace

# 清除Expo缓存
npx expo start --clear

# 如果还有问题，清除Metro缓存
npx react-native start --reset-cache
```

### 方案3：使用隧道模式（适合网络问题）

```bash
cd frontend/CretasFoodTrace
npx expo start --tunnel
```

### 方案4：使用localhost而不是IP地址

修改启动命令，使用localhost：
```bash
npx expo start --localhost
```

然后在模拟器中会使用 `exp://localhost:3010`

### 方案5：停止占用8081端口的进程

如果确实需要使用8081端口：

```bash
# 查找占用8081的进程
lsof -i :8081

# 结束进程（替换PID为实际进程ID）
kill -9 <PID>
```

## 快速修复步骤

1. **停止所有Expo进程**
   ```bash
   pkill -f expo
   pkill -f metro
   ```

2. **清除缓存**
   ```bash
   cd frontend/CretasFoodTrace
   npx expo start --clear
   ```

3. **使用正确的端口启动**
   ```bash
   npm start
   # 或
   npx expo start --port 3010
   ```

4. **在模拟器中手动打开**
   - 如果自动打开失败，在Expo DevTools中复制URL
   - 在Safari中打开：`exp://172.20.10.11:3010`
   - 或使用Expo Go扫描二维码

## 验证步骤

1. **检查开发服务器是否运行**
   ```bash
   lsof -i :3010
   ```

2. **检查网络连接**
   ```bash
   # 在模拟器中测试
   curl http://172.20.10.11:3010
   ```

3. **检查Expo配置**
   - 确认 `package.json` 中端口配置为 `3010`
   - 确认 `app.json` 配置正确

## 常见问题

### Q: 为什么使用8081而不是3010？
A: Expo默认使用8081端口。项目已配置为3010以避免端口冲突。确保使用正确的启动命令。

### Q: 模拟器总是超时怎么办？
A: 
1. 检查防火墙设置
2. 确保Mac和模拟器在同一网络
3. 尝试使用 `--tunnel` 模式
4. 或使用 `--localhost` 模式

### Q: 如何确认开发服务器地址？
A: 启动Expo后，查看终端输出的URL，应该类似：
```
Metro waiting on exp://172.20.10.11:3010
```

## 参考文档

- [Expo官方文档 - 开发服务器](https://docs.expo.dev/workflow/development-build/)
- [端口配置说明](../../docs/technical/PORT-CONFIGURATION.md)



