# 工厂版操作手册 Phase 0 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `factory-operation-manual.html` 顶部新增 §0A AI Query + §0B 财务 PBI 两个 Tier 1 production-grade 章节（每章 8 sub-section + FAQ），重新入库 KB（subcategory='factory'），部署到 prod，smoke test 通过。

**Architecture:** Hybrid 重组 — 保留现有 7236 行 dev/QA 风格内容作深度参考，章节头部新增 2 章产品手册风格章节（仿餐饮版 §1/§2 的 8-section 模板：概述 + 进入路径 + layout + 操作步骤 + 错误处理 + 关键指标速查 + 业务判断框架 + 跨章联动 + 决策场景 + FAQ）。两章作为 KB 的工厂域内容 lift，配合现有 287 chunks。

**Tech Stack:** HTML（vanilla 嵌套 `<section><h1><h2>` + `<table>` + 现有 CSS classes）、Python 3.8（manual_ingester.py）、PostgreSQL（food_knowledge_documents 表）、bash（部署 + smoke test）。

**Spec Reference:** `docs/superpowers/specs/2026-04-29-factory-product-manual-design.md`

---

## File Structure

| 文件 | 操作 | 内容 |
|------|------|------|
| `docs/plans/factory-operation-manual.html` | 修改 | 在 TOC 后、SECTION 1 前插入 §0A + §0B 两个 `<section>` 块；TOC 加 §0A / §0B 链接 |
| `web-admin/public/factory-operation-manual.html` | 同步 | 复制自 `docs/plans/factory-operation-manual.html`（同一份，公开访问用） |
| 服务器 47:/www/wwwroot/cretas/code/backend/python/food_kb/services/manual_ingester.py | 不改 | 已支持 factory.html，atomic swap 重入库 |
| 服务器 139:/www/wwwroot/web-admin/factory-operation-manual.html | 部署目标 | scp 推送，aiassist + web-admin 都读这个 |

---

## Task 1: 定位插入点 + 备份

**Files:**
- Read: `docs/plans/factory-operation-manual.html`

- [ ] **Step 1: 定位 §0A/§0B 插入位置**

```bash
cd C:\Users\Steve\my-prototype-logistics
grep -n "目录 (Table of Contents)\|SECTION 1\|<!-- SECTION 1\|section1\|系统概览与测试账号" docs/plans/factory-operation-manual.html | head -10
```

预期输出：能看到 TOC 在约 446-475 行，SECTION 1 anchor 在 481 行附近。
**§0A 插入位置 = 现有 SECTION 1 注释/anchor 之前**（约第 478 行 `<!-- SECTION 1: SYSTEM OVERVIEW -->` 那一行的前一行）。

- [ ] **Step 2: 备份原 HTML 文件**

```bash
cp docs/plans/factory-operation-manual.html docs/plans/factory-operation-manual.html.bak
ls -la docs/plans/factory-operation-manual.html*
```

预期：备份文件 `.bak` 存在，与原文件大小一致（299290 bytes）。

- [ ] **Step 3: 记录当前 KB 工厂 chunks 基线**

```bash
ssh root@47.100.235.168 "PGPASSWORD=cretas123 psql -h localhost -U cretas_user -d cretas_prod_db -c \"SELECT subcategory, COUNT(*) FROM food_knowledge_documents WHERE source='factory-operation-manual.html' GROUP BY subcategory;\""
```

预期：`factory | 287` 左右。**记下这个数字作为基线**，Task 7 验证用。

---

## Task 2: 写 §0A 智能数据分析 (AI Query) 章节

**Files:**
- Modify: `docs/plans/factory-operation-manual.html`（在 SECTION 1 注释前插入 §0A `<section>` 块）

- [ ] **Step 1: 在 §1 SECTION 1 前插入 §0A 完整章节 HTML**

定位到 `<!-- SECTION 1: SYSTEM OVERVIEW -->` 这行（用 Read tool 找到精确行号），在它之前插入下面这一整段 HTML。**完整复制不要省略**：

