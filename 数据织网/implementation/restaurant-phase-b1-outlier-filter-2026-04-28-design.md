# 餐饮 Phase B-1 — Outlier Filter Design

**生成时间**: 2026-04-28
**Branch**: `e2e/v1-framework`
**Phase A 完成 commit**: `cc4e805b3` (safe-commit.sh + rule 5b)
**Phase B 已 ship**: 6-keyword classifier (`80ec7202f`) + factoryAge business date (`05cd07e34`+`c8dee0a98`) + cross-factory tightening (`05cd07e34`) + safe-commit infra (`cc4e805b3`)
**Brainstorm 流程**: superpowers:brainstorming → general-purpose agent 长期审计 (3.5/5 评分, 3 项 HIGH 长期债已修正)
**Status**: Design approved by user, awaiting writing-plans handoff

---

## 1. 背景与目标

### 1.1 问题陈述

Phase A 让客户在 `/restaurant/data-completeness` 看到 6 模块覆盖率 (R_XMX 已升 16% → 29%, F002 18%, R_BEJ 0%)。但完整度只回答 "我有什么数据", 不回答 "数据干不干净"。客户 admin 巡检时无法快速识别:

- 今天 wastage cost ¥8,500 是异常还是正常? (本月平均 ¥1,200-¥3,400)
- 上周 stocktaking shortage ¥1,800 比基线高多少倍?
- 是 sample 录错了, 还是真的业务异常?

目前没有任何信号让 admin 注意到 outlier, 必须靠人工逐日翻 detail page。

### 1.2 目标

- **后端**: 建独立 `OutlierService`, 暴露 outlier detection API, 可被任何前端 (B-1 tab / B-3 dashboard / 上传图表 / 移动端) 复用
- **前端**: 在已有 `/restaurant/data-completeness` 页加 "数据质量" tab, 第一版展示 4 cost 信号 IQR outlier 列表 + dismiss 操作
- **算法**: IQR 1.5×fence + 30 天滚动窗口 + 2 级 fallback (本工厂 → 全网 baseline), 算法库共享 utils 让 chat AnomalyDetection 后续可统一
- **持久化**: dismissal 表完整 schema (含 reason / expires / snapshot 列), API 返回 `baseline_source` 透明标记

### 1.3 Scope 划分

**In scope (B-1 第一版)**:
- 4 cost 信号 totals 维度 outlier 检测 (`requisition_cost_total` / `wastage_cost_total` / `stocktaking_shortage_total` / `stocktaking_surplus_total`)
- IQR 1.5×fence + 30 天滚动 + N≥10 + 2 级 fallback
- 完整度页加 "数据质量" tab + 异常表格 + 总览数字
- dismiss / un-dismiss + RLS FORCE 隔离
- admin-tier 权限 (factory_admin / permission_admin / factory_super_admin / platform_admin)
- API 返回 `baseline_source` + `baseline_n` (round bucket)
- `outlier_stats.py` 同时 export iqr() + zscore() 函数 (DataDog 决策)
- KPI_KINDS 配置驱动 (常量 list, 不 hard-code SQL)

**Out of scope (Phase B-N 或 backlog, 见 §11)**:
- EAV per-dim 下钻 (接口预留 `detect_per_dim()` raise NotImplementedError)
- z-score 双触发 (utils 已 export, 但 service 不调)
- dismiss reason / expires UI (字段已建, 第一版 UI 不展示)
- 趋势图 (line chart with outlier 高亮)
- 邮件 / push 告警
- 4-eye gate (dismiss 不污染业务实体, 误 dismiss 可 un-dismiss 纠正)
- B-3 dashboard 整体集成
- qty / count 信号 (噪音高, 业务价值低)
- AnomalyDetection 切共享 utils (utils 已建好, 但 AnomalyDetection 迁移留后续)
- SECURITY DEFINER audit table
- Redis cache (单 worker prod 现状下不需要)

---

## 2. 核心决策

### 2.1 决策表 (Q1-Q6 + reviewer 修正)

| # | 决策 | 选择 | 长期理由 |
|---|---|---|---|
| Q1 | 集成位置 | **后端独立 outlier service + API** + **前端完整度页加 "数据质量" tab** | tab 比 chip 嵌入清晰 (完整度管"缺什么", 异常管"脏不脏" 平级); API 解耦让 B-3 dashboard / 上传页 chart 后续复用 |
| Q2 | 算法 | **单 IQR 1.5×fence** + **算法库共享 utils 同时 export iqr()+zscore()** | 餐饮 cost 数据右偏, IQR 不被节假日单点拉跑; A→C 是加法可逆, C→A 是减法 breaking; 共享 utils 让 AnomalyDetection 后续切 IQR 数字打架问题源头消除 |
| Q3 | 数据源 | **`agg_restaurant_daily_totals` per-day scalar** + **4 cost 信号** + **EAV 接口预留 `detect_per_dim()`** | 第一版客户先看总览有动力才下钻; EAV 21K 行/工厂/月数据量大第一版无证据需要; 4 cost 比 9 全字段不会 chip 满屏 |
| Q4 | 窗口 + fallback | **30 天滚动 + N≥10 + 2 级 fallback (本工厂 → 全网)** + **SECURITY DEFINER `get_global_kpi_stats()`** | 30 天对齐 completeness 页 max=30 + 餐饮季节性以节假日为主 (90 天会混春节); N=10 让正常运营 1-2 周的工厂用本地; SECURITY DEFINER 是 RLS bypass 标准方式且只暴露聚合数 |
| Q5 | UX + 时机 + dismissal | **简单异常表格 + 总览数字 + cache 5min + `outlier_dismissals` 表 + 主动 invalidate** | tab UI 紧凑可巡检; cache 5min 跟 completeness 页 pattern 一致; dismissal 防 chip 麻木; un-dismiss 让误操作可逆 |
| Q6 | 权限 | **admin-tier 看+dismiss + 不加 4-eye + 支持 un-dismiss + Quick-Win 3 cross-factory pattern** | 复用 Phase A `require_admin` 零成本; dismiss 不污染业务实体, 误 dismiss 可 un-dismiss; 加 4-eye 是错配 + 拖慢运营 |

### 2.2 Reviewer 修正 (3 项 HIGH 长期债 + 2 项 MEDIUM)

| # | 修正项 | 严重度 | 修法 |
|---|---|---|---|
| R1 | `outlier_dismissals` 表 schema 太窄, 必加 reason/expires/snapshot 列 | HIGH (12 月内必 migration) | 表第一版就建全 8 列 (`reason`/`expires_at`/`snapshot_value`/`snapshot_q1`/`snapshot_q3`/`snapshot_baseline_source`/`notes`/已有 4 列), UI 只用前 5, 其他 NULL |
| R2 | API 必须返 `baseline_source` 透明标记 fallback 来源 | HIGH (admin 误以为本工厂数字) | API response 每条 outlier 加 `baselineSource: 'self'\|'global'\|'none'` + `baselineN: number (round bucket)`, FE 第一版必须 render 灰色 badge "基于全网基线" |
| R3 | `outlier_stats.py` 第一版必须同时 export iqr() + zscore() + OutlierAlgorithm dataclass | MEDIUM-HIGH (chat AnomalyDetection 数字打架) | utils 文件第一版 export 4 个函数 + 1 个 dataclass, AnomalyDetection 切迁是改 import (留后续) |
| R4 | `get_global_kpi_stats()` n 字段 round bucket | MEDIUM (商业敏感推理风险) | function 内部 round n 到 `<10` / `10-49` / `50-99` / `100-499` / `500+` 5 桶, header SQL doc 明确唯一调用方 |
| R5 | KPI_KINDS 配置驱动 | MEDIUM | 常量 `DEFAULT_KPI_KINDS = [...]`, service 接口 `kpi_kinds=None` default 用常量, 后续加信号是 append list 不动 SQL 逻辑 |

### 2.3 Reviewer 不接受项

| reviewer 建议 | 否决理由 | 替代方案 |
|---|---|---|
| 默认 fallback 关闭, opt-in | 新工厂前 2 周没数据 fallback off 等于完全没信号, 违反 B-1 初衷 | 默认 on + baseline_source 透明标记 (R2) + n round bucket (R4) |
| 4-eye feature flag | 现在没证据 dismiss 滥用; dismissal 表已有 dismissed_by 审计可追溯; 加 flag 是预设需求 | spec backlog 写 "若客户单工厂 admin > 5, 考虑加 4-eye gate", 1 PR ~30 行 |

