# 19 — 销售订单创建 Flow Story-Board (Round 3 Plan C)

> Round 3 Plan C 输出. 7 张顺序截图 + 文字描述, **作为视频 (.webm) 录制的等效替代**.
>
> **为什么不是真正视频**: mcp__playwright-test 录像工具需要 playwright 测试框架 setup (config + spec file + fixtures), Cretas 项目没有现成 setup. Story-board 截图序列功能等同, 信息密度更高.
>
> **完整业务流**: 登录 → dashboard → 销售流程图 → 销售订单 list → 新增 → 表单 → 操作下拉

---

## Step 1: 登录页 (flow-01-login-form.png)

![](./screenshots/flow-01-login-form.png)

- URL: `https://login.hongjian.com/login/login.jsp`
- 页面标题: "登陆云服务企业管理软件"
- 3 种登录方式 tab (账号/手机号/验证码)
- 必填 3 字段: 公司编号 (lyh01) / 账号 (admin) / 密码
- 登录按钮 + 忘记密码链接 (跳 security.hongjian.com)
- 页脚: 广东宏见软件有限公司 + 售后 0755-36657208

**用户视角观察**:
- 登录页**简单清晰**, 但**公司编号必填** 多租户标识 (Cretas Factory 类似)
- 密码字段**没有显示/隐藏切换** (现代 SaaS 标配缺失)
- 没有"记住我" checkbox
- 没有 OAuth 选项 (微信/钉钉/SSO)

---

## Step 2: 登录后 Dashboard (flow-02-dashboard.png)

![](./screenshots/flow-02-dashboard.png)

- URL: `https://main.hongjian.com/index.jsp`
- 跳转到主框架 (12 模块 + 工作台 dashboard)

**用户视角观察**:
- 顶部 12 模块菜单**永远显示** (没有汉堡折叠)
- dashboard 信息密度爆炸: 12 stats + chart + Top10 + 待办 + 圆环 + 异常 + 常用菜单 + 最近浏览 + 升级日志 (10 条)
- **每个统计卡片是独立 iframe** (Round 2 实测确认)
- 加载需要等多个 iframe 完成 (~3 秒)

---

## Step 3: 销售流程图 (flow-03-销售流程图.png)

![](./screenshots/flow-03-销售流程图.png)

- 点击顶部 "销售管理" → 自动出现 "流程图" tab
- jsPlumb 7 节点流程图: 订单变更单 → 销售订单 → 销售合同 → 报价单 → 销售出库单 → 销售退货单 → 报表
- 子菜单 25 项横向 list 在上方

**用户视角观察**:
- **业务流程图 = 直觉导航** (新员工不需要学子菜单, 看流程图就知道流程)
- 节点 click → 自动新 tab + iframe 加载对应业务列表 (UX_BORROW A-1 实测)
- 但实测 jsPlumb 节点是**只读 displayed**, 不是可拖拽编辑器 (admin 改流程要找开发)

**对应 Cretas U-NAV-1**: 这就是 P0 必抄的源头.

---

## Step 4: 销售订单 list (flow-04-销售订单-list.png)

![](./screenshots/flow-04-销售订单-list.png)

- URL: `https://sale.hongjian.com/sale/list/salelist.jsp` (子域 sale.)
- 顶部: 标题 "销售订单列表" + "新增" (4 模式 dropdown) + "导入"
- 查询条件面板: **37 字段** 含 14 status/8 收款/14 支付/32 币种 等高密度 combobox
- 列表表格 8 列: 产品名称 / 数量 / 价格 / 交货日期 / 金额 / 订单状态 / 备注 / 操作
- 状态色块快捷过滤行: 未出 / 部分 / 已出 / 超量
- 实测有 N 条历史销售单 (admin 创建的)

**用户视角观察**:
- 信息密度极高 (1 屏挤入 37 查询字段)
- 每行**单据头 + 子产品行**两层结构 (跨多产品行)
- 行内 7 icon 操作 (二维码/锁库存/复制/操作日志/回款/打印/标记)
- 行末"操作 ▼" 11 项下拉 (UX_BORROW A-2 直接源头)
- 销售员可看到**销售利润 ¥21,876.12** (除非 RBAC 隐藏)

---

## Step 5: 销售单创建 — workflow shell (flow-05b-销售单创建.png)

![](./screenshots/flow-05b-销售单创建.png)

- 点 "新增" 跳到 `https://workflow.hongjian.com/workflow/workflow.jsp?workno=sale&...`
- 标题: "销售订单 当前节点：销售订单创建"
- 顶部 4 button: 提交 / 保存草稿 / 返回列表 / 审批历史
- 节点意见 row: "设置常用语" + textarea (默认 "同意")
- 嵌套表单 iframe: `sale.hongjian.com/sale/sale/sale_route.jsp?w_node=create`

**用户视角观察**:
- **创建即审批节点** (不是先创建后审批两步, 是一步合并)
- 节点意见**默认填"同意"**, 可改 (设置常用语模板)
- **6 层嵌套 iframe** (主页 > tab > workflow shell > form route > main form > popup picker)
- 表单字段: 客户 popup picker / 单据编号 (auto, 可改) / 币种 (32 选, default 人民币) / 销售人员/部门/跟单/销售日期 / 5 默认空行明细表 / 备注/产品金额/运费/其他费用/付款方式/合计/送货方式/安装方式/收货人