```html
<!-- ============================================================ -->
<!-- §0A: AI Query (Tier 1 production-grade)                       -->
<!-- ============================================================ -->
<section id="ch0a">
  <h1>§0A 智能数据分析 (AI Query)</h1>
  <!-- last-verified-against-product: 2026-04-29 -->
  <p class="overview">智能数据分析 (AI Query) 是白垩纪 SaaS 的<strong>数据分析入口</strong>，允许工厂用户用自然语言直接提问，例如"本月哪条产线 OEE 最低？"或"上周哪个 SKU 损耗率最高？"，无需编写 SQL 或配置 BI 报表。系统自动识别字段、执行聚合、生成图表并输出文字解读。适合厂长、生产主管、品控经理等管理岗位日常监控经营数据。<strong>与本手册 §12 "AI 对话" 章节的区别</strong>：§12 是系统内置 LLM 助手用于<strong>辅助操作</strong>（如 AI 创建生产计划、AI 推荐配方）；§0A 是 <strong>Excel 上传 + 数据集分析</strong>，专注于<strong>数据洞察</strong> — 一个执行命令，一个解读数字，不重叠。让前线班组长也能独立获取数据洞察，无需依赖 IT 配置。</p>

  <h2 id="ch0a-1">§0A.1 进入路径</h2>
  <p>进入 AI Query 有两条路径：</p>
  <ol>
    <li><strong>菜单导航路径（推荐）</strong>：登录 Web Admin 后台后，点击左侧导航栏"智能 BI"分组，再点击"智能数据分析"，进入 AI Query 主页面。</li>
    <li><strong>Dashboard 快捷入口</strong>：在首页 Dashboard 右上角的"快捷分析"卡片中，点击预设场景按钮（如"今日产量"、"本周良品率"、"产线 OEE"），系统直接跳转到 AI Query 并自动发送预设问题。</li>
  </ol>
  <div class="tip">新员工提示：第一次使用前，请确认负责人已为你的账号配置数据集访问权限。若进入后看不到任何数据集，联系工厂管理员开通"智能 BI"权限。</div>

  <h2 id="ch0a-2">§0A.2 主界面 layout</h2>
  <p>AI Query 页面由四个主要区块组成：</p>
  <table>
    <thead><tr><th>区块</th><th>位置</th><th>功能说明</th></tr></thead>
    <tbody>
      <tr><td><strong>顶部工具栏</strong></td><td>页面顶部</td><td>数据集选择下拉（已上传的 Excel 数据集）、上传新 Excel 按钮、历史对话按钮</td></tr>
      <tr><td><strong>中央查询输入区</strong></td><td>页面中部</td><td>自然语言输入框 + 发送按钮；下方显示快捷问题按钮（系统根据数据集字段自动推荐）</td></tr>
      <tr><td><strong>结果展示区</strong></td><td>输入区下方</td><td>AI 回答文字 + 可视化图表（柱状图/折线图/饼图，图表右上角有下载按钮）</td></tr>
      <tr><td><strong>左侧历史面板</strong></td><td>页面左侧</td><td>历史问答列表，按时间倒序排列；点击可重新加载该次对话上下文</td></tr>
    </tbody>
  </table>
  <div class="tip">快捷问题按钮会根据当前选择的数据集动态变化。切换数据集后建议先看一眼新出现的快捷问题，了解该数据集适合回答哪类问题。</div>

  <h2 id="ch0a-3">§0A.3 常用操作步骤</h2>
  <ol>
    <li><strong>选择或上传数据集</strong>：点击顶部"数据集"下拉选择已上传集；或点击"上传 Excel"上传 .xlsx / .xls / .csv（生产报工、质检、设备运行数据等）。</li>
    <li><strong>确认数据预览</strong>：上传后系统自动识别字段并显示前 5 行预览。检查列名（如"产线号"、"SKU"、"班次"）是否清晰中文。</li>
    <li><strong>输入自然语言问题</strong>：在中央输入框输入问题，如"本周哪条产线 OEE 最低？"或"上月每个 SKU 的损耗率"。也可直接点击下方快捷问题按钮。</li>
    <li><strong>发送并等待</strong>：点击发送（或回车），AI 处理通常 5-15 秒，显示"正在分析中…"。</li>
    <li><strong>查看回答</strong>：结果区出现 AI 文字回答 + 图表（图表类型由 AI 自动选择）。</li>
    <li><strong>追问</strong>：可继续追问，如"刚才 OEE 最低的产线，主要停机原因是什么？"，AI 引用上一轮上下文。</li>
    <li><strong>导出结果</strong>：点击图表右上角下载图标保存 PNG；点击数据表格右上角导出图标下载 CSV。</li>
    <li><strong>查阅历史</strong>：点击左侧历史面板记录可重新加载对话，便于跨日跟踪同一指标。</li>
  </ol>

  <h2 id="ch0a-4">§0A.4 常见错误处理</h2>
  <table>
    <thead><tr><th>错误提示</th><th>原因</th><th>处理方法</th></tr></thead>
    <tbody>
      <tr><td>"未找到数据集" / "请先上传数据"</td><td>当前账号下没有可用数据集，或权限未开通</td><td>点击"上传 Excel"上传新数据；权限问题联系工厂管理员开通"智能 BI"</td></tr>
      <tr><td>"分析超时" / 长时间无响应</td><td>数据量过大（>5 万行）或问题过于复杂</td><td>先按时间段筛选（如"本月"而非"全年"）分批提问；或先在 Excel 里过滤后再上传</td></tr>
      <tr><td>"回答内容与预期不符"</td><td>问题描述不够具体，AI 选错字段或聚合维度</td><td>问题中加入产线号、SKU、班次等具体维度；如把"最近产能"改为"2026 年 4 月各产线日产量"</td></tr>
      <tr><td>"字段未识别" / AI 不认识某列</td><td>Excel 列名为英文缩写、空格或语义模糊</td><td>检查并改 Excel 列名为清晰中文（"产线号"而非"line_id"），重新上传</td></tr>
      <tr><td>"图表无法显示"</td><td>数据行数不足（&lt;3 行）或浏览器渲染异常</td><td>刷新页面；若数据集只有少数行，图表不会生成，看文字回答即可</td></tr>
    </tbody>
  </table>
  <div class="warn">若 AI 回答中数字与 §0B 财务 PBI 看板明显不符，优先核对所选数据集的时间范围和数据来源是否一致。</div>

  <h2 id="ch0a-5">§0A.5 关键指标速查（厂长视角）</h2>
  <p>以下是工厂经营核心 KPI，在 AI Query 中直接用指标名提问即可获取对应数据：</p>
  <table>
    <thead><tr><th>指标</th><th>计算口径</th><th>健康区间（食品深加工）</th><th>红线</th></tr></thead>
    <tbody>
      <tr><td><span class="field-label">OEE (设备综合效率)</span></td><td>可用率 × 性能率 × 良品率</td><td>食品加工 55%-75%（连续生产线偏低于离散制造）</td><td>&lt;50% 红线，需立即排查</td></tr>
      <tr><td><span class="field-label">良品率</span></td><td>合格件 / 投产件</td><td>95%-99%</td><td>&lt;93% 红线</td></tr>
      <tr><td><span class="field-label">工序合格率</span></td><td>合格批次 / 总批次</td><td>98%+</td><td>&lt;95% 红线</td></tr>
      <tr><td><span class="field-label">损耗率</span></td><td>(实际用料 - 标准用料) / 标准用料</td><td>&lt;5%</td><td>&gt;10% 红线</td></tr>
      <tr><td><span class="field-label">设备利用率</span></td><td>实际运行时间 / 计划时间</td><td>75%-90%</td><td>&lt;60% 红线</td></tr>
      <tr><td><span class="field-label">准时交付率 (OTIF)</span></td><td>准时全量交付订单数 / 总订单数</td><td>95%+</td><td>&lt;90% 红线（直接影响客户关系）</td></tr>
      <tr><td><span class="field-label">人均产值</span></td><td>月营收 / 在线工人数</td><td>食品加工 ¥3-8 万/人/月（视品类）</td><td>季度环比下降 &gt;5% 警示</td></tr>
    </tbody>
  </table>
  <div class="formula">OEE = 可用率 × 性能率 × 良品率</div>
  <div class="formula">损耗率 = (实际用料 - 标准用料) / 标准用料 × 100%</div>

  <h2 id="ch0a-6">§0A.6 业务判断框架</h2>
  <p>当 AI Query 返回数据后，按以下路径进行业务判断：</p>
  <h3>OEE 突然下滑</h3>
  <p>问 AI "本周 OEE 最低的产线是哪条？" → 拆解三个分量 ("可用率/性能率/良品率") → 定位到具体问题：</p>
  <ul>
    <li><strong>可用率低</strong>（停机多）→ 转 §15 设备管理 查看故障/保养记录；问"本周该产线停机原因汇总"</li>
    <li><strong>性能率低</strong>（速度慢）→ 查 §10 报工记录 看节拍异常；可能是新工人或物料供应不及时</li>
    <li><strong>良品率低</strong>（质量差）→ 转 §6F 质检记录 查不合格批次；可能是原料批次问题或工序参数偏差</li>
  </ul>

  <h3>损耗率超标 (&gt;10%)</h3>
  <p>问 AI "本月哪个 SKU 的损耗率最高？" → 锁定问题 SKU → 多维度排查：</p>
  <ol>
    <li>查 §5 BOM 配方 vs §10 实际领料，看是工艺标准偏差还是操作浪费</li>
    <li>查原料批次（§4 + §6 入库记录），是否原料含水率/质量异常导致超损耗</li>
    <li>查工人/班次（§10 报工），是否特定操作工或班次损耗集中</li>
  </ol>

  <h3>某产线良品率持续偏低</h3>
  <p>问 AI "该产线近 30 天良品率趋势" → 看是渐降还是突降：</p>
  <ul>
    <li><strong>渐降</strong> → 设备老化/工艺漂移，转 §15 设备管理 安排校准/保养</li>
    <li><strong>突降</strong> → 检查近期 §4 原料类型变更或 §5 BOM 调整，可能是新原料/新配方问题</li>
  </ul>

  <h2 id="ch0a-7">§0A.7 跨章节联动</h2>
  <p>AI Query 是数据分析的起点，发现问题后通常需要跳转到专项章节深入处理：</p>
  <table>
    <thead><tr><th>联动章节</th><th>触发场景</th><th>联动方式</th></tr></thead>
    <tbody>
      <tr><td><a href="#section-smartbi">§13 SmartBI 智能分析</a></td><td>需要更复杂的多维分析或固定报表</td><td>SmartBI 是配置型，AI Query 是临时型，互补使用</td></tr>
      <tr><td>§0B 财务 PBI 看板</td><td>需要标准化财务月报（损益、应收应付）</td><td>PBI 看板拉实时财务数据，AI Query 依赖上传数据集，两者互补验证</td></tr>
      <tr><td><a href="#section6f">§6F 质检记录</a></td><td>AI Query 显示良品率低或工序合格率超标</td><td>下钻到批次维度，查具体不合格记录和原因</td></tr>
      <tr><td><a href="#section-equipment">§15 设备管理</a></td><td>AI Query 显示 OEE 低或停机时间长</td><td>查具体设备的故障/保养记录</td></tr>
      <tr><td><a href="#section10">§10 员工签到 + 报工</a></td><td>AI Query 显示人均产值低或损耗集中</td><td>下钻到工人/班次维度，定位个人或班次问题</td></tr>
    </tbody>
  </table>

  <h2 id="ch0a-8">§0A.8 常见决策场景</h2>
  <h3>场景 A：月度产值同比下滑 8%</h3>
  <p><strong>背景</strong>：月末数据出来后，厂长发现本月产值同比上月下滑 8%，需快速定位原因。</p>
  <p><strong>分析步骤</strong>：</p>
  <ol>
    <li>在 AI Query 上传本月生产报工数据，问："本月产值下滑主要来自哪条产线？"</li>
    <li>定位到下滑产线后，追问"该产线本月 OEE 拆解（可用率 / 性能率 / 良品率）"。</li>
    <li>若可用率低，转 §15 设备管理查停机记录；若良品率低，转 §6F 质检记录查不合格批次。</li>
    <li>形成改善方案后，在 AI Query 设置跟踪问题（"本周该产线日产量"），每日跟踪恢复进度。</li>
  </ol>

  <h3>场景 B：客户审厂前的数据自查</h3>
  <p><strong>背景</strong>：大客户预约下周来审厂，厂长需提前自查近 3 个月生产数据是否符合客户标准。</p>
  <p><strong>分析步骤</strong>：</p>
  <ol>
    <li>在 AI Query 问："近 3 个月该客户 SKU 的良品率、OTIF 和不合格批次数"。</li>
    <li>对比客户合同要求的标准（如良品率 ≥97%、OTIF ≥95%），找出未达标的 SKU 或月份。</li>
    <li>对未达标项准备整改说明：转 §6F 质检查问题批次根因；转 §10 报工查相关班次。</li>
    <li>导出关键数据 CSV/PDF 作审厂资料。</li>
  </ol>

  <h2 id="ch0a-faq">FAQ</h2>
  <dl>
    <dt><strong>Q: AI Query 和 SmartBI 有什么区别？</strong></dt>
    <dd>A: AI Query 是<strong>临时自由问答</strong>（上传 Excel → 自然语言问 → AI 回答 + 图）；SmartBI 是<strong>配置型固定报表</strong>（预设维度、指标、自动定时刷新）。日常临时分析用 AI Query，月度例行用 SmartBI。两者数据来源不同（AI Query 用上传数据集，SmartBI 直连数据库）。</dd>
    <dt><strong>Q: 上传的数据集多久过期？</strong></dt>
    <dd>A: 默认保留 90 天。超过 90 天的数据集会被自动清理（保留分析记录但不再可下钻）。重要数据集请定期导出备份；如需长期保留，联系系统管理员加入"长期数据集"白名单。</dd>
    <dt><strong>Q: AI 答错了或漏了数据怎么办？</strong></dt>
    <dd>A: 三步排查：(1) 检查问题描述是否够具体（加入产线号、SKU、日期范围）；(2) 检查 Excel 字段名是否清晰中文；(3) 简化问题分步问（如先问"本月各产线 OEE"，再问"OEE 最低的那条产线主要停机原因"）。仍有问题可点击 AI 答案下方"反馈"按钮，运营会改进。</dd>
    <dt><strong>Q: 能问跨数据集的复合问题吗？（如"将本月生产数据和质检数据关联分析"）</strong></dt>
    <dd>A: 当前版本暂不支持自动跨数据集关联。建议先在 Excel 里把两个数据集 VLOOKUP 合并为一份，再上传到 AI Query 提问。后续版本会支持自动关联（参见产品路线图）。</dd>
    <dt><strong>Q: 移动端能用 AI Query 吗？</strong></dt>
    <dd>A: 可以。手机浏览器打开 Web Admin 地址同样可用 AI Query，但<strong>无法上传 Excel</strong>（需 PC 端上传）。移动端适合查看历史问答和追问已上传的数据集。</dd>
  </dl>

  <h2 id="ch0a-related">相关章节</h2>
  <ul>
    <li><a href="#section-smartbi">§13 SmartBI 智能分析</a>：配置型固定报表，与 AI Query 互补</li>
    <li>§0B 财务 PBI 看板：财务数据标准视图，与 AI Query 互补验证</li>
    <li><a href="#section6f">§6F 质检记录管理</a>：良品率异常时深入排查</li>
    <li><a href="#section-equipment">§15 设备管理</a>：OEE 异常时查设备状态</li>
    <li><a href="#section10">§10 员工签到 + 报工</a>：人均产值/损耗异常时查工人维度</li>
  </ul>
</section>

```

