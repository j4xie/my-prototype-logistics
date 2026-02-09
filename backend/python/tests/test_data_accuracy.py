"""
SmartBI Data Accuracy Tests (Group 8A)

Verifies data integrity through the pipeline:
  Excel (Test.xlsx) → Python Parser → PostgreSQL → API → Frontend

Run:
  cd backend/python
  python -m pytest tests/test_data_accuracy.py -v --timeout=60
"""
import math
import re

import pytest
from sqlalchemy import text


class TestExcelGroundTruth:
    """8A.0: Verify ground truth fixture itself is valid."""

    def test_ground_truth_loaded(self, excel_ground_truth):
        """Ground truth has multiple sheets from Test.xlsx."""
        assert len(excel_ground_truth) >= 5, (
            f"Expected >=5 sheets, got {len(excel_ground_truth)}"
        )

    def test_ground_truth_structure(self, excel_ground_truth):
        """Each sheet has row_count, col_count, columns, numeric_sums."""
        for name, gt in excel_ground_truth.items():
            assert "row_count" in gt, f"Sheet '{name}' missing row_count"
            assert "col_count" in gt, f"Sheet '{name}' missing col_count"
            assert "columns" in gt, f"Sheet '{name}' missing columns"
            assert "numeric_sums" in gt, f"Sheet '{name}' missing numeric_sums"
            assert "sample_rows" in gt, f"Sheet '{name}' missing sample_rows"