---

## 3. 数据模型

### 3.1 数据源 (已存在, 不动)

`agg_restaurant_daily_totals` (smartbi_db, RLS FORCE):
```sql
CREATE TABLE agg_restaurant_daily_totals (
    factory_id            VARCHAR(50) NOT NULL,
    date                  DATE        NOT NULL,
    requisition_count     INT,
    requisition_qty_total NUMERIC(14,4),
    requisition_cost_total NUMERIC(14,2),     -- B-1 信号 1
    wastage_count         INT,
    wastage_qty_total     NUMERIC(14,4),
    wastage_cost_total    NUMERIC(14,2),       -- B-1 信号 2
    stocktaking_count     INT,
    stocktaking_shortage_total NUMERIC(14,4),  -- B-1 信号 3 (亏损 abs)
    stocktaking_surplus_total  NUMERIC(14,4),  -- B-1 信号 4 (盘盈)
    version               BIGINT    NOT NULL DEFAULT 1,
    computed_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (factory_id, date)
);
-- RLS FORCE policy: tenant_isolation USING factory_id = current_setting('app.factory_id', true)
-- Index: idx_agg_rest_totals_factory_date (factory_id, date DESC)
```

**B-1 不动此表**, 只读取。

### 3.2 新建表 — `outlier_dismissals`

```sql
-- Migration: V20260502_06__outlier_dismissals.sql
CREATE TABLE outlier_dismissals (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    anomaly_date DATE NOT NULL,
    kpi_kind VARCHAR(50) NOT NULL,
    dismissed_by VARCHAR(50) NOT NULL,
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- ↓ Reviewer R1: schema 全建, UI 第一版不展示
    reason VARCHAR(50) NULL,                   -- 后续 downselect: holiday/promotion/data_error/inventory_correction/other
    expires_at TIMESTAMPTZ NULL,               -- NULL = 永久 dismiss; 设值 = 临时 dismiss 到期重新触发
    snapshot_value NUMERIC(18,4),              -- dismiss 当时的异常值
    snapshot_q1 NUMERIC(18,4),                 -- dismiss 当时的 IQR Q1
    snapshot_q3 NUMERIC(18,4),                 -- dismiss 当时的 IQR Q3
    snapshot_baseline_source VARCHAR(10),      -- 'self' | 'global'
    notes TEXT NULL,
    UNIQUE (factory_id, anomaly_date, kpi_kind)
);

ALTER TABLE outlier_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlier_dismissals FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON outlier_dismissals FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

CREATE INDEX idx_outlier_dismissals_factory_kpi
    ON outlier_dismissals (factory_id, kpi_kind, anomaly_date DESC);

CREATE INDEX idx_outlier_dismissals_active
    ON outlier_dismissals (factory_id, kpi_kind)
    WHERE expires_at IS NULL OR expires_at > NOW();

COMMENT ON TABLE outlier_dismissals IS
    '餐饮 Phase B-1: admin 标记的 "已确认非异常" 记录, 用于过滤 outlier 列表. RLS FORCE 隔离, 必须 set_config(app.factory_id) inside transaction.';
COMMENT ON COLUMN outlier_dismissals.reason IS
    'Phase B-1 第一版 NULL; 后续 UI 加 downselect: holiday/promotion/data_error/inventory_correction/other';
COMMENT ON COLUMN outlier_dismissals.expires_at IS
    'Phase B-1 第一版 NULL (永久 dismiss); 后续 UI 加临时 dismiss (e.g. 节假日 7 天后重新触发)';
COMMENT ON COLUMN outlier_dismissals.snapshot_value IS
    'dismiss 当时的异常值, 后续 cache 失效阈值变了让 admin 能回看 "我当时为什么 dismiss"';
```

### 3.3 新建 SQL function — `get_global_kpi_stats`

```sql
-- Migration: V20260502_07__get_global_kpi_stats_fn.sql
--
-- Reviewer R4: round n 到 bucket 防止规模反推, header doc 明确唯一调用方
--
-- 唯一调用方: backend/python/smartbi/services/outlier_service.py
-- 用途: 当本工厂样本不足 (N<10) 时, 提供全网基线让新工厂也能看到信号
-- 返回: q1, q3, median, n_bucket (NOT 精确 n)
-- 安全: SECURITY DEFINER bypass RLS, 仅暴露聚合数, 不暴露任何明细 row

CREATE OR REPLACE FUNCTION get_global_kpi_stats(
    p_kpi_kind VARCHAR,
    p_window_days INT DEFAULT 30
)
RETURNS TABLE (
    q1 NUMERIC,
    q3 NUMERIC,
    median NUMERIC,
    n_bucket VARCHAR    -- '<10' | '10-49' | '50-99' | '100-499' | '500+'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_n INT;
    v_value_col TEXT;
BEGIN
    -- 校验 kpi_kind 防 SQL injection
    IF p_kpi_kind NOT IN (
        'requisition_cost_total',
        'wastage_cost_total',
        'stocktaking_shortage_total',
        'stocktaking_surplus_total'
    ) THEN
        RAISE EXCEPTION 'Invalid kpi_kind: %', p_kpi_kind;
    END IF;

    IF p_window_days < 1 OR p_window_days > 365 THEN
        RAISE EXCEPTION 'window_days out of range: %', p_window_days;
    END IF;

    -- 动态拼列名 (kpi_kind 已校验白名单)
    v_value_col := p_kpi_kind;

    RETURN QUERY EXECUTE format(
        'SELECT
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY %I)::NUMERIC AS q1,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY %I)::NUMERIC AS q3,
            PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY %I)::NUMERIC AS median,
            CASE
                WHEN COUNT(*) FILTER (WHERE %I IS NOT NULL) < 10 THEN ''<10''
                WHEN COUNT(*) FILTER (WHERE %I IS NOT NULL) < 50 THEN ''10-49''
                WHEN COUNT(*) FILTER (WHERE %I IS NOT NULL) < 100 THEN ''50-99''
                WHEN COUNT(*) FILTER (WHERE %I IS NOT NULL) < 500 THEN ''100-499''
                ELSE ''500+''
            END AS n_bucket
         FROM agg_restaurant_daily_totals
         WHERE date >= CURRENT_DATE - ($1 || '' days'')::interval
           AND %I IS NOT NULL',
        v_value_col, v_value_col, v_value_col,
        v_value_col, v_value_col, v_value_col, v_value_col,
        v_value_col
    ) USING p_window_days;
END;
$$;

COMMENT ON FUNCTION get_global_kpi_stats(VARCHAR, INT) IS
    'Phase B-1 outlier fallback: 全网聚合基线. SECURITY DEFINER bypass RLS. 唯一调用方: smartbi/services/outlier_service.py. n_bucket 而非精确 n 防止规模反推.';

-- 撤销 PUBLIC 权限, 仅特定 role 可调
REVOKE ALL ON FUNCTION get_global_kpi_stats(VARCHAR, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_global_kpi_stats(VARCHAR, INT) TO smartbi_app;
```

---

## 4. API Contract

### 4.1 GET /api/restaurant/outliers

**Auth**: admin-tier (复用 `require_admin`)
**Cross-factory**: `role != 'platform_admin' and factoryId != jwt_factory_id → 403` (复用 Quick-Win 3)

**Query params**:
- `factoryId: string (required)` — 50 字符内
- `windowDays: int (optional, default 30)` — 1-365

