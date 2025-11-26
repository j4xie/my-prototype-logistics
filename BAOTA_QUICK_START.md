# 宝塔 AI 服务快速启动指南

> ⚠️ **重要**: 你的目录结构是 `/www/wwwroot/project/` 而不是 `/www/wwwroot/cretas/`

---

## 🎯 快速操作（复制粘贴到宝塔终端）

### 第1步：检查 AI 服务目录是否存在

```bash
ls -la /www/wwwroot/project/backend-ai-chat
```

**应该看到**:
```
.env
requirements.txt
scripts/
venv/
```

如果目录不存在，说明还没有上传 `backend-ai-chat` 文件夹。

---

### 第2步：检查文件完整性

```bash
echo "=== 检查关键文件 ===" && \
test -f /www/wwwroot/project/backend-ai-chat/scripts/main.py && echo "✅ main.py" || echo "❌ main.py 缺失" && \
test -f /www/wwwroot/project/backend-ai-chat/.env && echo "✅ .env" || echo "❌ .env 缺失" && \
test -f /www/wwwroot/project/backend-ai-chat/requirements.txt && echo "✅ requirements.txt" || echo "❌ requirements.txt 缺失" && \
test -d /www/wwwroot/project/backend-ai-chat/venv && echo "✅ venv" || echo "❌ venv 缺失"
```

---

### 第3步：检查服务是否已运行

```bash
ps aux | grep -E 'python.*main|uvicorn' | grep -v grep && echo "✅ 服务已运行" || echo "❌ 服务未运行"
```

---

### 第4步：如果服务未运行，启动它

#### 方式1：手动启动（推荐首选）

```bash
cd /www/wwwroot/project/backend-ai-chat && \
nohup ./venv/bin/python scripts/main.py > /www/wwwroot/project/logs/ai-service.log 2>&1 &
```

然后验证：
```bash
sleep 2 && curl http://localhost:8085/
```

#### 方式2：创建启动脚本（更简洁）

**第一次只需创建一次**:

```bash
cat > /www/wwwroot/project/start-ai-service.sh << 'EOF'
#!/bin/bash
AI_DIR="/www/wwwroot/project/backend-ai-chat"
LOG_FILE="/www/wwwroot/project/logs/ai-service.log"

# 检查目录
[ -d "$AI_DIR" ] || { echo "❌ 目录不存在: $AI_DIR"; exit 1; }

# 创建日志目录
mkdir -p "$(dirname "$LOG_FILE")"

# 检查是否已运行
if pgrep -f "python.*main\.py" > /dev/null; then
    echo "⚠️ 服务已在运行"
    ps aux | grep -E 'python.*main' | grep -v grep
    exit 0
fi

# 启动服务
cd "$AI_DIR"
nohup ./venv/bin/python scripts/main.py > "$LOG_FILE" 2>&1 &
echo "✅ AI 服务已启动"
sleep 2
curl -s http://localhost:8085/ > /dev/null && echo "✅ API 可访问" || echo "⚠️ API 尚未就绪"
EOF

chmod +x /www/wwwroot/project/start-ai-service.sh
```

然后以后启动只需：
```bash
bash /www/wwwroot/project/start-ai-service.sh
```

---

## 🔍 常用命令速查

### 查看服务状态
```bash
ps aux | grep python | grep main
```

### 查看 8085 端口
```bash
lsof -i :8085
```

### 查看日志（实时）
```bash
tail -f /www/wwwroot/project/logs/ai-service.log
```

### 查看日志（最后50行）
```bash
tail -50 /www/wwwroot/project/logs/ai-service.log
```

### 测试 API
```bash
curl http://localhost:8085/
```

### 停止服务
```bash
pkill -f 'python.*main.py'
```

### 重启服务
```bash
pkill -f 'python.*main.py' && sleep 2 && bash /www/wwwroot/project/start-ai-service.sh
```

---

## ⚠️ 故障排查

