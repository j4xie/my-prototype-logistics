from __future__ import annotations
"""
Scenario detection and domain-specific context builders.

Detects whether data is financial, production, restaurant, sales,
supply-chain or generic, then pre-computes context strings that are
injected into LLM prompts.
"""
import asyncio
import logging
import re
from typing import Optional, List

import numpy as np
import pandas as pd

from .data_summarizer import humanize_df_columns, is_placeholder_col

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Scenario detection
# ---------------------------------------------------------------------------

def detect_analysis_scenario(df: pd.DataFrame) -> str:
    """Detect the analysis scenario from column names and data.

    Returns one of: ``'restaurant_operations'``, ``'financial'``, ``'sales'``,
    ``'production'``, ``'supply_chain'``, ``'general'``.

    Restaurant check runs first to avoid POS data falling into generic 'sales'.
    """
    col_text = '|'.join(df.columns.tolist()).lower()
    text_cols = df.select_dtypes(include=['object']).columns
    if len(text_cols) > 0:
        labels = df[text_cols[0]].dropna().astype(str).tolist()[:50]
        col_text += '|' + '|'.join(labels).lower()

    # Priority check: restaurant POS / procurement data
    restaurant_kw = [
        '门店名称', '商品名称', '商品分类', '点单方式', '套餐',
        '销售金额', '折后金额', '实收', '入库', '供应商', '原料',
        '餐饮商品', '单卖数量', '套餐子商品', '堂食', '外卖',
    ]
    restaurant_score = sum(1 for kw in restaurant_kw if kw in col_text)
    if restaurant_score >= 3:
        return 'restaurant_operations'

    scores = {
        'financial': 0,
        'sales': 0,
        'production': 0,
        'supply_chain': 0,
    }

    financial_kw = [
        '收入', '利润', '费用', '成本', '毛利', '净利', '营业', '资产', '负债',
        '税', '折旧', '摊销', '预算', '金额', '合计', '应收', '应付', '现金',
        '分红', '利润表', '资产负债', '损益',
        'revenue', 'profit', 'cost', 'expense', 'margin', 'budget', 'actual',
    ]
    sales_kw = [
        '订单', '客户', '销量', '销售额', '退货', '客单价', '转化率', '渠道',
        '区域', '经销商', '返利', '分部', '销售',
        'order', 'customer', 'sales', 'channel', 'return',
    ]
    production_kw = [
        '产量', '良品', '废品', '设备', '利用率', '产能', 'oee', '能耗',
        '用电', '水耗', '工时', '产线', 'yield', 'production', 'equipment',
    ]
    supply_chain_kw = [
        '库存', '到货', '供应商', '采购', '周转', '仓储', '物流', '缺货',
        'inventory', 'supplier', 'procurement', 'warehouse', 'logistics',
    ]

    for kw in financial_kw:
        if kw in col_text:
            scores['financial'] += 1
    for kw in sales_kw:
        if kw in col_text:
            scores['sales'] += 1
    for kw in production_kw:
        if kw in col_text:
            scores['production'] += 1
    for kw in supply_chain_kw:
        if kw in col_text:
            scores['supply_chain'] += 1

    max_score = max(scores.values())
    if max_score == 0:
        return 'general'

    return max(scores, key=scores.get)


# ---------------------------------------------------------------------------
# Financial context
# ---------------------------------------------------------------------------

