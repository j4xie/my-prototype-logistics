import json, sys
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
from collections import Counter

with open('data/e2e_failures.jsonl', 'r', encoding='utf-8') as f:
    failures = [json.loads(line) for line in f]

print('Total failures: %d' % len(failures))
print('Target 97%%: need to fix %d more' % (len(failures) - (1232 - int(1232*0.97))))
print()

method_counts = Counter(f.get('match_method','?') for f in failures)
print('=== By match method ===')
for method, count in method_counts.most_common():
    print('  %s: %d' % (method, count))

print()
actual_counts = Counter(f['actual_label'] for f in failures)
print('=== Top misroute TARGETS ===')
for intent, count in actual_counts.most_common(15):
    print('  %s: %d' % (intent, count))

print()
print('=== FIXABLE: PHRASE_MATCH wrong (direct fix) ===')
pm = [f for f in failures if f['match_method'] == 'PHRASE_MATCH']
for f in pm:
    exp = f['expected_label'].split('|')[0]
    print('  [%s] "%s" -> %s (expected: %s)' % (f['category'], f['text'], f['actual_label'], exp))
print('Count: %d' % len(pm))

print()
print('=== SEMANTIC -> SYSTEM_SETTINGS (phrase-fixable) ===')
ss = [f for f in failures if f['match_method'] == 'SEMANTIC' and f['actual_label'] == 'SYSTEM_SETTINGS']
for f in ss:
    exp = f['expected_label'].split('|')[0]
    print('  [%s] "%s" -> expected: %s' % (f['category'], f['text'], exp))
print('Count: %d' % len(ss))

print()
print('=== SEMANTIC -> other wrong (harder) ===')
so = [f for f in failures if f['match_method'] == 'SEMANTIC' and f['actual_label'] not in ('SYSTEM_SETTINGS',)]
for f in so:
    exp = f['expected_label'].split('|')[0]
    print('  [%s] "%s" -> %s (expected: %s)' % (f['category'], f['text'], f['actual_label'], exp))
print('Count: %d' % len(so))

print()
print('=== CLASSIFIER wrong ===')
cl = [f for f in failures if f['match_method'] == 'CLASSIFIER']
for f in cl:
    exp = f['expected_label'].split('|')[0]
    print('  [%s] "%s" -> %s (expected: %s)' % (f['category'], f['text'], f['actual_label'], exp))
print('Count: %d' % len(cl))

print()
print('=== ? / LLM / ERROR ===')
ot = [f for f in failures if f['match_method'] not in ('SEMANTIC','CLASSIFIER','PHRASE_MATCH')]
for f in ot:
    exp = f['expected_label'].split('|')[0]
    print('  [%s] "%s" -> %s (expected: %s) method=%s' % (f['category'], f['text'], f['actual_label'], exp, f['match_method']))
print('Count: %d' % len(ot))
