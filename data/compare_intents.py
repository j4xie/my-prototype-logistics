import sys
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

with open('data/e2e_intents.txt', 'r') as f:
    e2e = set(line.strip() for line in f if line.strip() and not line.startswith('Total'))
with open('data/db_intents.txt', 'r') as f:
    db = set(line.strip() for line in f if line.strip())

missing = e2e - db
print(f'E2E intents: {len(e2e)}, DB intents: {len(db)}, Missing: {len(missing)}')
print()
print('Missing intents (in E2E but not in DB):')
for i in sorted(missing):
    print(f'  {i}')