**Response (200)**:
```typescript
{
  factoryId: string;
  windowDays: number;
  cachedAt: string;       // ISO timestamp
  summary: {
    totalAnomalies: number;     // 待复核数 (排除 dismissed)
    dismissedThisMonth: number; // 本月已 dismiss 数
    insufficientKpis: string[]; // 全网都 N<10 的 kpi_kind list
  };
  outliers: [
    {
      anomalyDate: string;      // ISO date
      kpiKind: string;          // 'wastage_cost_total' etc
      kpiLabel: string;         // '损耗成本' (中文 display)
      value: number;
      q1: number;
      q3: number;
      iqr: number;              // q3 - q1
      lowerFence: number;       // q1 - 1.5*iqr
      upperFence: number;       // q3 + 1.5*iqr
      deviationX: number;       // (value - upperFence) / iqr 或 (lowerFence - value) / iqr, 取 abs
      severity: 'high' | 'medium';  // high if deviationX > 2 else medium
      direction: 'above' | 'below';  // above upperFence or below lowerFence
      // ↓ Reviewer R2: 透明标记 baseline 来源
      baselineSource: 'self' | 'global';
      baselineN: '<10' | '10-49' | '50-99' | '100-499' | '500+';
    }
  ];
  dismissed: [
    {
      id: number;
      anomalyDate: string;
      kpiKind: string;
      kpiLabel: string;
      dismissedBy: string;
      dismissedAt: string;
      snapshotValue: number;
      snapshotQ1: number;
      snapshotQ3: number;
      snapshotBaselineSource: 'self' | 'global';
    }
  ];
}
```

**Error codes**:
- 400: factoryId 空 / 长度超 50 / windowDays 越界
- 401: 未登录
- 403: 非 admin-tier 或 cross-factory 越权
- 503: DB 连接失败

### 4.2 POST /api/restaurant/outliers/dismiss

**Auth**: admin-tier + cross-factory check 同上

**Request body**:
```json
{
  "factoryId": "F002",
  "anomalyDate": "2026-04-25",
  "kpiKind": "wastage_cost_total",
  "snapshotValue": 8500,
  "snapshotQ1": 1200,
  "snapshotQ3": 3400,
  "snapshotBaselineSource": "self"
}
```

**Validation rules**:
- `factoryId`: required, string ≤ 50 chars
- `anomalyDate`: required, ISO date string (YYYY-MM-DD)
- `kpiKind`: required, must be in `DEFAULT_KPI_KINDS` whitelist (else 400)
- `snapshotValue` / `snapshotQ1` / `snapshotQ3`: required, number
- `snapshotBaselineSource`: required, must be `'self'` or `'global'` (else 400 "无效 baselineSource")

**Response (201)**:
```json
{
  "id": 123,
  "factoryId": "F002",
  "anomalyDate": "2026-04-25",
  "kpiKind": "wastage_cost_total",
  "dismissedBy": "restaurant_admin1",
  "dismissedAt": "2026-04-28T15:30:00Z"
}
```

**Side effects**:
- 写 `outlier_dismissals` (RLS GUC + transaction)
- Invalidate cache for `factoryId`

**Error codes**:
- 400: 任何 required field 空
- 401/403: 同 GET
- 409: UNIQUE 冲突 ("该异常已被标记 ✓ 非异常")

### 4.3 DELETE /api/restaurant/outliers/dismiss/{id}

**Auth**: admin-tier + cross-factory check (检查 dismissal row 的 factory_id)

**Response (204)** No content.

**Side effects**:
- DELETE `outlier_dismissals` row (RLS GUC + transaction)
- Invalidate cache for `factoryId`

**Error codes**:
- 401/403: 同上
- 404: dismissal id 不存在

---

## 5. 后端架构

### 5.1 新建文件 (5 个)

#### 5.1.1 `backend/python/smartbi/utils/outlier_stats.py` (~120 行)

纯函数 + dataclass, 无 I/O, 单测覆盖。

```python
"""共享 outlier 检测算法库 (Phase B-1).

Reviewer R3: 第一版同时 export iqr() + zscore(), 让 chat AnomalyDetection
后续切迁源头消除数字打架问题. AnomalyDetection 迁移在 Phase B-N backlog.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Literal, List
import statistics


@dataclass(frozen=True)
class IQRFence:
    q1: float
    q3: float
    iqr: float
    lower: float    # q1 - multiplier*iqr
    upper: float    # q3 + multiplier*iqr
    multiplier: float


@dataclass(frozen=True)
class Outlier:
    index: int
    value: float
    deviation_x: float    # 偏离倍数 (>= 1.0 表示越界)
    direction: Literal['above', 'below']


def iqr_fence(values: List[float], multiplier: float = 1.5) -> IQRFence | None:
    """计算 IQR fence. 返回 None if N < 4 (无法算 Q1/Q3).

    Note: Python statistics.quantiles(method='exclusive') 跟 PG PERCENTILE_CONT
    都是 continuous percentile, 数值差异通常 < 1% (interpolation 算法略不同).
    单测用 pytest.approx(rel=0.01) 容差对比. 实际 outlier 检测对此差异不敏感
    (1% 误差不会让 borderline 数字跨越 1.5×IQR fence).

    本地 N>=10 路径 100% Python (此函数), fallback 路径 100% PG (SECURITY DEFINER
    function), 单一 outlier 不会跨算法混用.
    """
    n = len(values)
    if n < 4:
        return None
    sorted_vals = sorted(values)
    q1, _, q3 = statistics.quantiles(sorted_vals, n=4, method='exclusive')
    iqr = q3 - q1
    return IQRFence(
        q1=q1, q3=q3, iqr=iqr,
        lower=q1 - multiplier * iqr,
        upper=q3 + multiplier * iqr,
        multiplier=multiplier,
    )


def find_outliers_iqr(values: List[float], fence: IQRFence) -> List[Outlier]:
    """返回所有越界的 outlier."""
    outliers = []
    for i, v in enumerate(values):
        if v > fence.upper:
            dev = (v - fence.upper) / fence.iqr if fence.iqr > 0 else 0
            outliers.append(Outlier(i, v, deviation_x=dev, direction='above'))
        elif v < fence.lower:
            dev = (fence.lower - v) / fence.iqr if fence.iqr > 0 else 0
            outliers.append(Outlier(i, v, deviation_x=dev, direction='below'))
    return outliers


def zscore_outliers(values: List[float], sigma: float = 2.0) -> List[Outlier]:
    """Z-score outlier 检测 — 第一版未被 OutlierService 调用,
    留给 AnomalyDetection 后续切迁."""
    n = len(values)
    if n < 2:
        return []
    mean = statistics.mean(values)
    std = statistics.stdev(values)
    if std == 0:
        return []
    outliers = []
    for i, v in enumerate(values):
        z = (v - mean) / std
        if abs(z) >= sigma:
            outliers.append(Outlier(
                i, v, deviation_x=abs(z),
                direction='above' if z > 0 else 'below',
            ))
    return outliers


@dataclass
class OutlierAlgorithm:
    """统一接口让 OutlierService / AnomalyDetection 共用算法."""
    name: Literal['iqr', 'zscore']
    threshold: float    # IQR multiplier or sigma

    def detect(self, values: List[float]) -> List[Outlier]:
        if self.name == 'iqr':
            fence = iqr_fence(values, multiplier=self.threshold)
            if fence is None:
                return []
            return find_outliers_iqr(values, fence)
        else:  # zscore
            return zscore_outliers(values, sigma=self.threshold)
```

#### 5.1.2 `backend/python/smartbi/services/outlier_service.py` (~280 行)

业务逻辑层。

