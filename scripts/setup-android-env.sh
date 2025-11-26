#!/bin/bash

###############################################################################
# Android 环境变量配置脚本
# 用途: 快速配置 ANDROID_HOME 和相关环境变量
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Android 环境配置向导${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 查找 Android SDK
echo -e "${BLUE}正在搜索 Android SDK...${NC}"

# 常见的 SDK 位置
POSSIBLE_LOCATIONS=(
  "$HOME/Library/Android/sdk"
  "$HOME/Android/Sdk"
  "/usr/local/share/android-sdk"
  "/opt/android-sdk"
  "$HOME/.android-sdk"
)

FOUND_SDK=""

for location in "${POSSIBLE_LOCATIONS[@]}"; do
  if [ -d "$location/platform-tools" ]; then
    FOUND_SDK="$location"
    echo -e "${GREEN}✅ 找到 Android SDK: $location${NC}"
    break
  fi
done

if [ -z "$FOUND_SDK" ]; then
  echo -e "${YELLOW}⚠️  未在常见位置找到 Android SDK${NC}"
  echo ""
  echo "请手动输入您的 Android SDK 路径："
  echo "（通常在 Android Studio 的 SDK Manager 中可以查看）"
  echo ""
  read -p "SDK 路径: " USER_SDK_PATH

  if [ -d "$USER_SDK_PATH/platform-tools" ]; then
    FOUND_SDK="$USER_SDK_PATH"
    echo -e "${GREEN}✅ SDK 路径有效${NC}"
  else
    echo -e "${RED}❌ 无效的 SDK 路径，请检查后重试${NC}"
    exit 1
  fi
fi

# 2. 检测 shell 类型
SHELL_RC=""
SHELL_NAME=$(basename "$SHELL")

case "$SHELL_NAME" in
  zsh)
    SHELL_RC="$HOME/.zshrc"
    ;;
  bash)
    SHELL_RC="$HOME/.bash_profile"
    ;;
  *)
    echo -e "${YELLOW}⚠️  未识别的 shell: $SHELL_NAME${NC}"
    SHELL_RC="$HOME/.profile"
    ;;
esac

echo ""
echo -e "${BLUE}检测到 shell: $SHELL_NAME${NC}"
echo -e "${BLUE}配置文件: $SHELL_RC${NC}"

# 3. 备份现有配置
if [ -f "$SHELL_RC" ]; then
  BACKUP_FILE="${SHELL_RC}.backup.$(date +%Y%m%d_%H%M%S)"
  cp "$SHELL_RC" "$BACKUP_FILE"
  echo -e "${GREEN}✅ 已备份配置文件: $BACKUP_FILE${NC}"
fi

# 4. 添加环境变量
echo ""
echo -e "${BLUE}准备添加以下环境变量到 $SHELL_RC:${NC}"
echo ""
cat << EOF
# Android SDK Configuration (added by setup-android-env.sh)
export ANDROID_HOME=$FOUND_SDK
export PATH=\$PATH:\$ANDROID_HOME/emulator
export PATH=\$PATH:\$ANDROID_HOME/platform-tools
export PATH=\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=\$PATH:\$ANDROID_HOME/tools
export PATH=\$PATH:\$ANDROID_HOME/tools/bin
EOF
echo ""

read -p "是否继续？(y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}⚠️  已取消配置${NC}"
  exit 0
fi

# 检查是否已经配置过
if grep -q "ANDROID_HOME" "$SHELL_RC" 2>/dev/null; then
  echo -e "${YELLOW}⚠️  检测到 $SHELL_RC 中已有 ANDROID_HOME 配置${NC}"
  read -p "是否覆盖？(y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 删除旧的 ANDROID_HOME 相关配置
    sed -i.bak '/ANDROID_HOME/d' "$SHELL_RC"
    sed -i.bak '/Android SDK/d' "$SHELL_RC"
    echo -e "${GREEN}✅ 已删除旧配置${NC}"
  else
    echo -e "${YELLOW}⚠️  保留现有配置，已取消${NC}"
    exit 0
  fi
fi

# 添加配置
cat >> "$SHELL_RC" << EOF

# Android SDK Configuration (added by setup-android-env.sh on $(date))
export ANDROID_HOME=$FOUND_SDK
export PATH=\$PATH:\$ANDROID_HOME/emulator
export PATH=\$PATH:\$ANDROID_HOME/platform-tools
export PATH=\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=\$PATH:\$ANDROID_HOME/tools
export PATH=\$PATH:\$ANDROID_HOME/tools/bin
EOF

echo -e "${GREEN}✅ 环境变量已添加到 $SHELL_RC${NC}"

# 5. 应用配置到当前 shell
echo ""
echo -e "${BLUE}应用配置到当前 shell...${NC}"
export ANDROID_HOME=$FOUND_SDK
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin

# 6. 验证配置
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}环境验证${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${BLUE}ANDROID_HOME:${NC} $ANDROID_HOME"

if command -v adb &> /dev/null; then
  ADB_VERSION=$(adb --version 2>&1 | head -n 1)
  echo -e "${GREEN}✅ adb: $ADB_VERSION${NC}"
else
  echo -e "${RED}❌ adb 命令未找到${NC}"
fi

if [ -d "$ANDROID_HOME/platforms" ]; then
  PLATFORMS=$(ls "$ANDROID_HOME/platforms" 2>/dev/null | wc -l | tr -d ' ')
  echo -e "${GREEN}✅ 已安装 $PLATFORMS 个 Android 平台版本${NC}"
fi

if [ -d "$ANDROID_HOME/build-tools" ]; then
  BUILD_TOOLS=$(ls "$ANDROID_HOME/build-tools" 2>/dev/null | wc -l | tr -d ' ')
  echo -e "${GREEN}✅ 已安装 $BUILD_TOOLS 个 Build Tools 版本${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}配置完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}重要提示:${NC}"
echo "1. 当前终端的环境变量已生效"
echo "2. 新打开的终端窗口会自动加载配置"
echo "3. 如需在当前终端刷新配置，请运行:"
echo -e "   ${BLUE}source $SHELL_RC${NC}"
echo ""
echo -e "${BLUE}下一步:${NC}"
echo "  运行构建脚本: ./scripts/build-android-apk.sh"
echo ""