def compute_financial_context(df: pd.DataFrame) -> str:
    """Pre-compute financial metrics to give LLM better 'ingredients'."""
    df = humanize_df_columns(df)
    meaningful_cols = [c for c in df.columns if not is_placeholder_col(c)]
    df = df[meaningful_cols]

    parts: List[str] = []

    text_cols = df.select_dtypes(include=['object']).columns
    if len(text_cols) == 0:
        return ""

    label_col = text_cols[0]
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not numeric_cols:
        return ""

    monthly_cols = [
        c for c in numeric_cols
        if pd.to_datetime(c, errors='coerce', format='%Y-%m-%d') is not pd.NaT
    ]
    if not monthly_cols:
        monthly_cols = [c for c in numeric_cols if any(p in c for p in ['月', '年'])]

    kw_map = {
        '营业收入': ['营业收入', '主营业务收入'],
        '营业成本': ['营业成本', '主营业务成本'],
        '毛利': ['毛利润', '毛利'],
        '净利润': ['净利润', '利润总额'],
        '费用': ['销售费用', '管理费用', '财务费用', '研发费用'],
    }

    found_rows: dict = {}
    labels = df[label_col].astype(str).str.strip()
    for category, keywords in kw_map.items():
        pattern = '|'.join(re.escape(kw) for kw in keywords)
        mask = labels.str.contains(pattern, regex=True, na=False)
        matched_indices = mask[mask].index
        for idx in matched_indices:
            label = labels.iloc[idx] if hasattr(labels, 'iloc') else labels[idx]
            if not label or label in found_rows:
                continue
            row_values = {}
            total = 0
            for nc in numeric_cols:
                val = df[nc].iloc[idx] if hasattr(df[nc], 'iloc') else df[nc][idx]
                if pd.notna(val) and isinstance(val, (int, float)):
                    row_values[nc] = val
                    total += val
            if row_values:
                found_rows[label] = {'values': row_values, 'total': total}

    if not found_rows:
        return ""

    parts.append("## 预计算财务指标")

    for label, info in found_rows.items():
        total = info['total']
        if abs(total) >= 1e8:
            display = f"{total/1e8:.2f}亿"
        elif abs(total) >= 1e4:
            display = f"{total/1e4:.2f}万"
        else:
            display = f"{total:,.2f}"
        parts.append(f"- {label}: 合计 {display}")

        if monthly_cols and len(info['values']) >= 3:
            vals = [info['values'].get(m) for m in monthly_cols if m in info['values']]
            if len(vals) >= 2:
                non_zero = [v for v in vals if v and v != 0]
                if non_zero:
                    first_nz, last_nz = non_zero[0], non_zero[-1]
                    if abs(first_nz) > 1e-6:
                        trend_pct = ((last_nz - first_nz) / abs(first_nz)) * 100
                        parts.append(
                            f"  趋势: {trend_pct:+.1f}% (从{first_nz:,.0f}到{last_nz:,.0f})"
                        )

    # Compute ratio metrics
    revenue_total = None
    cost_total = None
    net_profit_total = None
    for label, info in found_rows.items():
        if '营业收入' in label or '主营业务收入' in label:
            revenue_total = info['total']
        if '营业成本' in label or '主营业务成本' in label:
            cost_total = info['total']
        if '净利润' in label:
            net_profit_total = info['total']

    if revenue_total and abs(revenue_total) > 0:
        if cost_total is not None:
            gross_margin = (revenue_total - cost_total) / abs(revenue_total) * 100
            parts.append(f"- 毛利率: {gross_margin:.1f}% (食品加工参考范围15-35%，子行业差异大)")
        if net_profit_total is not None:
            net_margin = net_profit_total / abs(revenue_total) * 100
            parts.append(f"- 净利率: {net_margin:.1f}% (食品加工参考范围3-8%)")

        expense_benchmarks = {
            '销售费用': (8, 15), '管理费用': (5, 10),
            '财务费用': (1, 5), '研发费用': (2, 8),
        }
        total_expense = 0
        expense_items: List[tuple] = []
        for label, info in found_rows.items():
            if '费用' in label and info['total']:
                expense_ratio = info['total'] / abs(revenue_total) * 100
                total_expense += info['total']
                bench = None
                for bk, bv in expense_benchmarks.items():
                    if bk in label:
                        bench = bv
                        break
                bench_text = ""
                if bench:
                    bench_text = f" (参考范围{bench[0]}-{bench[1]}%)"
                expense_items.append((label, expense_ratio, bench_text))
                parts.append(f"- {label}率: {expense_ratio:.1f}%{bench_text}")

        if total_expense > 0:
            total_expense_ratio = total_expense / abs(revenue_total) * 100
            parts.append(f"- 总费用率: {total_expense_ratio:.1f}% (参考范围15-25%)")

        if len(expense_items) >= 2:
            sorted_expenses = sorted(expense_items, key=lambda x: x[1], reverse=True)
            parts.append(
                "- 费用占比排序: " + " > ".join(
                    f"{item[0]}({item[1]:.1f}%)" for item in sorted_expenses
                )
            )

    # Volatility analysis
    if monthly_cols and found_rows:
        trend_parts: List[str] = []
        for label, info in list(found_rows.items())[:4]:
            vals = [info['values'].get(m) for m in monthly_cols if m in info['values']]
            non_zero = [v for v in vals if v and v != 0]
            if len(non_zero) >= 3:
                arr = np.array(non_zero)
                cv = (arr.std() / abs(arr.mean())) * 100 if abs(arr.mean()) > 1e-6 else 0
                max_val, min_val = arr.max(), arr.min()
                trend_parts.append(
                    f"  {label}: 波动率{cv:.1f}%, 最高{max_val:,.0f}, 最低{min_val:,.0f}"
                )
        if trend_parts:
            parts.append("### 波动性分析")
            parts.extend(trend_parts)

    return "\n".join(parts) if len(parts) > 1 else ""


