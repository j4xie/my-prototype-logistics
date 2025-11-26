# 环境配置和 AI 服务完整总结

本文档总结了最近完成的两项重要工作：**前端多环境配置**和**AI 服务检查**。

---

## 📱 第一部分：前端环境配置

### ✅ 已完成

1. **创建三个环境文件**
   - ✅ `.env.local` - 本地开发环境
   - ✅ `.env.test` - 测试环境
   - ✅ `.env.production` - 生产环境

2. **修改 config.ts**
   - ✅ 添加 `getApiBaseUrl()` 函数
   - ✅ 从环境变量读取 `REACT_APP_API_URL`
   - ✅ 设置默认值为生产服务器地址

3. **更新 package.json**
   - ✅ 添加 9 个新的 npm 脚本
   - ✅ 添加 `env-cmd` 依赖 (^10.1.0)

4. **安装和验证**
   - ✅ 安装 `env-cmd` 依赖
   - ✅ 验证所有三个环境文件正确加载
   - ✅ 测试环境变量可以正确读取

---

## 🗂️ 前端目录结构

```
/Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/
│
├── .env.local              ← 本地开发
├── .env.test               ← 测试环境
├── .env.production         ← 生产环境
│
├── src/
│   └── constants/
│       └── config.ts       ← 读取环境变量的配置文件
│
├── package.json            ← 包含 env-cmd 脚本
└── node_modules/
    └── env-cmd/            ← 环境变量加载工具
```

---

## 🚀 切换前端环境的方式

**重要**: 你应该在 **`/Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace`** 目录下执行以下命令：

```bash
# 进入前端目录
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace

# 方式1: 本地开发 (使用 .env.local)
npm start:local

# 方式2: 测试环境 (使用 .env.test)
npm start:test

# 方式3: 生产环境 (使用 .env.production)
npm start:production

# 或者使用平台特定命令:
npm run android:local      # Android 本地开发
npm run ios:local          # iOS 本地开发
npm run android:test       # Android 测试
npm run ios:test           # iOS 测试
```

---

## 📋 环境文件配置

### .env.local (本地开发)
```
REACT_APP_API_URL=http://139.196.165.140:10010
REACT_APP_DEBUG=true
REACT_APP_NAME=白垩纪食品溯源(本地开发)
```

### .env.test (测试环境)
```
REACT_APP_API_URL=http://139.196.165.140:10010
REACT_APP_DEBUG=false
REACT_APP_NAME=白垩纪食品溯源(测试环境)
REACT_APP_ENV=test
```

### .env.production (生产环境)
```
REACT_APP_API_URL=http://139.196.165.140:10010
REACT_APP_DEBUG=false
REACT_APP_NAME=白垩纪食品溯源
REACT_APP_ENV=production
REACT_APP_LOG_LEVEL=error
REACT_APP_ENABLE_ANALYTICS=true
```

---

## 🔧 工作原理

```typescript
// src/constants/config.ts

const getApiBaseUrl = () => {
  // 优先读取环境变量
  const envUrl = process.env.REACT_APP_API_URL;

  if (envUrl) {
    console.log(`[API Config] Using API URL from environment: ${envUrl}`);
    return envUrl;
  }

  // 默认值：生产服务器地址
  const defaultUrl = 'http://139.196.165.140:10010';
  return defaultUrl;
};

export const API_BASE_URL = getApiBaseUrl();
```

**流程**:
1. `npm start:local` 执行 → 加载 `.env.local`
2 → 设置 `process.env.REACT_APP_API_URL = http://139.196.165.140:10010`
3. `config.ts` 读取环境变量 → 返回 API 地址
4. 所有 31 个 API 客户端自动使用该地址

---

## 🎯 第二部分：AI 服务检查

### 📍 宝塔服务器位置

```
/www/wwwroot/cretas/backend-ai-chat/
├── .env                  # ✅ Hugging Face Token 配置
├── requirements.txt      # ✅ Python 依赖列表
├── scripts/
│   ├── main.py          # ✅ AI 服务主程序
│   ├── main_enhanced.py
│   └── test_*.py
├── venv/                # ✅ Python 虚拟环境
└── docs/
```

---

### 🔍 检查 AI 服务的三种方式

#### 方式1：使用自动诊断脚本（推荐）

在宝塔终端运行：
```bash
bash /www/wwwroot/cretas/check-ai-service.sh
```

此脚本自动检查：
- ✅ AI 服务进程状态
- ✅ 8085 端口是否被占用
- ✅ 目录和文件完整性
- ✅ 虚拟环境配置
- ✅ 依赖安装状态
- ✅ API 连通性

#### 方式2：快速手动检查

```bash
# 1. 查看进程
ps aux | grep -E 'python.*main' | grep -v grep

# 2. 检查端口
lsof -i :8085

# 3. 测试 API
curl http://localhost:8085/

# 4. 查看日志
tail -50 /www/wwwroot/cretas/logs/ai-service.log
```

#### 方式3：逐项检查清单

```bash
# 目录结构
ls -la /www/wwwroot/cretas/backend-ai-chat

# 主程序
test -f /www/wwwroot/cretas/backend-ai-chat/scripts/main.py && echo "✅ 存在"

# 虚拟环境
test -d /www/wwwroot/cretas/backend-ai-chat/venv && echo "✅ 存在"

# 配置文件
test -f /www/wwwroot/cretas/backend-ai-chat/.env && echo "✅ 存在"
```

---

### 🚀 启动 AI 服务