- [ ] **Step 2: 验证 §0A 结构合法**

```bash
grep -c "id=\"ch0a" docs/plans/factory-operation-manual.html
```

预期：**11**（§0A + §0A.1~§0A.8 + §0A-faq + §0A-related = 11 个 id）

```bash
grep "<section id=\"ch0a\"" docs/plans/factory-operation-manual.html
grep "</section>" docs/plans/factory-operation-manual.html | head -2
```

预期：能找到 §0A 开始的 `<section id="ch0a">`，紧随其后 1 个匹配的 `</section>`。

---

## Task 3: 写 §0B 财务 PBI 看板章节

**Files:**
- Modify: `docs/plans/factory-operation-manual.html`（在 §0A 关闭 `</section>` 之后立刻插入 §0B `<section>`）

- [ ] **Step 1: 在 §0A 之后插入 §0B 完整章节 HTML**

定位到刚插入的 §0A 的 `</section>` 标签（即 §0A 末尾），在它之后立即插入下面整段 HTML：

```html

<!-- ============================================================ -->
<!-- §0B: 财务 PBI 看板 (Tier 1 production-grade)                  -->
<!-- ============================================================ -->
<section id="ch0b">
  <h1>§0B 财务 PBI 看板</h1>
  <!-- last-verified-against-product: 2026-04-29 -->
  <p class="overview">财务 PBI 看板是白垩纪 SaaS 的<strong>标准财务可视化解读入口</strong>，自动从生产报工、采购入库、销售出货、人工工资等系统数据汇总成月度损益、成本结构、应收应付、现金流四大视图。<strong>与本手册 §14 "财务管理" 章节的区别</strong>：§14 是<strong>财务操作模块</strong>（开发票、记凭证、做付款、对账），属于会计文员日常操作；§0B 是<strong>财务数据解读层</strong>，看板自动按月聚合并展示趋势，给厂长和老板看不动手 — 一个录入数据，一个解读数字，互补不重叠。无需会计手工整理，看板支持多工厂切换、按 SKU/客户/产线下钻，让厂长和财务文员快速识别成本异常、回款风险和利润趋势。</p>

  <h2 id="ch0b-1">§0B.1 进入路径</h2>
  <p>菜单导航路径：登录 Web Admin → 左侧"财务管理"分组 → "财务 PBI" 即进入主页面。</p>
  <div class="tip">权限提示：财务 PBI 默认仅对厂长 / 财务文员 / 老板角色可见。其他角色看不到该入口，需联系系统管理员在"角色权限"中开通"财务数据查看"权限。</div>

  <h2 id="ch0b-2">§0B.2 主界面 layout</h2>
  <p>财务 PBI 页面由五个主要区块组成：</p>
  <table>
    <thead><tr><th>区块</th><th>位置</th><th>内容说明</th></tr></thead>
    <tbody>
      <tr><td><strong>顶部时间筛选器</strong></td><td>页面顶部</td><td>选择月度 / 季度 / 年度；多工厂老板可同时选择多个工厂对比</td></tr>
      <tr><td><strong>四大 KPI 卡片</strong></td><td>第一行</td><td>营收 / 成本 / 利润 / 现金流四张大卡片，显示当期值 + 同比 + 环比</td></tr>
      <tr><td><strong>损益瀑布图</strong></td><td>第二行左侧</td><td>从营收逐项扣减各类成本（直接材料 / 直接人工 / 制造费用 / 管理 / 销售 / 财务）到净利润的瀑布展示，识别成本异常项</td></tr>
      <tr><td><strong>成本桑基图</strong></td><td>第二行右侧</td><td>桑基图（Sankey）展示成本流向：从总成本分流到 SKU/客户/产线维度，可点击节点高亮</td></tr>
      <tr><td><strong>AI 洞察面板</strong></td><td>页面右侧</td><td>系统自动生成本期重点提示（如"本月 X 客户应收逾期 30+ 天，金额 Y 万元"），节省人工浏览</td></tr>
    </tbody>
  </table>
  <div class="tip">瀑布图 / 桑基图为高级可视化，需浏览器支持 ECharts。如显示空白请刷新或换 Chrome。</div>

  <h2 id="ch0b-3">§0B.3 常用操作步骤</h2>
  <ol>
    <li><strong>选择时间范围</strong>：在顶部选择"本月至今"或"上月"作为分析起点。</li>
    <li><strong>选择工厂</strong>：单工厂老板默认显示当前工厂；多工厂集团可勾选多个对比。</li>
    <li><strong>看四大 KPI 卡片</strong>：先看整体 — 营收同比 / 环比 + 利润同比 / 环比，识别整体走势。</li>
    <li><strong>下钻瀑布图</strong>：点击瀑布图中某段（如"直接材料"），跳转到该成本项明细列表。</li>
    <li><strong>下钻桑基图</strong>：点击桑基图节点（如某 SKU），高亮该 SKU 在所有成本项的分布。</li>
    <li><strong>导出报表</strong>：点击右上角"导出"按钮，可选 PDF（含图表）或 Excel（含明细数据）。</li>
  </ol>

  <h2 id="ch0b-4">§0B.4 常见错误处理</h2>
  <table>
    <thead><tr><th>现象</th><th>可能原因</th><th>处理方法</th></tr></thead>
    <tbody>
      <tr><td>数据未更新（昨日数据仍显示前天值）</td><td>财务数据 T+1 同步，凌晨 2:00 自动刷新；当天 10 点后仍未更新可能是定时任务失败</td><td>点页面右上角"刷新"按钮手动触发；仍未更新联系技术支持查定时任务日志</td></tr>
      <tr><td>看板空白或显示"暂无数据"</td><td>该工厂尚未上线或数据未同步；时间范围选了未来日期</td><td>检查筛选器：工厂正确、时间范围合理；新工厂等次日凌晨数据首次同步</td></tr>
      <tr><td>毛利率显示异常值（如 -200% 或 300%）</td><td>退款冲账导致分子为负；成本录入错误</td><td>下钻瀑布图找异常交易，联系运营核实源数据；从 §11 报表中心导出明细排查</td></tr>
      <tr><td>瀑布图 / 桑基图区域空白</td><td>浏览器不支持 ECharts；权限不足看不到该面板</td><td>换 Chrome / Edge；权限问题联系系统管理员开通"财务数据深度查看"</td></tr>
      <tr><td>"导出失败" / 导出文件为空</td><td>当前筛选范围内数据量为 0 或服务器繁忙</td><td>缩小筛选范围（如只选 1 个工厂 1 个月）重试；高峰时段（月末 9-11 点）避开导出</td></tr>
    </tbody>
  </table>

  <h2 id="ch0b-5">§0B.5 关键指标速查</h2>
  <p>以下是财务 PBI 看板中六个核心 KPI 的定义、健康区间和预警阈值：</p>
  <table>
    <thead><tr><th>指标</th><th>计算口径</th><th>健康区间</th></tr></thead>
    <tbody>
      <tr><td><span class="field-label">毛利率</span></td><td>(营收 - 直接成本) / 营收 × 100%</td><td><strong>品类差异大</strong>：初加工（分切 / 屠宰）8-15%；中等加工 20-28%；深加工（预制菜 / 调味品）30-45%</td></tr>
      <tr><td><span class="field-label">营业利润率</span></td><td>营业利润 / 营收 × 100%</td><td>食品加工综合 5-12%</td></tr>
      <tr><td><span class="field-label">应收账龄</span></td><td>30 / 60 / 90 / 90+ 天分布</td><td>90+ &lt;10% 健康；&gt;20% 警示</td></tr>
      <tr><td><span class="field-label">现金流</span></td><td>经营 / 投资 / 筹资 三大类</td><td>经营现金流为正、覆盖投资 + 筹资</td></tr>
      <tr><td><span class="field-label">单位成本</span></td><td>总成本 / 产量</td><td>工厂自定（按 SKU 跟踪环比）</td></tr>
      <tr><td><span class="field-label">回款周转 (DSO)</span></td><td>应收余额 × 365 / 年营收</td><td>30-60 天健康；&gt;90 天警示</td></tr>
    </tbody>
  </table>
  <div class="formula">毛利率 = (营收 - 直接成本) / 营收 × 100%</div>
  <div class="formula">DSO = 应收账款余额 × 365 / 年营收</div>

  <h2 id="ch0b-6">§0B.6 业务判断框架</h2>
  <h3>毛利率下滑</h3>
  <p>当看板显示毛利率环比下降 &gt;3pp 时：</p>
  <ol>
    <li>看瀑布图，判断是<strong>营收下降</strong>还是<strong>直接成本上升</strong>主导</li>
    <li>营收下降 → 转 §6C 销售订单查订单量；可能是季节性或客户流失</li>
    <li>直接成本上升 → 看桑基图找成本最重的 SKU；转 §6E 采购订单查原料涨价情况</li>
    <li>双向恶化 → 紧急排查，可能是大客户取消订单 + 原料涨价叠加</li>
  </ol>

  <h3>应收账款恶化（90+ 天占比 &gt;15%）</h3>
  <p>当应收账龄分布出现 90+ 天占比异常时：</p>
  <ol>
    <li>下钻应收账龄面板，找出逾期金额最大的 3 个客户</li>
    <li>查 §3 客户管理记录最近沟通记录；判断是关系问题还是客户经营问题</li>
    <li>对长期不付款客户启动催收，必要时暂停后续订单（§6C）</li>
  </ol>

  <h3>现金流转负</h3>
  <p>当经营现金流连续 2 个月为负时（最严重的财务信号）：</p>
  <ol>
    <li>立即查应收账龄（DSO 是否拉长）+ 应付账龄（是否被供应商压款）</li>
    <li>查 §6E 采购订单确认是否有大额预付款积压</li>
    <li>问财务是否需要短期融资 / 调整应付账期 / 加速回款</li>
  </ol>
  <div class="warn">现金流转负是经营危机的最早信号，绝对不能仅由财务文员处理，需要厂长和老板共同介入。</div>

  <h2 id="ch0b-7">§0B.7 跨章节联动</h2>
  <table>
    <thead><tr><th>联动章节</th><th>联动场景</th><th>典型触发条件</th></tr></thead>
    <tbody>
      <tr><td>§0A AI Query</td><td>PBI 固定视图无法回答的临时问题（如某客户某 SKU 的特定时段毛利）</td><td>需要按非标准维度自定义下钻分析时</td></tr>
      <tr><td><a href="#section-finance">§14 财务管理</a></td><td>下钻到具体凭证 / 发票 / 付款单</td><td>PBI 看到异常数字，需追到原始凭证核查时</td></tr>
      <tr><td><a href="#section-smartbi">§13 SmartBI 智能分析</a></td><td>需要更复杂的财务多维分析或自定义报表</td><td>PBI 标准视图不够用时</td></tr>
      <tr><td>§11 查看分析报表</td><td>导出财务明细 Excel 用于审计或月末对账</td><td>月末关账、季度审计时</td></tr>
      <tr><td><a href="#section6e">§6E 采购订单管理</a></td><td>原料成本异常时溯源到具体采购单和供应商</td><td>毛利率因直接材料成本上升而恶化时</td></tr>
    </tbody>
  </table>

  <h2 id="ch0b-8">§0B.8 常见决策场景</h2>
  <h3>场景 A：月末关账核对</h3>
  <p><strong>操作步骤：</strong></p>
  <ol>
    <li>在 PBI 看板将时间范围设为"本月"，截图营收 / 成本 / 利润四张卡片作为月度汇总。</li>
    <li>下拉查应收账龄面板，导出逾期 &gt;30 天明细，安排催收跟进。</li>
    <li>下钻瀑布图各成本项与 §14 财务管理中的凭证逐项核对，确保看板数 = 凭证总和。</li>
    <li>从 §11 报表中心导出财务明细 Excel 给会计师事务所归档。</li>
  </ol>

  <h3>场景 B：季度董事会汇报准备</h3>
  <p><strong>操作步骤：</strong></p>
  <ol>
    <li>在 PBI 看板选择季度时间范围，多工厂集团对比各厂利润贡献。</li>
    <li>用瀑布图截图作为成本结构汇报材料；用桑基图截图展示成本流向 SKU/客户。</li>
    <li>结合 §0A AI Query 临时问问题（如"本季度新客户首单贡献"）作为补充洞察。</li>
    <li>导出 PBI PDF 作为董事会附件归档。</li>
  </ol>

  <h2 id="ch0b-faq">FAQ</h2>
  <dl>
    <dt><strong>Q: PBI 看板和 §14 财务管理是什么关系？</strong></dt>
    <dd>A: §14 是<strong>财务操作录入</strong>（开票、记账、付款），是数据源；PBI 是<strong>财务数据可视化</strong>（看板、瀑布图、桑基图），是数据展示层。会计文员在 §14 录数据，厂长 / 老板在 §0B 看数据。两者数据完全互通：§14 录入后 T+1 自动同步到 PBI 看板。</dd>
    <dt><strong>Q: 为什么数据延迟一天？能实时吗？</strong></dt>
    <dd>A: 财务数据默认 T+1 同步，当日凭证次日凌晨 2:00 同步到看板。如需实时（如月末最后一天），可点右上角"刷新"按钮手动触发；或联系技术支持开启"实时同步模式"（涉及性能权衡，需评估）。</dd>
    <dt><strong>Q: 应收账款为 0 是 bug 吗？</strong></dt>
    <dd>A: 不一定。如果工厂全部走"先款后货"模式（预收订金 → 发货 → 余款到账），应收账款长期接近 0 是正常的。检查 §6C 销售订单的付款条件配置。如果有月结客户但 PBI 显示 AR=0，可能是数据同步问题，联系技术支持。</dd>
    <dt><strong>Q: 不同工厂的毛利率差异大，怎么对比？</strong></dt>
    <dd>A: 工厂毛利率受品类（初/中/深加工）、客户结构（B2B/B2C）、产能规模、地理位置等多因素影响，<strong>不建议跨厂横向对比毛利率绝对值</strong>。应与<strong>该厂自身历史均值</strong>对比（同比/环比变化）。集团对比可在 §13 SmartBI 中使用标准化指标（如归一化后的"毛利率指数"）。</dd>
    <dt><strong>Q: 瀑布图和桑基图能定制吗？（如调整成本项分类）</strong></dt>
    <dd>A: 当前版本瀑布图成本分类按系统标准（直接材料/直接人工/制造费用/管理/销售/财务），桑基图分流维度可在右上角下拉切换（SKU / 客户 / 产线）。如需自定义成本科目分类，需在 §14 财务管理 → 科目设置中先定义，PBI 看板自动同步。</dd>
  </dl>

  <h2 id="ch0b-related">相关章节</h2>
  <ul>
    <li>§0A AI Query 智能数据分析：临时自由问答补充 PBI 固定视图</li>
    <li><a href="#section-finance">§14 财务管理</a>：财务操作录入入口，PBI 数据源头</li>
    <li><a href="#section-smartbi">§13 SmartBI 智能分析</a>：更复杂的多维财务分析</li>
    <li><a href="#section6e">§6E 采购订单管理</a>：原料成本异常时溯源</li>
    <li><a href="#section6c">§6C 销售订单管理</a>：营收异常时追订单</li>
  </ul>
</section>

```

