"""Tests for scripts/backfill_silver.py — legacy JSONB → Silver+Gold.

Week 4 Day 2 of Unified Data Layer v1 spec (Phase A.5).

Seeds smart_bi_pg_excel_uploads + smart_bi_dynamic_data with fake rows
that mirror the qhj export shape (Chinese column names in row_data,
field_mappings that map them to canonical names). Runs backfill_upload
and asserts Silver + Gold populated correctly.
"""
from __future__ import annotations

import json
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio

# Add scripts/ to sys.path for the import
import sys
from pathlib import Path
_SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from backfill_silver import (  # noqa: E402
    _PAYMENT_COLUMNS,
    _build_canonical_row,
    _extract_discounts,
    _extract_payments,
    _is_discount_column,
    _lookup_attr,
    _normalize_field_mappings,
    _parse_date,
    _parse_decimal,
    _parse_int,
    backfill_upload,
)


_TENANT = "TEST_BF_A"
_UPLOAD_ID = 99999  # synthetic id; cleanup wipes this


# ── Pure-function helpers ───────────────────────────────────

def test_parse_date_multiple_formats():
    assert _parse_date("2026-04-21") == date(2026, 4, 21)
    assert _parse_date("2026/4/21") == date(2026, 4, 21)
    assert _parse_date("2026-04-21 12:34:56") == date(2026, 4, 21)
    assert _parse_date("") is None
    assert _parse_date(None) is None
    assert _parse_date("not-a-date") is None
    assert _parse_date(date(2026, 4, 21)) == date(2026, 4, 21)


def test_parse_decimal_strips_currency_symbols():
    assert _parse_decimal("¥100.50") == Decimal("100.50")
    assert _parse_decimal("1,234.56") == Decimal("1234.56")
    assert _parse_decimal("") is None
    assert _parse_decimal(None) is None
    assert _parse_decimal("garbage") is None


def test_parse_int_robust():
    assert _parse_int("3") == 3
    assert _parse_int("3.0") == 3
    assert _parse_int(" 7 ") == 7
    assert _parse_int("") is None
    assert _parse_int("oops") is None


def test_build_canonical_row_maps_chinese_aliases():
    row_data = {
        "门店名称": "门店A",
        "订单号": "B001",
        "日期": "2026-04-21",
        "实收金额": "58.00",
        "人数": "2",
        "菜品明细": "#米饭#_1份*3",
        "非映射字段": "ignored",
    }
    field_mappings = {
        "门店名称": "store_name",
        "订单号": "source_bill_no",
        "日期": "date",
        "实收金额": "net_amount",
        "人数": "customer_count",
        "菜品明细": "combo_string",
    }
    unknown: list = []
    row = _build_canonical_row(
        row_data, field_mappings, "F", "excel", 100, unknown,
    )
    assert row is not None
    assert row.store_name == "门店A"
    assert row.source_bill_no == "B001"
    assert row.date == date(2026, 4, 21)
    assert row.net_amount == Decimal("58.00")
    assert row.customer_count == 2
    assert row.combo_string == "#米饭#_1份*3"
    # 非映射字段 has no field_mapping AND isn't in _ALIAS_TO_ATTR → gets tracked
    # in unknown with a <raw> prefix so admin can see what's being dropped.
    assert unknown == ["<raw>非映射字段"]


def test_build_canonical_row_missing_required_returns_none():
    row_data = {"订单号": "B001", "日期": "2026-04-21"}  # no store_name
    field_mappings = {
        "订单号": "source_bill_no",
        "日期": "date",
    }
    out = _build_canonical_row(row_data, field_mappings, "F", "excel", 100, [])
    assert out is None


def test_normalize_field_mappings_dict_form():
    raw = {"门店名称": "store_name", "订单号": "source_bill_no"}
    assert _normalize_field_mappings(raw) == {
        "门店名称": "store_name", "订单号": "source_bill_no",
    }


def test_normalize_field_mappings_array_form():
    """Real upload 3970 shape: array of {originalColumn, standardField, ...}."""
    raw = [
        {"originalColumn": "门店名称", "standardField": "category_name",
         "dataType": "TEXT", "confidence": 0.85},
        {"originalColumn": "营业日期", "standardField": "time_period"},
        {"originalColumn": "broken", "standardField": None},
    ]
    assert _normalize_field_mappings(raw) == {
        "门店名称": "category_name",
        "营业日期": "time_period",
        "broken": "",
    }


def test_normalize_field_mappings_handles_json_string():
    import json
    raw = json.dumps({"a": "b"})
    assert _normalize_field_mappings(raw) == {"a": "b"}