### 问题1：找不到目录

```bash
ls -la /www/wwwroot/project/
```

如果 `backend-ai-chat` 不在列表中，说明目录还没有上传。

**解决**: 需要把 `backend-ai-chat` 文件夹上传到 `/www/wwwroot/project/`

---

### 问题2：虚拟环境不存在

```bash
cd /www/wwwroot/project/backend-ai-chat
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

---

### 问题3：依赖缺失

```bash
/www/wwwroot/project/backend-ai-chat/venv/bin/pip install -r /www/wwwroot/project/backend-ai-chat/requirements.txt
```

---

### 问题4：HF_TOKEN 无效

编辑 `.env` 文件：
```bash
nano /www/wwwroot/project/backend-ai-chat/.env
```

更新 `HF_TOKEN` 为新值，然后保存（Ctrl+X, Y, Enter）

重启服务：
```bash
pkill -f 'python.*main.py'
bash /www/wwwroot/project/start-ai-service.sh
```

---

### 问题5：8085 端口被占用

```bash
lsof -i :8085 | grep python | awk '{print $2}' | xargs kill -9
```

---

## 📊 完整检查脚本（一键诊断）

如果想要更详细的诊断，创建这个脚本：

```bash
cat > /www/wwwroot/project/check-ai-service.sh << 'EOF'
#!/bin/bash

AI_DIR="/www/wwwroot/project/backend-ai-chat"

echo "=========================================="
echo "白垩纪 AI 服务诊断报告"
echo "=========================================="
echo ""

echo "【1】目录检查"
test -d "$AI_DIR" && echo "✅ 目录存在" || echo "❌ 目录不存在"

echo ""
echo "【2】文件检查"
test -f "$AI_DIR/scripts/main.py" && echo "✅ main.py" || echo "❌ main.py"
test -f "$AI_DIR/.env" && echo "✅ .env" || echo "❌ .env"
test -f "$AI_DIR/requirements.txt" && echo "✅ requirements.txt" || echo "❌ requirements.txt"

echo ""
echo "【3】进程检查"
ps aux | grep -E 'python.*main' | grep -v grep && echo "✅ 服务运行中" || echo "❌ 服务未运行"

echo ""
echo "【4】端口检查"
lsof -i :8085 2>/dev/null && echo "✅ 8085 端口监听中" || echo "❌ 8085 端口未监听"

echo ""
echo "【5】API 检查"
curl -s -m 2 http://localhost:8085/ > /dev/null && echo "✅ API 可访问" || echo "❌ API 无法访问"

echo ""
echo "=========================================="
EOF

chmod +x /www/wwwroot/project/check-ai-service.sh
```

然后运行：
```bash
bash /www/wwwroot/project/check-ai-service.sh
```

---

## 🎯 你现在应该做的

1. **进入宝塔终端**

2. **运行快速检查**:
   ```bash
   ls -la /www/wwwroot/project/backend-ai-chat
   ```

3. **如果目录存在，启动服务**:
   ```bash
   cd /www/wwwroot/project/backend-ai-chat && \
   nohup ./venv/bin/python scripts/main.py > /www/wwwroot/project/logs/ai-service.log 2>&1 &
   ```

4. **验证**:
   ```bash
   sleep 3 && curl http://localhost:8085/
   ```

如果看到 JSON 响应，说明 AI 服务已经成功启动！ 🎉

---

## 📍 关键路径

| 项目 | 路径 |
|------|------|
| AI 服务 | `/www/wwwroot/project/backend-ai-chat` |
| 主程序 | `/www/wwwroot/project/backend-ai-chat/scripts/main.py` |
| 虚拟环境 | `/www/wwwroot/project/backend-ai-chat/venv` |
| 日志文件 | `/www/wwwroot/project/logs/ai-service.log` |

---

**最后更新**: 2025-11-21
**状态**: 已修正路径为 `/www/wwwroot/project/`
