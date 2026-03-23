import sys, re
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

with open('tests/intent-routing-e2e-150.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Format: ('text', 'TYPE', 'INTENT_CODE|INTENT_CODE2', 'desc')
intents = set()
for m in re.finditer(r"'(?:CONSULT|QUERY|WRITE)',\s*'([A-Z_|]+)'", content):
    for code in m.group(1).split('|'):
        code = code.strip()
        if code and code not in ('N/A', 'OUT_OF_DOMAIN'):
            intents.add(code)

print(f'Total unique expected intents in E2E: {len(intents)}')
for i in sorted(intents):
    print(i)