def test_normalize_field_mappings_handles_none_and_empty():
    assert _normalize_field_mappings(None) == {}
    assert _normalize_field_mappings("") == {}
    assert _normalize_field_mappings([]) == {}
    assert _normalize_field_mappings({}) == {}


def test_lookup_attr_prefers_standard_field():
    """When standardField is a known alias, use it (Path A)."""
    # "store_name" is in _ALIAS_TO_ATTR mapping to "store_name"
    assert _lookup_attr("某中文列", "store_name") == "store_name"


def test_lookup_attr_falls_back_to_original_column():
    """When standardField is generic-type junk, fall through to original_col.
    This is the real qhj 3970 case: standardField='category_name' but
    originalColumn='门店名称' which IS in the alias table."""
    assert _lookup_attr("门店名称", "category_name") == "store_name"


def test_lookup_attr_returns_none_when_both_fail():
    assert _lookup_attr("totally_unknown_col", "also_unknown") is None


# ── EAV payment extraction ───────────────────────────────────

def test_extract_payments_picks_non_zero_amounts():
    row = {
        "现金": "100.00",
        "微信": "",
        "美团": "0",
        "[美团支付]": "50.5",
        "某不相关列": "ignored",
    }
    out = _extract_payments(row)
    # Set comparison because _PAYMENT_COLUMNS iteration order is set-based
    got = set(out)
    assert got == {("现金", Decimal("100.00")), ("[美团支付]", Decimal("50.5"))}


def test_extract_payments_handles_currency_symbols():
    """qhj exports sometimes have ¥ or 1,234.56 — _parse_decimal strips."""
    row = {"现金": "¥1,234.56"}
    out = _extract_payments(row)
    assert out == (("现金", Decimal("1234.56")),)


def test_extract_payments_empty_when_all_zero_or_missing():
    row = {"现金": "0", "微信": "0.00", "美团": ""}
    assert _extract_payments(row) == ()


def test_extract_payments_ignores_non_payment_columns():
    """Columns not in _PAYMENT_COLUMNS are skipped even if numeric."""
    row = {"折扣额": "50.00", "门店名称": "门店A"}
    assert _extract_payments(row) == ()


def test_payment_columns_known_methods_present():
    """Regression: core payment methods must be in the curated set."""
    for method in ("现金", "微信", "美团", "[美团支付]", "银行卡", "饿了么"):
        assert method in _PAYMENT_COLUMNS, f"{method} missing from _PAYMENT_COLUMNS"


def test_build_canonical_row_attaches_payments():
    row_data = {
        "门店名称": "S1",
        "账单号": "B1",
        "营业日期": "2026-04-21",
        "现金": "50.00",
        "微信": "30.00",
        "美团": "0",
    }
    field_mappings = {}
    unknown: list = []
    row = _build_canonical_row(
        row_data, field_mappings, "F001", "excel", 100, unknown,
    )
    assert row is not None
    assert set(row.payments) == {
        ("现金", Decimal("50.00")),
        ("微信", Decimal("30.00")),
    }
    # Payment columns must NOT end up in unknown
    for p in ("现金", "微信", "美团"):
        assert f"<raw>{p}" not in unknown


# ── EAV discount extraction ─────────────────────────────────

def test_is_discount_column_positive():
    """Heuristic recognizes 代<digit> / 券 / 优惠 patterns."""
    assert _is_discount_column("点评98代100") is True
    assert _is_discount_column("抖音138代201") is True
    assert _is_discount_column("[美团代金券]") is True
    assert _is_discount_column("[抖音套餐券]") is True
    assert _is_discount_column("鱼羊鲜50元优惠券") is True
    assert _is_discount_column("代金券优惠") is True


def test_is_discount_column_excludes_不计_suffix():
    """(不计) markers are 0-charge records, not real discounts."""
    assert _is_discount_column("招待(不计)") is False
    assert _is_discount_column("[美团代金券优惠](不计)") is False
    assert _is_discount_column("霸王餐(不计)") is False
    assert _is_discount_column("储值卡(不计)") is False


def test_is_discount_column_negative():
    """Column names without 代N/券/优惠 markers aren't discounts."""
    assert _is_discount_column("门店名称") is False
    assert _is_discount_column("现金") is False
    assert _is_discount_column("微信") is False
    assert _is_discount_column("营业日期") is False


def test_extract_discounts_picks_non_zero():
    row = {
        "点评98代100": "98.00",
        "抖音138代201": "0",
        "闪购95代100": "",
        "[美团代金券]": "50.5",
        "门店名称": "门店A",  # non-discount column ignored
    }
    out = _extract_discounts(row)
    got = {(name, amt) for name, amt, _qty in out}
    assert got == {
        ("点评98代100", Decimal("98.00")),
        ("[美团代金券]", Decimal("50.5")),
    }
    # quantity defaults to 1
    assert all(qty == 1 for _, _, qty in out)


