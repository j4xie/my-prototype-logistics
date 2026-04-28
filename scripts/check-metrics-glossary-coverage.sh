#!/usr/bin/env bash
# check-metrics-glossary-coverage.sh
# 检查餐饮指数字典对 chat cards 的覆盖度,防止新增 card 时字典忘记同步
# Usage: bash scripts/check-metrics-glossary-coverage.sh
# Exit 0 = pass / Exit 1 = fail (CI 友好)

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
GLOSSARY="$ROOT/docs/plans/restaurant-metrics-glossary.html"
CARDS_DIR="$ROOT/web-admin/src/views/smart-bi/components/chat/cards"

if [ ! -f "$GLOSSARY" ]; then
  echo "FAIL: glossary file not found at $GLOSSARY"
  exit 1
fi

if [ ! -d "$CARDS_DIR" ]; then
  echo "FAIL: cards dir not found at $CARDS_DIR"
  exit 1
fi

# 排除 RawJsonCard (debug 用,无业务指数)
CARD_COUNT=$(find "$CARDS_DIR" -maxdepth 1 -name "*.vue" -not -name "RawJsonCard.vue" | wc -l | tr -d ' ')

# h3 数量 (每个 metric 应该一个 h3,加上序言/使用说明大约 90+)
H3_COUNT=$(grep -c "<h3>" "$GLOSSARY" || echo 0)

# 期望: 每个 chat card 对应 1+ 字典条目 (有些 card 含多个指数)
# 阈值: cards × 4 = 84 (cards 21 时), 加硬底 75 防 cards 数下降时阈值过宽
HARD_FLOOR=75
EXPECTED_MIN=$((CARD_COUNT * 4))
if [ "$EXPECTED_MIN" -lt "$HARD_FLOOR" ]; then
  EXPECTED_MIN=$HARD_FLOOR
fi

echo "================================================="
echo "餐饮指数字典覆盖度检查"
echo "================================================="
echo "Glossary: $GLOSSARY"
echo "Cards dir: $CARDS_DIR"
echo ""
echo "Chat cards (排除 RawJsonCard): $CARD_COUNT"
echo "Glossary h3 chunks:           $H3_COUNT"
echo "期望最小 (cards x 3):           $EXPECTED_MIN"
echo ""

if [ "$H3_COUNT" -lt "$EXPECTED_MIN" ]; then
  echo "FAIL: glossary h3 count ($H3_COUNT) below expected min ($EXPECTED_MIN)"
  echo ""
  echo "可能原因:"
  echo "  - 新增了 chat card 但字典没同步"
  echo "  - 字典文件被意外缩水"
  echo "  - card 路径有变更"
  echo ""
  echo "对策: 跑 'ls -1 \"$CARDS_DIR\"' 看新 card,检查字典是否覆盖。"
  exit 1
fi

# 跑 ingester syntax check (确保 ingester 仍能 parse 字典)
INGESTER="$ROOT/backend/python/food_kb/services/manual_ingester.py"
CHAT="$ROOT/backend/python/food_kb/api/manual_chat.py"
if [ -f "$INGESTER" ] && [ -f "$CHAT" ]; then
  python -m py_compile "$INGESTER" 2>/dev/null && echo "ingester.py syntax OK" || { echo "FAIL: ingester.py syntax error"; exit 1; }
  python -m py_compile "$CHAT" 2>/dev/null && echo "manual_chat.py syntax OK" || { echo "FAIL: manual_chat.py syntax error"; exit 1; }
fi

# 检查字典是否注册到 ingester MANUAL_SOURCES
if grep -q "restaurant-metrics-glossary.html" "$INGESTER" 2>/dev/null; then
  echo "ingester 已注册 restaurant-metrics-glossary.html"
else
  echo "FAIL: restaurant-metrics-glossary.html 未注册到 manual_ingester.py MANUAL_SOURCES"
  exit 1
fi

echo ""
echo "PASS - 字典覆盖度检查通过"
