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

Reference: ``.claude/rules/python-java-port.md`` (Rule 8 / Rule 11 family —
Jackson + collection serialization quirks).
"""
from __future__ import annotations


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