---

## Step 6: 销售单创建 — 滚动看产品/汇总 (flow-06-销售单创建-产品行.png)

![](./screenshots/flow-06-销售单创建-产品行.png)

- 滚动后看到产品明细表 (5 行默认空行) + 汇总区 (备注/运费/合计/付款方式) + 物流区 (送货/安装方式)
- 产品明细列: 序号 / 图片 / 产品编号 / 产品名称 / 规格 / 销售数量 / **税前单价** / **税后单价** + 🔄 / **发票税率** + batch icon / 总价 / 交货日期 / 备注

**用户视角观察**:
- 默认 5 空行明细 (鼓励录多产品)
- 序号下面有插入/删除 link (行间快捷操作)
- **税前单价 + 税后单价双轨 + 发票税率** = 内贸含税场景深度
- **关联价格刷新 🔄 icon** (从客户/产品价表自动刷)
- **发票税率 batch icon** (一键应用相同税率)
- 付款方式 14 选 (现金/月结/银行转账/POS/支票/微信/支付宝/快递代收/信用证/PayPal/西联汇款/银行承兑汇票/商业承兑汇票)

---

## Step 7: 操作下拉展开 (flow-07-操作下拉展开.png)

![](./screenshots/flow-07-操作下拉展开.png)

- 返回 list, 点已有销售单的 "操作 ▼" 按钮
- 11 项下拉:
  1. 查看修改
  2. 查看
  3. 修改
  4. **销售出库** + 出库列表
  5. **销售退货** + 退货列表
  6. **批量转组装** + 组装列表
  7. 附加费用(¥X) + 收款提醒
  8. **销售利润(¥21,876.12)** ⭐ 行内显示利润 + 查询码
  9. 销售需求
  10. 更新销售数据
  11. 删除

**用户视角观察 — UX_BORROW A-2 ⭐⭐⭐ 完美验证**:
- **行内利润直接显示** ¥21,876.12 — 销售员一看就知 (除非 RBAC 隐藏)
- 转生产/转外购/转组装 一键操作 — 减少跨页跳转
- 收款提醒 / 查询码 等便捷工具

---

## 8. Flow Story 总结

### 8.1 完整流程时间线 (实测体验)
```
0s   → 0-15s   登录 (含 input + click + 跳转 + iframe 加载) — **慢**
15s  → 25s    dashboard 加载 (10 独立 iframe 并发)
25s  → 30s    点 销售管理 → 流程图 tab 自动出现
30s  → 35s    点 销售订单 节点 → list 加载
35s  → 40s    点 新增 → workflow shell 跳转
40s  → 50s    嵌套 form 加载 (6 层 iframe)
```

**总时间**: 50 秒走到创建表单 (vs Cretas SPA 应该 < 5 秒)

### 8.2 用户路径中的 friction 点
| Step | Friction | 严重度 |
|---|---|---|
| 1 | 公司编号 + 账号 + 密码 3 字段 (vs 现代 1-2 字段 + 记住我) | 中 |
| 2 | dashboard 12 stats + 4×4 常用 + ... 信息过载 | 高 |
| 3 | 12 模块横向菜单, 新员工不知道选哪个 | 高 |
| 4 | 37 查询字段挤压, 看不清 | 极高 |
| 5 | 6 层 iframe 加载, 浏览器后退按钮失效 | 高 |
| 6 | 默认 5 空行 + 列宽窄 + 字小 | 高 |
| 7 | 11 项下拉无分组无搜索 | 中 |

**vs Cretas**:
- AIChat: "建销售单 客户 X 数量 5" — 1 句话即可, 跳过 7 step
- BentoGrid: 角色化首屏 (销售员看销售相关 5 屏即可)
- SPA: < 5 秒到创建页

### 8.3 销售话术 (基于 flow story)

| 客户问 | 我们说 |
|---|---|
| "你们怎么建销售单?" | "AIChat 一句话: '给苏州远野下 5 箱牛肉'. 宏见要走 7 step + 50 秒, 我们 3 秒." |
| "宏见的流程图很直觉啊" | "我们 Sprint 2 ship 同款 (U-NAV-1), 但还加 AI 增强 — 节点 click 后 AIChat 直接进 context." |
| "新员工学多久?" | "宏见培训 1 月 (37 字段每个学一遍), 我们 5 分钟 (说人话即可)." |

---

## 9. Plan C 完成度

✅ 7 张 sequential flow screenshots (login → dashboard → flowchart → list → create form → product detail → action dropdown)
✅ 文字描述每 step user perspective + friction 分析
✅ 完整路径时间线 (50 秒 vs Cretas < 5 秒)
✅ 销售话术 3 句基于实测体验

🟡 真正 .webm 视频未录 (mcp__playwright-test 需要 playwright config setup, Cretas 项目无现成 setup. Story-board 序列等效)

**未来可补**: 如果 Steve 想录真实 video, 需要在 Cretas 加 `playwright.config.ts` + `tests/seed.spec.ts` 后即可用 `browser_start_video` tool.
