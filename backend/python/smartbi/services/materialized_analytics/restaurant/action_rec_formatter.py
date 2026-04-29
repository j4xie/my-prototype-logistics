"""Spec §4.3 compliant action recommendation formatter (K2 / C-rec 8).

Background
----------
C-quality.md C-rec 8 found 9/14 audited template insight_text strings
ended with vague "建议优化经营策略" or no recommendation at all.
I2 (commit e2ac5ee2c) added ACTION_REC_GUARD_CLAUSE for LLM-routed surfaces
but deterministic templates' hardcoded Chinese strings were untouched.

Standardized format ensures all template insights end with concrete next
steps that satisfy spec §4.3:
  对象  : <specific store/staff/dish/segment>
  收益  : <pct or yuan range>
  前置  : <prerequisite action>
  时间  : <implementation window>

If data insufficient for any field, use placeholder per spec
('数据待补' / '需先 X').
"""
from __future__ import annotations


def format_action_rec(
    object_target: str,
    benefit_range: str,
    prerequisite: str,
    timeline: str,
) -> str:
    """Build a spec §4.3 compliant action recommendation string.

    Example
    -------
    >>> format_action_rec(
    ...     object_target="青花椒徐汇日月光店",
    ...     benefit_range="客单价提升 3-5%",
    ...     prerequisite="服务员推销话术培训",
    ...     timeline="本月内",
    ... )
    '建议: 针对【青花椒徐汇日月光店】客单价提升 3-5% (前置: 服务员推销话术培训, 本月内完成)'
    """
    return (
        f"建议: 针对【{object_target}】{benefit_range} "
        f"(前置: {prerequisite}, {timeline}完成)"
    )


def format_data_insufficient(
    needed: str,
    next_action: str = "补充数据来源",
) -> str:
    """When data is insufficient for a concrete recommendation, fall back to honest signal.

    Example
    -------
    >>> format_data_insufficient(
    ...     needed="补充门店客单价对标数据",
    ...     next_action="联系产品组对接行业基准",
    ... )
    '建议: 数据不足以推荐具体行动,需先补充门店客单价对标数据 (后续动作: 联系产品组对接行业基准)'
    """
    return (
        f"建议: 数据不足以推荐具体行动,需先{needed} "
        f"(后续动作: {next_action})"
    )


# Apr 26 2026 phase 5 (UX): dim-aware action rec variations.
# Single generic "复制 Top SOP 可拉高末位 10-20% (前置: 对标走访 + KPI 重设)"
# was used across all top_n_by_dim outputs regardless of dim — felt
# boilerplate. Different dim types call for different operational
# actions; this dispatcher returns dim-specific phrasing.

def dim_aware_top_n_action_rec(
    primary_dim: str,
    measure: str,
    top_label: str,
    bottom_label: str,
    gap_pct: float,
) -> str:
    """Return a dim-tailored action_rec for top_n_by_dim outputs.

    - 门店/店类: 标杆复制 + 店长培训 (现行默认)
    - 商品/菜品/类别: 主推聚焦 + 末位淘汰
    - 渠道/平台: 投入重分配 + ROI 监测
    - 时段/月份: 高峰扩容 + 低谷促销
    - 等级/客群: 高净值留存 + 低活跃唤醒
    - 默认: 通用复盘
    """
    dim = (primary_dim or '').strip()

    if any(k in dim for k in ('门店', '店铺', '分店', '店')):
        return format_action_rec(
            object_target=f"末位门店「{bottom_label}」 (与 Top「{top_label}」差距 {gap_pct:.0f}%)",
            benefit_range=f"复制「{top_label}」标杆运营 SOP 可拉升末位营收 15-25%",
            prerequisite=f"对标走访「{top_label}」 + 末位店长 4 周培训 + 月度 KPI 复盘",
            timeline="本季度",
        )
    if any(k in dim for k in ('商品', '菜品', '产品', '类别', '分类', '品类', '单品')):
        return format_action_rec(
            object_target=f"末位{dim}「{bottom_label}」 (与 Top「{top_label}」差距 {gap_pct:.0f}%)",
            benefit_range=(
                f"主推聚焦头部 (将「{top_label}」做成爆款 SKU) + 末位淘汰/重做菜单, "
                f"预计提升 {measure} 8-15%"
            ),
            prerequisite=f"复盘「{top_label}」热销原因 + 与末位 SKU 毛利成本对比 + 菜单设计师介入",
            timeline="2 周内",
        )
    if any(k in dim for k in ('渠道', '平台', '来源', '美团', '饿了么', '抖音')):
        return format_action_rec(
            object_target=f"末位渠道「{bottom_label}」 (与 Top「{top_label}」差距 {gap_pct:.0f}%)",
            benefit_range=(
                f"营销投入向「{top_label}」倾斜 + 退出/缩减「{bottom_label}」, "
                f"渠道 ROI 提升 20-30%"
            ),
            prerequisite=f"近 3 月渠道客单价/毛利对比 + 平台佣金/广告费明细",
            timeline="本月内",
        )
    if any(k in dim for k in ('时段', '小时', '月份', '工作日', '周末', '节假日')):
        return format_action_rec(
            object_target=f"末位时段「{bottom_label}」 (与 Top「{top_label}」差距 {gap_pct:.0f}%)",
            benefit_range=(
                f"高峰「{top_label}」扩容 (人手/备货) + 低谷「{bottom_label}」促销引流, "
                f"全天产能利用率 +10-15%"
            ),
            prerequisite=f"分时人效统计 + 低谷优惠券方案设计",
            timeline="2 周试点",
        )
    if any(k in dim for k in ('等级', '客群', '会员', '客户', '贡献')):
        return format_action_rec(
            object_target=f"末位{dim}「{bottom_label}」 (与 Top「{top_label}」差距 {gap_pct:.0f}%)",
            benefit_range=(
                f"高净值「{top_label}」专属权益维系 + 低活跃「{bottom_label}」唤醒券, "
                f"贡献度提升 5-12%"
            ),
            prerequisite=f"客群消费频次/客单价分层 + CRM 触达策略设计",
            timeline="本月内",
        )
    # Default: keep the original "复制 SOP" pattern but slightly varied
    return format_action_rec(
        object_target=f"末位「{bottom_label}」 (与 Top「{top_label}」差距 {gap_pct:.0f}%)",
        benefit_range=f"对标 Top「{top_label}」运营成功要素 + 末位{dim}重审, 拉高 {measure} 10-20%",
        prerequisite=f"成功要素 5 维拆解 (产品/价格/位置/服务/营销) + 末位{dim}诊断",
        timeline="本季度",
    )
