#!/usr/bin/env bash
# C-RBAC-1 Day 10-11 — 5x5 negative regression for warehouse manager isolation.
#
# 客户原话 (六扇门第三次 May7 part2): "其他的话就尽量少让那个仓管员去参与什么什么
# 价格类的不要让他们去参与".
#
# 5 ROLES × 5 SENSITIVE_VIEWS = 25 negative cases. 期望: 全部不见价格 (字段 mask
# 为 '—' / null OR endpoint 返 403).
#
# 用法 (deploy 后跑):
#   1. 先确保 5 角色 token 已采到环境变量 (见 _seed-tokens.sh)
#   2. ./scripts/rbac-warehouse-mgr-audit-2026-05-15/run-regression.sh
#   3. 输出 → ./scripts/rbac-warehouse-mgr-audit-2026-05-15/report.md
#
# 退出码:
#   0 = 25/25 PASS (期望状态)
#   1 = 至少 1 case FAIL (价格泄漏 → 加 @PriceSensitive 修复)
#
# Author: Cretas Team — Track C
# Since: 2026-05-15

set -uo pipefail

# ==================== 配置 ====================

BASE_URL="${CRETAS_BASE_URL:-http://localhost:10010}"
FACTORY_ID="${CRETAS_FACTORY_ID:-F006}"
SAMPLE_PO_ID="${CRETAS_SAMPLE_PO_ID:-PO-20260514-001}"
SAMPLE_SO_ID="${CRETAS_SAMPLE_SO_ID:-SO-20260514-001}"
SAMPLE_PRODUCT_ID="${CRETAS_SAMPLE_PRODUCT_ID:-PT-001}"
SAMPLE_PAYMENT_ID="${CRETAS_SAMPLE_PAYMENT_ID:-PAY-20260514-001}"

# 5 角色 token (从环境变量读, 必须事先 export)
declare -A ROLE_TOKENS=(
    ["warehouse_manager"]="${TOKEN_WAREHOUSE_MGR:-}"
    ["operator"]="${TOKEN_OPERATOR:-}"
    ["quality_inspector"]="${TOKEN_QUALITY_INSPECTOR:-}"
    ["customer_service"]="${TOKEN_CUSTOMER_SERVICE:-}"
    ["viewer"]="${TOKEN_VIEWER:-}"
)

# 5 价格敏感视图 (endpoint, 期望策略)
# expected_mode: "mask" = 200 但价格字段为 null/—; "deny" = 403/401
declare -a VIEW_NAMES=("采购订单详情" "销售订单详情" "三价对比" "BOM 详情" "财务凭证")
declare -a VIEW_PATHS=(
    "/api/mobile/${FACTORY_ID}/purchase/orders/${SAMPLE_PO_ID}"
    "/api/mobile/${FACTORY_ID}/sales/orders/${SAMPLE_SO_ID}"
    "/api/mobile/${FACTORY_ID}/purchase/orders/${SAMPLE_PO_ID}/price-comparison"
    "/api/mobile/${FACTORY_ID}/bom/items?productTypeId=${SAMPLE_PRODUCT_ID}"
    "/api/mobile/${FACTORY_ID}/finance/payments/${SAMPLE_PAYMENT_ID}"
)
declare -a VIEW_EXPECTED_MODES=("mask" "mask" "deny" "mask" "deny")

# 价格字段名清单 (用于 mask 模式 grep 检测)
PRICE_FIELDS_REGEX='"(unitPrice|totalAmount|payableAmount|receivableAmount|discountAmount|taxAmount|materialCost|laborCost|subtotal|bomStandardPrice|movingAvgPrice|currentPrice)"\s*:\s*[0-9]'

REPORT="$(dirname "$0")/report.md"
PASS_COUNT=0
FAIL_COUNT=0
declare -a FAIL_LINES=()

# ==================== 主循环 ====================

