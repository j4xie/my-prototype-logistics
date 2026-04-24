# 客户验收 Shadow Test 指南 (v1.0)

**目的**: qa-prompt v2.4 Rule 13 — 真实用户 30 分钟自由点击, 抓自动化 E2E 抓不到的 UX bug。
Apr 20 事故: 客户张权 30min 点出 14 个 bug, 100% 自动化 E2E 漏网。
本指南提供测试账号 + 推荐路径 + bug 报告模板, 方便客户/实施/QA 执行。

---

## 基本信息

| 项目 | 值 |
|---|---|
| **测试环境 URL** | http://139.196.165.140:8097/ |
| **Prod 环境 URL** (仅验收已上线) | https://admin.cretaceousfuture.com/ |
| **测试工厂** | F001 (测试工厂, FACTORY type) / F006 (六膳门, FACTORY type) |
| **浏览器** | Chrome / Edge 最新版, DevTools 打开 Console + Network 面板 |

## 测试账号

| 账号 | 密码 | 角色 | 工厂 | 用途 |
|---|---|---|---|---|
| `factory_admin1` | `123456` | 工厂超管 | F001 | 大部分生产模块 (SO/PO/批次/生产计划/发货/库存/质检) |
| `f006_admin` | `123456` | 工厂管理员 | F006 | 静态客户表单验证 (P2.1/P2.2 docx 修复核对) |

**注意**: `qhj_prod` / 餐饮账号在 test 环境无 RESTAURANT type 工厂, 相关模块不可访问。只在 prod 有效。

## 登录前打开 DevTools

1. F12 打开 Chrome/Edge 开发者工具
2. 切到 **Console** 面板 — 记录任何红色 error
3. 切到 **Network** 面板 — 勾选 "Preserve log", 记录任何 4xx/5xx 请求

---

## 推荐测试路径 (约 30 min)

### 路径 1: 客户信息管理 (5 min) — 验证 Apr 24 PR1 docx 5 items

**账号**: factory_admin1 (F001) 或 f006_admin (F006)

- [ ] 侧边栏 → "销售管理" → "客户管理"
- [ ] 点 "新增" → **不填联系人/电话/收货地址**, 只填客户名称 → 确定. 应成功 (PR1 1.1)
- [ ] 找刚建的客户 → "编辑" → 修改 "状态" 为 "已停用" → 保存. 页面刷新后状态栏应显示 "已停用" (PR1 1.2)
- [ ] 修改联系人 + 电话 + 备注 → 保存. 回详情页验证 3 字段全部更新 (Round 14 W-11 fix)

### 路径 2: 销售订单全链 (10 min) — 验证 PR1 业务员/产品/合同号 + W-03 调整

- [ ] 侧边栏 → "销售管理" → "销售订单" → "新建"
- [ ] **合同号** 字段应 disabled + 显示 "保存后自动生成" (PR1 P1.1)
- [ ] **下单日期** 应默认今天 (Bug A)
- [ ] **业务员** 下拉 → 应显示员工列表 (非自由文本) (PR1 P1.2)
- [ ] 客户 → 选一个
- [ ] **产品** 下拉 → 应可模糊搜索, 选一个产品 (PR1 P1.3)
- [ ] 规格 + 数量 + 单位 (应默认 kg) + 单价 (Bug C)
- [ ] 保存 → 订单成功, 列表 +1, 合同号自动生成 (SO-YYYYMMDD-NNNN 格式)
- [ ] 点进详情 → **业务员应显示员工姓名不是 UUID** (Bug E)
- [ ] 订单详情页切 "关联采购" tab → 点 "在此创建采购订单" 按钮, 或到 /procurement/orders 新建 PO 选相同客户/SO ⚠️ (W-12 已知 bug: 目前即使创建成功也不会回显到此 tab, 需 backend feature fix)

### 路径 3: 采购订单 (5 min) — 验证 PR1 同根因覆盖

- [ ] 侧边栏 → "采购管理" → "采购订单" → "新建"
- [ ] **供应商** 下拉 → 应选一个 (PR1 equivalent)
- [ ] 添加行 → **原料** 选择 → 数量 → **单位默认 kg** + 可选 (Bug C-PO)
- [ ] 保存 → 成功, 列表 +1
- [ ] 详情页 → **供应商显示名称不是 UUID** (Bug E-PO)
- [ ] 列表状态 tag 应显示中文 (草稿/已提交/已审批, 不是 DRAFT/SUBMITTED) (Bug J-PO)

### 路径 4: 原材料批次 + 库存调整 (5 min) — 验证 W-02/W-04/W-06/W-03

