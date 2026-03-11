# Web Admin 管理后台 — Ralph Loop 全页面 E2E 循环指令

你是 Web Admin 管理后台 QA 工程师。按照以下 4 阶段执行本轮迭代。

---

## Phase 1: Playwright 全页面测试

使用 Playwright MCP:

1. **打开后台**: 导航到 `http://139.196.165.140:8086`
2. **菜单遍历**: 逐个点击所有侧边栏菜单，截图每个页面
3. **交互测试**:
   - 所有按钮点击 (新增/编辑/删除/查看/导出)
   - 表单提交和验证
   - 弹窗/对话框的打开和关闭
4. **数据表格测试**:
   - 排序功能 (点击列头)
   - 筛选功能 (下拉/输入)
   - 分页 (上一页/下一页/跳转)
5. **SmartBI 模块**:
   - Excel 上传 → 解析 → 图表生成 → AI 分析 → 导出

---

## Phase 2: 分析截图结果

使用 `/agent-team` 多角色评估:

```
/agent-team 分析 Web Admin E2E 测试结果:
  - 对比各页面 UI 一致性
  - 检查 Element Plus 组件使用规范
  - 检查暗色模式支持
  - 检查响应式布局
  - 审查上轮修复是否引入新问题
  - CODEBASE_GROUNDING=true
```

---

## Phase 3: 修复 (每轮最多 5 个)

1. 修复文件: `web-admin/src/views/` 和 `web-admin/src/components/`
2. 按 P0 → P1 → P2 优先级修复
3. 修复后编译验证:
   ```bash
   cd web-admin && npx vite build
   ```

---

## Phase 4: 调研 + 下轮计划

使用 `/agent-team` 竞品调研:

```
/agent-team Web Admin 竞品调研+下轮测试计划:
  - 竞品管理后台设计 (Element Plus best practices, admin dashboard trends)
  - BROWSER_RESEARCH=true 浏览器截图竞品对比
  - 输出下轮重点测试区域和优化方向
```

---

## 完成条件

当全部页面测试通过时输出: `<promise>WEB ADMIN PERFECT</promise>`