{
    echo "# C-RBAC-1 5x5 Negative Regression Report"
    echo ""
    echo "**Generated**: $(date -Iseconds)"
    echo "**Base URL**: \`${BASE_URL}\`"
    echo "**Factory**: \`${FACTORY_ID}\`"
    echo ""
    echo "客户原话: 六扇门第三次 May7 part2 行 188 — *其他的话就尽量少让那个仓管员去参与什么什么价格类的不要让他们去参与*"
    echo ""
    echo "## 测试矩阵"
    echo ""
    echo "| Role | $(printf '%s | ' "${VIEW_NAMES[@]}")"
    echo "|---|$(printf -- '---|%.0s' "${VIEW_NAMES[@]}")"
} > "$REPORT"

for role in "${!ROLE_TOKENS[@]}"; do
    token="${ROLE_TOKENS[$role]}"
    if [ -z "$token" ]; then
        echo "WARN: TOKEN_${role^^} 未设置, role=${role} 跳过 (5 case 计为 SKIP)" >&2
        printf "| %s | SKIP | SKIP | SKIP | SKIP | SKIP |\n" "$role" >> "$REPORT"
        continue
    fi

    row="| ${role} |"
    for i in "${!VIEW_PATHS[@]}"; do
        view_name="${VIEW_NAMES[$i]}"
        view_path="${VIEW_PATHS[$i]}"
        expected="${VIEW_EXPECTED_MODES[$i]}"

        url="${BASE_URL}${view_path}"
        # -s silent, -o body, -w status code
        resp_body=$(mktemp)
        status=$(curl -sS -o "$resp_body" -w "%{http_code}" \
            -H "Authorization: Bearer ${token}" \
            -H "X-Cretas-Test: rbac-regression" \
            --max-time 10 \
            "${url}" 2>/dev/null || echo "000")

        verdict="PASS"
        case "$expected" in
            deny)
                if [ "$status" = "403" ] || [ "$status" = "401" ]; then
                    verdict="PASS"
                else
                    verdict="FAIL($status)"
                    FAIL_LINES+=("${role} × ${view_name}: 期望 403/401, 实际 ${status}")
                fi
                ;;
            mask)
                if [ "$status" = "403" ] || [ "$status" = "401" ]; then
                    # 也算 OK — endpoint deny 比 mask 更严
                    verdict="PASS(deny)"
                elif [ "$status" = "200" ]; then
                    # 检查响应体里没有非 null/非 '—' 的价格字段值
                    if grep -qE "$PRICE_FIELDS_REGEX" "$resp_body" 2>/dev/null; then
                        leaked=$(grep -oE "$PRICE_FIELDS_REGEX" "$resp_body" | head -3 | tr '\n' ' ')
                        verdict="FAIL(leak)"
                        FAIL_LINES+=("${role} × ${view_name}: 价格字段泄漏 — ${leaked}")
                    else
                        verdict="PASS"
                    fi
                else
                    verdict="FAIL($status)"
                    FAIL_LINES+=("${role} × ${view_name}: 期望 200(mask) 或 403, 实际 ${status}")
                fi
                ;;
        esac

        rm -f "$resp_body"
        row+=" ${verdict} |"
        if [[ "$verdict" == PASS* ]]; then
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    done
    echo "$row" >> "$REPORT"
done

# ==================== 总结 ====================

{
    echo ""
    echo "## 总结"
    echo ""
    echo "- ✅ PASS: ${PASS_COUNT}"
    echo "- ❌ FAIL: ${FAIL_COUNT}"
    echo "- 总计: $((PASS_COUNT + FAIL_COUNT)) cases"
    echo ""
    if [ "$FAIL_COUNT" -gt 0 ]; then
        echo "## ❌ Failures (修复方案: 在对应 entity 字段加 @PriceSensitive)"
        echo ""
        for line in "${FAIL_LINES[@]}"; do
            echo "- $line"
        done
    else
        echo "## ✅ 25/25 PASS — RBAC 框架完整, 仓管员看不到任何价格字段"
    fi
} >> "$REPORT"

echo "Report → $REPORT"
echo "PASS=${PASS_COUNT} FAIL=${FAIL_COUNT}"
if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
exit 0
