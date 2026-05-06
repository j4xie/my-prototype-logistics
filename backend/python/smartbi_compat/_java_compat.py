"""Java semantic mirror helpers shared across smartbi_compat endpoints.

Each helper here makes Python emit byte-shape-equivalent output to Java
under specific Java semantic quirks discovered during T6.1 dryrun (Phase 2A
parity port). Helpers are pure functions with no module dependencies — keep
them this way so any endpoint can import without circular import risk.

Helpers
-------
- ``_java_hashmap_bucket(key, capacity=16)``
    Mirror Java ``HashMap`` bucket index for a String key. Mirrors the
    ``String.hashCode()`` polynomial + ``HashMap`` spread/mask. Used to
    predict ``entrySet()`` iteration order for value-tied entries.

- ``_sort_entries_java_iter_then_value_desc(items, capacity=16)``
    Mirror Java ``entrySet().stream().sorted(comparingByValue().reversed())``
    on a HashMap built by ``Collectors.groupingBy``. Encodes the
    ``computeIfAbsent`` PREPEND-within-bucket semantic (PR-N-1 finding,
    2026-05-06).

- ``_format_decimal_half_up(d, places=1)``
    Mirror Java ``String.format("%.Nf", d)`` HALF_UP rounding. Python
    f-string ``:.Nf`` uses banker's rounding (round half to even); Java
    uses HALF_UP. Rule 12 candidate (PR-N-1 closer fixed procurement
    supplier concentration 46.55 → "46.6" mirror, 2026-05-06).

History
-------
- 2026-05-06: PR-N-1 (chat 1, commit 85cae2d22) introduced both helpers
  inline in analysis_procurement.py.
- 2026-05-06: organizer commit 6d74d69cd reused them from analysis_inventory.py
  via cross-module import (code smell — internal _ prefix imported across
  module boundary).
- 2026-05-06: this module extracts both helpers to a single shared location
  per task #22, enabling future smartbi_compat endpoints to reuse without
  cross-module import.
- 2026-05-07: ``_format_decimal_half_up`` added to defensively cover 14
  Rule 12 latent sites across analysis_inventory / analysis_drilldown /
  analysis_sales that emit ``f"{float(d):.Nf}"`` (banker's). F001 prod
  data didn't trigger; other factory data with .x5 boundary values would.

Reference: ``.claude/rules/python-java-port.md`` (Rule 8 / Rule 11 / Rule 12
family — Jackson + collection + display formatting quirks).
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP


def _java_hashmap_bucket(s: str, capacity: int = 16) -> int:
    """Mirror Java HashMap bucket index for a String key.

    Used to predict Java HashMap.entrySet() iteration order, which is
    bucket-asc + linked-list-order-within-bucket. Needed for tie-breaking
    in stable sorts where Python dict insertion order otherwise diverges
    from Java HashMap iter (e.g. Collectors.groupingBy outputs).

    Algorithm: Java String.hashCode() (h = 31*h + c, all chars), then
    HashMap spread (h ^ (h >>> 16)) & (cap-1). Default cap=16, resizes
    to 32 when size > 12 (loadFactor 0.75) — so for small dicts (<13
    keys) cap=16 is correct.
    """
    h = 0
    for c in str(s):
        h = (31 * h + ord(c)) & 0xFFFFFFFF
    spread = h ^ (h >> 16)
    return spread & (capacity - 1)


def _sort_entries_java_iter_then_value_desc(items, capacity: int = 16) -> list:
    """Mirror Java `entrySet().stream().sorted(comparingByValue().reversed())`
    on a HashMap built by `Collectors.groupingBy(classifier, downstream)`.

    PR-N-1 finding (2026-05-06): Collectors.groupingBy uses
    `HashMap.computeIfAbsent`, whose internal node-creation path PREPENDS the
    new node to the bucket head (`tab[i] = newNode(hash, key, v, first)` in
    OpenJDK HashMap.computeIfAbsent — `first` becomes the new node's `next`).
    This is OPPOSITE of `HashMap.put`, which appends to the linked-list tail.

    Therefore within-bucket iter order is the REVERSE of insertion order:
    last-inserted entry is at the bucket head and emitted first by the
    `entrySet()` iterator.

    Caller responsibility: dict insertion order must match Java's stream
    encounter order (typically PostgreSQL heap order ≈ chronological order).
    `_query_material_batches_in_range` orders by `created_at` to give Python
    the same encounter sequence Hibernate's no-ORDER-BY query produces.

    Implementation:
      1. Sort by (bucket_asc, position_desc) → bucket-asc + reverse-within-bucket
      2. Stable sort by value desc preserves the Java HashMap iter order for
         value-tied entries.
    """
    items_list = list(items)
    indexed = list(enumerate(items_list))
    by_java_iter = [
        kv for _, kv in sorted(
            indexed,
            key=lambda x: (_java_hashmap_bucket(x[1][0], capacity), -x[0]),
        )
    ]
    return sorted(by_java_iter, key=lambda kv: kv[1], reverse=True)


def _format_decimal_half_up(d, places: int = 1) -> str:
    """Mirror Java ``String.format("%.Nf", d)`` HALF_UP rounding.

    Python f-string ``f"{float(d):.Nf}"`` uses banker's rounding (round half
    to even, IEEE 754 default). Java ``String.format("%.Nf", d)`` uses
    HALF_UP. So 46.55 with 1 decimal becomes:

      Python f-string: "46.5"  (banker's — .5 rounds to even digit 6 → 4 → ...wait)
      Java %.1f:       "46.6"

    Actually Python f-string for 46.55 specifically depends on the float
    representation: 46.55 stored as 46.549999999... gives "46.5" via f-string.
    The Java HALF_UP semantic gives "46.6". This divergence broke procurement
    supplier concentration on F001 prod (PR-N-1 closer fix, 2026-05-06).

    Use this helper at any display formatting site that mirrors Java
    ``String.format("%.Nf", ...)``. Examples:

        _format_decimal_half_up(Decimal("46.55"), 1)  → "46.6"
        _format_decimal_half_up(Decimal("0.5"), 0)    → "1"
        _format_decimal_half_up(Decimal("46.555"), 2) → "46.56"
        _format_decimal_half_up(Decimal("46.000"), 1) → "46.0"  (preserves trailing zero,
                                                                  matches Java %.1f)

    Caller responsibility: pass a ``Decimal`` (preferred) or any value
    convertible via ``Decimal(str(value))``. If you have a float, prefer
    converting via ``Decimal(str(float_value))`` upstream to avoid float
    precision artifacts entering the helper.

    See Rule 12 in ``.claude/rules/python-java-port.md`` (graduate after
    2nd sister chat hit, currently candidate).
    """
    if not isinstance(d, Decimal):
        d = Decimal(str(d))
    if places == 0:
        quant = Decimal("1")
    else:
        quant = Decimal("0." + "0" * (places - 1) + "1")
    return str(d.quantize(quant, rounding=ROUND_HALF_UP))