# ---------------------------------------------------------------------------
# Production context
# ---------------------------------------------------------------------------

def compute_production_context(df: pd.DataFrame) -> str:
    """Pre-compute production / OEE metrics for LLM context."""
    parts: List[str] = []
    text_cols = df.select_dtypes(include=['object']).columns
    if len(text_cols) == 0:
        return ""
    label_col = text_cols[0]
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not numeric_cols:
        return ""

    prod_kw_map = {
        '产量': ['产量', '产出', '总产量', 'output', 'production'],
        '良品率': ['良品率', '合格率', '良率', 'yield', 'yield_rate'],
        '废品率': ['废品率', '不良率', '次品率', 'waste_rate', 'defect_rate'],
        '设备利用率': ['设备利用率', '利用率', '开机率', 'oee', 'utilization'],
        '能耗': ['能耗', '用电', '水耗', '电耗', 'energy', 'power'],
        '工时': ['工时', '人工时', '人时', 'labor_hours', 'man_hours'],
    }

    found_rows: dict = {}
    labels = df[label_col].astype(str).str.strip()
    labels_lower = labels.str.lower()
    for category, keywords in prod_kw_map.items():
        pattern = '|'.join(re.escape(kw) for kw in keywords)
        mask = labels_lower.str.contains(pattern, regex=True, na=False)
        matched_indices = mask[mask].index
        for idx in matched_indices:
            label = labels.iloc[idx] if hasattr(labels, 'iloc') else labels[idx]
            if not label:
                continue
            row_values = {}
            for nc in numeric_cols:
                val = df[nc].iloc[idx] if hasattr(df[nc], 'iloc') else df[nc][idx]
                if pd.notna(val) and isinstance(val, (int, float)):
                    row_values[nc] = val
            if row_values and label not in found_rows:
                found_rows[label] = {'values': row_values, 'category': category}

    col_metrics: dict = {}
    for col in numeric_cols:
        col_lower = col.lower()
        for category, keywords in prod_kw_map.items():
            if any(kw in col_lower for kw in keywords):
                values = df[col].dropna()
                if len(values) > 0:
                    col_metrics[col] = {
                        'category': category,
                        'mean': float(values.mean()),
                        'min': float(values.min()),
                        'max': float(values.max()),
                    }
                break

    if not found_rows and not col_metrics:
        return ""

    parts.append("## 预计算生产运营指标")

    for label, info in found_rows.items():
        vals = info['values']
        total = sum(vals.values())
        if abs(total) >= 1e4:
            display = f"{total/1e4:.2f}万"
        else:
            display = f"{total:,.2f}"
        parts.append(f"- {label} ({info['category']}): 合计 {display}")

    for col, info in col_metrics.items():
        parts.append(
            f"- 列 [{col}] ({info['category']}): 均值={info['mean']:.2f}, "
            f"范围=[{info['min']:.2f}, {info['max']:.2f}]"
        )

    parts.append("### 生产行业基准")
    parts.append("  - OEE: 食品加工行业60-85%")
    parts.append("  - 良品率: 95-99.5%")
    parts.append("  - 废品率: 1-5%")
    parts.append("  - 能耗成本占比: 5-15%")

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Restaurant context
# ---------------------------------------------------------------------------

