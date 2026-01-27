#!/bin/bash
# 图片优化脚本 - 转换 PNG 为 WebP 并压缩
#
# 依赖安装:
#   macOS: brew install webp
#   Ubuntu: sudo apt install webp
#   Windows: 下载 https://developers.google.com/speed/webp/download
#
# 使用方法: bash scripts/optimize-images.sh

set -e

IMAGES_DIR="assets/images"
OUTPUT_DIR="assets/images/webp"

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

echo "=== 开始图片优化 ==="
echo ""

# 统计原始大小
ORIGINAL_SIZE=$(du -sh "$IMAGES_DIR" | cut -f1)
echo "原始图片目录大小: $ORIGINAL_SIZE"
echo ""

# 转换所有 PNG 为 WebP
for file in "$IMAGES_DIR"/*.png; do
    if [ -f "$file" ]; then
        filename=$(basename "$file" .png)
        output="$OUTPUT_DIR/${filename}.webp"

        echo "转换: $file -> $output"
        cwebp -q 85 "$file" -o "$output" 2>/dev/null

        # 显示压缩效果
        original=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        compressed=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output" 2>/dev/null)
        ratio=$((100 - compressed * 100 / original))
        echo "  压缩率: ${ratio}% (${original} -> ${compressed} bytes)"
    fi
done

echo ""
echo "=== 优化完成 ==="

# 统计优化后大小
OPTIMIZED_SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
echo "优化后目录大小: $OPTIMIZED_SIZE"
echo ""
echo "下一步:"
echo "1. 更新 HTML 中的图片路径，添加 WebP 支持"
echo "2. 使用 <picture> 标签兼容旧浏览器"
