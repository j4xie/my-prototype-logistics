#!/bin/bash
for num in 11 17 23 40; do
  echo "--- #$num ---"
  curl -s -X POST http://localhost:10010/api/public/ai-demo/execute -H "Content-Type: application/json" -d @/tmp/t${num}.json | python3 -c '
import sys,json
d=json.load(sys.stdin)
r=d.get("data",{})
print("intent=%s, status=%s, method=%s" % (r.get("intentCode"), r.get("status"), r.get("matchMethod")))
'
done
