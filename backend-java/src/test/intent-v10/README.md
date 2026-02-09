# v10.0 意图识别系统测试套件

## 测试目录结构

```
intent-v10/
├── cases/                          # 测试用例文件
│   ├── 01-complex-language.json    # 复杂语言模式 (40条)
│   ├── 02-multi-turn-dialogue.json # 多轮对话 (30条)
│   ├── 03-permission-control.json  # 权限控制 (30条)
│   ├── 04-self-learning.json       # 自学习验证 (20条)
│   ├── 05-rag-consultation.json    # RAG咨询 (30条)
│   ├── 06-write-operations.json    # 写入操作 (30条)
│   └── 07-response-formatting.json # 响应格式化 (20条)
├── results/                        # 测试结果
├── scripts/                        # 测试脚本
│   ├── run-tests.sh               # Bash测试运行器
│   ├── test-runner.js             # Node.js测试运行器
│   └── quick-test.sh              # 快速验证脚本
└── README.md                       # 本文件
```

## 快速开始

### 1. 快速验证 (推荐先运行)

```bash
cd backend-java/src/test/intent-v10/scripts
./quick-test.sh
```

### 2. 运行所有测试 (串行)

```bash
# 使用 Bash
./run-tests.sh all

# 使用 Node.js (推荐，输出更友好)
node test-runner.js all
```

### 3. 并行运行所有测试

```bash
# 使用 Bash
./run-tests.sh parallel

# 使用 Node.js
node test-runner.js parallel
```

### 4. 运行特定类别

```bash
./run-tests.sh 01-complex-language
node test-runner.js 03-permission-control
```

## 测试用例分类

| 类别 | 文件 | 用例数 | 测试目标 |
|------|------|--------|----------|
| 复杂语言 | 01-complex-language.json | 40 | 反问、转折、双重否定、省略 |
| 多轮对话 | 02-multi-turn-dialogue.json | 30 | 参数收集、意图消歧 |
| 权限控制 | 03-permission-control.json | 30 | 角色权限、敏感度审批 |
| 自学习 | 04-self-learning.json | 20 | 表达学习、关键词学习 |
| RAG咨询 | 05-rag-consultation.json | 30 | 知识库、网络搜索 |
| 写入操作 | 06-write-operations.json | 30 | 创建、更新、删除 |
| 响应格式 | 07-response-formatting.json | 20 | 自然语言格式化 |
| **总计** | | **200** | |

## 通过标准

| 类别 | 目标通过率 |
|------|-----------|
| 复杂语言模式 | ≥85% |
| 多轮对话 | ≥90% |
| 权限控制 | 100% |
| 自学习 | ≥80% |
| RAG/搜索 | ≥70% |
| 写入操作 | 100% (敏感操作审批) |
| 响应格式 | 100% |
| **整体** | **≥85%** |

## 测试报告

运行测试后，报告会生成在 `results/` 目录：

- `test_results_YYYYMMDD_HHMMSS.json` - JSON格式详细报告
- `test_results_YYYYMMDD_HHMMSS.md` - Markdown格式报告

## API 配置

| 项目 | 值 |
|------|-----|
| 公开端点 | `http://139.196.165.140:10010/api/public/ai-demo/execute` |
| 认证端点 | `http://139.196.165.140:10010/api/mobile/F001/ai/execute` |
| 登录端点 | `http://139.196.165.140:10010/api/mobile/auth/unified-login` |
| 工厂ID | F001 |

## 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 工厂超级管理员 | factory_admin1 | 123456 |
| 质检员 | quality_insp1 | 123456 |
| 仓储主管 | warehouse_mgr1 | 123456 |
| HR管理员 | hr_admin1 | 123456 |
| 调度员 | dispatcher1 | 123456 |

## 注意事项

1. 确保后端服务运行在 139.196.165.140:10010
2. 权限测试需要对应角色的Token
3. 网络搜索测试依赖外部服务可用性
4. 建议先运行 `quick-test.sh` 验证环境
