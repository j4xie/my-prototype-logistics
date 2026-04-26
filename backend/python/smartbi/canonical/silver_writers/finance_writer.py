"""FinanceWriter — write fact_finance_voucher with normalized dim_finance_subject.

Current simplifications:
- Subject normalization is whitespace-collapse + lowercase only (no stemming /
  category inference). New subjects insert with category='unknown'; admin can
  re-categorize later.
- Finance aliases not in ALIAS_TO_ATTR yet — we read from common Chinese / English
  column names directly (voucher_no / 凭证号 / 凭证日期 / 科目 / 借方 / 贷方).
- source_row_hash = sha256(voucher_no|voucher_date|subject_name|amount); enables
  idempotent re-run via ON CONFLICT DO NOTHING.
"""
from __future__ import annotations

import hashlib
import json
import re
import time
from datetime import date, datetime
from typing import TYPE_CHECKING, Any, Dict, Optional

from .base import BaseWriter, WriteSummary

if TYPE_CHECKING:
    import asyncpg


_DEFAULT_CATEGORY = "unknown"
_WHITESPACE_RE = re.compile(r"\s+")


_VOUCHER_NO_KEYS = ("voucher_no", "凭证号", "凭证编号", "voucher_number")
_VOUCHER_DATE_KEYS = ("voucher_date", "凭证日期", "记账日期", "date")
_SUBJECT_KEYS = ("subject", "科目", "科目名称", "subject_name", "account", "账户")
_DEBIT_KEYS = ("debit_amount", "借方金额", "借方", "debit")
_CREDIT_KEYS = ("credit_amount", "贷方金额", "贷方", "credit")
_DESCRIPTION_KEYS = ("description", "摘要", "备注", "memo")


def _pick(row: Dict[str, Any], keys: tuple[str, ...]) -> Optional[Any]:
    for k in keys:
        if k in row and row[k] not in (None, ""):
            return row[k]
    return None


def _to_float(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _to_date(value: Any) -> Optional[date]:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
    return None


def _normalize_subject(name: str) -> str:
    return _WHITESPACE_RE.sub("", str(name)).lower()


def _hash_row(
    voucher_no: Optional[str],
    voucher_date: Optional[date],
    subject_name: str,
    amount: float,
) -> str:
    payload = "|".join(
        [
            str(voucher_no or ""),
            voucher_date.isoformat() if voucher_date else "",
            subject_name,
            f"{amount:.4f}",
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class FinanceWriter(BaseWriter):
    """Write voucher rows with normalized subject FK; idempotent via source_row_hash."""

    async def write(self, upload_id: int, factory_id: str) -> WriteSummary:
        t0 = time.time()
        rows_written = 0
        rows_skipped = 0
        new_entity_count = 0
        subject_cache: Dict[str, int] = {}

        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT row_data FROM smart_bi_dynamic_data WHERE upload_id = $1",
                upload_id,
            )

            for row_pg in rows:
                row = self._unwrap_row(row_pg["row_data"])
                subject_name_raw = _pick(row, _SUBJECT_KEYS)
                if not subject_name_raw:
                    rows_skipped += 1
                    continue

                subject_name = str(subject_name_raw).strip()
                normalized = _normalize_subject(subject_name)
                if normalized in subject_cache:
                    subject_id = subject_cache[normalized]
                else:
                    subject_id, was_new = await self._resolve_subject(
                        conn, factory_id, subject_name, normalized
                    )
                    subject_cache[normalized] = subject_id
                    if was_new:
                        new_entity_count += 1

                voucher_no = _pick(row, _VOUCHER_NO_KEYS)
                voucher_date = _to_date(_pick(row, _VOUCHER_DATE_KEYS))
                debit = _to_float(_pick(row, _DEBIT_KEYS))
                credit = _to_float(_pick(row, _CREDIT_KEYS))
                description = _pick(row, _DESCRIPTION_KEYS)
                amount = debit + credit
                row_hash = _hash_row(
                    str(voucher_no) if voucher_no is not None else None,
                    voucher_date,
                    subject_name,
                    amount,
                )

                result = await conn.execute(
                    """
                    INSERT INTO fact_finance_voucher
                      (factory_id, upload_id, voucher_no, voucher_date, subject_id,
                       debit_amount, credit_amount, description, source_row_hash)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (factory_id, upload_id, source_row_hash) DO NOTHING
                    """,
                    factory_id,
                    upload_id,
                    str(voucher_no) if voucher_no is not None else None,
                    voucher_date,
                    subject_id,
                    debit,
                    credit,
                    str(description) if description is not None else None,
                    row_hash,
                )
                if isinstance(result, str) and result.endswith(" 0"):
                    rows_skipped += 1
                else:
                    rows_written += 1

        return WriteSummary(
            rows_written=rows_written,
            rows_skipped=rows_skipped,
            new_entity_count=new_entity_count,
            admin_queue_count=0,
            tentative_count=0,
            elapsed_ms=int((time.time() - t0) * 1000),
        )

    async def _resolve_subject(
        self,
        conn: "asyncpg.Connection",
        factory_id: str,
        name: str,
        normalized: str,
    ) -> tuple[int, bool]:
        existing = await conn.fetchrow(
            """
            SELECT subject_id FROM dim_finance_subject
            WHERE factory_id = $1 AND normalized_name = $2
            """,
            factory_id,
            normalized,
        )
        if existing is not None:
            return int(existing["subject_id"]), False

        inserted = await conn.fetchrow(
            """
            INSERT INTO dim_finance_subject
              (factory_id, name, normalized_name, category)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (factory_id, normalized_name) DO UPDATE
              SET updated_at = NOW()
            RETURNING subject_id
            """,
            factory_id,
            name,
            normalized,
            _DEFAULT_CATEGORY,
        )
        return int(inserted["subject_id"]), True

    @staticmethod
    def _unwrap_row(raw: Any) -> Dict[str, Any]:
        if isinstance(raw, dict):
            return raw
        if isinstance(raw, str):
            try:
                parsed = json.loads(raw)
                return parsed if isinstance(parsed, dict) else {}
            except (ValueError, TypeError):
                return {}
        return {}
