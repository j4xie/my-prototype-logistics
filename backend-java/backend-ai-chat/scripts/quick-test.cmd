@echo off
chcp 65001 >nul
echo ========================================
echo 白垩纪 AI 服务快速测试
echo ========================================
echo.

REM 测试 AI 服务健康检查
echo [测试 1] AI 服务健康检查...
curl -s http://localhost:8085/
if errorlevel 1 (
    echo ❌ AI 服务未运行！请先启动 AI 服务
    echo.
    echo 启动命令:
    echo   cd /Users/jietaoxie/Downloads/cretas-backend-system-main/backend-ai-chat
    echo   venv\Scripts\activate
    echo   python main.py
    pause
    exit /b 1
)
echo.
echo ✅ AI 服务运行正常
echo.

REM 运行 Python 测试脚本
echo [测试 2] 运行完整功能测试...
echo.
python test_heiniu.py

echo.
echo ========================================
echo 测试完成！
echo ========================================
pause