```python
"""餐饮 outlier 检测服务 (Phase B-1).

复用 Phase A pattern:
- get_pg_pool() 单例 (smartbi/config.py)
- RLS GUC + conn.transaction() 强制 (W0.4 finding 3)

Reviewer R5: KPI_KINDS 配置驱动, 后续加信号是 append list.
"""
from __future__ import annotations
import logging
import asyncio
from dataclasses import dataclass, field
from typing import List, Literal, Optional
from datetime import date

from smartbi.utils.outlier_stats import (
    OutlierAlgorithm, iqr_fence, find_outliers_iqr, IQRFence,
)

logger = logging.getLogger(__name__)

# Reviewer R5: 配置驱动, 不 hard-code 4 信号
DEFAULT_KPI_KINDS = [
    "requisition_cost_total",
    "wastage_cost_total",
    "stocktaking_shortage_total",
    "stocktaking_surplus_total",
]

KPI_LABELS = {
    "requisition_cost_total": "领料成本",
    "wastage_cost_total": "损耗成本",
    "stocktaking_shortage_total": "盘亏",
    "stocktaking_surplus_total": "盘盈",
}

LOCAL_N_THRESHOLD = 10        # N>=10 用本地, 否则 fallback global
DEFAULT_WINDOW_DAYS = 30
IQR_MULTIPLIER = 1.5


@dataclass
class DetectedOutlier:
    anomaly_date: date
    kpi_kind: str
    value: float
    q1: float
    q3: float
    iqr: float
    lower_fence: float
    upper_fence: float
    deviation_x: float
    severity: Literal['high', 'medium']
    direction: Literal['above', 'below']
    baseline_source: Literal['self', 'global']
    baseline_n: str    # '<10' | '10-49' | ...


class OutlierService:
    """检测 outlier + 处理 fallback + 排除 dismissed."""

    async def detect_totals(
        self,
        factory_id: str,
        window_days: int = DEFAULT_WINDOW_DAYS,
        kpi_kinds: Optional[List[str]] = None,
    ) -> tuple[List[DetectedOutlier], List[str]]:
        """主入口. 返 (outliers, insufficient_kpis).

        insufficient_kpis = 全网都 N<10 的 kpi_kind list, 前端显示 "样本不足".
        """
        kpi_kinds = kpi_kinds or DEFAULT_KPI_KINDS
        from smartbi.config import get_pg_pool
        pool = await get_pg_pool()
        if pool is None:
            raise RuntimeError("SmartBI pool unavailable")

        # 并行 4 个 kpi
        tasks = [
            self._detect_one_kpi(pool, factory_id, kpi, window_days)
            for kpi in kpi_kinds
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_outliers = []
        insufficient = []
        for kpi, res in zip(kpi_kinds, results):
            if isinstance(res, Exception):
                logger.warning(f"[outlier] kpi={kpi} failed: {res}")
                continue
            outliers, was_insufficient = res
            if was_insufficient:
                insufficient.append(kpi)
            all_outliers.extend(outliers)

        # 按日期降序
        all_outliers.sort(key=lambda o: o.anomaly_date, reverse=True)
        return all_outliers, insufficient

    async def _detect_one_kpi(
        self, pool, factory_id: str, kpi_kind: str, window_days: int
    ) -> tuple[List[DetectedOutlier], bool]:
        """检测单个 kpi. 返 (outliers, was_insufficient_locally_AND_globally)."""
        # Step 1: query 本工厂 30 天
        local_data = await self._query_local(pool, factory_id, kpi_kind, window_days)

        if len(local_data) >= LOCAL_N_THRESHOLD:
            # Step 2: 用本地 IQR
            return self._compute_outliers(
                local_data, kpi_kind, baseline_source='self',
                baseline_n=self._bucket_n(len(local_data)),
            ), False

        # Step 3: fallback global
        global_stats = await self._query_global_baseline(pool, kpi_kind, window_days)
        if global_stats is None or global_stats['n_bucket'] == '<10':
            # 全网也 N<10, 跳过
            return [], True

        # Step 4: 用全网 baseline 算 outlier (但点是本工厂的)
        return self._compute_outliers_with_baseline(
            local_data, kpi_kind,
            q1=global_stats['q1'], q3=global_stats['q3'],
            baseline_source='global', baseline_n=global_stats['n_bucket'],
        ), False

    async def _query_local(
        self, pool, factory_id: str, kpi_kind: str, window_days: int
    ) -> list[tuple[date, float]]:
        """查询本工厂 N 天数据. 返 [(date, value), ...].

        ⚠️ W0.4 finding 3: RLS FORCE, 必须 GUC + transaction.
        """
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "SELECT set_config('app.factory_id', $1, true)", factory_id
                )
                rows = await conn.fetch(
                    f"""
                    SELECT date, {kpi_kind} AS value
                    FROM agg_restaurant_daily_totals
                    WHERE factory_id = $1
                      AND date >= CURRENT_DATE - ($2 || ' days')::interval
                      AND {kpi_kind} IS NOT NULL
                    ORDER BY date
                    """,
                    factory_id, str(window_days),
                )
        return [(r['date'], float(r['value'])) for r in rows]

    async def _query_global_baseline(
        self, pool, kpi_kind: str, window_days: int
    ) -> dict | None:
        """调用 SECURITY DEFINER function. 不需 GUC (function bypass RLS)."""
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT q1, q3, median, n_bucket FROM get_global_kpi_stats($1, $2)",
                kpi_kind, window_days,
            )
        if row is None or row['q1'] is None:
            return None
        return dict(row)

    def _compute_outliers(
        self, local_data, kpi_kind, baseline_source, baseline_n,
    ) -> List[DetectedOutlier]:
        """用本地数据算 IQR + 检测."""
        values = [v for _, v in local_data]
        fence = iqr_fence(values, multiplier=IQR_MULTIPLIER)
        if fence is None:
            return []
        return self._build_outliers(local_data, fence, kpi_kind, baseline_source, baseline_n)

    def _compute_outliers_with_baseline(
        self, local_data, kpi_kind, q1, q3, baseline_source, baseline_n,
    ) -> List[DetectedOutlier]:
        """用 global q1/q3 算 fence + 检测本工厂数据."""
        if not local_data:
            return []
        iqr = float(q3 - q1)
        fence = IQRFence(
            q1=float(q1), q3=float(q3), iqr=iqr,
            lower=float(q1) - IQR_MULTIPLIER * iqr,
            upper=float(q3) + IQR_MULTIPLIER * iqr,
            multiplier=IQR_MULTIPLIER,
        )
        return self._build_outliers(local_data, fence, kpi_kind, baseline_source, baseline_n)

    def _build_outliers(
        self, local_data, fence, kpi_kind, baseline_source, baseline_n,
    ) -> List[DetectedOutlier]:
        outliers = []
        for d, v in local_data:
            if v > fence.upper:
                dev = (v - fence.upper) / fence.iqr if fence.iqr > 0 else 0
                outliers.append(self._make_outlier(d, kpi_kind, v, fence, dev, 'above', baseline_source, baseline_n))
            elif v < fence.lower:
                dev = (fence.lower - v) / fence.iqr if fence.iqr > 0 else 0
                outliers.append(self._make_outlier(d, kpi_kind, v, fence, dev, 'below', baseline_source, baseline_n))
        return outliers

    def _make_outlier(self, anomaly_date, kpi_kind, value, fence, dev, direction, source, n):
        return DetectedOutlier(
            anomaly_date=anomaly_date, kpi_kind=kpi_kind, value=value,
            q1=fence.q1, q3=fence.q3, iqr=fence.iqr,
            lower_fence=fence.lower, upper_fence=fence.upper,
            deviation_x=dev,
            severity='high' if dev > 2.0 else 'medium',
            direction=direction,
            baseline_source=source, baseline_n=n,
        )

    @staticmethod
    def _bucket_n(n: int) -> str:
        if n < 10: return '<10'
        if n < 50: return '10-49'
        if n < 100: return '50-99'
        if n < 500: return '100-499'
        return '500+'

    async def detect_per_dim(self, *args, **kwargs):
        """EAV per-dim 下钻 — Phase B-N backlog.

        接口预留, 让 B-3 dashboard 加点击下钻时无需改 service signature.
        """
        raise NotImplementedError(
            "Per-dim outlier detection (EAV) is a Phase B-N item, "
            "see docs/数据织网/implementation/restaurant-phase-b1-outlier-filter-2026-04-28-design.md backlog"
        )
```

#### 5.1.3 `backend/python/smartbi/api/restaurant_outliers.py` (~330 行)

API 路由层。

**注意**: 下面代码片段中以 `# ...` 省略的部分 (validate 字段 / RLS 转账 / cache invalidate / build response) 是常规 boilerplate, 由 writing-plans 阶段细化任务后由 implementer 按 §8 Error Handling 表 + §7 数据流补完。Spec 提供完整结构 + 函数签名 + 关键防御点。

