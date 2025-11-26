# 🔥 宝塔防火墙开放 8085 端口

## 问题
```
139.196.165.140:8085/docs → ERR_CONNECTION_REFUSED
```

说明 8085 端口被防火墙阻止了。

---

## ✅ 解决方案（三选一）

### 方案1️⃣: 通过宝塔面板 UI（推荐）

1. **打开宝塔面板**
   ```
   https://139.196.165.140:16435/a96c4c2e
   ```

2. **点击菜单**: 安全 → 防火墙

3. **添加规则**:
   - 放行端口: `8085`
   - 或者添加规则: `TCP 8085`

4. **保存并确认**

---

### 方案2️⃣: 命令行方式（在宝塔终端执行）

**检查当前防火墙状态**:
```bash
ufw status
```

**开放 8085 端口**:
```bash
ufw allow 8085/tcp
```

**验证**:
```bash
ufw status | grep 8085
```

---

### 方案3️⃣: 编辑宝塔防火墙配置

在宝塔终端执行：

```bash
# 添加 8085 端口到宝塔防火墙
echo "8085" >> /etc/bt_panel/firewall/rule.conf

# 重启宝塔面板
systemctl restart bt_panel
```

---

## 🧪 验证开放成功

在宝塔终端执行以下任意一个命令验证：

```bash
# 方式1: 检查端口监听
lsof -i :8085

# 方式2: netstat 检查
netstat -tuln | grep 8085

# 方式3: 在本地测试
curl http://localhost:8085/

# 方式4: 从外部访问测试（这是最终验证）
curl http://139.196.165.140:8085/
```

**看到 JSON 响应就说明开放成功**:
```json
{"service":"食品加工数据分析 API","status":"running"}
```

---

## 📝 开放后，你可以访问

| 地址 | 用途 |
|------|------|
| `http://139.196.165.140:8085/` | API 健康检查 |
| `http://139.196.165.140:8085/docs` | API 交互式文档 |
| `http://139.196.165.140:8085/api/ai/chat` | AI 对话接口 |

---

## ⚠️ 如果仍然无法访问

可能的原因和检查：

```bash
# 1. 检查服务是否真的在运行
ps aux | grep python | grep main

# 2. 检查进程是否还活着
lsof -i :8085

# 3. 查看日志看是否有错误
tail -50 /www/wwwroot/project/logs/ai-service.log

# 4. 尝试重启服务
pkill -f 'python.*main'
cd /www/wwwroot/project/backend-ai-chat && nohup ./venv/bin/python scripts/main.py > /www/wwwroot/project/logs/ai-service.log 2>&1 &
```

---

## 🔐 安全提示

如果只想特定 IP 访问（更安全）:

```bash
# 只允许你的电脑 IP (如: 192.168.1.100)
ufw allow from 192.168.1.100 to any port 8085

# 只允许内网访问
ufw allow from 192.168.1.0/24 to any port 8085
```

---

**现在去宝塔面板开放 8085 端口，然后重新访问 API 文档吧！** 🚀