- [ ] **Step 2: 验证 §0B 结构合法**

```bash
grep -c "id=\"ch0b" docs/plans/factory-operation-manual.html
```

预期：**11**（同 §0A 数量）

```bash
grep -c "<section id=\"ch0" docs/plans/factory-operation-manual.html
```

预期：**2**（§0A + §0B 两个 section 开头）

---

## Task 4: 更新 TOC + 文档头 last-verified meta

**Files:**
- Modify: `docs/plans/factory-operation-manual.html` 的 TOC 区域（约第 446-475 行）+ 文档头（约第 6-8 行）

- [ ] **Step 1: TOC 顶部加 §0A / §0B 链接**

定位 TOC 区域第一个 `<li>` 元素（"系统概览与测试账号"那一行），在它**之前**插入两个新 li：

```html
    <li><a href="#ch0a">§0A. 智能数据分析 (AI Query)</a> <span class="badge badge-danger">新</span></li>
    <li><a href="#ch0b">§0B. 财务 PBI 看板</a> <span class="badge badge-danger">新</span></li>
```

- [ ] **Step 2: TOC 末尾"本手册涵盖..."更新计数**

找到 `<div class="toc-note">本手册涵盖系统全部 20 个功能模块、80+ 页面。版本 3.2 更新于 2026-04-04。</div>` 这一行，改为：

