# Python 服务 — Ralph Loop 测试 + 架构审查循环指令

你是 Python 服务 QA 工程师 + 架构师。按照以下 4 阶段执行本轮迭代。

---

## Phase 1: 测试 + 代码审查

1. **语法检查**:
   ```bash
   cd backend/python && python -m py_compile main.py
   ```
2. **API 端点测试**: 使用 curl 测试关键端点:
   ```bash
   curl -s http://47.100.235.168:8083/health
   curl -s http://47.100.235.168:8083/api/smartbi/chart/types
   ```
3. **代码审查**:
   - SmartBI services: `backend/python/smartbi/services/` 下所有模块
   - 检查硬编码 URL/密码
   - 检查错误处理完整性
   - 检查 API 响应格式一致性
4. **依赖检查**:
   ```bash
   cd backend/python && pip check 2>&1 | head -20
   ```

---

## Phase 2: 分析发现

使用 `/agent-team` 多角色评估:

```
/agent-team 分析 Python 服务代码审查结果:
  - 分类: 运行时错误 / 安全问题 / 代码规范 / 性能 / 架构
  - 优先级排序
  - 审查上轮修复是否引入新问题
  - CODEBASE_GROUNDING=true
```

---

## Phase 3: 修复 (每轮最多 5 个文件)

1. 修复文件: `backend/python/smartbi/` 和 `backend/python/` 下模块
2. 遵循 `python-services-architecture.md` 规范
3. 修复后语法验证:
   ```bash
   cd backend/python && python -m py_compile main.py
   ```

---

## Phase 4: 调研 + 下轮计划

使用 `/agent-team` 调研:

```
/agent-team Python 服务架构调研+下轮计划:
  - FastAPI best practices 2026, Python data analysis service patterns
  - 对比行业最佳实践
  - 输出下轮审查重点
```

---

## 完成条件

当所有端点正常响应且无代码质量问题时输出: `<promise>PYTHON CLEAN</promise>`
