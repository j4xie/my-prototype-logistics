#!/bin/bash
# Server-side script to patch CacheConfig.class in the fat JAR
set -e

JAR=/www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar
WORK=/tmp/jar-patch
SRC=/tmp/CacheConfig.java

echo "=== Step 1: Extract dependency JARs ==="
rm -rf $WORK && mkdir -p $WORK && cd $WORK

# Extract all libs needed for compilation
jar xf $JAR BOOT-INF/lib/ 2>/dev/null || true
echo "Extracted $(ls BOOT-INF/lib/*.jar 2>/dev/null | wc -l) lib JARs"

echo "=== Step 2: Build classpath ==="
CP=""
for j in BOOT-INF/lib/*.jar; do
  CP="$CP:$j"
done
echo "Classpath: ${#CP} chars"

echo "=== Step 3: Compile CacheConfig.java ==="
mkdir -p out
javac -cp "$CP" -d out $SRC 2>&1
echo "Compiled: $(find out -name '*.class' | head -5)"

echo "=== Step 4: Backup current JAR ==="
cp $JAR "${JAR}.bak.$(date +%Y%m%d_%H%M%S)"
echo "Backup created"

echo "=== Step 5: Patch JAR with new class ==="
# Use jar uf with proper BOOT-INF/classes/ prefix
mkdir -p patch/BOOT-INF/classes/com/cretas/aims/config/
cp out/com/cretas/aims/config/CacheConfig.class patch/BOOT-INF/classes/com/cretas/aims/config/
cd patch
jar uf $JAR BOOT-INF/classes/com/cretas/aims/config/CacheConfig.class
echo "JAR patched"

echo "=== Step 6: Verify ==="
jar tf $JAR | grep CacheConfig
echo "=== Step 7: Restart backend ==="
systemctl restart cretas-backend
echo "Restarting... wait 40s for health check"
sleep 40

STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:10010/api/mobile/health)
echo "Health: $STATUS"

if [ "$STATUS" = "200" ]; then
  echo "=== Step 8: Test product-types API ==="
  curl -s -X POST http://localhost:10010/api/mobile/auth/unified-login \
    -H "Content-Type: application/json" \
    -d '{"username":"factory_admin1","password":"123456"}' > /tmp/login.json
  TOKEN=$(python3 -c "import json; print(json.load(open('/tmp/login.json')).get('data',{}).get('accessToken',''))")
  curl -s "http://localhost:10010/api/mobile/F001/product-types/active" \
    -H "Authorization: Bearer $TOKEN" | python3 -c "
import json, sys
d=json.load(sys.stdin)
print('success:', d.get('success'))
data = d.get('data', [])
print('product count:', len(data))
for p in data[:5]:
    print(' -', p.get('code','?'), p.get('name','?'))
"
fi

echo "=== DONE ==="