```html
  <div class="toc-note">本手册涵盖系统全部 22 个功能模块、80+ 页面。版本 3.3 更新于 2026-04-29（新增 §0A AI Query 智能数据分析 + §0B 财务 PBI 看板）。</div>
```

- [ ] **Step 3: 文档头加 last-verified meta**

定位 HTML 文件 `<head>` 中 `<title>` 标签后一行（约第 7 行），加：

```html
<!-- last-verified-against-product: 2026-04-29 -->
```

- [ ] **Step 4: 更新文档头 subtitle 版本号**

找到 `<span>版本 3.2</span>` 改为 `<span>版本 3.3</span>`。
找到 `<span>2026 年 4 月 4 日</span>` 改为 `<span>2026 年 4 月 29 日</span>`。
找到 `<span>完整操作手册 (Sections 1-14)</span>` 改为 `<span>完整操作手册 (Sections 0A-0B + 1-20)</span>`。

- [ ] **Step 5: 验证 TOC 改完无破坏**

```bash
grep -A1 "目录 (Table of Contents)" docs/plans/factory-operation-manual.html | head -5
grep -c "ch0a\|ch0b" docs/plans/factory-operation-manual.html
```

预期 grep -c：**24**（§0A 11 + §0B 11 + TOC 2 个 a href = 24）