def test_extract_discounts_excludes_不计_columns():
    row = {
        "招待(不计)": "50.00",
        "[美团代金券优惠](不计)": "30.00",
        "点评98代100": "98.00",  # real discount
    }
    out = _extract_discounts(row)
    assert len(out) == 1
    assert out[0][0] == "点评98代100"


def test_extract_discounts_doesnt_double_count_payment_cols():
    """点评买单 is a payment channel; it shouldn't be classified as discount
    even though the name doesn't match the pattern. Payments are filtered
    out before the discount heuristic runs."""
    row = {
        "点评买单": "100.00",      # payment, filtered by _PAYMENT_COLUMNS
        "点评98代100": "98.00",     # actual discount
    }
    out = _extract_discounts(row)
    names = {name for name, _, _ in out}
    assert names == {"点评98代100"}


def test_build_canonical_row_attaches_discounts():
    row_data = {
        "门店名称": "S1",
        "账单号": "B1",
        "营业日期": "2026-04-21",
        "点评98代100": "98.00",
        "鱼羊鲜50元优惠券": "50.00",
        "招待(不计)": "0",         # excluded even if present
    }
    unknown: list = []
    row = _build_canonical_row(row_data, {}, "F001", "excel", 100, unknown)
    assert row is not None
    disc_names = {name for name, _, _ in row.discounts}
    assert disc_names == {"点评98代100", "鱼羊鲜50元优惠券"}
    # Discount columns don't pollute unknown list
    for d in ("点评98代100", "鱼羊鲜50元优惠券"):
        assert f"<raw>{d}" not in unknown


def test_build_canonical_row_tracks_unknown_canonicals():
    """Canonical names not in _ALIAS_TO_ATTR are reported so user knows
    what's being dropped on the floor."""
    row_data = {"a": "x", "b": "y", "c": "z"}
    field_mappings = {
        "a": "store_name", "b": "source_bill_no",
        "c": "some_unmapped_canonical",
    }
    unknown: list = []
    # Missing date — returns None — but unknown tracking still runs.
    _build_canonical_row(row_data, field_mappings, "F", "excel", 100, unknown)
    assert "some_unmapped_canonical" in unknown


# ── Integration: backfill against real DB ──────────────────

@pytest_asyncio.fixture
async def pool():
    import asyncpg
    from smartbi.config import get_settings
    from smartbi.tenant_ctx import set_pg_connection_tenant
    settings = get_settings()
    if not settings.postgres_url:
        pytest.skip("No Postgres configured")
    p = await asyncpg.create_pool(
        settings.postgres_url, min_size=1, max_size=3,
        setup=set_pg_connection_tenant,
    )
    try:
        yield p
    finally:
        await p.close()