```python
"""餐饮 outlier API (Phase B-1).

Endpoints:
  GET    /api/restaurant/outliers
  POST   /api/restaurant/outliers/dismiss
  DELETE /api/restaurant/outliers/dismiss/{id}

Reviewer R6: cache 启动加 warning 提示单 worker 假设.
"""
from __future__ import annotations
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, Tuple, Optional

from fastapi import APIRouter, HTTPException, Query, Request, Body, Path

from smartbi.canonical.provenance._admin_auth import require_admin
from smartbi.services.outlier_service import (
    OutlierService, KPI_LABELS, DEFAULT_WINDOW_DAYS, DEFAULT_KPI_KINDS,
)

logger = logging.getLogger(__name__)
logger.warning(
    "[outlier_api] Module-level cache assumes single-worker uvicorn. "
    "If you switch to --workers > 1, add Redis backend (see backlog)."
)

router = APIRouter()
_service = OutlierService()

_CACHE_TTL_S = 300
_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}


def _invalidate_cache(factory_id: str) -> None:
    _cache.pop(factory_id, None)


# ─────────────────────────────────────────────────────
# GET /api/restaurant/outliers
# ─────────────────────────────────────────────────────
@router.get("/outliers")
async def get_outliers(
    request: Request,
    factoryId: str = Query(..., description="Factory ID"),
    windowDays: int = Query(DEFAULT_WINDOW_DAYS, ge=1, le=365),
) -> Dict[str, Any]:
    require_admin(request)
    _validate_factory_access(request, factoryId)

    # Cache check
    now_ts = time.monotonic()
    cached = _cache.get(factoryId)
    if cached:
        cached_ts, cached_body = cached
        if now_ts - cached_ts < _CACHE_TTL_S:
            return cached_body

    # Detect outliers
    try:
        outliers, insufficient = await _service.detect_totals(
            factoryId, window_days=windowDays,
        )
    except RuntimeError as exc:
        raise HTTPException(503, f"数据库连接失败: {exc}")
    except Exception as exc:
        logger.exception(f"[outlier] detect failed for {factoryId}: {exc}")
        raise HTTPException(500, "outlier 检测内部错误")

    # Query dismissed (本月)
    dismissed = await _query_dismissed_this_month(factoryId)
    dismissed_keys = {(d['anomaly_date'], d['kpi_kind']) for d in dismissed}

    # 排除 dismissed
    pending = [o for o in outliers if (o.anomaly_date, o.kpi_kind) not in dismissed_keys]

    body = {
        "factoryId": factoryId,
        "windowDays": windowDays,
        "cachedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "totalAnomalies": len(pending),
            "dismissedThisMonth": len(dismissed),
            "insufficientKpis": insufficient,
        },
        "outliers": [_outlier_to_json(o) for o in pending],
        "dismissed": dismissed,
    }
    _cache[factoryId] = (now_ts, body)
    return body


# ─────────────────────────────────────────────────────
# POST /api/restaurant/outliers/dismiss
# ─────────────────────────────────────────────────────
@router.post("/outliers/dismiss", status_code=201)
async def dismiss_outlier(
    request: Request,
    body: Dict[str, Any] = Body(...),
) -> Dict[str, Any]:
    require_admin(request)
    factory_id = body.get("factoryId")
    _validate_factory_access(request, factory_id)
    # ... validate other fields, INSERT INTO outlier_dismissals (RLS GUC + transaction)
    # ... handle UNIQUE conflict → 409
    # ... invalidate cache
    # ... return 201 body


# ─────────────────────────────────────────────────────
# DELETE /api/restaurant/outliers/dismiss/{id}
# ─────────────────────────────────────────────────────
@router.delete("/outliers/dismiss/{dismissal_id}", status_code=204)
async def undismiss_outlier(
    request: Request,
    dismissal_id: int = Path(..., ge=1),
) -> None:
    require_admin(request)
    # ... query dismissal row to get factory_id (for RLS + cross-factory check)
    # ... DELETE (RLS GUC + transaction)
    # ... invalidate cache


def _validate_factory_access(request: Request, factory_id: str) -> None:
    """Quick-Win 3 pattern: cross-factory check."""
    role = getattr(request.state, "role", None)
    jwt_factory_id = getattr(request.state, "factory_id", None) or ""
    if role != "platform_admin" and factory_id != jwt_factory_id:
        raise HTTPException(
            403,
            f"非 platform_admin 仅可访问自己工厂的 outlier (当前工厂 {jwt_factory_id!r})",
        )


def _outlier_to_json(o) -> Dict[str, Any]:
    return {
        "anomalyDate": o.anomaly_date.isoformat(),
        "kpiKind": o.kpi_kind,
        "kpiLabel": KPI_LABELS.get(o.kpi_kind, o.kpi_kind),
        "value": float(o.value),
        "q1": float(o.q1), "q3": float(o.q3), "iqr": float(o.iqr),
        "lowerFence": float(o.lower_fence), "upperFence": float(o.upper_fence),
        "deviationX": float(o.deviation_x),
        "severity": o.severity,
        "direction": o.direction,
        "baselineSource": o.baseline_source,
        "baselineN": o.baseline_n,
    }


async def _query_dismissed_this_month(factory_id: str) -> list:
    # ... query outlier_dismissals with RLS GUC + transaction
    pass
```

#### 5.1.4 + 5.1.5 Migrations
见 §3.2 + §3.3.

### 5.2 Modified files (1 个)

#### `backend/python/main.py`
```python
from smartbi.api.restaurant_outliers import router as outliers_router
app.include_router(outliers_router, prefix="/api/restaurant", tags=["RestaurantOutliers"])
```

---

## 6. 前端架构

### 6.1 新建文件 (3 个)

#### 6.1.1 `web-admin/src/api/restaurant/outliers.ts` (~80 行)
```typescript
import { pythonFetch } from '@/utils/python-fetch';

export interface OutlierItem {
  anomalyDate: string;
  kpiKind: string;
  kpiLabel: string;
  value: number;
  q1: number; q3: number; iqr: number;
  lowerFence: number; upperFence: number;
  deviationX: number;
  severity: 'high' | 'medium';
  direction: 'above' | 'below';
  baselineSource: 'self' | 'global';      // R2: 透明标记
  baselineN: '<10' | '10-49' | '50-99' | '100-499' | '500+';
}

export interface DismissedItem {
  id: number;
  anomalyDate: string;
  kpiKind: string;
  kpiLabel: string;
  dismissedBy: string;
  dismissedAt: string;
  snapshotValue: number;
  snapshotQ1: number;
  snapshotQ3: number;
  snapshotBaselineSource: 'self' | 'global';
}

export interface OutliersResponse {
  factoryId: string;
  windowDays: number;
  cachedAt: string;
  summary: {
    totalAnomalies: number;
    dismissedThisMonth: number;
    insufficientKpis: string[];
  };
  outliers: OutlierItem[];
  dismissed: DismissedItem[];
}

export async function fetchOutliers(factoryId: string, windowDays = 30): Promise<OutliersResponse> {
  return pythonFetch<OutliersResponse>(
    `/api/restaurant/outliers?factoryId=${encodeURIComponent(factoryId)}&windowDays=${windowDays}`
  );
}

export async function dismissOutlier(payload: {
  factoryId: string; anomalyDate: string; kpiKind: string;
  snapshotValue: number; snapshotQ1: number; snapshotQ3: number;
  snapshotBaselineSource: 'self' | 'global';
}): Promise<{ id: number }> {
  return pythonFetch('/api/restaurant/outliers/dismiss', {
    method: 'POST', body: JSON.stringify(payload),
  });
}

export async function undismissOutlier(id: number): Promise<void> {
  await pythonFetch(`/api/restaurant/outliers/dismiss/${id}`, { method: 'DELETE' });
}
```

