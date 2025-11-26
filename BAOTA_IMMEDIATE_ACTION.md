# 🚨 立即在宝塔终端执行

## ⚠️ 纠正: 目录是 `/www/wwwroot/project/` 不是 `/www/wwwroot/cretas/`

---

## 【第1步】检查目录是否存在

```bash
ls -la /www/wwwroot/project/backend-ai-chat
```

✅ 如果看到 `.env`, `requirements.txt`, `scripts/`, `venv/` - 说明目录完整

❌ 如果不存在或缺少文件 - 需要确认文件是否已上传

---

## 【第2步】启动 AI 服务

**最简单的方式**（直接粘贴执行）：

```bash
cd /www/wwwroot/project/backend-ai-chat && \
mkdir -p /www/wwwroot/project/logs && \
nohup ./venv/bin/python scripts/main.py > /www/wwwroot/project/logs/ai-service.log 2>&1 &
```

---

## 【第3步】验证服务启动

```bash
sleep 3 && curl http://localhost:8085/
```

**应该返回类似这样的 JSON**:
```json
{
  "service": "海牛 AI 成本分析 API",
  "status": "running",
  "version": "1.0.0"
}
```

如果看到 JSON，说明 ✅ 成功启动！

---

## 🔍 如果服务启动失败

### 查看错误日志
```bash
tail -50 /www/wwwroot/project/logs/ai-service.log
```

### 常见问题排查

**问题 1: 虚拟环境不存在**
```bash
cd /www/wwwroot/project/backend-ai-chat
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

**问题 2: HF_TOKEN 无效**
```bash
nano /www/wwwroot/project/backend-ai-chat/.env
# 编辑 HF_TOKEN=hf_你的token
# 按 Ctrl+X, Y, Enter 保存
```

**问题 3: 依赖缺失**
```bash
/www/wwwroot/project/backend-ai-chat/venv/bin/pip install -r /www/wwwroot/project/backend-ai-chat/requirements.txt
```

---

## 📋 其他常用命令

| 操作 | 命令 |
|------|------|
| 检查是否运行 | `ps aux \| grep python \| grep main` |
| 查看实时日志 | `tail -f /www/wwwroot/project/logs/ai-service.log` |
| 停止服务 | `pkill -f 'python.*main.py'` |
| 查看 8085 端口 | `lsof -i :8085` |
| API 文档 | `http://139.196.165.140:8085/docs` |

---

## 📁 关键路径

```
/www/wwwroot/project/
├── backend-ai-chat/           ← AI 服务目录
│   ├── scripts/main.py        ← 主程序
│   ├── .env                   ← 配置文件
│   ├── requirements.txt
│   └── venv/                  ← Python 虚拟环境
└── logs/
    └── ai-service.log         ← 日志文件
```

---

## ✅ 成功标志

- ✅ `curl http://localhost:8085/` 返回 JSON
- ✅ `ps aux | grep python` 看到 `main.py` 进程
- ✅ `lsof -i :8085` 显示监听
- ✅ 日志文件中没有 `ERROR` 标记

**全部完成后 AI 服务就运行起来了！** 🎉

---

**现在就去宝塔终端试试吧！**
