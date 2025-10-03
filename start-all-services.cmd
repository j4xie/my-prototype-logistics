@echo off
chcp 65001 >nul
echo ========================================
echo 白垩纪食品溯源系统 - 完整服务启动
echo ========================================
echo.

REM 检查 MySQL 服务
echo [1/4] 检查 MySQL 服务...
sc query MySQL80 | find "RUNNING" >nul
if errorlevel 1 (
    echo MySQL 未运行，正在启动...
    net start MySQL80
    if errorlevel 1 (
        echo ❌ MySQL 启动失败！请手动启动 MySQL 服务
        pause
        exit /b 1
    )
    echo ✅ MySQL 启动成功
) else (
    echo ✅ MySQL 已运行
)
echo.

REM 启动 AI 服务 (8085)
echo [2/4] 启动 AI 成本分析服务 (端口 8085)...
start "白垩纪-AI服务" cmd /k "cd backend-ai-chat && venv\Scripts\activate && python main.py"
timeout /t 3 >nul
echo ✅ AI 服务已启动
echo.

REM 启动后端 API (3001)
echo [3/4] 启动后端 API 服务 (端口 3001)...
start "白垩纪-后端API" cmd /k "cd backend && npm run dev"
timeout /t 3 >nul
echo ✅ 后端 API 已启动
echo.

REM 启动 React Native (3010)
echo [4/4] 启动 React Native 开发服务器 (端口 3010)...
start "白垩纪-React Native" cmd /k "cd frontend\HainiuFoodTrace && npm start"
timeout /t 2 >nul
echo ✅ React Native 已启动
echo.

echo ========================================
echo ✨ 所有服务已启动完成！
echo ========================================
echo.
echo 服务清单:
echo   - MySQL 数据库: 端口 3306
echo   - AI 分析服务: http://localhost:8085
echo   - 后端 API: http://localhost:3001
echo   - React Native: http://localhost:3010
echo.
echo 测试步骤:
echo   1. 打开 Expo Go 或 Android 模拟器
echo   2. 扫描 React Native 终端中的二维码
echo   3. 登录系统 (processing_admin / DeptAdmin@123)
echo   4. 进入"加工管理" → "批次管理"
echo   5. 选择批次 → 成本分析 → 点击"AI 智能分析"
echo.
echo 按任意键退出...
pause >nul
