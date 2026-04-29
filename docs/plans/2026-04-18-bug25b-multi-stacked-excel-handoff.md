# Bug #25b 真修 Handoff — 多表堆叠 Excel 上传对话框 (方案 B 完整检测)

**Date**: 2026-04-18 (Apr 18 session 结束)
**Branch**: `e2e/v1-framework`
**Previous session outcome**: Bug #37/#38/#39/#34b/#31/#40 全修 + 补 deep, qa-prompt v2.2 r2 落盘

---

## 背景

Bug #25 原描述 (task #225): "multi-level Excel field_defs vs row_data key mismatch — chat-layer fallback applied, upstream parser fix still pending"

**现状**:
- 现状: chat.py 已有 fallback (行数据 key 对齐 field_defs), 但上游 parser 遇到"一个 Sheet 里堆叠多个独立表格"时把两个表合并成一个, field_defs 是第 1 个表的 header, row_data 混合了第 2 个表的行。

**Bug #25b 真修目标**: 上传 UI 加"请选择表范围"对话框, 后端 Excel parser 检测独立表区域让用户选择。

---

## 方案 B — 完整检测 (2-3 小时)

### Phase 1: 后端 structure_detector 加多表区域检测 (60 min)

**文件**: `backend/python/smartbi/services/structure_detector.py` (1249 行, 复杂)

新增函数 `detect_multiple_table_regions(raw_df: pd.DataFrame) -> List[TableRegion]`:
- 算法: 扫描每行, 识别"header-like 行" (全非数字 + 有中文) 作为区域起点
- 用 **连续 >= 2 行空行** 作为 region 分隔
- 返回 `[{start_row: int, end_row: int, header_row: int, preview_cols: [str], sample_rows: int}]`
- 单表文件返回 `[{start: 0, end: last, header: 0, ...}]` (兼容)

**测试**: `backend/python/smartbi/services/structure/tests/test_multi_region.py`
- 单表 → 1 region
- 双表堆叠 (header + data + blank + header + data) → 2 regions
- 三表 → 3 regions
- Edge: 空表, 仅 header 无数据, header 行有 merge cells

### Phase 2: API 加 regions 预检 + selectedRegion 参数 (30 min)

**文件**: `backend/python/smartbi/api/excel.py` (或 `main.py` 的 upload endpoint)

新增:
- `POST /api/smartbi/excel/detect-regions` — 上传 file 返 regions list (不持久化, 只 preview)
- `POST /api/smartbi/excel/upload-and-analyze` — 加 `selectedRegion: int` query param, 只解析 `regions[selectedRegion]` 的范围

**关键**: 后端 `pandas.read_excel(skiprows=N, nrows=M, ..., sheet_name=S)` 支持 offset + limit, 无需改 pandas core。

### Phase 3: 前端 ExcelUpload.vue 加预览对话框 (45 min)

**文件**: `web-admin/src/views/smart-bi/ExcelUpload.vue` (1495 行, 已有 4 step wizard)

在 step 1 (选文件) 和 step 2 (预览字段) 之间插入 **新 step 1.5**:
- 上传文件先调 `/detect-regions` 拿 regions
- 若 len(regions) == 1 → 自动 skip 这步, 走原流程
- 若 len(regions) >= 2 → 弹 dialog "检测到 N 个独立数据区域", 展示每区域的 preview (header + 前 3 行), 用户选 radio 确认
- 选定后把 `selectedRegion` 塞 POST body, 继续走 upload-and-analyze

**UI 组件建议**:
- `el-dialog` 标题"请选择表范围"
- 每个 region 用 `el-card` 展示: "区域 1 (第 X-Y 行, Z 列)" + `el-table` preview 3 行
- `el-radio-group` 选中一个 region
- 确定按钮 disabled until 选中

### Phase 4: E2E 真窗口 verify (严格 v2.2 r2) (30 min)

按 qa-prompt.txt v2.2 r2 **每步必做 7 项** + **Rule 9 数据抽检**:

1. 准备测试 Excel: 手工造一个双表堆叠文件 (上半部分销售数据, 下半部分库存数据, 中间 3 行空行隔开)
2. 真窗口上传 (browser_click 真 upload, 非 form.fill)
3. MutationObserver 装好
4. 预期 dialog 弹 2 regions
5. 选 region 1, 确认
6. 观察 toast "解析成功 N 行"
7. 进入 step 2 验证 field_defs 只含 region 1 的 header
8. `browser_console_messages level=error` 0
9. `browser_network_requests` /detect-regions 200 + /upload-and-analyze 200
10. **Rule 9**: field_defs 列数 byte-match + 中末段 2-3 行抽检业务合理性

### Phase 5: commit + 部 test (10 min)

```
fix(smartbi): Bug #25b 真修 多表堆叠 Excel 检测 + 区域选择对话框

Phase 1: structure_detector 加 detect_multiple_table_regions (空行分隔算法)
Phase 2: /excel/detect-regions endpoint + upload selectedRegion query param
Phase 3: ExcelUpload.vue 加 region 选择 dialog (len>=2 时)
Phase 4: E2E 真窗口 + MutationObserver + Rule 9 验证

Fixes Bug #25 upstream parser (chat-layer fallback 留着但不再是主通道).
```

---

## 起步 checklist (新 session)

1. TaskGet #231 — 确认 task 描述 + 本 handoff
2. 读 qa-prompt.txt v2.2 r2 @ 项目根
3. TaskList — 本 session task 已完成 #266-#279, 新 session #231 为主任务
4. 切 `e2e/v1-framework` 分支, pull 最新 (commit `216710a97` HEAD 或更新)
5. 制备测试 Excel (或找一个已有多表 Excel 样本 — 可能之前青花椒测试里有)
6. 起步读 3 文件: `excel_parser.py` / `structure_detector.py` / `ExcelUpload.vue`

---

## 硬规则提醒

1. **test 环境唯一**: test URL `http://139.196.165.140:8097/`, 绝不动 prod
2. **`--env prod` 必须用户明确说"部 prod"** 才执行
3. **MutationObserver 必装**, 不用 querySelectorAll (Bug #28 平反教训)
4. **console-error + network 每步都查**, 不光 snapshot
5. **Rule 9 数据抽检**: Top 3 byte-match 不够, 中段 + 末段都要 (Bug #37 教训)
6. **scope 干净**: commit 前 `git status --short` 确认 staging 只含本次改动

---

## 已知相关 context

- **Bug #25 原 fallback 代码**: `backend/python/chat.py` 有行数据 key 对齐 field_defs 的降级逻辑, 留着作为兜底
- **青花椒真实数据样本**: `tests/qhj_sales_bug16.csv` + 其他 `.xlsx` 可能有多表案例, 参考 `smartbi维度分析/大众点评/真实餐饮连锁数据/`
- **test upload_id 范例**: F002/3735 (Restaurant-hotpot-normal-s42.xlsx), F001 可能也有

---

## Prod 部署 待做 (pending, 需用户明确同意)

当前 4 commits 都 test 绿未部 prod:
- `08c223e13` Bug #37
- `9a8efa5a5` Bug #34b + #38 + qa-prompt r2
- `f3a3f135b` Bug #31
- `8d9f4d7ec` Bug #40
- (并行 session 另有 security Phase 3-6 commits 也在 branch 上)

若本 session 结束前用户授权 "部 prod", 执行:
```bash
./scripts/deploy/deploy-backend.sh --env prod      # Java 10010
./scripts/deploy/deploy-smartbi-python.sh --env prod  # Python 8083
./scripts/deploy/deploy-web-admin.sh --env prod    # web-admin 139:8086 (会 YES-PROD 确认)
```
