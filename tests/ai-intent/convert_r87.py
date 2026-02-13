#!/usr/bin/env python3
import sys, io, json, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Load report data
d = json.loads(open(sorted(glob.glob('tests/ai-intent/reports/v5_round87_*.json'))[-1], encoding='utf-8').read())
results = d['all_results']

# Read template
with open('tests/ai-intent/test_v5_round76.py', 'r', encoding='utf-8') as f:
    template = f.read()

# Build TEST_CASES tuples
tc_lines = []
current_cat = None
for r in results:
    cat = r['category']
    q = r['userInput']
    intents = r['acceptable_intents']
    # Convert None back
    intents_strs = []
    for intent in intents:
        if intent is None:
            intents_strs.append('None')
        else:
            intents_strs.append(f'"{intent}"')
    intents_str = '[' + ', '.join(intents_strs) + ']'

    if cat != current_cat:
        if current_cat is not None:
            tc_lines.append('')
        current_cat = cat
        count = sum(1 for x in results if x['category'] == cat)
        tc_lines.append(f'    # ===== {cat} ({count} cases) =====')
    tc_lines.append(f'    ("{q}", {intents_str}, "{cat}"),')

tc_block = '\n'.join(tc_lines)

# Find and replace TEST_CASES in template
tc_start = template.index('TEST_CASES = [')
bracket = 0
tc_end = tc_start
for i, c in enumerate(template[tc_start:], tc_start):
    if c == '[': bracket += 1
    elif c == ']': bracket -= 1
    if bracket == 0:
        tc_end = i + 1
        break

new_content = template[:tc_start] + 'TEST_CASES = [\n' + tc_block + '\n]' + template[tc_end:]

# Fix all round references
new_content = new_content.replace('Round 76', 'Round 87')
new_content = new_content.replace('round76', 'round87')
new_content = new_content.replace(
    'MOBILE & FIELD OPERATIONS queries for food manufacturing.\n       Covers clock_in, field_report, mobile_inspect, photo_evidence,\n       voice_input, offline_ops, location, quick_scan, and mobile_alert.',
    'CUSTOMER SERVICE & COMPLAINT queries for food manufacturing.\n       Covers complaint_receive, return_process, customer_feedback, after_sales,\n       recall_manage, customer_inquiry, service_level, claim_process, and crm_data.'
)
new_content = new_content.replace(
    'MOBILE & FIELD OPERATIONS queries',
    'CUSTOMER SERVICE & COMPLAINT queries'
)
new_content = new_content.replace(
    '(clock_in, field_report, mobile_inspect, photo_evidence,',
    '(complaint_receive, return_process, customer_feedback, after_sales,'
)
new_content = new_content.replace(
    'voice_input, offline_ops, location, quick_scan, mobile_alert)',
    'recall_manage, customer_inquiry, service_level, claim_process, crm_data)'
)
new_content = new_content.replace(
    'v5_round76_mobile_field_operations',
    'v5_round87_customer_service_complaint'
)

with open('tests/ai-intent/test_v5_round87.py', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f'Rebuilt R87 with {len(results)} test cases in standard format')