---

## Task 5: 同步到 web-admin/public/

**Files:**
- Copy from: `docs/plans/factory-operation-manual.html`
- Copy to: `web-admin/public/factory-operation-manual.html`

- [ ] **Step 1: 复制文件**

```bash
cp docs/plans/factory-operation-manual.html web-admin/public/factory-operation-manual.html
ls -la docs/plans/factory-operation-manual.html web-admin/public/factory-operation-manual.html
```

预期：两个文件大小完全一致。

- [ ] **Step 2: 验证 ch0a / ch0b 在 public 副本里也有**

```bash
grep -c "ch0a\|ch0b" web-admin/public/factory-operation-manual.html
```

预期：24

---

## Task 6: 重新入库到 KB（atomic swap）

**Files:**
- 服务器：47.100.235.168 / `/www/wwwroot/cretas/code/backend/python/`

- [ ] **Step 1: 同步 HTML 到 47 服务器（确认路径）**

47 服务器 ingester 实际读取的路径是 `/www/wwwroot/cretas/code/docs/plans/factory-operation-manual.html`（注意：在 `code/docs/plans/` 下，不在 `code/backend/python/docs/`）。

```bash
scp docs/plans/factory-operation-manual.html root@47.100.235.168:/www/wwwroot/cretas/code/docs/plans/factory-operation-manual.html
ssh root@47.100.235.168 "ls -la /www/wwwroot/cretas/code/docs/plans/factory-operation-manual.html"
```