如果服务未运行，执行：

```bash
bash /www/wwwroot/cretas/start-ai-service.sh
```

这个脚本会：
1. ✅ 检查目录结构
2. ✅ 创建虚拟环境（如果不存在）
3. ✅ 安装/更新依赖
4. ✅ 启动 AI 服务
5. ✅ 测试 API 连接

---

### ⚙️ 关键配置

#### .env 文件必填项
```bash
HF_TOKEN=your_huggingface_token_here
```

获取新 Token：https://huggingface.co/settings/tokens

#### Redis 配置（可选）
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

---

### 📊 服务状态验证

成功启动后应该看到：

```
✅ AI 服务已启动，进程ID: 12345
✅ 服务进程正在运行
✅ API 可以访问: http://localhost:8085/
📚 API 文档: http://139.196.165.140:8085/docs
```

API 响应示例：
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

---

## 📚 创建的文档

为了帮助你管理这些服务，我创建了以下文档：

### 本地开发用文档
1. **`BAOTA_AI_SERVICE_CHECKLIST.md`** - 宝塔终端快速检查清单
2. **`AI_SERVICE_QUICK_REFERENCE.md`** - AI 服务快速参考表
3. **`ENVIRONMENT_AND_AI_SERVICE_SUMMARY.md`** - 本文档

### 服务器上的脚本
4. **`/www/wwwroot/cretas/check-ai-service.sh`** - 自动诊断脚本
5. **`/www/wwwroot/cretas/start-ai-service.sh`** - 自动启动脚本

### 详细部署指南
6. **`docs/deployment/AI_SERVICE_DEPLOYMENT_GUIDE.md`** - 完整部署指南

---

## 🔗 三个后端服务对比

| 项目 | 框架 | 语言 | 端口 | 启动位置 | 启动命令 |
|------|------|------|------|---------|---------|
| **Java 后端** | Spring Boot | Java | 10010 | `backend-java` | `mvn spring-boot:run` |
| **AI 服务** | FastAPI | Python | 8085 | `backend-java/backend-ai-chat` | `python scripts/main.py` |
| **前端** | Expo/React Native | TypeScript | 3010 | `frontend/CretasFoodTrace` | `npm start:local` |

---

## ✅ 快速检查清单

### 前端环境配置
- [x] 创建 `.env.local`、`.env.test`、`.env.production`
- [x] 修改 `config.ts` 读取环境变量
- [x] 更新 `package.json` 添加环境脚本
- [x] 安装 `env-cmd` 依赖
- [x] 验证所有环境文件正确加载

### AI 服务检查
- [x] 确认宝塔服务器上有 `backend-ai-chat` 目录
- [x] 创建自动诊断脚本 (`check-ai-service.sh`)
- [x] 创建自动启动脚本 (`start-ai-service.sh`)
- [x] 创建快速参考文档

### 待完成（由你在宝塔上执行）
- [ ] 在宝塔终端运行: `bash /www/wwwroot/cretas/check-ai-service.sh`
- [ ] 确认服务状态（是否已运行）
- [ ] 如需启动: `bash /www/wwwroot/cretas/start-ai-service.sh`
- [ ] 验证 API 可以访问: `curl http://localhost:8085/`

---

## 💡 使用场景示例

### 本地开发
```bash
cd frontend/CretasFoodTrace
npm start:local        # 使用 .env.local，API 地址: 139.196.165.140:10010
npm run android:local  # Android 开发
```

### 测试环境
```bash
npm start:test         # 使用 .env.test
```

### 生产环境
```bash
npm start:production   # 使用 .env.production
```

### 部署到宝塔
1. 编译前端: 在 `frontend/CretasFoodTrace` 运行构建命令
2. 上传构建产物到 `/www/wwwroot/cretas/frontend/`
3. 配置 Nginx 反向代理（如需要）

---

## 🆘 问题排查

### 前端问题
```bash
# 环境变量未加载
echo $REACT_APP_API_URL

# 检查 config.ts 是否正确
cat frontend/CretasFoodTrace/src/constants/config.ts

# 验证 env-cmd 已安装
npm list env-cmd
```

### AI 服务问题
```bash
# 在宝塔终端运行完整诊断
bash /www/wwwroot/cretas/check-ai-service.sh

# 查看详细日志
tail -100 /www/wwwroot/cretas/logs/ai-service.log
```

---

## 📞 需要帮助？

### 快速参考
1. 查看快速参考表: `AI_SERVICE_QUICK_REFERENCE.md`
2. 宝塔检查清单: `BAOTA_AI_SERVICE_CHECKLIST.md`
3. 完整部署指南: `docs/deployment/AI_SERVICE_DEPLOYMENT_GUIDE.md`

### 自动化诊断
```bash
# 在宝塔上运行
bash /www/wwwroot/cretas/check-ai-service.sh
```

### 查看日志
```bash
# 在宝塔上查看
tail -f /www/wwwroot/cretas/logs/ai-service.log
```

---

## 📋 下一步行动

1. **立即**: 在宝塔终端运行 `bash /www/wwwroot/cretas/check-ai-service.sh`
2. **查看结果**: 确认服务是否已运行或需要启动
3. **如需启动**: 运行 `bash /www/wwwroot/cretas/start-ai-service.sh`
4. **验证**: 访问 `http://139.196.165.140:8085/docs` 查看 API 文档

---

**最后更新**: 2025-11-21
**完成度**: ✅ 100% - 所有前端环境配置和 AI 服务检查文档已完成
