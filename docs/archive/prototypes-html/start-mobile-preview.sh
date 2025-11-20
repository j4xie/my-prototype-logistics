#!/bin/bash

# 白垩纪食品溯源系统 - 移动端原型预览启动脚本

echo "🦕 白垩纪食品溯源系统 - 移动端原型预览"
echo "========================================="
echo ""

# 检查是否在prototypes目录
if [ ! -f "index.html" ]; then
    echo "❌ 错误：请在prototypes目录下运行此脚本"
    exit 1
fi

echo "📱 选择查看方式："
echo ""
echo "1. 浏览器直接打开（推荐）"
echo "2. 启动本地服务器（可用于手机访问）"
echo "3. 仅打开流程图"
echo ""
read -p "请输入选项 (1-3): " choice

case $choice in
    1)
        echo ""
        echo "📂 正在打开主导航页..."
        open index.html
        echo "✅ 已在浏览器中打开"
        echo ""
        echo "💡 提示：按F12 → 点击手机图标 → 选择iPhone 14 Pro"
        ;;
    2)
        echo ""
        echo "🚀 正在启动本地服务器..."
        echo ""
        echo "📱 访问地址："
        echo "   本机: http://localhost:8080"
        echo "   手机: http://$(ipconfig getifaddr en0):8080"
        echo ""
        echo "⚠️  提示：确保手机和电脑在同一WiFi网络"
        echo "🛑 按 Ctrl+C 停止服务器"
        echo ""
        python3 -m http.server 8080
        ;;
    3)
        echo ""
        echo "🗺️ 正在打开完整流程图..."
        open flow-map.html
        echo "✅ 已在浏览器中打开"
        ;;
    *)
        echo ""
        echo "❌ 无效选项，请重新运行脚本"
        exit 1
        ;;
esac
