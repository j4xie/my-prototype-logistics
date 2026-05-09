"""FinanceWriter — write fact_finance_voucher with normalized dim_finance_subject.

Current simplifications:
- Subject normalization is whitespace-collapse + lowercase only (no stemming /
  category inference). New subjects insert with category='unknown'; admin can
  re-categorize later.
- Finance aliases not in ALIAS_TO_ATTR yet — we read from common Chinese / English
  column names directly (voucher_no / 凭证号 / 凭证日期 / 科目 / 借方 / 贷方).
- source_row_hash = sha256(voucher_no|voucher_date|subject_name|amount); enables
  idempotent re-run via ON CONFLICT DO NOTHING.

Day 10-12 (Sub-Project C): if SMARTBI_ENABLE_PROVENANCE env flag is ON, each
non-skipped voucher row also records cell-level provenance (debit_amount /
credit_amount) anchored to the finance_subject. valid_from = voucher_date.
Default OFF.
"""
from __future__ import annotations

import hashlib
import logging
import re
import time
from datetime import date
from typing import TYPE_CHECKING, Dict, List, Optional, Tuple

from smartbi.canonical.provenance._writer_hook import (
    is_provenance_enabled,
    write_provenance_for_fields,
)

from ._helpers import pick, to_date, to_float, unwrap_row
from .base import BaseWriter, WriteSummary

if TYPE_CHECKING:
    import asyncpg


logger = logging.getLogger(__name__)

_DEFAULT_CATEGORY = "unknown"
_WHITESPACE_RE = re.compile(r"\s+")


_VOUCHER_NO_KEYS = ("voucher_no", "凭证号", "凭证编号", "voucher_number")
_VOUCHER_DATE_KEYS = ("voucher_date", "凭证日期", "记账日期", "date")
_SUBJECT_KEYS = ("subject", "科目", "科目名称", "subject_name", "account", "账户")
_DEBIT_KEYS = ("debit_amount", "借方金额", "借方", "debit")
_CREDIT_KEYS = ("credit_amount", "贷方金额", "贷方", "credit")
_DESCRIPTION_KEYS = ("description", "摘要", "备注", "memo")


def _normalize_subject(name: str) -> str:
    """Subject-specific normalize — kept local; finance category UX may diverge."""
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
        # Day 10-12: gather (subject_id, debit, credit, voucher_date) for any
        # row that successfully INSERTed, so we can dual-write provenance after
        # the main loop. Built only when env flag is ON to avoid memory cost
        # when feature disabled.
        provenance_enabled = is_provenance_enabled()
        provenance_records: List[Tuple[int, float, float, Optional[date]]] = []

        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT row_data FROM smart_bi_dynamic_data WHERE upload_id = $1",
                upload_id,
            )

            for row_pg in rows:
                row = unwrap_row(row_pg["row_data"])
                subject_name_raw = pick(row, _SUBJECT_KEYS)
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

                voucher_no = pick(row, _VOUCHER_NO_KEYS)
                voucher_date = to_date(pick(row, _VOUCHER_DATE_KEYS))
                debit = to_float(pick(row, _DEBIT_KEYS), default=0.0)
                credit = to_float(pick(row, _CREDIT_KEYS), default=0.0)
                description = pick(row, _DESCRIPTION_KEYS)
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
                    if provenance_enabled:
                        provenance_records.append(
                            (subject_id, debit, credit, voucher_date)
                        )

            # Day 10-12 (Phase B C1 fix): opt-in cell-level provenance dual-
            # write. Per-voucher cell-level lineage isn't analytically useful —
            # debits/credits are typically read at (subject, day) granularity,
            # and per-voucher lineage would explode field_provenance rows
            # (one upload with 10k vouchers same subject/day → 20k rows, all
            # but the first as 'field_conflict' admin_queue noise).
            #
            # Strategy: roll up to one provenance write per (subject_id,
            # voucher_date) with SUM(debit_amount) + SUM(credit_amount). The
            # Silver layer (fact_finance_voucher) retains per-voucher detail
            # — only the provenance dual-write is rolled up. Vouchers with
            # NULL voucher_date are skipped from provenance (we can't anchor
            # without a valid_from); the Silver row still landed normally.
            if provenance_enabled and provenance_records:
                from collections import defaultdict

                # IMP-2 (2026-04-27): observability for silent NULL-anchor drops.
                # Rollup loop below skips rows where subject_id or voucher_date is
                # NULL — without this WARNING log, those skipped rows leave NO trace
                # (no admin_queue, no metric). One log line per upload-batch keeps
                # noise low while making the silent path visible to ops.
                null_anchor_skipped = sum(
                    1
                    for (subject_id, _debit, _credit, voucher_date)
                    in provenance_records
                    if subject_id is None or voucher_date is None
                )
                if null_anchor_skipped > 0:
                    logger.warning(
                        "FinanceWriter provenance: %d/%d rows skipped "
                        "(NULL subject_id or voucher_date), "
                        "upload_id=%s factory=%s",
                        null_anchor_skipped,
                        len(provenance_records),
                        upload_id,
                        factory_id,
                    )

                rollup: Dict[
                    Tuple[int, date], Dict[str, float]
                ] = defaultdict(
                    lambda: {"debit_amount": 0.0, "credit_amount": 0.0}
                )
                for subject_id, debit, credit, voucher_date in provenance_records:
                    if subject_id is None or voucher_date is None:
                        continue
                    key = (subject_id, voucher_date)
                    rollup[key]["debit_amount"] += float(debit or 0)
                    rollup[key]["credit_amount"] += float(credit or 0)

                # Anchor: entity_type='finance_subject'. valid_from=voucher_date
                # so subsequent reads pick the correct day's value.
                # valid_to=None → open-ended (a voucher remains authoritative
                # until a higher-priority source overrides it).
                # MIN-3 (2026-04-27): aggregate hook return counters per
                # rollup-batch and log a single summary WARNING when any
                # error_swallowed occurred. Per-error WARNING already lives in
                # _writer_hook.py; this is the batch-level rollup so ops can
                # alert on "FinanceWriter provenance: error_swallowed=" lines
                # without scraping per-error noise.
                total_swallowed = 0
                total_rows = 0
                async with conn.transaction():
                    for (subject_id, voucher_date), totals in rollup.items():
                        counts = await write_provenance_for_fields(
                            conn,
                            factory_id=factory_id,
                            entity_type="finance_subject",
                            entity_id=subject_id,
                            fields=totals,
                            source_type="bill_flow",
                            mapper_method="rule",
                            confidence=0.90,
                            source_upload_id=upload_id,
                            valid_from=voucher_date,
                        )
                        total_swallowed += counts.get("error_swallowed", 0)
                        total_rows += 1
                if total_swallowed > 0:
                    logger.warning(
                        "FinanceWriter provenance: error_swallowed=%d across "
                        "%d rollup rows, upload_id=%s factory=%s",
                        total_swallowed,
                        total_rows,
                        upload_id,
                        factory_id,
                    )

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
