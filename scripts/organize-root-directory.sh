#!/bin/bash
# 根目录文件整理脚本 (2026-04-22)
# 用途: 组织杂乱的临时脚本、截图、数据文件
# 安全: 仅做本地操作，不涉及 git 删除

set -e

echo "======================================"
echo "根目录文件整理工具"
echo "======================================"
echo ""

ROOT=$(pwd)

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 第一步: 创建目录结构
echo -e "${YELLOW}[第1步] 创建目录结构${NC}"
mkdir -p archive/yolo-experiments/scripts/{apr12,apr13,apr14_15,apr16_17,apr18_20}
mkdir -p scripts/yolo-training/{active,phase-a,phase-b,phase-c,utilities}
mkdir -p config/aiquery
mkdir -p test-results/archived
mkdir -p docs/screenshots/{e2e,server,demo,misc}
mkdir -p releases
mkdir -p data/samples
echo -e "${GREEN}✓ 目录创建完成${NC}"
echo ""

# 第二步: 整理截图
echo -e "${YELLOW}[第2步] 整理截图${NC}"
[ -n "$(ls *.png 2>/dev/null | grep '^e2e-')" ] && mv e2e-*.png docs/screenshots/e2e/ 2>/dev/null && echo "✓ e2e 截图" || true
[ -n "$(ls *.png 2>/dev/null | grep '^ssc-')" ] && mv ssc-*.png docs/screenshots/server/ 2>/dev/null && echo "✓ 服务器截图" || true
[ -n "$(ls *.png 2>/dev/null | grep '^demo-')" ] && mv demo-*.png docs/screenshots/demo/ 2>/dev/null && echo "✓ 演示截图" || true
[ -n "$(ls *.png 2>/dev/null | grep '^r')" ] && mv r*-*.png docs/screenshots/misc/ 2>/dev/null && echo "✓ 其他测试截图" || true
[ -n "$(ls *.png 2>/dev/null | grep '^qa-')" ] && mv qa-*.png docs/screenshots/misc/ 2>/dev/null && echo "✓ QA 截图" || true
[ -n "$(ls *.png 2>/dev/null | grep '^fallback-')" ] && mv fallback-*.png docs/screenshots/misc/ 2>/dev/null && echo "✓ Fallback 截图" || true
[ -n "$(ls *.png 2>/dev/null | grep '^w')" ] && mv w*-*.png docs/screenshots/misc/ 2>/dev/null && echo "✓ Week 截图" || true
# 剩余 PNG
[ -n "$(ls *.png 2>/dev/null)" ] && mv *.png docs/screenshots/misc/ 2>/dev/null && echo "✓ 剩余截图" || true
echo ""

# 第三步: 整理配置文件
echo -e "${YELLOW}[第3步] 整理配置文件${NC}"
[ -f "aiquery-*.yml" ] && mv aiquery-*.yml config/aiquery/ 2>/dev/null && echo "✓ aiquery 配置" || true
echo ""

# 第四步: 整理测试结果
echo -e "${YELLOW}[第4步] 整理测试结果${NC}"
[ -n "$(ls p1_batch*.txt 2>/dev/null)" ] && mv p1_batch*.txt test-results/archived/ 2>/dev/null && echo "✓ p1 batch 结果" || true
[ -f "p1_all.txt" ] && mv p1_all.txt test-results/archived/ 2>/dev/null && echo "✓ p1 all 结果" || true
[ -n "$(ls prod_batch*.txt 2>/dev/null)" ] && mv prod_batch*.txt test-results/archived/ 2>/dev/null && echo "✓ prod batch 结果" || true
echo ""

# 第五步: 整理大文件
echo -e "${YELLOW}[第5步] 整理大文件${NC}"
[ -n "$(ls CretasFoodTrace*.apk 2>/dev/null | grep -v prod)" ] && mv CretasFoodTrace.apk releases/ 2>/dev/null && echo "✓ 旧版 APK" || true
[ -f "CretasFoodTrace-*prod*.apk" ] && mv CretasFoodTrace-*prod*.apk releases/ 2>/dev/null && echo "✓ 最新版 APK" || true
[ -f "zenodo_sample.zip" ] && mv zenodo_sample.zip data/samples/ 2>/dev/null && echo "✓ Zenodo 样本" || true
[ -n "$(ls *订单销售明细表.zip 2>/dev/null)" ] && mv *订单销售明细表.zip data/samples/ 2>/dev/null && echo "✓ 销售数据" || true
echo ""

# 第六步: 删除无用文件（可选，默认注释）
echo -e "${YELLOW}[第6步] 清理根目录日志 (可选)${NC}"
echo "将执行以下删除 (y/n):"
echo "  - 2026-04-07-*.txt (旧验证计划, 285KB)"
echo "  - bash.exe.stackdump, du.exe.stackdump"
echo "  - nul, NOW() (无用文件)"
read -p "是否继续? [y/N]: " confirm
if [ "$confirm" = "y" ]; then
    rm -f 2026-04-07-*.txt 2>/dev/null && echo "✓ 删除旧日志" || true
    rm -f bash.exe.stackdump du.exe.stackdump 2>/dev/null && echo "✓ 删除 crash dumps" || true
    rm -f nul NOW() 2>/dev/null && echo "✓ 删除无用文件" || true
else
    echo "跳过删除步骤"
fi
echo ""

# 最后: 统计
echo -e "${GREEN}======================================"
echo "整理完成！${NC}"
echo "======================================"
echo ""
echo "根目录文件统计:"
echo "  - 临时脚本: $(ls tmp_*.py 2>/dev/null | wc -l) 个 (保留在根目录等待分类)"
echo "  - 核心脚本: $(ls {labeling_pipeline,orchestrator,post_pipeline,final_merge,leakage_check}.py 2>/dev/null | wc -l) 个 (根目录)"
echo "  - 截图: $(find docs/screenshots -name '*.png' 2>/dev/null | wc -l) 个 (已整理)"
echo "  - 配置文件: $(find config -type f 2>/dev/null | wc -l) 个 (已整理)"
echo ""
echo "下一步："
echo "  1. 手动分类 tmp_*.py (活跃脚本 → scripts/yolo-training/active/)"
echo "  2. 提交整理结果: git add -A && git commit -m 'chore: organize root directory'"
echo ""
