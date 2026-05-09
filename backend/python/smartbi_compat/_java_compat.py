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

- ``_java_string_hashcode(s)``
    Mirror ``java.lang.String.hashCode`` — signed int32 polynomial hash
    (``h = 31*h + c`` with int32 overflow wrap). Used as the seed source
    for production / quality mock data generators (T6.6 Phase B).

- ``_JavaRandom(seed)``
    Mirror ``java.util.Random`` 48-bit LCG. Bit-exact reproduction of
    ``next_int(bound)`` (power-of-2 fast path + rejection-sampling) and
    ``next_double()`` (53-bit mantissa). Required by T6.6 production /
    quality mock data parity — Python ``random.Random`` is Mersenne
    Twister, not LCG, so the sequences would never line up.

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
- 2026-05-09: ``_java_string_hashcode`` + ``_JavaRandom`` added as Day-0
  hard-gate foundation for T6.6 Phase B production / quality endpoint
  ports (PR #199 §3 / PR #203 §8.9). Co-located with ``_java_hashmap_bucket``
  — same Java semantic mirror family. Bit-exact reference values come from
  ``tests/fixtures/JavaRandomReferenceDump.java`` against Azul JDK 21.0.10.

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


# ---------------------------------------------------------------------------
# Java Random + String.hashCode bit-exact mirror (T6.6 Phase B foundation)
# ---------------------------------------------------------------------------

_INT32_MASK = 0xFFFFFFFF
_INT32_SIGN = 0x80000000          # 2^31
_LCG_MULTIPLIER = 0x5DEECE66D     # java.util.Random multiplier
_LCG_ADDEND = 0xB                 # java.util.Random addend
_LCG_MASK = (1 << 48) - 1         # 48-bit LCG state mask


def _java_string_hashcode(s: str) -> int:
    """Mirror ``java.lang.String.hashCode`` — signed int32 polynomial hash.

    Algorithm (per JDK source ``String.hashCode``)::

        int h = 0;
        for (int i = 0; i < length; i++)
            h = 31 * h + value[i];
        return h;

    The polynomial accumulates with int32 wrap-around. Returns a Python
    ``int`` in the closed range ``[-2**31, 2**31 - 1]`` so callers can pass
    it straight to ``_JavaRandom(seed)`` and reproduce ``Random(s.hashCode())``
    semantics exactly.

    Iterates over Python ``str`` characters by ``ord(c)``. For BMP code
    points this matches Java's per-``char`` loop. For supplementary planes
    Java uses two surrogate ``char`` values per code point — Python ``str``
    iterates by code point. T6.6 mock data factory IDs are ASCII only, so
    this distinction does not matter in practice; if you need surrogate-pair
    parity for non-BMP input, encode via ``s.encode('utf-16-be')`` and
    iterate as 16-bit units instead.

    >>> _java_string_hashcode("F001")
    2133035
    >>> _java_string_hashcode("AaAa") == _java_string_hashcode("BBBB")
    True
    """
    h = 0
    for c in s:
        h = (31 * h + ord(c)) & _INT32_MASK
    if h & _INT32_SIGN:
        h -= 1 << 32
    return h


class _JavaRandom:
    """Mirror ``java.util.Random`` — 48-bit linear congruential generator.

    Reproduces JDK 21 ``Random.nextInt(bound)`` and ``Random.nextDouble``
    bit-for-bit. Construct with the same seed Java uses — typically
    ``_java_string_hashcode(factory_id)`` — and consume in the same order
    as the Java side to get identical mock data.

    Algorithm (per ``java.util.Random`` source)::

        // constructor
        this.seed = (seed ^ 0x5DEECE66D) & ((1 << 48) - 1)

        // protected int next(int bits)
        seed = (seed * 0x5DEECE66D + 0xB) & ((1 << 48) - 1)
        return (int) (seed >>> (48 - bits))

        // public int nextInt(int bound)
        if (bound is power of 2)
            return (int) ((bound * (long) next(31)) >> 31)
        do {
            bits = next(31);
            val  = bits % bound;
        } while (bits - val + (bound - 1) < 0);   // overflow-detect rejection
        return val;

        // public double nextDouble()
        return ((next(26) << 27) + next(27)) / (double)(1L << 53)

    Java's rejection check ``bits - val + (bound - 1) < 0`` relies on
    32-bit signed overflow. Python ints are arbitrary precision, so we
    detect the same condition by testing ``>= 2**31`` instead.
    """

    __slots__ = ("seed",)

    def __init__(self, seed: int) -> None:
        # Java accepts a long seed, then scrambles it via XOR with the
        # multiplier and masks to 48 bits. Negative seeds (e.g. negative
        # hashcodes) work because Python's bitwise XOR matches Java long
        # XOR after we mask to 48 bits.
        self.seed = (seed ^ _LCG_MULTIPLIER) & _LCG_MASK

    def _next(self, bits: int) -> int:
        """Advance the LCG and return the top ``bits`` of the 48-bit state."""
        self.seed = (self.seed * _LCG_MULTIPLIER + _LCG_ADDEND) & _LCG_MASK
        return self.seed >> (48 - bits)

    def next_int(self, bound: int) -> int:
        """Mirror ``Random.nextInt(int bound)`` — uniform in ``[0, bound)``."""
        if bound <= 0:
            raise ValueError("bound must be positive")
        # Power-of-2 fast path — Java uses (long) cast to widen, so the
        # multiplication does not overflow. Python ints never overflow,
        # so the formula is direct.
        if (bound & -bound) == bound:
            return (bound * self._next(31)) >> 31
        # Rejection-sampling path. The Java overflow check `< 0` becomes
        # `>= 2**31` here: when the unsigned sum would wrap into the
        # signed-negative range, Java retries to avoid modulo bias.
        while True:
            bits = self._next(31)
            val = bits % bound
            if bits - val + bound - 1 < _INT32_SIGN:
                return val

    def next_double(self) -> float:
        """Mirror ``Random.nextDouble`` — uniform in ``[0.0, 1.0)``.

        Returns a 53-bit-precision float. The numerator
        ``(next(26) << 27) + next(27)`` is at most ``2**53 - 1``, which
        converts to ``float`` losslessly; division by ``2**53`` (also exact
        as a ``float``) then yields the same IEEE-754 ``double`` Java's
        ``(double) longValue / (double) (1L << 53)`` produces.
        """
        return ((self._next(26) << 27) + self._next(27)) / float(1 << 53)