- [ ] 侧边栏 → "仓储管理" → "原材料批次" → "入库登记"
- [ ] 选原料, 填数量, **总价值** 应自动计算 (如原料无单价, 应有提示 "请手动输入总价值" W-02)
- [ ] 填过期日期 → 保存 (W-04 前: PUT 200 但过期日期不入库; 现应正确持久化)
- [ ] 编辑刚建的批次 → 改数量 + 过期日期 → 保存 → 再打开验证字段变化 (W-04)
- [ ] 侧边栏 → "仓储管理" → "盘点管理"
- [ ] 找一个批次点 "调整" → 输入负数 (如 -5) → "调整后数量" 应实时显示 → 提交 → 批次数量应正确减少 (W-03)
- [ ] 输入负数过大 (如 -999) → "调整后数量" 应标红 + 确定按钮应 disabled (W-03 guard)

### 路径 5: 出货管理 (3 min) — 验证 W-01 P0 恢复

- [ ] 侧边栏 → "仓储管理" → "出货管理" → "新建出货"
- [ ] 客户 → 选
- [ ] 产品批次 → 选
- [ ] **发货日期** 应自动默认今天 (W-01 字段新增)
- [ ] 数量 / 车牌 / 司机 / 司机电话 → 填
- [ ] 提交 → 应成功 (W-01 前: 100% 400 失败)
- [ ] 详情页 → **车牌/司机/电话** 应显示用户输入 (V20260424_01 columns)

### 路径 6: 边缘 UX 错误 (2 min) — 验证 W-08/W-10 Rule 8 合规

操作: 尝试故意触发错误, 观察 toast 文案:

- [ ] 任一模块新建表单 → 留空必填字段 → 提交. Toast 应显示 **具体字段名** + 什么不对 (如 "字段 'type' 不能为空"), **不是** "must not be null"
- [ ] 任一模块更新 → 通过 DevTools Network 篡改 request body 送错类型 → Response body `message` 应含 **具体类型** + actionHint 字段

---

## Bug 报告模板 (按这个格式提交)

```markdown
### Bug #X — 一行症状

**环境**: test / prod
**账号**: factory_admin1
**复现路径**:
1. 侧边栏 → ...
2. 点 ...
3. 输入 ...
4. 点保存

**实际行为**: toast "创建失败" / console 红色 / UI 卡住
**期望行为**: toast "创建成功" / 无 error / 列表刷新 +1

**证据**:
- 时间戳: 2026-04-24 10:30:15
- Network request: POST /api/mobile/F001/sales/orders → 400
- Response body: `{"message":"..."}`
- Console error: `...`
- 截图: (如有)

**Severity**: P0 (blocker) / P1 (important) / P2 (UX) / Minor
```

## 测试期间应观察的 6 类症状

| 症状 | 分类 | 例子 |
|---|---|---|
| 点保存无 toast 但数据没变 | silent-drop bug | (W-04/W-06 类已修 9 处, 若再次出现立刻报) |
| Toast 文案是 "操作失败" / "请求失败" 泛泛 | UX bug (吞 message) | 后端明明返错但前端没显示原因 |
| Toast 3 秒闪过看不清 | UX bug (非 sticky) | error 必须 duration:0 + showClose |
| 侧边栏菜单某模块消失 | RBAC bug 或 factoryType filter | 检查控制台 user 角色 + factory type |
| 跨模块数据对不上 (SO 详情 Tab 计数 != 列表) | 数据一致性 bug | (W-12 SO→PO 已知, 其他 Tab 应 OK) |
| Console 红色 JS error | Frontend runtime error | 截图 + Network 对应请求 |

## 提交 bug 报告

- 方式 1: 直接发到 Claude Chat 记 session
- 方式 2: 推 GitHub issue / Linear / 内部 tracker (项目未定)
- 方式 3: 写到 `流程实际测试/99-pending-followup.md` 追加

---

## 与自动化 E2E 的分工

| 维度 | 自动化 E2E (qa-round*) | 客户 Shadow test (本指南) |
|---|---|---|
| 强项 | wire-level silent-drop / 新功能 CRUD / 批量回归 | "新功能看起来怪怪的" / "我点了但没反应" / "这个按钮应该跳哪" |
| 弱项 | UX 主观感受 / 未规划路径 | 覆盖广但不深入 / 复现路径不一定精确 |
| 覆盖关系 | 必做 + 代码 PR 门禁 | 大版本前 + 客户发版 / Apr 20 14 bug 全靠这种方式 |
| 频率 | 每 commit / PR | 每大版本 1-2 次 |

**结论**: 两者互补, 不能互相替代。自动化保证新功能正确, shadow test 保证老功能没烂。

---

## 历史事故速查 (防重蹈覆辙)

- **Apr 20 2026**: 客户张权 30min 手工点 14 bug, 全部自动化 E2E 漏网 → 催生本指南 (qa-prompt Rule 13)
- **Apr 22 2026**: 客户报 "仓储管理没了" → prod F001 type=RESTAURANT 触发 filter 屏蔽菜单 → 证明 test/prod 不一致 Bug 靠 shadow test 才能抓
- **Apr 24 2026**: 本 session Round 10 Rule 8 skip → retroactive audit 抓 W-08/W-10 → 证明 error path UX 也要测, 不能用 "非主路径" 当借口