#### 6.1.2 `web-admin/src/views/restaurant/data-quality-tab.vue` (~280 行)
```vue
<!--
  数据质量 tab — 餐饮 Phase B-1 outlier filter.
  Reviewer R2: 必须 render baselineSource 灰色 badge.
-->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import {
  fetchOutliers, dismissOutlier, undismissOutlier,
  type OutliersResponse, type OutlierItem, type DismissedItem,
} from '@/api/restaurant/outliers';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);
const loading = ref(false);
const data = ref<OutliersResponse | null>(null);
const errorMsg = ref('');
const showDismissed = ref(false);

async function load() {
  if (!factoryId.value) return;
  loading.value = true;
  errorMsg.value = '';
  try {
    data.value = await fetchOutliers(factoryId.value);
  } catch (err: unknown) {
    errorMsg.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function handleDismiss(item: OutlierItem) {
  try {
    await dismissOutlier({
      factoryId: factoryId.value!,
      anomalyDate: item.anomalyDate,
      kpiKind: item.kpiKind,
      snapshotValue: item.value,
      snapshotQ1: item.q1,
      snapshotQ3: item.q3,
      snapshotBaselineSource: item.baselineSource,
    });
    await load();    // 刷新列表
  } catch (err) {
    // ... toast error
  }
}

async function handleUndismiss(item: DismissedItem) {
  try {
    await undismissOutlier(item.id);
    await load();
  } catch (err) {
    // ... toast error
  }
}

function severityType(sev: string): 'danger' | 'warning' {
  return sev === 'high' ? 'danger' : 'warning';
}

function formatRange(item: OutlierItem): string {
  return `¥${item.q1.toLocaleString()} - ¥${item.q3.toLocaleString()}`;
}

onMounted(load);
</script>

<template>
  <div class="data-quality-tab">
    <el-skeleton v-if="loading" :rows="5" animated />
    <el-alert v-else-if="errorMsg" :title="errorMsg" type="error" />
    <template v-else-if="data">
      <!-- 总览数字 -->
      <el-card class="summary-card" shadow="never">
        <span>本月 {{ data.outliers.length + data.dismissed.length }} 个 cost 信号异常</span>
        <el-tag type="warning">待复核 {{ data.summary.totalAnomalies }}</el-tag>
        <el-tag type="info">已确认 {{ data.summary.dismissedThisMonth }}</el-tag>
        <el-tag v-if="data.summary.insufficientKpis.length" type="info">
          {{ data.summary.insufficientKpis.length }} 个信号样本不足
        </el-tag>
      </el-card>

      <!-- 异常表格 -->
      <el-table :data="data.outliers" v-if="data.outliers.length" class="outlier-table">
        <el-table-column prop="anomalyDate" label="日期" width="120" />
        <el-table-column prop="kpiLabel" label="KPI" width="120" />
        <el-table-column label="实际值" width="120">
          <template #default="{ row }">¥{{ row.value.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="正常范围" width="180">
          <template #default="{ row }">
            <span>{{ formatRange(row) }}</span>
            <!-- R2: baseline 透明标记 -->
            <el-tag v-if="row.baselineSource === 'global'" type="info" size="small" effect="plain">
              全网基线
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="偏离" width="120">
          <template #default="{ row }">
            <el-tag :type="severityType(row.severity)" size="small">
              {{ row.direction === 'above' ? '高' : '低' }} {{ row.deviationX.toFixed(1) }}×
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button size="small" @click="handleDismiss(row)">✓ 非异常</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-else description="本周期内无异常信号" />

      <!-- 已确认折叠区 -->
      <div v-if="data.dismissed.length" class="dismissed-section">
        <el-button link @click="showDismissed = !showDismissed">
          {{ showDismissed ? '收起' : '展开' }}已确认 {{ data.dismissed.length }} 项
        </el-button>
        <el-table v-show="showDismissed" :data="data.dismissed" size="small">
          <el-table-column prop="anomalyDate" label="日期" width="120" />
          <el-table-column prop="kpiLabel" label="KPI" width="120" />
          <el-table-column label="当时值" width="120">
            <template #default="{ row }">¥{{ row.snapshotValue.toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="dismissedBy" label="确认人" width="120" />
          <el-table-column prop="dismissedAt" label="确认时间" width="180" />
          <el-table-column label="操作">
            <template #default="{ row }">
              <el-button size="small" @click="handleUndismiss(row)">↺ 恢复</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </div>
</template>
```

#### 6.1.3 `web-admin/src/views/restaurant/data-completeness.vue` (改造, +~60 行)

把现有内容包进 tab 1, 加 tab 2 引用 data-quality-tab.vue。

```vue
<template>
  <el-tabs v-model="activeTab" class="completeness-tabs">
    <el-tab-pane label="数据完整度" name="completeness">
      <!-- 现有内容 (header card + modules grid) -->
    </el-tab-pane>
    <el-tab-pane label="数据质量" name="quality">
      <DataQualityTab />
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import DataQualityTab from './data-quality-tab.vue';

const activeTab = ref<string>('completeness');
// 现有 setup 不动
</script>
```

---

## 7. 数据流

### 7.1 GET 流程

```
1. admin 打开 /restaurant/data-completeness, 切到 "数据质量" tab
2. data-quality-tab.vue onMounted → fetchOutliers(F002)
3. FE → GET /api/restaurant/outliers?factoryId=F002&windowDays=30
4. BE require_admin (401 if not auth, 403 if not admin)
5. BE _validate_factory_access (403 if cross-factory non-platform_admin)
6. BE 检查 cache (in-memory dict, 5 min TTL)
   ├─ hit → 返 cached body (typically <50ms)
   └─ miss → 继续 (~500-2000ms 取决于 fallback)
7. BE OutlierService.detect_totals(F002, 30, DEFAULT_KPI_KINDS) — 4 kpi 并行:
   for each kpi in KPI_KINDS:
     a. _query_local: SELECT date, {kpi} FROM agg_restaurant_daily_totals 30 天 (RLS GUC + transaction)
     b. if N >= 10: 用本地 IQR (q1, q3, fence), 找 outliers, baseline_source='self'
     c. if N < 10: call _query_global_baseline → SELECT q1, q3, n_bucket FROM get_global_kpi_stats(kpi, 30) (SECURITY DEFINER, no GUC)
        - if global n_bucket = '<10': 跳过, 标记 insufficient
        - else: 用 global q1/q3 算 fence, 检测本工厂 local_data, baseline_source='global'
   ↓
   合并所有 outliers + insufficient list
8. BE _query_dismissed_this_month: SELECT * FROM outlier_dismissals WHERE factory_id=F002 AND dismissed_at >= '2026-04-01' (RLS GUC + transaction)
9. BE 排除 dismissed (set lookup by (anomaly_date, kpi_kind))
10. BE 构造 response, cache.set(F002, body), 返
11. FE 渲染 summary 数字 + outlier 表格 + 折叠 dismissed
12. FE 对 baselineSource='global' 的行渲染灰色 "全网基线" badge
```

### 7.2 Dismiss 流程

```
1. admin 点 [✓ 非异常] 按钮
2. FE → POST /api/restaurant/outliers/dismiss { factoryId, anomalyDate, kpiKind, snapshotValue, snapshotQ1, snapshotQ3, snapshotBaselineSource }
3. BE require_admin + _validate_factory_access
4. BE INSERT INTO outlier_dismissals (...) (RLS GUC + transaction)
   ├─ UNIQUE(factory_id, anomaly_date, kpi_kind) violated → 409
   └─ ok → INSERT 完成, 返 dismissal id + dismissed_at
5. BE _invalidate_cache(factoryId)
6. FE await load() 重新拉数据
7. 该 outlier 从 outliers list 消失, 出现在 dismissed list (折叠)
```

### 7.3 Un-dismiss 流程

```
1. admin 展开 dismissed 折叠区, 点 [↺ 恢复] 按钮
2. FE → DELETE /api/restaurant/outliers/dismiss/{id}
3. BE require_admin
4. BE 先查 dismissal row 拿 factory_id (用 RLS GUC, 拿不到 = 404)
5. BE _validate_factory_access (跨工厂 403)
6. BE DELETE FROM outlier_dismissals WHERE id=$1 (RLS GUC + transaction)
7. BE _invalidate_cache(factoryId)
8. FE await load() 重新拉数据
9. 该 outlier 从 dismissed list 消失, 出现回 outliers list (因为 IQR 重新算还会 detect 它)
```

---

## 8. Error Handling

| 场景 | 状态码 | 用户看到 | 后端日志 |
|---|---|---|---|
| 未登录 | 401 | "未登录, 请先认证" | INFO |
| 非 admin tier | 403 | "需要 admin 权限" | INFO |
| Cross-factory 越权 | 403 | "非 platform_admin 仅可访问自己工厂的 outlier (当前工厂 'F002')" | INFO |
| factoryId 空 / 长度超 50 | 400 | "factoryId 不能为空 / 长度超限" | INFO |
| windowDays 越界 | 400 | FastAPI Query 验证 | INFO |
| `smartbi_pool` 不可用 | 503 | "数据库连接失败" | ERROR |
| `agg_restaurant_daily_totals` 不存在 | 500 → 跳过该 kpi | 部分 outliers (其他 kpi 正常) | WARNING |
| RLS GUC 没设 | 静默 0 rows | "本月无异常" (假象, 实际查询失败) — **绝对不能发生** | 代码 enforce |
| `get_global_kpi_stats()` 失败 | 跳过该 kpi fallback | 该 kpi 加入 insufficientKpis | WARNING |
| 本工厂 + 全网都 N<10 | 200, kpi 加入 insufficientKpis | "样本不足" badge | INFO |
| dismiss UNIQUE 冲突 | 409 | "该异常已被标记 ✓ 非异常" | INFO |
| undismiss id 不存在 | 404 | "dismissal 记录不存在" | INFO |
| dismiss SECURITY DEFINER function 抛 invalid kpi_kind | 400 | "无效 KPI 类型" | INFO |

