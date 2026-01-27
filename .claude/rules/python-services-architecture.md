# Python 服务架构规范

**最后更新**: 2026-01-25

---

## 核心原则

**所有 Python 服务统一部署在一个进程中**，通过模块化组织代码，避免端口和进程泛滥。

---

## 服务结构

```
python-services/ (端口 8083)
├── main.py                      # 统一入口，注册所有路由
├── config.py                    # 全局配置
├── requirements.txt             # 统一依赖
│
├── modules/
│   ├── smartbi/                 # SmartBI 数据分析模块
│   │   ├── __init__.py
│   │   ├── api/                 # API 路由
│   │   │   ├── excel.py         # /api/smartbi/excel/*
│   │   │   ├── analysis.py      # /api/smartbi/analysis/*
│   │   │   ├── chart.py         # /api/smartbi/chart/*
│   │   │   └── forecast.py      # /api/smartbi/forecast/*
│   │   └── services/            # 业务逻辑
│   │
│   ├── error_analysis/          # AI 意图错误分析模块
│   │   ├── __init__.py
│   │   ├── api/                 # /api/error-analysis/*
│   │   └── services/
│   │
│   └── scheduling/              # 调度算法模块
│       ├── __init__.py
│       ├── api/                 # /api/scheduling/*
│       │   └── linucb.py        # /api/scheduling/linucb/*
│       └── services/
│           ├── linucb_service.py
│           └── least_squares_service.py
│
└── common/                      # 公共工具
    ├── __init__.py
    └── utils.py
```

---

## 路由规范

### 主路由

| 模块 | 路由前缀 | 说明 |
|------|----------|------|
| SmartBI | `/api/smartbi/*` | Excel 解析、数据分析、图表、预测 |
| Error Analysis | `/api/error-analysis/*` | AI 意图错误分析 |
| Scheduling | `/api/scheduling/*` | LinUCB、最小二乘法、特征工程 |

### 兼容路由 (Legacy)

为保持 Java 端调用不变，保留以下旧路由：

| 旧路由 | 新路由 | 说明 |
|--------|--------|------|
| `/api/linucb/*` | `/api/scheduling/linucb/*` | LinUCB 算法 |
| `/api/analysis/*` | `/api/error-analysis/*` | 错误分析 |

---

## 添加新模块的步骤

1. **创建模块目录**
   ```
   modules/new_module/
   ├── __init__.py
   ├── api/
   │   └── endpoints.py
   └── services/
       └── service.py
   ```

2. **在 main.py 中注册路由**
   ```python
   from modules.new_module.api import endpoints as new_module_api
   app.include_router(new_module_api.router, prefix="/api/new-module", tags=["NewModule"])
   ```

3. **更新 Java 配置** (如需要)
   - `PythonSmartBIConfig.java` 添加新端点
   - `PythonSmartBIClient.java` 添加调用方法

---

## 禁止事项

- ❌ 不要创建新的独立 Python 服务 (新端口/新进程)
- ❌ 不要在模块外放置业务代码
- ❌ 不要硬编码 URL，使用配置文件

---

## Java 调用 Python 的模式

```java
// 1. 检查 Python 服务可用性
if (pythonClient.isAvailable()) {
    // 2. 尝试 Python 调用
    Optional<Response> result = pythonClient.callMethod(...);
    if (result.isPresent() && result.get().isSuccess()) {
        log.debug("使用 Python 处理");
        return result.get();
    }
}
// 3. Fallback 到 Java 实现
log.debug("使用 Java 处理 (Fallback)");
return javaImplementation(...);
```

---

## 部署

```bash
# 统一部署脚本
./deploy-python-services.sh

# 服务器目录
/www/wwwroot/python-services/

# 启动命令
cd /www/wwwroot/python-services
source venv38/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8083
```

---

## 端口分配

| 端口 | 服务 | 语言 |
|------|------|------|
| 8083 | python-services | Python (统一) |
| 9090 | embedding-service | Java (gRPC) |
| 10010 | cretas-backend | Java |

**注意**: Python 服务只使用 8083 端口，不要分配新端口。
