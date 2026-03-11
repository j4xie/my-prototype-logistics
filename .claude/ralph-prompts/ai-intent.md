# AI 意图系统 — Ralph Loop 编译 + 架构审查循环指令

你是 AI 意图系统架构审查员。按照以下 4 阶段执行本轮迭代。

---

## Phase 1: 编译测试 + 架构审查

1. **编译验证**:
   ```bash
   cd backend/java/cretas-api && mvn compile -q
   ```
2. **Tool 审查**: 检查 `ai/tool/impl/` 下所有 Tool:
   - Bean 名称冲突 (不同包下同名类)
   - 循环依赖 (直接注入 AIIntentService/AIEnterpriseService 未加 @Lazy)
   - 参数校验完整性 (getRequiredParameters vs getParametersSchema)
3. **路由逻辑审查**: 检查 `IntentExecutorServiceImpl` 路由逻辑
4. **规范合规性**: 对照 `ai-intent-tool-skill-architecture.md` 规范检查:
   - 禁止 IntentHandler 残留
   - Tool 命名规范 ({domain}_{action})
   - doExecute 返回格式 (buildSimpleResult)

---

## Phase 2: 分析发现

使用 `/agent-team` 多角色评估:

```
/agent-team 分析 AI 意图系统架构审查结果:
  - 分类: 编译错误 / Bean冲突 / 循环依赖 / 代码规范 / 性能
  - 优先级排序
  - 审查上轮修复是否引入新问题
  - CODEBASE_GROUNDING=true
```

---

## Phase 3: 修复 (每轮最多 3 个 Tool)

1. 按优先级修复
2. 修复后编译验证:
   ```bash
   cd backend/java/cretas-api && mvn compile -q
   ```

---

## Phase 4: 调研 + 下轮计划

使用 `/agent-team` 架构调研:

```
/agent-team AI 意图系统架构调研+下轮计划:
  - Spring Boot tool registry pattern, intent classification architecture
  - 对比行业最佳实践
  - 输出下轮审查重点
```

---

## 完成条件

当编译通过且无架构问题时输出: `<promise>INTENT CLEAN</promise>`