def compute_restaurant_context(df: pd.DataFrame) -> str:
    """Pre-compute restaurant chain metrics for LLM context injection.

    Covers: menu engineering quadrants, store comparison, category breakdown,
    combo efficiency, discount analysis, and Dianping listing potential.
    """
    parts: List[str] = []
    cols = {c.strip(): c for c in df.columns}

    def _find_col(*candidates: str) -> Optional[str]:
        for cand in candidates:
            for raw in cols:
                if cand in raw:
                    return cols[raw]
        return None

    store_col = _find_col("门店名称", "门店")
    product_col = _find_col("商品名称", "商品")
    category_col = _find_col("商品分类", "分类")
    order_method_col = _find_col("点单方式")
    qty_single_col = _find_col("单卖数量")
    qty_combo_col = _find_col("套餐内销量")
    amount_col = _find_col("销售金额")
    actual_col = _find_col("实收")
    discount_col = _find_col("折后金额")
    return_col = _find_col("退货数量")
    supplier_col = _find_col("供应商")
    material_col = _find_col("原料名称", "原料分类")
    inbound_qty_col = _find_col("入库数量")
    inbound_amt_col = _find_col("入库金额")

    # Fallback: Java upload may rename columns
    if not product_col:
        for c in df.columns:
            c_lower = c.strip().lower()
            if c_lower.startswith("product") and c_lower != "product":
                sample = df[c].dropna().head(20)
                if (
                    len(sample) > 0
                    and sample.apply(
                        lambda x: isinstance(x, str)
                        and any('\u4e00' <= ch <= '\u9fff' for ch in str(x))
                    ).mean() > 0.3
                ):
                    product_col = c
                    logger.info(f"Restaurant context: product_col fallback -> '{c}'")
                    break
    if not category_col:
        for c in df.columns:
            if c.strip().lower() == "category":
                category_col = c
                break
    if not qty_single_col:
        for c in df.columns:
            c_lower = c.strip().lower()
            if c_lower.startswith("product") and c_lower != "product" and c != product_col:
                try:
                    vals = pd.to_numeric(df[c], errors='coerce').dropna()
                    if len(vals) > 10 and vals.median() > 0 and vals.median() < 10000:
                        if (vals == vals.astype(int)).mean() > 0.8:
                            qty_single_col = c
                            logger.info(
                                f"Restaurant context: qty_single_col fallback -> '{c}'"
                            )
                            break
                except Exception:
                    pass

    # Ensure numeric columns are actually numeric (work on copy)
    df = df.copy()
    for nc in [
        actual_col, amount_col, discount_col, qty_single_col,
        qty_combo_col, return_col, inbound_qty_col, inbound_amt_col,
    ]:
        if nc and nc in df.columns:
            df[nc] = pd.to_numeric(df[nc], errors='coerce').fillna(0)

    # Menu Engineering Quadrant
    if product_col and actual_col:
        qty_col = qty_single_col
        if qty_col:
            item_df = df.groupby(product_col).agg(
                total_revenue=pd.NamedAgg(column=actual_col, aggfunc='sum'),
                total_qty=pd.NamedAgg(column=qty_col, aggfunc='sum'),
            ).reset_index()
        else:
            item_df = df.groupby(product_col).agg(
                total_revenue=pd.NamedAgg(column=actual_col, aggfunc='sum'),
                total_qty=pd.NamedAgg(column=actual_col, aggfunc='count'),
            ).reset_index()

        item_df = item_df[item_df['total_qty'] > 0].copy()
        if len(item_df) > 0:
            item_df['unit_profit'] = item_df['total_revenue'] / item_df['total_qty']
            qty_median = item_df['total_qty'].median()
            profit_median = item_df['unit_profit'].median()

            def _quadrant(row):
                high_qty = row['total_qty'] >= qty_median
                high_profit = row['unit_profit'] >= profit_median
                if high_qty and high_profit:
                    return 'Star'
                if high_qty and not high_profit:
                    return 'Plow'
                if not high_qty and high_profit:
                    return 'Puzzle'
                return 'Dog'

            item_df['quadrant'] = item_df.apply(_quadrant, axis=1)

            parts.append("## 菜品四象限分析 (Menu Engineering)")
            parts.append(
                f"分析菜品数: {len(item_df)}, 销量中位数: {qty_median:.0f}, "
                f"单品利润中位数: {profit_median:.1f}元"
            )
            for q_name, q_label in [
                ('Star', '明星菜(高销量+高利润)'),
                ('Plow', '金牛菜(高销量+低利润)'),
                ('Puzzle', '问题菜(低销量+高利润)'),
                ('Dog', '瘦狗菜(低销量+低利润)'),
            ]:
                q_items = item_df[item_df['quadrant'] == q_name].nlargest(
                    15, 'total_revenue'
                )
                if len(q_items) > 0:
                    items_str = ', '.join(
                        f"{row[product_col]}(\\{row['total_revenue']:.0f}/{row['total_qty']:.0f}份)"
                        for _, row in q_items.iterrows()
                    )
                    q_count = len(item_df[item_df['quadrant'] == q_name])
                    parts.append(f"- **{q_label}** ({q_count}个): {items_str}")

    # Store Comparison
    if store_col and actual_col:
        store_df = df.groupby(store_col).agg(
            total_revenue=pd.NamedAgg(column=actual_col, aggfunc='sum'),
            item_count=pd.NamedAgg(column=actual_col, aggfunc='count'),
        ).reset_index().sort_values('total_revenue', ascending=False)

        parts.append(f"\n## 门店对比 (共{len(store_df)}家)")
        top_stores = store_df.head(10)
        for rank, (_, row) in enumerate(top_stores.iterrows(), 1):
            parts.append(
                f"  {rank}. {row[store_col]}: "
                f"\\{row['total_revenue']:,.0f} ({row['item_count']}单)"
            )

        if len(store_df) > 10:
            bottom = store_df.tail(5)
            parts.append("  -- 末位门店 --")
            for _, row in bottom.iterrows():
                parts.append(f"  - {row[store_col]}: \\{row['total_revenue']:,.0f}")

        median_rev = store_df['total_revenue'].median()
        weak_stores = store_df[store_df['total_revenue'] < median_rev * 0.5]
        if len(weak_stores) > 0:
            names = ', '.join(weak_stores[store_col].tolist()[:5])
            parts.append(f"  ⚠ 营收低于中位数50%的门店: {names}")

    # Category Breakdown
    if category_col and actual_col:
        cat_df = df.groupby(category_col).agg(
            revenue=pd.NamedAgg(column=actual_col, aggfunc='sum'),
        ).reset_index().sort_values('revenue', ascending=False)
        total_rev = cat_df['revenue'].sum()
        if total_rev > 0:
            parts.append("\n## 品类结构")
            for _, row in cat_df.head(10).iterrows():
                pct = row['revenue'] / total_rev * 100
                parts.append(
                    f"  - {row[category_col]}: \\{row['revenue']:,.0f} ({pct:.1f}%)"
                )

    # Combo Efficiency
    if order_method_col and actual_col:
        combo_df = df.groupby(order_method_col).agg(
            revenue=pd.NamedAgg(column=actual_col, aggfunc='sum'),
            count=pd.NamedAgg(column=actual_col, aggfunc='count'),
        ).reset_index()
        total_rev = combo_df['revenue'].sum()
        if total_rev > 0:
            parts.append("\n## 套餐效率")
            for _, row in combo_df.iterrows():
                pct = row['revenue'] / total_rev * 100
                parts.append(
                    f"  - {row[order_method_col]}: "
                    f"\\{row['revenue']:,.0f} ({pct:.1f}%), {row['count']}笔"
                )

    # Discount Analysis
    if store_col and amount_col and actual_col:
        store_disc = df.groupby(store_col).agg(
            gross=pd.NamedAgg(column=amount_col, aggfunc='sum'),
            net=pd.NamedAgg(column=actual_col, aggfunc='sum'),
        ).reset_index()
        store_disc['discount_pct'] = (
            (1 - store_disc['net'] / store_disc['gross'].replace(0, 1)) * 100
        ).clip(0, 100)
        high_disc = store_disc[store_disc['discount_pct'] > 20].sort_values(
            'discount_pct', ascending=False
        )
        if len(high_disc) > 0:
            parts.append("\n## 折扣依赖预警 (折扣率>20%)")
            for _, row in high_disc.head(5).iterrows():
                parts.append(f"  - {row[store_col]}: 折扣率 {row['discount_pct']:.1f}%")

    # Procurement Analysis
    if supplier_col and (inbound_qty_col or inbound_amt_col):
        val_col = inbound_amt_col or inbound_qty_col
        sup_df = df.groupby(supplier_col).agg(
            total=pd.NamedAgg(column=val_col, aggfunc='sum'),
        ).reset_index().sort_values('total', ascending=False)
        parts.append(f"\n## 供应商分析 (共{len(sup_df)}家)")
        total = sup_df['total'].sum()
        for _, row in sup_df.head(5).iterrows():
            pct = row['total'] / total * 100 if total > 0 else 0
            parts.append(f"  - {row[supplier_col]}: {row['total']:,.0f} ({pct:.1f}%)")
        top3_pct = sup_df.head(3)['total'].sum() / total * 100 if total > 0 else 0
        parts.append(f"  前3供应商集中度: {top3_pct:.1f}%")

    # Dianping Listing Potential
    if product_col and actual_col and len(parts) > 0:
        parts.append("\n## 大众点评上榜潜力评估维度")
        parts.append("  - 招牌菜集中度: Star象限菜品收入占总收入比例")
        if return_col:
            total_returns = pd.to_numeric(df[return_col], errors='coerce').sum()
            total_qty_val = (
                pd.to_numeric(df[qty_single_col], errors='coerce').sum()
                if qty_single_col else len(df)
            )
            return_rate = total_returns / total_qty_val * 100 if total_qty_val > 0 else 0
            parts.append(f"  - 退货/退菜率: {return_rate:.2f}%")
        parts.append("  - 价格定位: 参考客单价与行业中位数对比")
        parts.append("  - 出品稳定性: 各门店同菜品价格方差")

    if not parts:
        return ""
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Food KB context
# ---------------------------------------------------------------------------