### 关键防御 (W0.4 finding 3)

`_query_local` 和 `_query_dismissed_this_month` 的 GUC pattern **必须**:
```python
async with pool.acquire() as conn:
    async with conn.transaction():     # ← 缺这层 commit 会 wipe GUC
        await conn.execute(
            "SELECT set_config('app.factory_id', $1, true)", factory_id
        )
        rows = await conn.fetch(...)
```

如果 reviewer 看到代码缺 `async with conn.transaction()`, **直接 reject**。

---

## 9. Testing Strategy

### 9.1 Pytest (~8 个 test, ~250 行)

#### `tests/test_outlier_stats.py` (3 tests)
1. `test_iqr_fence_normal_distribution` — 50 个均值 100 std 10 的样本, IQR fence 应在 [70, 130] 区间
2. `test_iqr_fence_right_skewed` — 餐饮 cost 模拟 (大部分 200-800, 5 个 5000+), IQR Q3+1.5×IQR 不被极值拉跑
3. `test_iqr_fence_returns_none_for_small_sample` — N<4 返 None
4. `test_zscore_outliers_basic` — 正态分布 + 1 个 5σ 异常, zscore 抓到
5. `test_outlier_algorithm_dataclass_iqr` — `OutlierAlgorithm(name='iqr', threshold=1.5).detect(values)` 跟直接调 iqr_fence + find_outliers_iqr 结果一致

#### `tests/test_outlier_service.py` (3 tests)
1. `test_detect_totals_local_n_above_threshold` — mock pool 返 30 行本地数据, 应该用本地 IQR, baseline_source='self'
2. `test_detect_totals_fallback_to_global` — mock pool 本地返 5 行, mock global function 返 q1/q3/n_bucket='100-499', 应该 fallback, baseline_source='global'
3. `test_detect_totals_insufficient_globally` — mock 本地 5 行, global n_bucket='<10', 应该返空 + insufficient_kpis 包含该 kpi

#### `tests/test_restaurant_outliers_api.py` (4 tests)
1. `test_get_outliers_admin_success` — mock service 返 outliers + dismissed, response 结构正确, baselineSource 字段存在
2. `test_get_outliers_cross_factory_403` — factory_super_admin F001 访问 F002 → 403
3. `test_dismiss_outlier_inserts_and_invalidates_cache` — POST 后 cache 被清, GET 返 401 vs 200 分开 mock
4. `test_undismiss_outlier_404_when_not_exist` — DELETE 不存在 id → 404

### 9.2 Vitest (~3 个 test, ~150 行)

#### `__tests__/data-quality-tab.spec.ts`
1. `renders-outlier-list` — mock fetchOutliers 返 3 outliers + 2 dismissed, 表格 render 5 行 + 折叠区 2 行
2. `dismiss-button-triggers-api-and-reload` — 点 [✓ 非异常] → 调 dismissOutlier + 重新 fetchOutliers
3. `baseline-source-global-renders-badge` — outlier baselineSource='global' 行有 "全网基线" badge, 'self' 没有

### 9.3 Smoke E2E (1 test, append `web-admin/data-fabric-c-smoke-e2e.spec.ts`)

```typescript
test('B-1 outlier filter — admin 巡检流程', async ({ page }) => {
  // 1. 登录 restaurant_admin1
  // 2. 访问 /restaurant/data-completeness
  // 3. 切到 "数据质量" tab
  // 4. 等待表格 render (空或非空都 OK)
  // 5. 若有数据: 点第一行 [✓ 非异常] → 等 toast → 等列表刷新
  // 6. 展开 dismissed 折叠区 → 点 [↺ 恢复] → 等列表刷新
  // 7. 验证该行回到 outliers list
});
```

---

## 10. 部署 + Verify

### 10.1 部署顺序

1. **Migration 应用** (test smartbi_db 优先):
   ```bash
   ssh root@47.100.235.168 "psql -h localhost -U smartbi smartbi_db -f /tmp/V20260502_06__outlier_dismissals.sql"
   ssh root@47.100.235.168 "psql -h localhost -U smartbi smartbi_db -f /tmp/V20260502_07__get_global_kpi_stats_fn.sql"
   ```
   验证: `SELECT * FROM outlier_dismissals;` (应空表) + `SELECT * FROM get_global_kpi_stats('wastage_cost_total', 30);`

2. **Python test deploy**:
   ```bash
   ./scripts/deploy/deploy-smartbi-python.sh --env test
   ```
   验证: `curl http://localhost:8084/health` + `curl http://localhost:8084/api/restaurant/outliers?factoryId=F002` (with auth header)

3. **web-admin test deploy**:
   ```bash
   ./scripts/deploy/deploy-web-admin.sh --env test
   ```
   验证: 访问 `http://139.196.165.140:8097/restaurant/data-completeness`, 确认 "数据质量" tab 出现

### 10.2 真窗 Verify (test env)

测试 3 工厂:
- **F002 (restaurant_admin1)**: 应有部分 outliers (有数据), 测试 dismiss + un-dismiss
- **R_BEJ (buerjun_admin)**: N<10 工厂, 应全部 fallback global, 显示 "全网基线" badge
- **R_XMX**: N<10 + 全网也可能 N<10, 应显示 "样本不足"

Verify 项:
- [ ] tab 切换正常, "数据质量" 进得去
- [ ] outlier 表格 render, 颜色编码正确 (红 high / 橙 medium)
- [ ] baselineSource='global' 行有灰色 "全网基线" badge
- [ ] dismiss → toast → 列表刷新, 该行进入折叠区
- [ ] un-dismiss → toast → 该行回 outliers
- [ ] cross-factory 访问 (factory_super_admin F002 → F001) → 403 + 中文 detail
- [ ] 5 min cache 命中 (二次访问 < 100ms response time)

### 10.3 Prod 部署 (verify 通过后)

```bash
./scripts/deploy/deploy-smartbi-python.sh --env prod
./scripts/deploy/deploy-web-admin.sh --env prod
ssh root@47.100.235.168 "psql -h localhost -U smartbi smartbi_prod_db -f /tmp/V20260502_06__outlier_dismissals.sql"
ssh root@47.100.235.168 "psql -h localhost -U smartbi smartbi_prod_db -f /tmp/V20260502_07__get_global_kpi_stats_fn.sql"
```

Prod 真窗 verify 同上。

---

## 11. 长期演进 + Backlog

### 11.1 演进路径 (无重写)

| 演进方向 | 现已预留 | 后续添加成本 |
|---|---|---|
| EAV per-dim 下钻 | `OutlierService.detect_per_dim()` 接口签名 | 实现该方法 + EAV SQL + UI detail page; ~3-5 天 |
| 加 z-score 双触发 | `outlier_stats.py` 已 export zscore() + OutlierAlgorithm dataclass | 改 service 配置 algorithm 列表; ~1 天 |
| 加 dismiss reason downselect | `outlier_dismissals.reason` 列已存在 | 加 enum + form select; ~半天 |
| 加 expires_at 临时 dismiss | `outlier_dismissals.expires_at` 列已存在 | UI 加 datepicker + service 过滤; ~1 天 |
| 加趋势图 (line chart) | API 已返 30 天完整数据 | 前端加 ECharts; ~1 天 |
| 4-eye gate (大客户) | dismissal 表已有 dismissed_by | 加 reviewed_by + reviewed_at 列 + 端点; ~1 天 |
| 邮件 / push 告警 | dismissal 表记 "未 dismiss" 状态 | cron 扫待复核 + 推送; ~2-3 天 |
| AnomalyDetection 切共享 utils | utils 已 export iqr() + zscore() | 改 import + 测试; ~半天 |
| Multi-worker Redis cache | 启动 warning 已加 | 替换 in-memory dict 为 Redis client; ~1 天 |
| SECURITY DEFINER audit table | function header doc 已留唯一调用方 | 新建 audit table + INSERT in function; ~半天 |
| Industry benchmark 第 3 级 fallback | OutlierService fallback 链路已抽象 | 加第 3 级 + UI 标记; ~1-2 天 |

