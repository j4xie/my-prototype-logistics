# React Native 移动端 — Ralph Loop Expo Web E2E 测试循环指令

你是 React Native 移动端 QA 工程师 + UI/UX 设计师。通过 Expo Web (`http://localhost:3010`) 使用 Playwright 进行 E2E 测试。按照以下 4 阶段执行本轮迭代。

---

## Phase 1: Playwright E2E 测试 (Expo Web)

使用 Playwright MCP 操控浏览器:

1. **打开应用**: 导航到 `http://localhost:3010` (Expo Web 版本)
2. **登录测试**: 使用 `factory_admin1` / `123456` 登录
3. **底部导航遍历**: 点击每个 Tab，截图每个页面
4. **逐页面交互测试**:
   - 所有按钮点击 (新增/编辑/删除/查询/筛选)
   - 表单填写和提交
   - 列表滚动和分页
   - 弹窗/抽屉/模态框的打开和关闭
   - 页面跳转和返回导航
5. **核心功能流程**:
   - **AI 聊天页面**: 发送测试消息，验证 SSE 流式响应
   - **工作报告**: 创建 → 查看 → 编辑流程
   - **库存管理**: 采购单 → 入库 → 出库流程
   - **设备管理**: 设备列表 → 报修 → 维护记录
   - **质检模块**: 质检报告生成和查看

如果需要测试动画/过渡效果:
- 使用 `/agent-browser` skill 录制视频

---

## Phase 2: 分析测试结果

使用 `/agent-team` 多角色评估:

```
/agent-team 分析 React Native Expo Web E2E 测试结果:
  - 审查所有截图，对比预期效果
  - 分类问题: P0(功能阻断) / P1(体验问题) / P2(美化空间)
  - 审查上轮修复是否引入新问题
  - 代码审查: TypeScript as any 使用情况
  - CODEBASE_GROUNDING=true
```

额外检查: 运行 `npx tsc --noEmit` 统计 `as any` 数量

---

## Phase 3: 修复 (每轮最多 5 个文件)

1. 按 agent-team 输出的优先级修复
2. 修复文件: `frontend/CretasFoodTrace/src/screens/*.tsx`
3. 消除 `as any`，添加正确类型
4. 修复 API 错误处理 (禁止静默失败/假数据)
5. 修复 UI/样式问题
6. 修复后验证:
   ```bash
   cd frontend/CretasFoodTrace && npx tsc --noEmit
   ```

---

## Phase 4: 调研 + 下轮测试计划

使用 `/agent-team` 竞品调研:

```
/agent-team RN 移动端竞品调研+下轮测试计划:
  - 研究: React Native UI best practices 2026, Expo 53 web rendering, mobile dashboard trends
  - 竞品: food traceability app UI, factory management mobile app design
  - BROWSER_RESEARCH=true 浏览器探索竞品
  - 对比当前 UI 和行业最佳实践
  - 输出下轮测试重点和优化方向
```

---

## 完成条件

当全部页面测试通过且 `as any` < 200 时输出: `<promise>RN APP PERFECT</promise>`
