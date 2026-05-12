"""R3 drilldown deep — Rule 12 HALF_UP lock-down LIVE verification.

Runs against the deployed analysis_drilldown.py on the test server.
Imports _build_kpi_card directly so we exercise the exact production
function the HTTP endpoint uses, but isolated from DB/auth concerns.

Boundary canaries:
  Decimal("100.005") — banker's rounds DOWN to 100.00 (last digit 0 is even),
                       HALF_UP rounds UP to 100.01.
  Decimal("100.025") — banker's rounds DOWN to 100.02 (last digit 2 is even),
                       HALF_UP rounds UP to 100.03.
  Decimal("46.0")    — Java BigDecimal scale-2 preserves "46.00" string.

If any canary diverges, analysis_drilldown.py:315 lost rounding=ROUND_HALF_UP
or analysis_drilldown.py:319 _format_decimal_half_up reverted to f-string.
"""
import sys
sys.path.insert(0, "/www/wwwroot/cretas/code/backend/python")

from decimal import Decimal, ROUND_HALF_UP
from smartbi_compat.api.analysis_drilldown import _build_kpi_card

print("=== R3 Rule 12 LIVE verification against deployed analysis_drilldown.py ===")
print()

r1 = _build_kpi_card("K", "T", Decimal("100.005"), "元", "green")
r2 = _build_kpi_card("K", "T", Decimal("100.025"), "元", "green")
r3 = _build_kpi_card("K", "T", Decimal("46.55"), "元", "green")
r4 = _build_kpi_card("K", "T", Decimal("46"), "元", "green")

v1, raw1 = r1["value"], r1["rawValue"]
v2, raw2 = r2["value"], r2["rawValue"]
v3, raw3 = r3["value"], r3["rawValue"]
v4, raw4 = r4["value"], r4["rawValue"]

print("Boundary canary results (deployed code):")
print("  Decimal('100.005') -> value={!r:>8}  rawValue={!r:>6}  (HALF_UP expected '100.01' / 100.01)".format(v1, raw1))
print("  Decimal('100.025') -> value={!r:>8}  rawValue={!r:>6}  (HALF_UP expected '100.03' / 100.03)".format(v2, raw2))
print("  Decimal('46.55')   -> value={!r:>8}  rawValue={!r:>6}  (HALF_UP expected '46.55'  / 46.55)".format(v3, raw3))
print("  Decimal('46')      -> value={!r:>8}  rawValue={!r:>6}  (scale-2 expected '46.00'  / 46.0)".format(v4, raw4))
print()

errors = []
if not (v1 == "100.01" and raw1 == 100.01):
    errors.append("100.005 -> {} / {} (expected '100.01' / 100.01) — banker's regression at line 315/319".format(v1, raw1))
if not (v2 == "100.03" and raw2 == 100.03):
    errors.append("100.025 -> {} / {} (expected '100.03' / 100.03) — banker's regression at line 315/319".format(v2, raw2))
if not (v4 == "46.00" and raw4 == 46.0):
    errors.append("46 -> {} / {} (expected '46.00' / 46.0) — scale-2 trailing zero not preserved".format(v4, raw4))

# Raw Decimal-layer divergence proof
val = Decimal("100.005")
bankers = val.quantize(Decimal("0.01"))
half_up = val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
print("Raw Decimal-layer divergence proof:")
print("  Decimal('100.005').quantize(Decimal('0.01'))                            = {}  (banker's default)".format(bankers))
print("  Decimal('100.005').quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)    = {}  (HALF_UP explicit)".format(half_up))
print("  divergence: bankers != half_up -> {}".format(bankers != half_up))
print()

if errors:
    for e in errors:
        print("  FAIL: " + e)
    print()
    print("RESULT: Rule 12 REGRESSION on deployed code")
    sys.exit(1)
else:
    print("RESULT: Rule 12 HALF_UP LOCKED on deployed analysis_drilldown.py")
    print("  - line 315: value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)")
    print("  - line 319: _format_decimal_half_up(value, 2)")
    print("  Boundary canaries 100.005 and 100.025 both round per HALF_UP, not banker's.")
    sys.exit(0)
