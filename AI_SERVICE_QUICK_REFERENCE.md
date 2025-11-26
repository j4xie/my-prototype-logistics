# AI 服务快速参考表

## 🎯 核心信息

| 项目 | 值 |
|------|-----|
| **服务名称** | 白垩纪 AI 成本分析服务 |
| **框架** | Python FastAPI |
| **位置** | `/www/wwwroot/cretas/backend-ai-chat` |
| **启动脚本** | `/www/wwwroot/cretas/scripts/main.py` |
| **监听端口** | 8085 |
| **日志文件** | `/www/wwwroot/cretas/logs/ai-service.log` |

---

## 🚀 常用命令（在宝塔终端执行）

### 1️⃣ 完整检查
```bash
bash /www/wwwroot/cretas/check-ai-service.sh
```

### 2️⃣ 启动服务
```bash
bash /www/wwwroot/cretas/start-ai-service.sh
```

### 3️⃣ 查看日志
```bash
tail -f /www/wwwroot/cretas/logs/ai-service.log
```

### 4️⃣ 停止服务
```bash
pkill -f 'python.*main.py'
```

### 5️⃣ 测试 API
```bash
curl http://localhost:8085/
```

### 6️⃣ 查看进程
```bash
ps aux | grep -E 'python.*main' | grep -v grep
```

### 7️⃣ 检查端口
```bash
lsof -i :8085
```

---

## 📁 目录结构

```
/www/wwwroot/cretas/backend-ai-chat/
├── .env                  ← 必须有！包含 HF_TOKEN
├── requirements.txt      ← 依赖列表
├── scripts/
│   └── main.py          ← 主程序
├── venv/                ← Python 虚拟环境
│   ├── bin/python
│   └── lib/...
└── docs/
```

---

## 🔍 诊断快速命令

| 检查项 | 命令 |
|--------|------|
| **是否运行** | `ps aux \| grep python` |
| **端口占用** | `lsof -i :8085` |
| **目录存在** | `ls -la /www/wwwroot/cretas/backend-ai-chat` |
| **main.py** | `test -f /www/wwwroot/cretas/backend-ai-chat/scripts/main.py && echo OK` |
| **虚拟环境** | `test -d /www/wwwroot/cretas/backend-ai-chat/venv && echo OK` |
| **API 响应** | `curl http://localhost:8085/` |

---

## 🛠️ 故障排查

### 服务不能启动
```bash
# 1. 检查日志
tail -50 /www/wwwroot/cretas/logs/ai-service.log

# 2. 直接运行看错误
cd /www/wwwroot/cretas/backend-ai-chat
./venv/bin/python scripts/main.py
```

### 端口被占用
```bash
# 杀死占用进程
lsof -i :8085 | grep python | awk '{print $2}' | xargs kill -9
```

### 依赖缺失
```bash
/www/wwwroot/cretas/backend-ai-chat/venv/bin/pip install -r requirements.txt
```

### HF_TOKEN 无效
```bash
# 编辑 .env 文件
nano /www/wwwroot/cretas/backend-ai-chat/.env

# 更新 HF_TOKEN
# 保存并重启服务
pkill -f 'python.*main'
bash /www/wwwroot/cretas/start-ai-service.sh
```

---

## 📊 预期输出

### 服务成功启动
```
✅ AI 服务已启动，进程ID: 12345
✅ 服务进程正在运行
✅ API 可以访问: http://localhost:8085/
```

### API 健康检查响应
```json
{
  "service": "海牛 AI 成本分析 API",
  "status": "running",
  "version": "1.0.0",
  "model": "Llama-3.1-8B-Instruct"
}
```

---

## 🔑 关键配置

### .env 必填项
```bash
HF_TOKEN=hf_xxxxxxxxxxxxx  # 从 huggingface.co 获取
```

### .env 可选项
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

---

## 🌐 访问地址

| 用途 | 地址 |
|------|------|
| API 接口 | `http://localhost:8085` |
| API 文档 | `http://139.196.165.140:8085/docs` |
| 健康检查 | `http://localhost:8085/` |
| AI 对话 | POST `http://localhost:8085/api/ai/chat` |

---

## 📈 性能监控

### 查看资源占用
```bash
# 内存和 CPU
top -p $(pgrep -f 'python.*main')

# 或
ps aux | grep -E 'python.*main' | grep -v grep | awk '{print $2, $3, $4, $6}'
```

### 日志大小
```bash
du -sh /www/wwwroot/cretas/logs/ai-service.log
```

---

## ⚡ 一键操作脚本

### 一键启动
```bash
bash /www/wwwroot/cretas/start-ai-service.sh
```

### 一键停止和重启
```bash
pkill -f 'python.*main' && sleep 2 && bash /www/wwwroot/cretas/start-ai-service.sh
```

### 一键诊断
```bash
bash /www/wwwroot/cretas/check-ai-service.sh
```

---

## 📞 需要帮助？

1. 运行完整诊断: `bash /www/wwwroot/cretas/check-ai-service.sh`
2. 查看日志: `tail -100 /www/wwwroot/cretas/logs/ai-service.log`
3. 参考指南: `/docs/deployment/AI_SERVICE_DEPLOYMENT_GUIDE.md`
4. 查看清单: `BAOTA_AI_SERVICE_CHECKLIST.md`

---

**服务位置**: `/www/wwwroot/cretas/backend-ai-chat`
**主程序**: `scripts/main.py`
**监听端口**: 8085
**最后更新**: 2025-11-21
