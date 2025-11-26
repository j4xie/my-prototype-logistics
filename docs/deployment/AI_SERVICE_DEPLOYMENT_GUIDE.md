# AI 服务部署指南 (宝塔面板)

## 📍 服务概况

**项目**: 白垩纪食品溯源 - AI 成本分析服务
**框架**: Python FastAPI
**端口**: 8085
**位置**: `/www/wwwroot/cretas/backend-ai-chat`
**状态**: 需要验证和启动

---

## 🔍 第一步：检查服务状态

### 方式1：使用检查脚本（推荐）

在宝塔终端运行以下命令：

```bash
bash /www/wwwroot/cretas/check-ai-service.sh
```

此脚本会检查：
- ✅ AI 服务进程是否运行
- ✅ 8085 端口是否被占用
- ✅ 目录和文件结构完整性
- ✅ 虚拟环境配置
- ✅ 依赖安装状态
- ✅ API 连通性

### 方式2：手动检查

```bash
# 查看进程
ps aux | grep -E 'python.*main' | grep -v grep

# 查看端口
lsof -i :8085

# 查看目录
ls -la /www/wwwroot/cretas/backend-ai-chat
```

---

## 🚀 第二步：启动 AI 服务

### 如果服务未运行

在宝塔终端运行：

```bash
bash /www/wwwroot/cretas/start-ai-service.sh
```

此脚本会：
1. ✅ 检查目录结构
2. ✅ 创建虚拟环境（如果不存在）
3. ✅ 安装/更新依赖
4. ✅ 启动 AI 服务
5. ✅ 测试 API 连接

---

## 🔧 服务管理命令

### 查看服务状态
```bash
ps aux | grep -E 'python.*main' | grep -v grep
```

### 查看实时日志
```bash
tail -f /www/wwwroot/cretas/logs/ai-service.log
```

### 停止服务
```bash
pkill -f 'python.*main.py'
```

### 重启服务
```bash
bash /www/wwwroot/cretas/start-ai-service.sh
```

### 查看完整检查报告
```bash
bash /www/wwwroot/cretas/check-ai-service.sh
```

---

## 📂 目录结构验证

服务启动后，应该有以下文件结构：

```
/www/wwwroot/cretas/backend-ai-chat/
├── .env                      # ✅ 环境变量配置（包含 HF_TOKEN）
├── requirements.txt          # ✅ Python 依赖清单
├── scripts/
│   ├── main.py              # ✅ 主程序（AI 服务）
│   ├── main_enhanced.py     # 增强版本
│   └── test_*.py            # 测试脚本
├── venv/                    # ✅ Python 虚拟环境
│   ├── bin/python           # Python 解释器
│   ├── bin/pip              # pip 包管理器
│   └── lib/python*/site-packages/  # 已安装的包
├── docs/                    # 文档目录
└── logs/                    # 日志目录（可选）
```

---

## 🌐 API 测试

### 健康检查
```bash
curl http://localhost:8085/
```

**预期返回**：
```json
{
  "service": "海牛 AI 成本分析 API",
  "status": "running",
  "version": "1.0.0",
  "model": "Llama-3.1-8B-Instruct",
  "purpose": "水产加工成本优化分析",
  "redis_available": true
}
```

### API 文档
```
http://139.196.165.140:8085/docs
```

### 测试 AI 对话
```bash
curl -X POST http://localhost:8085/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "请介绍一下自己",
    "user_id": "test_factory"
  }'
```

---

## ⚙️ 配置说明

### .env 文件配置

```bash
# Hugging Face Token（必须）- 用于访问 Llama 模型
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Redis 配置（可选，用于会话存储）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

**注意**：
- HF_TOKEN 需要从 https://huggingface.co/settings/tokens 获取
- 如果 Redis 不可用，服务会自动切换到内存模式

### 修改监听地址和端口

编辑 `scripts/main.py`，找到以下代码：

```python
# 行号约 280-290
if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",      # 监听所有网卡
        port=8085,           # 端口号
        reload=False
    )
```

---

## 🐛 故障排查

### 问题1：服务无法启动

**症状**: 进程未运行或立即退出

**排查步骤**：
```bash
# 1. 查看日志
tail -50 /www/wwwroot/cretas/logs/ai-service.log

