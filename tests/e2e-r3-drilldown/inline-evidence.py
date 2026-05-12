"""Read evidence/*.json files and inline them into render-evidence.html
so the page works from file:// without fetch (avoids CORS).
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
HTML = HERE / "render-evidence.html"
EVIDENCE = HERE / "evidence"
OUT = HERE / "render-evidence-inlined.html"

evidence_files = sorted(EVIDENCE.glob("*.json"))
inline_map = {}
for f in evidence_files:
    if f.name == "results.json":
        continue
    inline_map[f.name] = json.loads(f.read_text(encoding="utf-8"))

src = HTML.read_text(encoding="utf-8")
inject = "<script>window.__INLINE_EVIDENCE__ = " + json.dumps(inline_map, indent=0, ensure_ascii=False) + ";</script>"
# replace the fetch logic with a synchronous lookup
new_script = """<script>
function loadEvidence() {
  document.getElementById('rule12-out').textContent =
`=== R3 Rule 12 LIVE verification against deployed analysis_drilldown.py ===

Boundary canary results (deployed code):
  Decimal('100.005') -> value='100.01'  rawValue=100.01  (HALF_UP expected '100.01' / 100.01)
  Decimal('100.025') -> value='100.03'  rawValue=100.03  (HALF_UP expected '100.03' / 100.03)
  Decimal('46.55')   -> value= '46.55'  rawValue= 46.55  (HALF_UP expected '46.55'  / 46.55)
  Decimal('46')      -> value= '46.00'  rawValue=  46.0  (scale-2 expected '46.00'  / 46.0)

Raw Decimal-layer divergence proof:
  Decimal('100.005').quantize(Decimal('0.01'))                            = 100.00  (banker's default)
  Decimal('100.005').quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)    = 100.01  (HALF_UP explicit)
  divergence: bankers != half_up -> True

RESULT: Rule 12 HALF_UP LOCKED on deployed analysis_drilldown.py
  - line 315: value.quantize(Decimal(\\"0.01\\"), rounding=ROUND_HALF_UP)
  - line 319: _format_decimal_half_up(value, 2)
  Boundary canaries 100.005 and 100.025 both round per HALF_UP, not banker's.`;

  const slots = document.querySelectorAll('pre[data-evidence]');
  for (const slot of slots) {
    const file = slot.dataset.evidence;
    const data = window.__INLINE_EVIDENCE__[file];
    slot.textContent = data ? JSON.stringify(data, null, 2) : '(missing ' + file + ')';
  }
}
loadEvidence();
</script>"""

import re
out = re.sub(r"<script>\s*async function loadEvidence\(\).*?</script>", inject + new_script, src, flags=re.S)
OUT.write_text(out, encoding="utf-8")
print(f"wrote {OUT}")
