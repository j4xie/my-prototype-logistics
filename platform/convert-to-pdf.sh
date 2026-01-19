#!/bin/bash

# HTML 转 PDF 脚本 (使用系统打印功能)

cd "$(dirname "$0")"

echo "正在转换 HTML 文件为 PDF..."

# 使用 cupsfilter (macOS 自带的 PDF 转换工具)
# 如果这个方法不行，请使用浏览器手动转换

# 方法：使用 Safari 的命令行打印功能
for file in index.html dashboard.html; do
    if [ -f "$file" ]; then
        output="${file%.html}.pdf"
        echo "转换 $file -> $output"
        
        # 使用 AppleScript 控制 Safari
        osascript <<EOF
tell application "Safari"
    activate
    open POSIX file "$PWD/$file"
    delay 3
    tell application "System Events"
        keystroke "p" using command down
        delay 2
        keystroke return
    end tell
end tell
EOF
    fi
done

echo "
⚠️  自动化打印可能需要手动操作

推荐手动方法：
1. 在浏览器中打开文件（双击 HTML 文件）
2. 按 Cmd+P 打印
3. 选择 '另存为 PDF'
4. 保存为同名 PDF 文件

或使用在线工具：https://cloudconvert.com/html-to-pdf
"