async def get_food_kb_context_with_timeout(
    df: pd.DataFrame, timeout_secs: float = 3.0
) -> str:
    """Query food KB with a timeout -- returns empty string on timeout or error."""
    try:
        return await asyncio.wait_for(
            _get_food_kb_context(df), timeout=timeout_secs,
        )
    except asyncio.TimeoutError:
        logger.info(f"Food KB context timed out after {timeout_secs}s, skipping")
        return ""
    except Exception as e:
        logger.debug(f"Food KB context error: {e}")
        return ""


async def _get_food_kb_context(df: pd.DataFrame) -> str:
    """Query food knowledge base for industry context."""
    try:
        from services.food_context_bridge import get_food_context_bridge

        bridge = get_food_context_bridge()
        column_names = df.columns.tolist()
        sample_data = df.head(5).to_dict('records') if len(df) > 0 else None

        ctx = await bridge.get_food_context(column_names, sample_data)
        if not ctx.get("is_food_industry"):
            return ""

        parts: List[str] = []
        kb_text = ctx.get("kb_context", "")
        if kb_text:
            parts.append(kb_text)

        try:
            enriched = await bridge.get_entity_enriched_context(column_names, sample_data)
            entity_text = enriched.get("context_text", "")
            if entity_text:
                parts.append(entity_text)
        except Exception as e:
            logger.debug(f"Entity enrichment skipped: {e}")

        try:
            report_context = await _get_industry_report_context(df, ctx)
            if report_context:
                parts.append(report_context)
        except Exception as e:
            logger.debug(f"Industry report retrieval skipped: {e}")

        if parts:
            return "\n## 食品行业知识库参考\n" + "\n".join(parts)
        return ""
    except Exception as e:
        logger.debug(f"Food KB context unavailable: {e}")
        return ""