# 2. 直接运行（查看错误）
cd /www/wwwroot/cretas/backend-ai-chat
./venv/bin/python scripts/main.py

# 3. 常见原因：
# - 缺少 HF_TOKEN：编辑 .env 文件添加 Token
# - 端口被占用：lsof -i :8085
# - 依赖未安装：venv/bin/pip install -r requirements.txt
```

### 问题2：8085 端口无法访问

**症状**: `curl http://localhost:8085` 连接超时

**排查步骤**：
```bash
# 1. 检查服务是否运行
ps aux | grep -E 'python.*main' | grep -v grep

# 2. 检查端口监听
lsof -i :8085

# 3. 检查防火墙
ufw status
# 如需开放端口：ufw allow 8085

# 4. 检查宝塔面板防火墙
# 登录宝塔 → 安全 → 防火墙规则 → 添加 8085
```

### 问题3：模型加载缓慢

**症状**: 启动后需要等待很长时间，或内存占用很高

**解决方案**：
```bash
# 1. 首次启动需要下载模型（可能需要 10-30 分钟）
# 查看日志了解进度：
tail -f /www/wwwroot/cretas/logs/ai-service.log

# 2. 增加宝塔服务器内存配额
# 登录宝塔 → 监控 → 查看内存使用

# 3. 减少模型 token 输出（在 main.py 中）
# 将 max_tokens 从 1000 改为 500
```

### 问题4：HF_TOKEN 无效或过期

**症状**: API 返回 401 或模型加载失败

**解决方案**：
```bash
# 1. 访问 https://huggingface.co/settings/tokens
# 2. 创建新 Token（选择 "read" 权限）
# 3. 编辑 /www/wwwroot/cretas/backend-ai-chat/.env
# 4. 更新 HF_TOKEN 值
# 5. 重启服务：bash /www/wwwroot/cretas/start-ai-service.sh
```

---

## 📊 性能优化

### 1. 启用 Redis 缓存

```bash
# 在宝塔上安装 Redis
docker run -d -p 6379:6379 redis:alpine

# 验证 Redis
redis-cli ping
```

### 2. 增加工作进程

编辑 `scripts/main.py`：

```python
if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8085,
        workers=4  # 添加这行，使用 4 个工作进程
    )
```

### 3. 监控日志大小

```bash
# 查看日志大小
du -sh /www/wwwroot/cretas/logs/ai-service.log

# 清理旧日志（保留最近 100 行）
tail -100 /www/wwwroot/cretas/logs/ai-service.log > /tmp/ai.log && \
mv /tmp/ai.log /www/wwwroot/cretas/logs/ai-service.log
```

---

## 🔐 安全建议

### 1. 配置反向代理（可选但推荐）

在宝塔面板中：
- 网站 → 反向代理 → 添加反向代理
- 代理名称: `ai-chat-proxy`
- 目标URL: `http://127.0.0.1:8085`
- 发送头: 添加必要的安全头

### 2. 限制 API 访问

```bash
# 在防火墙中只允许特定 IP 访问 8085
ufw allow from 192.168.1.0/24 to any port 8085
```

### 3. 定期备份 .env 文件

```bash
# 备份包含 HF_TOKEN 的配置
cp /www/wwwroot/cretas/backend-ai-chat/.env \
   /www/wwwroot/cretas/backups/ai-service-.env.$(date +%Y%m%d)
```

---

## 📋 快速参考

| 操作 | 命令 |
|------|------|
| 检查状态 | `bash /www/wwwroot/cretas/check-ai-service.sh` |
| 启动服务 | `bash /www/wwwroot/cretas/start-ai-service.sh` |
| 停止服务 | `pkill -f 'python.*main.py'` |
| 查看日志 | `tail -f /www/wwwroot/cretas/logs/ai-service.log` |
| 测试 API | `curl http://localhost:8085/` |
| API 文档 | `http://139.196.165.140:8085/docs` |

---

## 🔗 相关资源

- **项目主文档**: [CLAUDE.md](../../CLAUDE.md)
- **AI 服务README**: [README_CRETAS.md](../../backend-java/backend-ai-chat/README_CRETAS.md)
- **Spring Boot 后端**: 端口 10010
- **React Native 前端**: 端口 3010

---

**最后更新**: 2025-11-21
**维护者**: Cretas 开发团队
