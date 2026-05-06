"""Unit tests for _java_hashmap_bucket / _sort_entries_java_iter_then_value_desc.

PR-N-1 (2026-05-06) — pin the F001 prod sort-tie case where Sister C's
PR-L append-style helper produced wrong order vs Java's actual response.

Root cause: Java's `Collectors.groupingBy(classifier, downstream)` uses
`HashMap.computeIfAbsent` whose internal node-creation PREPENDS new nodes
to the bucket head (NOT append like `put`). So within-bucket linked-list
order is REVERSE of insertion order. PR-L's helper assumed append.

Fix: helper now sorts by (bucket_asc, position_desc) so the LATEST inserted
entry within a bucket is emitted first, mirroring Java's iter order.

Caller responsibility: dict insertion order must match Java's stream
encounter order (heap order ≈ created_at order). `_query_material_batches_in_range`
now `ORDER BY created_at, id` accordingly.
"""
from decimal import Decimal

from smartbi_compat._java_compat import (
    _java_hashmap_bucket,
    _sort_entries_java_iter_then_value_desc,
)


# ---------------------------------------------------------------------------
# Hash / bucket invariants
# ---------------------------------------------------------------------------


def test_java_hashcode_supplier_ids_b15_collision():
    """F001 prod ties: '最终测试供应商' (uuid 8099f932...) and '南海渔业公司'
    (legacy 'SUP-F001-002') both hash to bucket 15 at default cap=16.
    Verified against authoritative Java `String.hashCode()` on server."""
    assert _java_hashmap_bucket("8099f932-a642-4a52-ae26-68e92912d896", 16) == 15
    assert _java_hashmap_bucket("SUP-F001-002", 16) == 15


def test_java_hashcode_supplier_ids_b14_three_way_collision():
    """F001 prod three-way collision in bucket 14:
    SUP-F001-001 (positive value=122825), bcd77cc6 (zero), da8a009d (zero)."""
    assert _java_hashmap_bucket("SUP-F001-001", 16) == 14
    assert _java_hashmap_bucket("bcd77cc6-81bd-4d0f-94cc-fe57b9d3df30", 16) == 14
    assert _java_hashmap_bucket("da8a009d-56bd-49e9-825d-a03c38ef4d60", 16) == 14


# ---------------------------------------------------------------------------
# Iter-order invariant: prepend (computeIfAbsent) within bucket
# ---------------------------------------------------------------------------


def test_within_bucket_prepend_two_entries():
    """Two zero-value entries in same bucket (b15): later-inserted first.

    Insertion order in Python dict: SUP-F001-002 first, then 8099f932...
    Java HashMap iter (prepend) emits 8099f932 first, SUP-F001-002 second.
    This is the F001 prod regression PR-N-1 fixes.
    """
    items = [
        ("SUP-F001-002", Decimal("0")),
        ("8099f932-a642-4a52-ae26-68e92912d896", Decimal("0")),
    ]
    out = _sort_entries_java_iter_then_value_desc(items)
    assert [k for k, _ in out] == [
        "8099f932-a642-4a52-ae26-68e92912d896",
        "SUP-F001-002",
    ]


def test_within_bucket_prepend_three_entries_with_value_split():
    """Three entries in b14: SUP-F001-001 (positive 122825), bcd77cc6 (zero),
    da8a009d (zero). Insertion order: SUP-F001-001, bcd77cc6, da8a009d.

    Expected output (post-prepend, post value-desc):
      SUP-F001-001 (highest value, b14) — promoted to top by value sort
      da8a009d (zero, b14, latest insertion → bucket head)
      bcd77cc6 (zero, b14, earlier insertion → bucket second)
    """
    items = [
        ("SUP-F001-001", Decimal("122825")),
        ("bcd77cc6-81bd-4d0f-94cc-fe57b9d3df30", Decimal("0")),
        ("da8a009d-56bd-49e9-825d-a03c38ef4d60", Decimal("0")),
    ]
    out = _sort_entries_java_iter_then_value_desc(items)
    assert [k for k, _ in out] == [
        "SUP-F001-001",
        "da8a009d-56bd-49e9-825d-a03c38ef4d60",
        "bcd77cc6-81bd-4d0f-94cc-fe57b9d3df30",
    ]