预期：文件大小约 320KB（与本地匹配）。

- [ ] **Step 2: 触发 atomic swap 重新入库**

```bash
ssh root@47.100.235.168 "
cd /www/wwwroot/cretas/code/backend/python
source venv38/bin/activate
python -c \"
import asyncio, logging
logging.basicConfig(level=logging.INFO)
from food_kb.services.manual_ingester import ingest_all_manuals
asyncio.run(ingest_all_manuals())
\" 2>&1 | tail -30
"
```

预期日志（关键行）：
- `[manual_ingester] ingesting factory-operation-manual.html with subcategory='factory'`
- `[manual_ingester] split into N chunks`（N ≈ 309-315）
- `[manual_ingester] atomic swap: deleted old + renamed .NEW to canonical`

- [ ] **Step 3: 验证入库后 chunks 数**

```bash
ssh root@47.100.235.168 "PGPASSWORD=cretas123 psql -h localhost -U cretas_user -d cretas_prod_db -c \"SELECT subcategory, COUNT(*) FROM food_knowledge_documents WHERE source='factory-operation-manual.html' GROUP BY subcategory;\""
```

预期：**factory | 309-315**（比 Task 1 Step 3 记录的基线 287 多 22-28）

如果数字 &lt;305 或 &gt;320，说明分块异常，去 Task 11 排查。

---

## Task 7: 部署 HTML 到 139（aiassist + web-admin 都读这个）

- [ ] **Step 1: scp 到 139 服务器**

```bash
scp web-admin/public/factory-operation-manual.html root@139.196.165.140:/www/wwwroot/web-admin/factory-operation-manual.html
ssh root@139.196.165.140 "ls -la /www/wwwroot/web-admin/factory-operation-manual.html"
```

预期：文件大小约 320KB（299KB + ~21KB 的 §0A/§0B）。

- [ ] **Step 2: 验证 nginx 通公网可访问**

```bash
curl -s -o /dev/null -w "HTTP %{http_code} | size=%{size_download}\n" https://aiassist.cretaceousfuture.com/factory-operation-manual.html
```

预期：HTTP 200，size_download ≈ 320KB。

注意：当前 `aiassist.cretaceousfuture.com` nginx 限制了 location，可能 `/factory-operation-manual.html` 返回 404（因为只放行了 `/aiassist.html`）。如果 404 不需要修，因为这文件主要在 `admin.cretaceousfuture.com` 或 web-admin 内访问。

```bash
curl -sI -k https://admin.cretaceousfuture.com/factory-operation-manual.html | head -5
```

预期：HTTP 200。

---

## Task 8: Smoke Test A — 工厂版 AI Query 关键词检查

- [ ] **Step 1: 通过 nginx 调 manual-chat API（工厂版）**

```bash
echo '{"question":"AI Query 怎么用","category":"factory"}' | \
  curl -s --data-binary @- -H "Content-Type: application/json" \
  -X POST https://aiassist.cretaceousfuture.com/api/food-kb/manual-chat \
  --max-time 60 > /tmp/test_a.json
cat /tmp/test_a.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
ans = d.get('answer', '')
keywords = ['OEE', '良品率', '损耗率', '工序合格率', 'OTIF', '产线', 'SKU']
hit = [k for k in keywords if k in ans]
print('Answer length:', len(ans))
print('Hit keywords:', hit)
print('PASS' if len(hit) >= 1 else 'FAIL')
print('Answer preview:', ans[:300])
"
```

预期：
- Answer length ≥ 200
- Hit keywords：至少 1 个工厂 KPI 关键词
- PASS

如果 FAIL（命中 0 个工厂关键词），看 sources 里章节是不是 §0A：

```bash
cat /tmp/test_a.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
print([s['title'] for s in d.get('sources', [])[:5]])
"
```

预期 sources 包含 "§0A 智能数据分析" 或 "factory-operation-manual" 相关 title。

---

## Task 9: Smoke Test B — 工厂版财务看板

- [ ] **Step 1: 调 API**