@pytest_asyncio.fixture
async def clean_and_seed(pool):
    """Wipe + seed smart_bi_pg_excel_uploads + smart_bi_dynamic_data.

    WARNING: smart_bi_dynamic_data may or may not have RLS enabled on
    this DB. We clean by upload_id (synthetic 99999) to avoid touching
    real data.
    """
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            # Clean Silver/Gold state for our tenant.
            for t in ("agg_daily", "agg_product", "agg_channel"):
                await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", _TENANT)
            await conn.execute("DELETE FROM fact_pos_transaction WHERE factory_id=$1", _TENANT)
            for t in ("dim_staff", "dim_product", "dim_payment_channel",
                      "dim_discount", "dim_store"):
                await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", _TENANT)

            # Wipe + seed legacy tables for our synthetic upload.
            await conn.execute("DELETE FROM smart_bi_dynamic_data WHERE upload_id=$1", _UPLOAD_ID)
            await conn.execute("DELETE FROM smart_bi_pg_excel_uploads WHERE id=$1", _UPLOAD_ID)

            # Seed the upload row with field_mappings.
            field_mappings = {
                "门店名称": "store_name",
                "订单号": "source_bill_no",
                "日期": "date",
                "实收金额": "net_amount",
                "人数": "customer_count",
                "菜品明细": "combo_string",
            }
            await conn.execute(
                """
                INSERT INTO smart_bi_pg_excel_uploads
                    (id, factory_id, file_name, upload_status, field_mappings)
                VALUES ($1, $2, 'backfill_test.xlsx', 'COMPLETED', $3)
                """,
                _UPLOAD_ID, _TENANT, json.dumps(field_mappings),
            )

            # Seed 3 rows.
            rows = [
                (1, {
                    "门店名称": "S1", "订单号": "BF-1", "日期": "2026-04-21",
                    "实收金额": "20.00", "人数": "2",
                    "菜品明细": "#米饭#_1份*3+#可乐#_1份*8",
                }),
                (2, {
                    "门店名称": "S1", "订单号": "BF-2", "日期": "2026-04-21",
                    "实收金额": "3.00", "人数": "1",
                    "菜品明细": "#米饭#_1份*3",
                }),
                (3, {
                    "门店名称": "S2", "订单号": "BF-3", "日期": "2026-04-22",
                    "实收金额": "16.00", "人数": "2",
                    "菜品明细": "#可乐#_2份*8",
                }),
            ]
            for row_idx, row_data in rows:
                await conn.execute(
                    """
                    INSERT INTO smart_bi_dynamic_data
                        (factory_id, upload_id, sheet_name, row_index, row_data)
                    VALUES ($1, $2, 'Sheet1', $3, $4::jsonb)
                    """,
                    _TENANT, _UPLOAD_ID, row_idx, json.dumps(row_data),
                )
    finally:
        reset_factory_id(token)

    yield

    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            for t in ("agg_daily", "agg_product", "agg_channel"):
                await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", _TENANT)
            await conn.execute("DELETE FROM fact_pos_transaction WHERE factory_id=$1", _TENANT)
            for t in ("dim_staff", "dim_product", "dim_payment_channel",
                      "dim_discount", "dim_store"):
                await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", _TENANT)
            await conn.execute("DELETE FROM smart_bi_dynamic_data WHERE upload_id=$1", _UPLOAD_ID)
            await conn.execute("DELETE FROM smart_bi_pg_excel_uploads WHERE id=$1", _UPLOAD_ID)
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_backfill_populates_silver_and_gold(pool, clean_and_seed):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        stats = await backfill_upload(
            pool, upload_id=_UPLOAD_ID, factory_id=_TENANT,
        )
        assert stats.rows_read == 3
        assert stats.rows_queued == 3
        assert stats.rows_skipped_missing_required == 0
        assert stats.pipeline is not None
        assert stats.pipeline.normalize.transactions_written == 3
        # 2 米饭 items + 1 可乐 item from first combo + 2nd 米饭 + 1 可乐 from third
        # Actually: bill1 has 2 items, bill2 has 1, bill3 has 1 = 4 total.
        assert stats.pipeline.normalize.items_written == 4

        async with pool.acquire() as conn:
            n_txn = await conn.fetchval(
                "SELECT COUNT(*) FROM fact_pos_transaction WHERE factory_id=$1 AND upload_id=$2",
                _TENANT, _UPLOAD_ID,
            )
            n_daily = await conn.fetchval(
                "SELECT COUNT(*) FROM agg_daily WHERE factory_id=$1", _TENANT
            )
        assert n_txn == 3
        # 2 stores × 2 dates but distinct combos: S1 on 4-21 has 2 bills
        # aggregated into 1 agg_daily row, S2 on 4-22 has 1 bill into 1 row.
        assert n_daily == 2
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_backfill_rerun_is_idempotent(pool, clean_and_seed):
    """Re-running the same backfill must be safe — Silver's ON CONFLICT DO
    NOTHING on the bill UNIQUE key makes every row a no-op the second time."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        first = await backfill_upload(pool, upload_id=_UPLOAD_ID, factory_id=_TENANT)
        second = await backfill_upload(pool, upload_id=_UPLOAD_ID, factory_id=_TENANT)
        assert first.pipeline.normalize.transactions_written == 3
        assert second.pipeline.normalize.transactions_written == 0
        assert second.pipeline.normalize.duplicates_skipped == 3

        async with pool.acquire() as conn:
            n_txn = await conn.fetchval(
                "SELECT COUNT(*) FROM fact_pos_transaction WHERE factory_id=$1 AND upload_id=$2",
                _TENANT, _UPLOAD_ID,
            )
        assert n_txn == 3
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_backfill_limit_caps_rows(pool, clean_and_seed):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        stats = await backfill_upload(
            pool, upload_id=_UPLOAD_ID, factory_id=_TENANT, limit=2,
        )
        assert stats.rows_read == 2
        assert stats.pipeline.normalize.transactions_written == 2
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_backfill_unknown_upload_id_raises(pool):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        with pytest.raises(ValueError, match="upload 123456789 not found"):
            await backfill_upload(pool, upload_id=123456789, factory_id=_TENANT)
    finally:
        reset_factory_id(token)
