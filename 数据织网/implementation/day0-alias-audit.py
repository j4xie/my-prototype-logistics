"""Day 0 ALIAS pre-flight audit (A spec §7 Phase 0) - v2 fix.

v1 错: 没算 PAYMENT_COLUMNS 和 DISCOUNT regex (这两类 EAV 字段).
v2: 完整覆盖检测 = ALIAS + PAYMENT + DISCOUNT.

输出: 每 factory 命中率 + 总体命中率 + Top 未匹配 original_name (按上传频次)

Hard gate: 总体命中率 ≥ 80% 才能进 Day 1, 否则必须先扩 ALIAS_TO_ATTR.
"""
import sys
import re
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend" / "python"))
from scripts.backfill_silver import _ALIAS_TO_ATTR, _PAYMENT_COLUMNS, _is_discount_column

ALIAS_KEYS = set(_ALIAS_TO_ATTR.keys())
PAYMENT_KEYS = set(_PAYMENT_COLUMNS)

def is_covered(name: str) -> tuple[bool, str]:
    """检测一个字段是否被现有 normalizer 覆盖. Returns (covered, category)."""
    if name in ALIAS_KEYS:
        return True, "alias"
    if name in PAYMENT_KEYS:
        return True, "payment_eav"
    if _is_discount_column(name):
        return True, "discount_eav"
    return False, "uncovered"

input_file = sys.argv[1] if len(sys.argv) > 1 else "/tmp/field_defs.txt"
data = []
with open(input_file, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        parts = line.split("|")
        if len(parts) != 3:
            continue
        factory_id, original_name, count = parts
        data.append((factory_id.strip(), original_name.strip(), int(count)))

per_factory_total = defaultdict(set)
per_factory_covered = defaultdict(lambda: defaultdict(set))
per_factory_total_uploads = defaultdict(int)
unmatched_freq = defaultdict(int)

for factory_id, name, count in data:
    per_factory_total[factory_id].add(name)
    per_factory_total_uploads[factory_id] += count
    covered, cat = is_covered(name)
    if covered:
        per_factory_covered[factory_id][cat].add(name)
    else:
        unmatched_freq[name] += count

all_factories = sorted(per_factory_total.keys())
overall_total_distinct = sum(len(per_factory_total[f]) for f in all_factories)
overall_covered_distinct = sum(
    sum(len(s) for s in per_factory_covered[f].values()) for f in all_factories
)

print("=" * 80)
print("ALIAS Pre-Flight Audit v2 (Day 0 of A spec §7 Phase 0)")
print("v2 修: 加入 PAYMENT_COLUMNS + DISCOUNT regex 这两类 EAV 字段")
print("=" * 80)
print(f"\n_ALIAS_TO_ATTR: {len(ALIAS_KEYS)} keys (canonical)")
print(f"_PAYMENT_COLUMNS: {len(PAYMENT_KEYS)} keys (支付方式 EAV)")
print(f"_is_discount_column regex: 含 代N|券|优惠 (优惠/折扣 EAV)")
print()

print(f"{'Factory':<20} {'Distinct':>10} {'Alias':>8} {'Payment':>8} {'Discount':>10} {'Hit %':>8}")
print("-" * 80)
for fid in all_factories:
    total = len(per_factory_total[fid])
    cov = per_factory_covered[fid]
    alias_hits = len(cov.get("alias", set()))
    pay_hits = len(cov.get("payment_eav", set()))
    disc_hits = len(cov.get("discount_eav", set()))
    total_covered = alias_hits + pay_hits + disc_hits
    pct = total_covered / total * 100 if total else 0
    print(f"{fid:<20} {total:>10} {alias_hits:>8} {pay_hits:>8} {disc_hits:>10} {pct:>7.1f}%")

overall_pct = overall_covered_distinct / overall_total_distinct * 100 if overall_total_distinct else 0
print("-" * 80)
print(f"{'OVERALL':<20} {overall_total_distinct:>10} {'':>8} {'':>8} {'':>10} {overall_pct:>7.1f}%")
print()

GATE = 80.0
if overall_pct >= GATE:
    print(f"PASS: Overall {overall_pct:.1f}% >= {GATE}% gate. Proceed to Day 1.")
else:
    print(f"FAIL: Overall {overall_pct:.1f}% < {GATE}% gate. Must extend ALIAS_TO_ATTR first.")

print(f"\nTop 50 uncovered original_name (sorted by upload_count):")
print(f"{'Rank':<6} {'Uploads':>10} {'Original name':<45} {'Length':>8}")
print("-" * 80)
for i, (name, freq) in enumerate(sorted(unmatched_freq.items(), key=lambda x: -x[1])[:50], 1):
    print(f"{i:<6} {freq:>10} {name[:43]:<45} {len(name):>8}")

# Categorize uncovered by pattern
print(f"\nUncovered name pattern analysis:")
patterns = {
    "财务报表 (本月实际/预算/本年/同比/环比)": r'(本月实际|预算数|本年|同比|环比|去年同期)',
    "月份列 (1月/2月.../12月)": r'^([1-9]|1[0-2])月$',
    "金额_N 系列 (财务表 column suffix)": r'^金额_\d+$',
    "毛利率_N 系列": r'^(毛利率|实际收入|实际成本|对应收入)(\(.*\))?(_\d+)?$',
    "套餐/sub-product 列": r'(套餐|子商品|含套餐|不含套餐)',
    "商品维度 (分类/编码/类型/规格)": r'^(商品|菜品)(分类|编码|类型|规格|名称|信息)$',
    "评论/评分 (review shape)": r'(评分|评论|星级|rating|review)',
    "盘点/库存 (inventory shape)": r'(盘点|库存|进货|出货|损耗)',
    "排班 (schedule shape)": r'(班次|排班|工时|出勤)',
    "门店扩展": r'^(店|店名|店铺|分店|店面|门面)$',
    "订单数量/件数": r'^(订单数|件数|笔数|订单总数|交易笔数)$',
    "其它": r'.*',
}

categorized = defaultdict(list)
for name, freq in unmatched_freq.items():
    for cat_name, pattern in patterns.items():
        if re.search(pattern, name):
            categorized[cat_name].append((name, freq))
            break

print(f"\n{'Category':<50} {'Names':>8} {'Total uploads':>15}")
print("-" * 80)
for cat, items in sorted(categorized.items(), key=lambda x: -sum(f for _, f in x[1])):
    total_uploads = sum(f for _, f in items)
    print(f"{cat[:48]:<50} {len(items):>8} {total_uploads:>15}")