```bash
echo '{"question":"财务看板看什么","category":"factory"}' | \
  curl -s --data-binary @- -H "Content-Type: application/json" \
  -X POST https://aiassist.cretaceousfuture.com/api/food-kb/manual-chat \
  --max-time 60 > /tmp/test_b.json
cat /tmp/test_b.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
ans = d.get('answer', '')
keywords = ['损益瀑布', '桑基', '应收账龄', 'DSO', '毛利率', '现金流', '财务 PBI']
hit = [k for k in keywords if k in ans]
print('Answer length:', len(ans))
print('Hit keywords:', hit)
print('PASS' if len(hit) >= 1 else 'FAIL')
print('Answer preview:', ans[:300])
"
```

预期：PASS（命中至少 1 个 §0B 关键词）。

---

## Task 10: Smoke Test C — 餐饮版跨域拒绝不被破坏

- [ ] **Step 1: 验证餐饮版仍正确拒绝工厂问题**

```bash
echo '{"question":"怎么开始一个生产批次","category":"restaurant"}' | \
  curl -s --data-binary @- -H "Content-Type: application/json" \
  -X POST https://aiassist.cretaceousfuture.com/api/food-kb/manual-chat \
  --max-time 60 | python3 -c "
import json, sys
d = json.load(sys.stdin)
ans = d.get('answer', '')[:200]
expected = '该功能在当前选择的版本'
print('PASS' if expected in ans else 'FAIL')
print('Answer:', ans)
"
```

预期：PASS — 餐饮版仍只用一句话拒绝跨域问题（之前 commit `f7505d547` 修的逻辑没被破坏）。

---

## Task 11: 失败排查（Atomic swap chunks 数异常时）

如果 Task 6 Step 3 chunks 数偏离预期（&lt;305 或 &gt;320）：

- [ ] **Step 1: 查 ingester 切片日志**

```bash
ssh root@47.100.235.168 "grep -E 'split into|chunk count|factory-operation' /www/wwwroot/cretas/python-prod.log | tail -20"
```

- [ ] **Step 2: 手动 dry-run 重新切片**

```bash
ssh root@47.100.235.168 "
cd /www/wwwroot/cretas/code/backend/python
source venv38/bin/activate
python -c \"
from food_kb.services.manual_ingester import _split_html_into_chunks
with open('/www/wwwroot/cretas/code/docs/plans/factory-operation-manual.html', 'r', encoding='utf-8') as f:
    html = f.read()
chunks = _split_html_into_chunks(html, max_chars=1200)
print(f'Total chunks: {len(chunks)}')
ch0a = [c for c in chunks if 'ch0a' in c.get('title','').lower() or '§0A' in c.get('title','')]
ch0b = [c for c in chunks if 'ch0b' in c.get('title','').lower() or '§0B' in c.get('title','')]
print(f'§0A chunks: {len(ch0a)}')
print(f'§0B chunks: {len(ch0b)}')
\"
"
```

预期：§0A + §0B 总 chunks ≈ 22-28。如果其中某章 chunks 异常少（&lt;5），是 HTML 结构有问题（可能 `<section>` 标签未闭合或嵌套异常），用 W3C HTML validator 校验。

- [ ] **Step 3: 回滚（如必要）**

```bash
# 用 git 恢复 HTML（自动回到原 287 chunks 状态）
cd C:\Users\Steve\my-prototype-logistics
git checkout HEAD -- docs/plans/factory-operation-manual.html web-admin/public/factory-operation-manual.html

# scp 旧 HTML 回 47 + 重跑 ingester
scp docs/plans/factory-operation-manual.html root@47.100.235.168:/www/wwwroot/cretas/code/docs/plans/factory-operation-manual.html
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code/backend/python && source venv38/bin/activate && python -c 'import asyncio; from food_kb.services.manual_ingester import ingest_all_manuals; asyncio.run(ingest_all_manuals())'"
```

---

## Task 12: 提交 + 清理

- [ ] **Step 1: git status 检查只 staging 这 2 个文件**

```bash
cd C:\Users\Steve\my-prototype-logistics
git status --short docs/plans/factory-operation-manual.html web-admin/public/factory-operation-manual.html
git status --short | head -10
```

预期：只看到这 2 个文件 modified。如果有别的 dirty 文件（concurrent session），不要 add 它们。

- [ ] **Step 2: 删除备份**

```bash
rm docs/plans/factory-operation-manual.html.bak
```

- [ ] **Step 3: 并发安全提交**

```bash
git commit -m "feat(food-kb): 工厂版手册 Phase 0 — §0A AI Query + §0B 财务 PBI 两章 Tier 1 production-grade

- §0A 智能数据分析：8 sub-section + FAQ + 关键章节联动
  - KPI: OEE / 良品率 / 工序合格率 / 损耗率 / OTIF / 人均产值
  - 业务判断框架: OEE 拆解 / 损耗率超标 / 良品率持续偏低 3 场景
- §0B 财务 PBI 看板：8 sub-section + FAQ + 关键章节联动
  - KPI: 毛利率 (分初/中/深加工) / 营业利润率 / 应收账龄 / DSO / 现金流
  - 业务判断框架: 毛利率下滑 / 应收恶化 / 现金流转负 3 场景
- TOC 加 §0A / §0B 链接 + 版本 3.2→3.3 + last-verified=2026-04-29
- KB chunks: 287 → 309-315 (factory subcategory)" \
  -- docs/plans/factory-operation-manual.html web-admin/public/factory-operation-manual.html
```

- [ ] **Step 4: 验证 commit 内容只 2 文件**

```bash
git show --stat HEAD | head -10
```

预期：`2 files changed`，文件名只有 docs/plans + web-admin/public 两个。

---

## Self-Review

执行后所有 task done，最终验收：

- [ ] §0A + §0B HTML 文件渲染（浏览器打开 https://aiassist.cretaceousfuture.com/factory-operation-manual.html#ch0a 验证锚点跳转）
- [ ] KB chunks 增加 ≥ 20（基线 287 → ≥307）
- [ ] Smoke test A/B/C 全 PASS
- [ ] git commit 单独清晰（不带其他 concurrent session 文件）

---

## 不在本次 Phase 范围

- §1-§20 章节模板补强（Phase 1b）
- 5 培训路径（Phase 1b）
- 24 决策合成场景（Phase 1b）
- `_FACTORY_KEYWORDS` auto-detect（已用 explicit category，影响小）
- CI drift防腐扩展到 factory manual（Phase 2）

后续 Phase 详见 spec `docs/superpowers/specs/2026-04-29-factory-product-manual-design.md` 第 10 节。