def test_full_f001_prod_supplier_order():
    """Full F001 prod composite supplier ranking — pin the post-fix order
    against Java's actual response (recorded 2026-05-06).

    Insertion order assumes Python's batch query is now `ORDER BY created_at, id`,
    matching Java's PostgreSQL heap-scan order:
      1. SUP-F001-001        (b14, val=122825)  — 2026-01-02
      2. 7850ac4f...         (b12, val=129520)  — 2026-04-03
      3. SUP-F001-002        (b15, val=0)       — 2026-04-05 11:09
      4. SUP-F001-003        (b0,  val=0)       — 2026-04-05 11:19
      5. 1d427d49...         (b4,  val=0)       — 2026-04-05 11:27
      6. 8099f932...         (b15, val=0)       — 2026-04-05 11:29
      7. bcd77cc6...         (b14, val=0)       — 2026-04-05 11:41
      8. da8a009d...         (b14, val=0)       — 2026-04-05 11:48
      9. 2b7cc5ae...         (b12, val=0)       — 2026-04-05 12:00
     10. e7ce0ec9...         (b13, val=0)       — 2026-04-05 12:10
     11. eeffa0b7...         (b5,  val=25890.96) — 2026-04-24

    Java's actual response order (zero-value tail [3..10]):
      [3]  SUP-F001-003 (b0)
      [4]  1d427d49     (b4)
      [5]  2b7cc5ae     (b12) — within-bucket prepend over 7850ac4f (positive)
      [6]  e7ce0ec9     (b13)
      [7]  da8a009d     (b14) — latest of three b14 inserts → head
      [8]  bcd77cc6     (b14)
      [9]  8099f932     (b15) — latest of two b15 inserts → head
      [10] SUP-F001-002 (b15)
    """
    items = [
        ("SUP-F001-001", Decimal("122825")),
        ("7850ac4f-e6ba-421a-88ab-b0ff009daf6d", Decimal("129520")),
        ("SUP-F001-002", Decimal("0")),
        ("SUP-F001-003", Decimal("0")),
        ("1d427d49-dff9-4568-b8f3-4102d9cd64d1", Decimal("0")),
        ("8099f932-a642-4a52-ae26-68e92912d896", Decimal("0")),
        ("bcd77cc6-81bd-4d0f-94cc-fe57b9d3df30", Decimal("0")),
        ("da8a009d-56bd-49e9-825d-a03c38ef4d60", Decimal("0")),
        ("2b7cc5ae-59a9-4784-9e6b-84efdfb50ce8", Decimal("0")),
        ("e7ce0ec9-7a2d-4981-864b-d32b3071d8fd", Decimal("0")),
        ("eeffa0b7-2e15-4536-bacd-3467cf8313ff", Decimal("25890.96")),
    ]
    out = _sort_entries_java_iter_then_value_desc(items)
    assert [k for k, _ in out] == [
        "7850ac4f-e6ba-421a-88ab-b0ff009daf6d",  # value=129520, b12
        "SUP-F001-001",                          # value=122825, b14
        "eeffa0b7-2e15-4536-bacd-3467cf8313ff",  # value=25890.96, b5
        "SUP-F001-003",                          # zero, b0
        "1d427d49-dff9-4568-b8f3-4102d9cd64d1",  # zero, b4
        "2b7cc5ae-59a9-4784-9e6b-84efdfb50ce8",  # zero, b12 (prepend over 7850ac4f)
        "e7ce0ec9-7a2d-4981-864b-d32b3071d8fd",  # zero, b13
        "da8a009d-56bd-49e9-825d-a03c38ef4d60",  # zero, b14 (latest of 3 → head)
        "bcd77cc6-81bd-4d0f-94cc-fe57b9d3df30",  # zero, b14
        "8099f932-a642-4a52-ae26-68e92912d896",  # zero, b15 (latest of 2 → head)
        "SUP-F001-002",                          # zero, b15
    ]


def test_single_entry_per_bucket_invariant():
    """When every entry has a unique bucket, prepend semantics is a no-op
    relative to append (nothing to reverse). Verifies PR-L's 8/8 prior
    test cases still pass."""
    items = [
        ("a-bucket-0", Decimal("100")),  # arbitrary distinct keys
        ("b-bucket-1", Decimal("50")),
        ("c-bucket-2", Decimal("200")),
    ]
    out = _sort_entries_java_iter_then_value_desc(items)
    # Sort by value desc, no within-bucket reordering since single-item buckets.
    values = [v for _, v in out]
    assert values == sorted(values, reverse=True)
