# 15. Playwright 自动化回归测试

**作用**: 每次部署后 5 分钟跑完基础回归, 替代手动 30 分钟
**脚本**: `tests/bug-verify-2026-04-15/verify-17-full.mjs`
**环境**: headed Chrome (真实窗口), slowMo=150ms, 全 console/pageerror/network 监听

---

## 15.1 前置要求

### Node.js + Playwright
```bash
node --version   # >= 18
cd C:\Users\Steve\my-prototype-logistics
ls node_modules/playwright   # 应存在
```

若无 playwright:
```bash
npm install -D playwright
npx playwright install chromium
```

---

## 15.2 快速执行

```bash
cd C:\Users\Steve\my-prototype-logistics
node tests/bug-verify-2026-04-15/verify-17-full.mjs
```

**会自动**:
1. 打开真实 Chromium 窗口 (1440×900)
2. 访问 `http://139.196.165.140:8086/`
3. 登录 `admin / 123456`
4. 依次跑 16 个 phase (login + 15 bug)
5. 每步慢速 150ms 便于观察
6. 输出报告 + 截图

---

## 15.3 期望输出

```
════════ login 登录 ════════
  URL: http://139.196.165.140:8086/dashboard
  → ✅ PASS  (pageerr=0, http4xx=0)

════════ #1 Canvas 配置编辑器 应无 403 ════════
  body 含 403: NO ✅
  → ✅ PASS

...

═══════════ 最终汇总 ═══════════
✅ login    pageErr=0 consoleErr=0 http4xx=0
✅ #1       pageErr=0 consoleErr=0 http4xx=0
...
✅ #15      pageErr=0 consoleErr=0 http4xx=0

总: pageerror=0, console.error=0, HTTP 4xx=0
失败 phase: 无 ✅
双前缀 URL 请求: 0 ✅
```

### 通过标准
- **任一 ❌**: 失败, 对应 bug 可能复活
- **console.error 非 0**: 浏览器有红色错误
- **HTTP 4xx > 0**: 后端调用失败
- **双前缀 URL > 0**: URL 构造 bug 复活 (关键!)

---

## 15.4 输出文件

| 文件 | 内容 |
|------|------|
| `full-17-report.json` | 每 phase 的 console/pageerror/http4xx 详细日志 |
| `screenshots/17full/*.png` | 每步截图 (便于看 UI 实际状态) |

---

## 15.5 排错

### 失败情况 1: 登录失败
```
ERR login: locator.click: Timeout 30000ms exceeded
```

可能原因:
- 后端服务挂 → `curl https://www.cretaceousfuture.com/api/mobile/health`
- admin 账号被禁 → `ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_prod_db -c \"SELECT is_active FROM users WHERE username='admin'\""`

### 失败情况 2: #4 双前缀 URL 复活
```
❌ 403 http://.../api/mobile/api/mobile/F001/customers
```

原因:
- `ReferenceSelector.vue` 修改被回滚
- 或新增模块 apiEndpoint 又写了绝对路径

修复: 检查最近的 commit, grep `'/api/mobile/` 绝对路径

### 失败情况 3: 全部 ERR (Chromium 没启动)
- 检查 `playwright install chromium`
- 查 `node --version >= 18`

---

## 15.6 扩展自动化

### 添加新 phase
编辑 `verify-17-full.mjs`, 按现有模板加:

```javascript
await phase('#N', '新功能验证', async () => {
  await page.goto(`${BASE}/new-feature`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const btn = page.locator('button').filter({ hasText: /新功能/ }).first();
  if (await btn.count() > 0) {
    await btn.click();
    await page.waitForTimeout(2000);
  }
  await shot('N-new-feature');
});
```

### 集成 CI
```bash
# 每次 web-admin 部署后
bash scripts/deploy/deploy-web-admin.sh && \
  node tests/bug-verify-2026-04-15/verify-17-full.mjs
```

若自动化失败可 fail CI pipeline.

---

## 15.7 其他自动脚本 (业务链路)

### `test-e2e-business-chain.mjs` (API level, 9 步)
```bash
node test-e2e-business-chain.mjs
```
- 非 UI, 直接调 API
- 9/9 PASS 标准
- 快 (2-3 min)
- 覆盖: sample→quote→SO→finance→purchase+BOM→plan→report→delivery→invoice+payment

**与 verify-17-full 区别**:
- verify-17-full: UI 层, 17 bug 回归
- business-chain: API 层, 业务链正确性

两者配合用, 全覆盖.

---

## 15.8 自动化不能替代手工的场景

| 场景 | 为什么 |
|------|-------|
| 客户演示 | 需真人讲解 + 应变 |
| ⭐ 税率分组 G1 对话框细节验证 | UI 显示细节 (卡片布局/字体/颜色) 自动化难断 |
| 跨浏览器兼容 (Safari/Firefox) | 脚本只测 Chromium |
| 真人感知 (卡顿/丑) | 主观体验 |
| 跨账号角色权限细节 | 脚本只用 admin, 16 角色需手测 |

---

## 15.9 本节 Checklist (6 项)

| 项 | 勾选 |
|---|------|
| Playwright 安装完 | ☐ |
| verify-17-full.mjs 跑通 16/16 PASS | ☐ ⭐ |
| 报告 full-17-report.json 生成 | ☐ |
| 截图 screenshots/17full/ 齐 | ☐ |
| 无双前缀 URL (关键质量门) | ☐ ⭐⭐ |
| 集成到 CI (可选) | ☐ |

---

## 15.10 下一步

- [16-full-checklist.md](16-full-checklist.md) 完整交付 checklist
