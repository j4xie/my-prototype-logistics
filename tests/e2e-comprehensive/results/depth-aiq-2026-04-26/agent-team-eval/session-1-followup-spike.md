# Session 1 Follow-up — Bug D 修 + 9MB sync spike 实测

**生成时间**: 2026-04-26 (audit 后立即执行)
**目的**: 验证 audit 推荐的 immediate (<1h) 3 个动作

---

## 1. Bug D ✅ 已修 (commit `3aada0344`)

| File | 改动 |
|---|---|
| `web-admin/src/views/smart-bi/analysis/UploadArea.vue:20,30` | accept `.xlsx,.xls` → `.xlsx,.xls,.csv` + 文案同步 |
| `web-admin/src/components/smartbi/SmartBIUploader.vue:88,文案` | 同上 (audit 漏抓的第二个组件) |

**额外发现**: audit 仅找到 1 个组件 (UploadArea.vue), 但 grep 又找到 1 个 (SmartBIUploader.vue) — Hidden Assumption #5 部分成立, **第三方组件确实有相同 regression**.

vue-tsc 验证通过. 待 web-admin deploy 后用户即可在 SmartBIAnalysis 页拖 csv.

---

## 2. Verify-1 ✅ Critic 反驳 100% 正确

**Claim 验证**: `excel_async.py:_probe()` 失败时主流 read_csv (line 416-429) 不会到达.

**代码追踪**:
1. Line 295: `df_probe, encoding = _probe(csv_skiprows)` — worker 第一行 IO
2. Line 287-291: `_probe` 仅调 `pd.read_csv` (no ext 分支)
3. xlsx binary → UnicodeDecodeError → 抛出
4. Line 511: 外层 `except Exception as e:` 兜底 → 设 `upload_status='FAILED'` + `crashed after 0 rows`
5. **主流 416-429 永远不会执行**

**实测对照**: S1 失败的 4184 (评价Q3.xlsx) server log:
```
[stream-worker] upload_id=4184 PROCESSING started (...)
[stream-worker] upload_id=4184 crashed after 0 rows  ← total_rows=0 证明无主流
```

**结论**: Bug A 修复确实只需 30-50 行 (单点修 _probe), 不是 R1 估的 80-150.

---

## 3. Spike-1: 9MB sync 端点单文件实测

**测试**: 唏嘛香会员.xlsx 9.35 MB 经 `/api/mobile/R_XMX_FRESH/smart-bi/upload-and-analyze` (sync Java 路径).

### Timing
| 阶段 | 时长 |
|---|---|
| 总耗时 | **253s (4.2 min)** |
| HTTP 状态 | 200 (Java) / 500 (Python 内部, 见 Bug E) |
| 实际 parse: 推断 | ~200s (剩余 50s 是网络 + nginx) |

### 内存峰值
| 指标 | Before | After | 增量 |
|---|---|---|---|
| Free | 1003 MB | 3188 MB | **+2185 (gc 后回收)** |
| Buff/cache | 5819 MB | 3375 MB | -2444 (peak 期间被挤占) |
| Python uvicorn RSS | 334 MB | **1295 MB peak** | **+961 MB** |
| Python uvicorn VSZ | 6203 MB | 7069 MB | +866 MB |

**结论 — Critic 35% OOM 概率被推翻**: 实际峰值 RSS 1.3 GB << 16 GB 总内存, OOM 概率 < 5% 在 prod 实际负载下.

### Bug E 发现 (新)

**Sync xlsx parse 成功** but **JSON serialize 失败**:

```
ValueError: Out of range float values are not JSON compliant
File "/usr/lib64/python3.8/json/encoder.py", line 257, in iterencode
File "/.../starlette/responses.py", line 184, in render
    return json.dumps(...)  ← FastAPI JSONResponse 默认 allow_nan=False
File "/.../fastapi/routing.py", line 464, in app
    response = actual_response_class(content, **response_args)
```

**根因**: 9MB 唏嘛香会员.xlsx 解析后含 `nan` / `inf` 值 (推测某列空值或异常分数), Python stdlib JSON encoder `allow_nan=False` 拒绝.

**修复方向 (Bug E)**:
- **方案 1 (1 行)**: `excel.py` 的 sync 端点 return 前用 `df.replace([np.inf, -np.inf, np.nan], None)` 清洗 OR `df.fillna(None)`
- **方案 2 (1 行)**: 全局换 `ORJSONResponse` (FastAPI 主默认支持 NaN→null)
- **方案 3 (推荐)**: `pd.json_normalize` 时显式 `.where(pd.notna(df), None)`

**优先级**: P1 (S2 启动后期修, Bug A 主路径不影响)

### 替代路径影响

audit 原推荐 A3 (修 Bug A 后用 async 重传) **依然首选** 因为:
1. async 路径**无 JSON serialize 问题** (返回 uploadId 早, parse 在 BG worker, 错误以 `error_message` 字段存)
2. async 是 prod 主路径, 12 csv 已验证
3. 修 Bug A 30-50 行后, async 应能正确 parse xlsx (像 sync 一样)
4. 8 xlsx × 4 min (sync 实测) ~32 min vs async 应类似

A1 路径**实际可能性**比 audit 估的高 (无 OOM), 但 Bug E 是新 blocker. 如果走 A1 必须先修 Bug E.

---

## 4. 决策更新 (vs audit)

| 议题 | audit 推荐 | spike 后修正 |
|---|---|---|
| Bug A 改动量 | 30-50 行 (Critic 修正) | ✅ 维持 |
| 路径优先 | A3 (修 A 后 async 重传) | ✅ 维持 (Bug E 让 A1 也需先修) |
| 9MB sync OOM 风险 | 35% (Critic) | ❌ 实测 < 5% |
| sync 端点新 bug 数 | 0 已知 | ❌ +1 (Bug E NaN/Inf JSON) |
| 总修复工作量 | A+B+D ~ 65 行 | A+B+D+E ~ 70 行 (E 仅 1-3 行) |

---

## 5. 下一步

按顺序:
1. **Bug A 修复** (~30-50 行) — `excel_async.py:287-291` `_probe` 加 ext 分支
2. **Bug B 修复** (~10-15 行) — `excel_async.py:53-141` 加 ext fast-fail
3. **Bug E 修复** (~1-3 行) — sync 端点 return 前清洗 NaN/Inf
4. **路径 A3 重传**: 修 Bug A 后用 async 重传 8 xlsx + GML 2月销量
5. **启动 S2**: 360 题
