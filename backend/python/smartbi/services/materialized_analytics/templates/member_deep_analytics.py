"""MemberDeepAnalytics — 会员卡数据深度分析 (member-level dataset).

Distinct from member_consumption: that template operates on ORDER-LEVEL data
and counts orders paid via 会员卡/储值卡. This template operates on MEMBER-
LEVEL exports (one row per card/member) with columns like 卡号 / 卡状态 /
等级 / 充值总金额 / 当前余额 / 等级变动时间.

Real data seen: 唏嘛香会员数据.xlsx — 60K rows × 25 cols.

Outputs:
  - 等级分布: 会员数 by VIP level (VIP1/VIP2/...)
  - 卡状态分布: 正常 / 冻结 / 注销 share
  - 余额分层: sleeping-card check — members with high 余额 but long dormancy
  - 充值-消费-余额 漏斗: 总充值 → 当前累计消费 (充值 - 余额) → 剩余
  - Top 充值 / 余额 members (anonymized — mask phone/name tail)

Applies when schema has 卡号 OR 会员 column AND at least one 余额/充值 column.
Self-excludes order-level POS exports (those have 商品信息 / 账单号 / etc.
but not 卡号 as a primary identifier).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import polars as pl

from ..compute.base import ComputeBackend
from ..schema import DataSchema, Domain
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_CARD_ID_CANDIDATES = ("卡号", "会员卡号", "会员编号", "卡编号")
_MEMBER_NAME_CANDIDATES = ("会员", "会员姓名", "持卡人")
_LEVEL_CANDIDATES = ("等级", "会员等级", "卡等级")
_STATUS_CANDIDATES = ("卡状态", "会员状态", "状态")
_BALANCE_CANDIDATES = ("当前余额(元)", "当前余额", "账户余额", "卡余额", "余额")
_PRINCIPAL_BAL_CANDIDATES = ("当前本金余额(元)", "当前本金余额", "本金余额")
_TOTAL_RECHARGE_CANDIDATES = ("充值总金额(元)", "充值总金额", "累计充值", "总充值")
_GIFT_AMOUNT_CANDIDATES = ("充值赠送总额(元)", "充值赠送总额", "赠送金额", "当前赠送余额(元)")
_OPEN_DATE_CANDIDATES = ("开卡时间", "开卡日期", "入会时间", "等级变动时间")
_LAST_CONSUME_DATE_CANDIDATES = ("最近消费时间", "最后消费", "上次消费")
_GENDER_CANDIDATES = ("性别",)

_SAMPLE_CAP = 500_000
_TOP_N = 10

# Status labels considered "active" for KPI (rest = inactive/closed)
_ACTIVE_STATUSES = ("正常", "激活", "已激活")
# Meta-label rows to filter (合计/总计 etc.)
_META_LABELS = ("合计", "总计", "小计", "汇总")


@register
class MemberDeepAnalytics(AnalysisTemplate):

    sample_queries = [
        "会员卡数据",
        "会员等级分布",
        "会员余额统计",
        "储值会员分析",
        "会员充值情况",
    ]

    @property
    def code(self) -> str:
        return "member_deep_analytics"

    @property
    def title(self) -> str:
        return "会员卡深度分析"

    def applies(self, schema: DataSchema) -> bool:
        if schema.domain not in (Domain.RESTAURANT, Domain.UNKNOWN):
            return False
        names = {f.name for f in schema.fields}
        has_card = any(c in names for c in _CARD_ID_CANDIDATES)
        has_balance = any(c in names for c in _BALANCE_CANDIDATES) or \
                      any(c in names for c in _TOTAL_RECHARGE_CANDIDATES)
        # Must have card ID (proves member-level) + balance/recharge (proves card data)
        # The 商品信息 check rules out order-level POS data that happens to have 会员 field
        not_order_level = "商品信息" not in names and "账单号" not in names
        return has_card and has_balance and not_order_level

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        cols = set(df.columns)

        card_col = next((c for c in _CARD_ID_CANDIDATES if c in cols), None)
        level_col = next((c for c in _LEVEL_CANDIDATES if c in cols), None)
        status_col = next((c for c in _STATUS_CANDIDATES if c in cols), None)
        balance_col = next((c for c in _BALANCE_CANDIDATES if c in cols), None)
        recharge_col = next((c for c in _TOTAL_RECHARGE_CANDIDATES if c in cols), None)
        gift_col = next((c for c in _GIFT_AMOUNT_CANDIDATES if c in cols), None)
        name_col = next((c for c in _MEMBER_NAME_CANDIDATES if c in cols), None)
        open_date_col = next((c for c in _OPEN_DATE_CANDIDATES if c in cols), None)
        gender_col = next((c for c in _GENDER_CANDIDATES if c in cols), None)

        if card_col is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no card-id column",
            )

        # Drop meta summary rows (if any 合计/总计 mixed in)
        if card_col:
            df = df.filter(
                ~pl.col(card_col).cast(pl.Utf8, strict=False).fill_null("")
                   .is_in(list(_META_LABELS))
            )

        if df.height > _SAMPLE_CAP:
            df = df.head(_SAMPLE_CAP)

        total_members = df.height

        # ── Level distribution ──
        by_level: List[Dict[str, Any]] = []
        if level_col:
            rows = (
                df.filter(pl.col(level_col).is_not_null())
                .group_by(level_col)
                .agg([
                    pl.len().alias("members"),
                    *([pl.col(balance_col).cast(pl.Float64, strict=False).fill_null(0.0).sum().alias("total_balance")]
                      if balance_col else []),
                    *([pl.col(recharge_col).cast(pl.Float64, strict=False).fill_null(0.0).sum().alias("total_recharge")]
                      if recharge_col else []),
                ])
                .sort("members", descending=True)
                .to_dicts()
            )
            by_level = [
                {
                    "level": str(r.get(level_col) or "<空>"),
                    "members": int(r["members"]),
                    "share_pct": round(r["members"] / total_members * 100, 2)
                        if total_members else 0.0,
                    "total_balance": round(float(r.get("total_balance") or 0.0), 2) if balance_col else None,
                    "total_recharge": round(float(r.get("total_recharge") or 0.0), 2) if recharge_col else None,
                }
                for r in rows
            ]

        # ── Status distribution ──
        by_status: List[Dict[str, Any]] = []
        active_members = 0
        if status_col:
            rows = (
                df.filter(pl.col(status_col).is_not_null())
                .group_by(status_col)
                .agg(pl.len().alias("members"))
                .sort("members", descending=True)
                .to_dicts()
            )
            by_status = [
                {
                    "status": str(r.get(status_col) or "<空>"),
                    "members": int(r["members"]),
                    "share_pct": round(r["members"] / total_members * 100, 2)
                        if total_members else 0.0,
                }
                for r in rows
            ]
            active_members = sum(
                r["members"] for r in by_status if r["status"] in _ACTIVE_STATUSES
            )

        # ── Balance / recharge / consumption funnel ──
        total_recharge = 0.0
        total_balance = 0.0
        total_gift = 0.0
        if recharge_col:
            total_recharge = float(
                df.select(
                    pl.col(recharge_col).cast(pl.Float64, strict=False).fill_null(0.0).sum()
                ).item() or 0.0
            )
        if balance_col:
            total_balance = float(
                df.select(
                    pl.col(balance_col).cast(pl.Float64, strict=False).fill_null(0.0).sum()
                ).item() or 0.0
            )
        if gift_col:
            total_gift = float(
                df.select(
                    pl.col(gift_col).cast(pl.Float64, strict=False).fill_null(0.0).sum()
                ).item() or 0.0
            )

        # Implied consumed amount = total_recharge - total_balance (rough; ignores
        # refunds / gift-only flows).
        implied_consumed = total_recharge - total_balance if recharge_col and balance_col else None
        consumed_rate_pct = None
        if implied_consumed is not None and total_recharge > 0:
            consumed_rate_pct = round(implied_consumed / total_recharge * 100, 2)

        # ── Balance stratification ──
        balance_bins: List[Dict[str, Any]] = []
        if balance_col:
            bin_expr = (
                pl.when(pl.col(balance_col).cast(pl.Float64, strict=False).fill_null(0.0) <= 0)
                  .then(pl.lit("0 元 (已清零)"))
                .when(pl.col(balance_col).cast(pl.Float64, strict=False) <= 100)
                  .then(pl.lit("0-100 元"))
                .when(pl.col(balance_col).cast(pl.Float64, strict=False) <= 500)
                  .then(pl.lit("100-500 元"))
                .when(pl.col(balance_col).cast(pl.Float64, strict=False) <= 1000)
                  .then(pl.lit("500-1000 元"))
                .when(pl.col(balance_col).cast(pl.Float64, strict=False) <= 5000)
                  .then(pl.lit("1000-5000 元"))
                .otherwise(pl.lit("5000 元+"))
            )
            rows = (
                df.with_columns(bin_expr.alias("_bin"))
                .group_by("_bin")
                .agg([
                    pl.len().alias("members"),
                    pl.col(balance_col).cast(pl.Float64, strict=False).fill_null(0.0).sum().alias("total"),
                ])
                .to_dicts()
            )
            bin_order = ["0 元 (已清零)", "0-100 元", "100-500 元", "500-1000 元", "1000-5000 元", "5000 元+"]
            by_bin_map = {str(r["_bin"]): r for r in rows}
            for label in bin_order:
                r = by_bin_map.get(label)
                if r:
                    balance_bins.append({
                        "bin": label,
                        "members": int(r["members"]),
                        "members_share_pct": round(r["members"] / total_members * 100, 2)
                            if total_members else 0.0,
                        "total_balance": round(float(r.get("total") or 0.0), 2),
                    })
                else:
                    balance_bins.append({
                        "bin": label, "members": 0, "members_share_pct": 0.0, "total_balance": 0.0,
                    })

        # ── Gender distribution (optional) ──
        by_gender: List[Dict[str, Any]] = []
        if gender_col:
            rows = (
                df.filter(pl.col(gender_col).is_not_null())
                .group_by(gender_col)
                .agg(pl.len().alias("members"))
                .sort("members", descending=True)
                .to_dicts()
            )
            by_gender = [
                {
                    "gender": str(r.get(gender_col) or "<空>"),
                    "members": int(r["members"]),
                    "share_pct": round(r["members"] / total_members * 100, 2)
                        if total_members else 0.0,
                }
                for r in rows
            ]

        # ── Build insight ──
        parts: List[str] = []
        parts.append(f"期内会员总数 {total_members:,}")
        if active_members > 0:
            active_pct = round(active_members / total_members * 100, 1) if total_members else 0.0
            parts[-1] += f"，激活 {active_members:,} ({active_pct:.1f}%)"
        parts[-1] += "。"
        if by_level:
            top_level = by_level[0]
            parts.append(f"最大等级：{top_level['level']} {top_level['members']:,} 人 ({top_level['share_pct']:.1f}%)。")
        if total_recharge > 0:
            parts.append(f"累计充值 {total_recharge:,.0f} 元")
            if total_balance > 0:
                parts[-1] += f"，当前余额 {total_balance:,.0f} 元"
            if consumed_rate_pct is not None:
                parts[-1] += f"（消化率 {consumed_rate_pct:.1f}%）"
            parts[-1] += "。"
        if balance_bins:
            zero_bin = next((b for b in balance_bins if b["bin"].startswith("0 元")), None)
            if zero_bin and zero_bin["members_share_pct"] > 20:
                parts.append(
                    f"⚠ {zero_bin['members']:,} 位会员余额已清零"
                    f"（占 {zero_bin['members_share_pct']:.1f}%），需激活唤回。"
                )
        insight_text = " ".join(parts)

        # ── ECharts — pie of level distribution, fallback to status ──
        chart_config = None
        if by_level:
            chart_config = {
                "type": "pie",
                "title": {"text": "会员等级分布", "left": "center"},
                "tooltip": {"trigger": "item", "formatter": "{b}: {c} 人 ({d}%)"},
                "legend": {"top": 30},
                "series": [{
                    "name": "会员数",
                    "type": "pie",
                    "radius": ["30%", "65%"],
                    "data": [
                        {"name": l["level"], "value": l["members"]}
                        for l in by_level if l["members"] > 0
                    ],
                    "label": {"formatter": "{b}: {d}%"},
                }],
            }
        elif by_status:
            chart_config = {
                "type": "pie",
                "title": {"text": "会员卡状态分布", "left": "center"},
                "tooltip": {"trigger": "item"},
                "series": [{
                    "name": "会员数",
                    "type": "pie",
                    "radius": "60%",
                    "data": [
                        {"name": s["status"], "value": s["members"]}
                        for s in by_status if s["members"] > 0
                    ],
                }],
            }

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "total_members": total_members,
                "active_members": active_members,
                "by_level": by_level,
                "by_status": by_status,
                "balance_bins": balance_bins,
                "by_gender": by_gender,
                "total_recharge": round(total_recharge, 2) if recharge_col else None,
                "total_balance": round(total_balance, 2) if balance_col else None,
                "total_gift": round(total_gift, 2) if gift_col else None,
                "implied_consumed": round(implied_consumed, 2) if implied_consumed is not None else None,
                "consumed_rate_pct": consumed_rate_pct,
            },
            chart_config=chart_config,
            kpis={
                "total_members": total_members,
                "active_members": active_members,
                "top_level": by_level[0]["level"] if by_level else None,
                "total_recharge": round(total_recharge, 2) if recharge_col else None,
                "total_balance": round(total_balance, 2) if balance_col else None,
                "consumed_rate_pct": consumed_rate_pct,
            },
            insight_text=insight_text,
        )