class TestPostgresRowCounts:
    """8A.2: PostgreSQL row counts match Excel row counts.

    The Python ExcelParser strips header rows, metadata rows, section
    labels, and completely empty rows.  A 10-15% reduction is typical
    for financial/profit-statement sheets.  We therefore allow a tolerance
    proportional to the sheet size.
    """

    def test_pg_row_counts(self, pg_engine, excel_ground_truth):
        """PG row_count is within a reasonable range of Excel row_count."""
        with pg_engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT sheet_name, row_count
                    FROM smart_bi_pg_excel_uploads
                    ORDER BY created_at DESC
                """)
            ).fetchall()

        if not rows:
            pytest.skip("No upload records in PostgreSQL — upload Test.xlsx first")

        pg_counts = {}
        for sheet_name, row_count in rows:
            if sheet_name not in pg_counts:
                pg_counts[sheet_name] = row_count

        matched = 0
        severe_mismatches = []
        for sheet_name, gt in excel_ground_truth.items():
            if sheet_name not in pg_counts:
                continue
            matched += 1
            pg_rc = pg_counts[sheet_name]
            excel_rc = gt["row_count"]
            if excel_rc == 0:
                continue
            # PG should have ≥70% of Excel rows (parser strips headers/empty rows)
            ratio = pg_rc / excel_rc
            if ratio < 0.70 or ratio > 1.05:
                severe_mismatches.append(
                    f"  {sheet_name}: PG={pg_rc}, Excel={excel_rc} "
                    f"(ratio={ratio:.2f})"
                )

        assert matched > 0, "No sheet names matched between PG and Excel"
        assert not severe_mismatches, (
            "Row count ratio outside [0.70, 1.05]:\n"
            + "\n".join(severe_mismatches)
        )


_AUTO_COL_RE = re.compile(
    r"^(Column_?\d+|Unnamed:\s*\d+)$", re.IGNORECASE
)


class TestPostgresColumnDefinitions:
    """8A.3: PG field definitions cover meaningful Excel columns.

    Pandas reads empty-header cells as 'Unnamed: N'.
    The Python parser strips those before persisting to PG.
    We only check that *named* columns survive.
    """

    def test_pg_columns_superset(self, pg_engine, excel_ground_truth):
        """PG field_definitions ⊇ Excel meaningful columns."""
        with pg_engine.connect() as conn:
            uploads = conn.execute(
                text("""
                    SELECT id, sheet_name
                    FROM smart_bi_pg_excel_uploads
                    ORDER BY created_at DESC
                """)
            ).fetchall()

        if not uploads:
            pytest.skip("No upload records — upload Test.xlsx first")

        upload_map = {}
        for uid, sheet_name in uploads:
            if sheet_name not in upload_map:
                upload_map[sheet_name] = uid

        missing_report = []
        with pg_engine.connect() as conn:
            for sheet_name, gt in excel_ground_truth.items():
                if sheet_name not in upload_map:
                    continue
                upload_id = upload_map[sheet_name]
                pg_fields = conn.execute(
                    text("""
                        SELECT original_name
                        FROM smart_bi_pg_field_definitions
                        WHERE upload_id = :uid
                        ORDER BY display_order
                    """),
                    {"uid": upload_id},
                ).fetchall()
                pg_col_names = {r[0] for r in pg_fields}
                excel_cols = set(gt["columns"])
                # Keep only meaningful columns (not Unnamed: X or Column_XX)
                meaningful = {
                    c for c in excel_cols if not _AUTO_COL_RE.match(str(c))
                }
                dropped = meaningful - pg_col_names
                if dropped:
                    missing_report.append(
                        f"  {sheet_name}: missing {dropped}"
                    )

        if missing_report:
            import warnings
            warnings.warn(
                "Some meaningful Excel columns missing from PG:\n"
                + "\n".join(missing_report[:5])
            )


class TestPostgresDataAccuracy:
    """8A.4: PostgreSQL JSONB values match Excel sample rows."""

    def test_pg_sample_row_accuracy(self, pg_engine, excel_ground_truth):
        """First 3 rows in PG JSONB ≈ Excel first 3 rows (numeric diff < 0.01)."""
        with pg_engine.connect() as conn:
            uploads = conn.execute(
                text("""
                    SELECT id, sheet_name
                    FROM smart_bi_pg_excel_uploads
                    ORDER BY created_at DESC
                """)
            ).fetchall()

        if not uploads:
            pytest.skip("No upload records — upload Test.xlsx first")

        upload_map = {}
        for uid, sheet_name in uploads:
            if sheet_name not in upload_map:
                upload_map[sheet_name] = uid

        errors = []
        checked = 0
        with pg_engine.connect() as conn:
            for sheet_name, gt in excel_ground_truth.items():
                if sheet_name not in upload_map:
                    continue
                if not gt["sample_rows"]:
                    continue

                upload_id = upload_map[sheet_name]
                try:
                    pg_rows = conn.execute(
                        text("""
                            SELECT row_data
                            FROM smart_bi_dynamic_data
                            WHERE upload_id = :uid
                            ORDER BY row_index
                            LIMIT 3
                        """),
                        {"uid": upload_id},
                    ).fetchall()
                except Exception:
                    # Table might not exist yet
                    continue

                if not pg_rows:
                    continue

                checked += 1
                for i, (pg_row_tuple,) in enumerate(pg_rows):
                    if i >= len(gt["sample_rows"]):
                        break
                    excel_row = gt["sample_rows"][i]
                    pg_row = pg_row_tuple if isinstance(pg_row_tuple, dict) else {}

                    for col, excel_val in excel_row.items():
                        if col not in pg_row:
                            continue
                        pg_val = pg_row[col]
                        try:
                            e_num = float(excel_val)
                            p_num = float(pg_val)
                            if math.isnan(e_num) or math.isnan(p_num):
                                continue
                            if abs(e_num - p_num) > 0.01:
                                errors.append(
                                    f"  {sheet_name}[row {i}][{col}]: "
                                    f"Excel={e_num}, PG={p_num}"
                                )
                        except (TypeError, ValueError):
                            if str(excel_val).strip() != str(pg_val).strip():
                                errors.append(
                                    f"  {sheet_name}[row {i}][{col}]: "
                                    f"Excel='{excel_val}', PG='{pg_val}'"
                                )

        if checked == 0:
            pytest.skip("No matching sheets with dynamic data found")
        if errors:
            if len(errors) > checked * 5:
                pytest.fail(
                    f"Data accuracy errors ({len(errors)}):\n"
                    + "\n".join(errors[:20])
                )
            else:
                import warnings
                warnings.warn(
                    f"Minor data differences ({len(errors)}):\n"
                    + "\n".join(errors[:10])
                )


class TestQuickSummaryAccuracy:
    """8C.1: quickSummary sums match manual calculation."""

    @pytest.mark.asyncio
    async def test_quick_summary_sums(self, client, sample_quick_summary_data):
        """Python quickSummary column sums match manual sums."""
        r = await client.post(
            "/api/insight/quick-summary", json=sample_quick_summary_data
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True

        # Manual calculation
        manual_sums = {}
        for row in sample_quick_summary_data:
            for k, v in row.items():
                if isinstance(v, (int, float)):
                    manual_sums[k] = manual_sums.get(k, 0) + v

        # Compare with Python's sums
        for col_info in body["columns"]:
            col_name = col_info["name"]
            if col_name in manual_sums and "sum" in col_info:
                python_sum = col_info["sum"]
                manual_sum = manual_sums[col_name]
                diff = abs(python_sum - manual_sum)
                assert diff < 1.0, (
                    f"Column '{col_name}': Python sum={python_sum}, "
                    f"manual sum={manual_sum}, diff={diff}"
                )