async def _get_industry_report_context(
    df: pd.DataFrame, food_ctx: dict
) -> str:
    """Query industry_report category in food knowledge base for relevant passages."""
    try:
        from food_kb.services.knowledge_retriever import get_knowledge_retriever

        retriever = get_knowledge_retriever()
        if not retriever.is_ready():
            return ""

        sub_sector = food_ctx.get("sub_sector", "")
        restaurant_info = food_ctx.get("restaurant_info", {})

        query_parts = ["行业报告"]
        if restaurant_info.get("is_restaurant_chain"):
            chain_type = restaurant_info.get("chain_type", "餐饮")
            query_parts.append(f"餐饮 {chain_type}")
            data_type = restaurant_info.get("data_type", "")
            if data_type:
                query_parts.append(data_type)
        elif sub_sector:
            query_parts.append(f"食品 {sub_sector}")
        else:
            query_parts.append("食品加工")

        col_text = " ".join(df.columns.tolist()[:15])
        metric_keywords: List[str] = []
        for kw in [
            "成本", "利润", "毛利", "翻台", "客单价", "食材",
            "人力", "营收", "同比", "环比", "趋势", "市场",
        ]:
            if kw in col_text:
                metric_keywords.append(kw)
        if metric_keywords:
            query_parts.extend(metric_keywords[:3])

        query = " ".join(query_parts)

        results = await retriever.retrieve(
            query=query,
            categories=["industry_report"],
            top_k=3,
            similarity_threshold=0.50,
        )

        if not results:
            return ""

        report_parts = ["行业报告参考:"]
        for doc in results:
            source = doc.source or "未知来源"
            content = doc.content
            if len(content) > 500:
                content = content[:500] + "..."
            report_parts.append(f"  [{source}] {content}")

        return "\n".join(report_parts)

    except ImportError:
        logger.debug("food_kb module not available for industry report retrieval")
        return ""
    except Exception as e:
        logger.debug(f"Industry report retrieval failed: {e}")
        return ""
