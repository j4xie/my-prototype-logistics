#!/bin/bash

# 白垩纪食品溯源系统 - 后端编译脚本
# 使用 Maven 编译 Spring Boot 项目并生成 JAR 文件

set -e  # 遇到错误立即退出

echo "========================================"
echo "  Cretas Backend - Build Script"
echo "========================================"

# 检查 Maven 是否安装
if ! command -v mvn &> /dev/null; then
    echo "❌ Maven 未安装，请先安装 Maven"
    echo "   macOS: brew install maven"
    echo "   Linux: sudo apt-get install maven"
    exit 1
fi

echo "✅ Maven 版本:"
mvn --version

# 进入项目目录
cd "$(dirname "$0")"

echo ""
echo "🔨 开始编译项目..."
echo "-------------------------------------------"

# 清理并编译项目（跳过测试）
mvn clean package -DskipTests

echo ""
echo "✅ 编译完成！"
echo "-------------------------------------------"

# 检查 JAR 文件是否生成
JAR_FILE="target/cretas-backend-system-1.0.0.jar"

if [ -f "$JAR_FILE" ]; then
    echo "📦 JAR 文件生成成功:"
    ls -lh "$JAR_FILE"
    echo ""
    echo "📍 JAR 文件路径:"
    echo "   $(pwd)/$JAR_FILE"
    echo ""
    echo "🚀 下一步："
    echo "   1. 测试本地运行: java -jar $JAR_FILE"
    echo "   2. 部署到服务器: ./deploy.sh"
else
    echo "❌ JAR 文件生成失败"
    exit 1
fi

echo ""
echo "========================================"
echo "  Build Completed Successfully!"
echo "========================================"