### 11.2 Backlog (写进 spec, 等触发)

- **B-N #1**: EAV per-dim 下钻 — **触发**: admin 反馈 "知道总损耗高但不知哪原料"
- **B-N #2**: dismiss reason / expires UI — **触发**: admin 反馈 "我 dismiss 了 100 条记不清原因" 或 "节假日 dismiss 后下次还要触发"
- **B-N #3**: 趋势图 — **触发**: admin 反馈 "想看异常前后的趋势"
- **B-N #4**: AnomalyDetection 切共享 utils — **触发**: 客户问 "chat 异常检测和 dashboard outliers 数字不一致" 或 6 月内主动迁
- **B-N #5**: 4-eye gate — **触发**: 客户单工厂 admin > 5 OR 出现 dismiss 滥用案例
- **B-N #6**: 邮件 / push 告警 — **触发**: admin 反馈 "巡检不及时, 异常 3 天后才发现"
- **B-N #7**: Redis cache — **触发**: prod 切换 multi-worker uvicorn (现单 worker)
- **B-N #8**: SECURITY DEFINER audit table — **触发**: 发现 `get_global_kpi_stats` 被 1+ 处调用 (现仅 outlier_service)

---

## 12. 实施约束 (subagent 必读)

### 12.1 Hard constraints

1. ⚠️ **RLS GUC pattern 强制** (W0.4 finding 3):
   ```python
   async with pool.acquire() as conn:
       async with conn.transaction():       # ← 不能省
           await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)
           rows = await conn.fetch(...)
   ```
   适用表: `agg_restaurant_daily_totals`, `outlier_dismissals`. **缺 transaction 直接 reject 代码**。

2. ⚠️ **SECURITY DEFINER function 不需要 GUC** — 它本身 bypass RLS, 内部跨工厂聚合。如果在调用前 SET app.factory_id, function 内部聚合会被这个 GUC 限制 → 严重 bug。

3. ⚠️ **所有 commit 用 `bash scripts/safe-commit.sh "msg" file1 file2 ...`** (rule 5b)。
   不要用 `git add F1 F2 && git commit -m "msg"` — 会吞并发 session 文件。

4. ⚠️ **测试先行 test env (8084 + 8097)** — prod (8083 + 8086) 等真窗 verify 通过后单独决定。

5. ⚠️ **subagent dispatch 时 prompt 必须明确传递**:
   - "用 conn.transaction() 包 set_config('app.factory_id', $1, true)"
   - "用 bash scripts/safe-commit.sh 提交"
   - "测试在 test env (8084 + 8097), 不部 prod"

### 12.2 复用现有 pattern

| 需求 | 复用 | 不要重新实现 |
|---|---|---|
| Pool 单例 | `smartbi.config.get_pg_pool()` (W0.4 finding) | |
| Admin 鉴权 | `from smartbi.canonical.provenance._admin_auth import require_admin` (W0.4 finding 5) | |
| Cross-factory check | Phase B Quick-Win 3 pattern (in `data_quality_queue_admin.py`) | |
| FE pythonFetch | `web-admin/src/utils/python-fetch.ts` (W0.4 finding 6) | 不要用 axios 调 Python backend |
| Cache 5min TTL | `restaurant_completeness.py` 已有 in-memory dict pattern | |

### 12.3 不要做的事

- ❌ 不要实现 `detect_per_dim()` (留 NotImplementedError)
- ❌ 不要实现 dismiss reason / expires UI (字段已建, UI 不展示)
- ❌ 不要 hard-code KPI 4 信号到 SQL (用 KPI_KINDS 配置)
- ❌ 不要在 `get_global_kpi_stats()` 返精确 n (round bucket)
- ❌ 不要给 `get_global_kpi_stats()` GRANT EXECUTE TO PUBLIC (仅 smartbi_app)
- ❌ 不要部 prod (除非用户 explicit 授权)
- ❌ 不要给 dismiss 加 4-eye gate (Phase B-N backlog)
- ❌ 不要在 outlier_service.py 直接 import AIIntentService / AIEnterpriseService (跟 .claude/rules/ai-intent-tool-skill-architecture.md 一致避免循环依赖)

---

## 13. 估算

| 维度 | 估值 |
|---|---|
| 总 commits | ~10 (按里程碑 commit, rule 1) |
| 后端代码 | ~800 行 (utils 120 + service 280 + api 330 + 2 migrations 70) |
| 前端代码 | ~440 行 (api client 80 + tab 280 + completeness 改造 60 + tests 不算) |
| 测试代码 | ~400 行 (pytest 250 + vitest 150) |
| 总代码量 | ~1640 行 |
| 实施时间 | 1.5-2 天 (subagent-driven 单 session 可完成) |
| Brainstorm 时间 (已花) | ~1 小时 (含 reviewer audit) |

---

## 14. Self-Review Notes

Spec 完成后内部一致性检查 (2026-04-28):

| 检查项 | 状态 | 备注 |
|---|---|---|
| Placeholder scan | ✅ | §5.1.3 `# ...` 是有意省略 boilerplate, 已 §5.1.3 注释说明 |
| `outlier_dismissals` schema 跟 API contract 字段类型 | ✅ | snapshot_value NUMERIC(18,4) → JSON number; baselineSource VARCHAR(10) → enum 'self'\|'global' |
| OutlierService.\_bucket_n 跟 SECURITY DEFINER function bucket | ✅ | 5 桶完全一致: <10 / 10-49 / 50-99 / 100-499 / 500+ |
| RLS GUC pattern 在所有 query agg + dismissals 处 | ✅ | §5.1.2 `_query_local` / §5.1.3 `_query_dismissed_this_month` / dismiss / undismiss 全部要求 conn.transaction() |
| SECURITY DEFINER function 不需 GUC | ✅ | §5.1.2 `_query_global_baseline` 直接 conn.fetchrow 不带 GUC, §12.1 hard constraint #2 已说明 |
| Python IQR vs PG PERCENTILE_CONT 数值一致性 | ⚠️ Note added | §5.1.1 doc 说明 < 1% 差异 + 测试用 pytest.approx; 单 outlier 不跨算法 |
| POST dismiss validation rules | ✅ Added | §4.2 加 validation 块 |
| Cross-factory 403 in cross-references | ✅ | §4.1/§4.2/§4.3/§7/§8/§10.2 全部一致 |
| Reviewer R1-R5 全部反映在 schema/API/utils | ✅ | §3.2 (R1) / §4.1 + §6.1.1 + §6.1.2 (R2) / §5.1.1 (R3) / §3.3 (R4) / §5.1.2 (R5) |
| Backlog 触发条件具体可观测 | ✅ | §11.2 每条都有明确触发 ("admin 反馈 X" / "客户单工厂 admin > 5" / "prod 切 multi-worker") |
| 跟 Phase A pattern 复用率 | ✅ | get_pg_pool() / require_admin / pythonFetch / Quick-Win 3 cross-factory / cache 5min — 5 个 pattern 复用 |

## 15. 文件清单

### 新建 (11 个)
- `backend/python/smartbi/utils/outlier_stats.py`
- `backend/python/smartbi/services/outlier_service.py`
- `backend/python/smartbi/api/restaurant_outliers.py`
- `backend/python/smartbi/database/migrations/V20260502_06__outlier_dismissals.sql`
- `backend/python/smartbi/database/migrations/V20260502_07__get_global_kpi_stats_fn.sql`
- `backend/python/tests/test_outlier_stats.py`
- `backend/python/tests/test_outlier_service.py`
- `backend/python/tests/test_restaurant_outliers_api.py`
- `web-admin/src/api/restaurant/outliers.ts`
- `web-admin/src/views/restaurant/data-quality-tab.vue`
- `web-admin/src/views/restaurant/__tests__/data-quality-tab.spec.ts`

### 修改 (3 个)
- `backend/python/main.py` — 注册 outliers router
- `web-admin/src/views/restaurant/data-completeness.vue` — 包进 tabs
- `web-admin/data-fabric-c-smoke-e2e.spec.ts` — append B-1 smoke test

---

**Status**: Design approved by user (2026-04-28). Ready for writing-plans skill handoff.
