# 宝塔面板 AI 服务快速检查清单

> **说明**: 这份清单用于在宝塔终端中检查和启动 AI 服务。你已经把 `backend-ai-chat` 复制到服务器上，现在需要验证它是否正确配置和运行。

---

## 📋 快速检查

直接在宝塔终端复制并执行以下命令：

### 【第1步】检查目录结构

```bash
ls -la /www/wwwroot/cretas/backend-ai-chat
```

**应该看到**:
```
.env                    # 环境变量配置
requirements.txt        # 依赖列表
scripts/                # 包含 main.py
venv/                   # Python 虚拟环境
```

如果看不到上述内容，说明目录复制可能有问题。

---

### 【第2步】检查关键文件完整性

```bash
echo "检查 main.py:" && test -f /www/wwwroot/cretas/backend-ai-chat/scripts/main.py && echo "✅ 存在" || echo "❌ 不存在"

echo "检查 .env:" && test -f /www/wwwroot/cretas/backend-ai-chat/.env && echo "✅ 存在" || echo "❌ 不存在"

echo "检查 requirements.txt:" && test -f /www/wwwroot/cretas/backend-ai-chat/requirements.txt && echo "✅ 存在" || echo "❌ 不存在"

echo "检查 venv:" && test -d /www/wwwroot/cretas/backend-ai-chat/venv && echo "✅ 存在" || echo "❌ 不存在"
```

---

### 【第3步】检查服务是否运行

```bash
ps aux | grep -E 'python.*main|uvicorn' | grep -v grep && echo "✅ 服务运行中" || echo "❌ 服务未运行"
```

---

### 【第4步】检查 8085 端口

```bash
lsof -i :8085 2>/dev/null || echo "⚠️ 8085 端口未被占用（可能服务未启动）"
```

---

## 🚀 启动服务

如果服务未运行，执行以下命令启动：

```bash
cd /www/wwwroot/cretas/backend-ai-chat && \
nohup ./venv/bin/python scripts/main.py > /www/wwwroot/cretas/logs/ai-service.log 2>&1 &
```

**或者使用自动化脚本**（更推荐）：

```bash
bash /www/wwwroot/cretas/start-ai-service.sh
```

---

## 🧪 测试连接

启动后，用以下命令测试：

```bash
curl http://localhost:8085/
```

**应该返回类似这样的 JSON**:
```json
{
  "service": "海牛 AI 成本分析 API",
  "status": "running",
  "version": "1.0.0"
}
```

---

## 🔍 查看日志

```bash
# 实时查看日志
tail -f /www/wwwroot/cretas/logs/ai-service.log

# 查看最后 50 行
tail -50 /www/wwwroot/cretas/logs/ai-service.log

# 查看特定错误
grep "ERROR\|Exception" /www/wwwroot/cretas/logs/ai-service.log
```

---

## ⚠️ 常见问题

### 问题1：venv 目录不存在

**现象**: 无法找到 Python 虚拟环境

**解决**:
```bash
cd /www/wwwroot/cretas/backend-ai-chat
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

---

### 问题2：依赖未安装

**现象**: `ImportError: No module named 'fastapi'`

**解决**:
```bash
/www/wwwroot/cretas/backend-ai-chat/venv/bin/pip install -r /www/wwwroot/cretas/backend-ai-chat/requirements.txt
```

---

### 问题3：端口 8085 被占用

**现象**: `Address already in use`

**解决**:
```bash
# 查看占用端口的进程
lsof -i :8085

# 杀死进程
kill -9 <PID>

# 或清理所有 Python 进程
pkill -f 'python.*main'
```

---

### 问题4：HF_TOKEN 无效

**现象**: `Authentication required` 或 `Invalid token`

**解决**:
```bash
# 1. 访问获取新 Token: https://huggingface.co/settings/tokens
# 2. 编辑 .env 文件
nano /www/wwwroot/cretas/backend-ai-chat/.env

# 3. 更新 HF_TOKEN=hf_新的Token值
# 4. Ctrl+X, Y, Enter 保存
# 5. 重启服务
pkill -f 'python.*main'
bash /www/wwwroot/cretas/start-ai-service.sh
```

---

## 📊 完整诊断脚本

如果上面的逐步检查很麻烦，直接运行完整诊断：

```bash
bash /www/wwwroot/cretas/check-ai-service.sh
```

这个脚本会自动检查所有配置和状态，并生成报告。

---

## 🔗 关键路径速查

| 项目 | 路径 |
|------|------|
| AI 服务目录 | `/www/wwwroot/cretas/backend-ai-chat` |
| 主程序 | `/www/wwwroot/cretas/backend-ai-chat/scripts/main.py` |
| 虚拟环境 | `/www/wwwroot/cretas/backend-ai-chat/venv` |
| 环境配置 | `/www/wwwroot/cretas/backend-ai-chat/.env` |
| 依赖列表 | `/www/wwwroot/cretas/backend-ai-chat/requirements.txt` |
| 日志文件 | `/www/wwwroot/cretas/logs/ai-service.log` |
| 检查脚本 | `/www/wwwroot/cretas/check-ai-service.sh` |
| 启动脚本 | `/www/wwwroot/cretas/start-ai-service.sh` |

---

## 📋 逐步部署检查表

在宝塔终端逐项完成以下检查：

- [ ] 目录 `/www/wwwroot/cretas/backend-ai-chat` 存在
- [ ] 文件 `main.py` 存在于 `scripts/` 目录
- [ ] 文件 `.env` 存在且包含 `HF_TOKEN`
- [ ] 虚拟环境 `venv` 目录存在
- [ ] Python 依赖已安装（运行 `pip list` 检查）
- [ ] 服务进程运行中（查看 `ps aux` 输出）
- [ ] 端口 8085 被监听（运行 `lsof -i :8085`）
- [ ] API 可以访问（运行 `curl http://localhost:8085/`）
- [ ] 日志文件正常（查看 `logs/ai-service.log`）

---

## 🎯 预期结果

启动成功后，应该看到：

```
✅ AI 服务已启动，进程ID: 12345
✅ 服务进程正在运行
✅ API 可以访问: http://localhost:8085/
📚 API 文档: http://139.196.165.140:8085/docs
```

然后访问 API 文档验证：
```
http://139.196.165.140:8085/docs
```

---

## 💡 提示

- **如果第一次启动很慢**: 正常现象，模型下载需要 10-30 分钟
- **如果内存占用很高**: 这是大型 AI 模型的正常行为
- **如果收到 401 错误**: 检查 HF_TOKEN 是否有效
- **如果无法访问 API**: 检查防火墙是否允许 8085 端口

---

**完成上述检查后，AI 服务应该就正常运行了！**

如有问题，查看日志获取详细错误信息：
```bash
tail -50 /www/wwwroot/cretas/logs/ai-service.log
```
