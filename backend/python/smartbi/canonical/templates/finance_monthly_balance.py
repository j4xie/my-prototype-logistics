"""Monthly debit/credit balance from fact_finance_voucher × dim_finance_subject."""
from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from smartbi.canonical.templates.base import TemplateResult

if TYPE_CHECKING:
    import asyncpg


async def compute_finance_monthly_balance(
    pool: "asyncpg.Pool",
    factory_id: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> TemplateResult:
    """Aggregate vouchers by month × subject category. Net = credit − debit.

    Tenant safety: caller MUST set ``app.factory_id`` (via tenant_ctx.set_factory_id
    or pool setup callback) before invoking. Forgetting → FORCE RLS silently returns
    0 rows. Mirrors BaseWriter.write contract.
    """
    where = ["v.factory_id = $1"]
    params: list = [factory_id]
    if date_from is not None:
        where.append(f"v.voucher_date >= ${len(params) + 1}")
        params.append(date_from)
    if date_to is not None:
        where.append(f"v.voucher_date <= ${len(params) + 1}")
        params.append(date_to)
    where_sql = " AND ".join(where)

    sql = f"""
        SELECT
          date_trunc('month', v.voucher_date)::date AS month,
          COALESCE(s.category, 'unknown') AS category,
          SUM(COALESCE(v.debit_amount, 0)) AS debit_total,
          SUM(COALESCE(v.credit_amount, 0)) AS credit_total
        FROM fact_finance_voucher v
        LEFT JOIN dim_finance_subject s ON s.subject_id = v.subject_id
        WHERE {where_sql}
          AND v.voucher_date IS NOT NULL
        GROUP BY 1, 2
        ORDER BY 1, 2
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    if not rows:
        return TemplateResult(
            code="finance_monthly_balance",
            title="月度收支",
            data={},
            applies=False,
            skip_reason="no fact_finance_voucher rows",
        )

    items: List[Dict[str, Any]] = []
    total_debit = 0.0
    total_credit = 0.0
    months_set = set()

    for r in rows:
        debit = float(r["debit_total"] or 0)
        credit = float(r["credit_total"] or 0)
        balance = credit - debit
        month_val = r["month"]
        month_str = month_val.isoformat() if month_val else None
        if month_str:
            months_set.add(month_str)
        items.append(
            {
                "month": month_str,
                "category": r["category"],
                "debit": round(debit, 2),
                "credit": round(credit, 2),
                "balance": round(balance, 2),
            }
        )
        total_debit += debit
        total_credit += credit

    net_balance = total_credit - total_debit
    n_months = len(months_set)

    return TemplateResult(
        code="finance_monthly_balance",
        title="月度收支",
        data={"items": items},
        kpis={
            "total_debit": round(total_debit, 2),
            "total_credit": round(total_credit, 2),
            "net_balance": round(net_balance, 2),
            "n_months": n_months,
        },
        chart_config={
            "type": "stacked_bar",
            "x_field": "month",
            "y_fields": ["debit", "credit"],
            "group_field": "category",
            "title": "月度收支 (按科目类别)",
        },
        insight_text=(
            f"近 {n_months} 个月净收支 ¥{net_balance:,.0f}，"
            f"收入 ¥{total_credit:,.0f} / 支出 ¥{total_debit:,.0f}。"
        ),
    )
