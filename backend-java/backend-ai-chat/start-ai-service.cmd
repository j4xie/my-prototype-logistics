@echo off
echo ================================
echo 白垩纪 AI 成本分析服务 启动脚本
echo ================================
echo.

REM 检查Python环境
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] Python未安装或未加入PATH
    echo 请安装Python 3.8+
    pause
    exit /b 1
)

REM 检查虚拟环境
if not exist "venv" (
    echo [提示] 虚拟环境不存在，正在创建...
    python -m venv venv
    echo [完成] 虚拟环境创建成功
    echo.
)

REM 激活虚拟环境
echo [1/4] 激活虚拟环境...
call venv\Scripts\activate

REM 检查依赖
echo [2/4] 检查依赖...
pip list | findstr fastapi >nul 2>&1
if errorlevel 1 (
    echo [提示] 依赖未安装，正在安装...
    pip install -r requirements.txt
    echo [完成] 依赖安装完成
    echo.
)

REM 检查.env文件
echo [3/4] 检查配置...
if not exist ".env" (
    echo [警告] .env文件不存在！
    echo 请创建.env文件并配置HF_TOKEN
    echo.
    echo 示例：
    echo HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    echo REDIS_HOST=localhost
    echo REDIS_PORT=6379
    echo REDIS_DB=0
    echo.
    pause
    exit /b 1
)

REM 检查Redis（可选）
echo [检查] Redis服务...
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo [提示] Redis未运行，将使用内存存储
    echo [提示] 建议启动Redis以保持会话持久化
    echo.
) else (
    echo [成功] Redis连接正常
    echo.
)

REM 启动服务
echo [4/4] 启动AI服务...
echo.
echo ================================
echo 服务信息：
echo - 端口: 8085
echo - API文档: http://localhost:8085/docs
echo - 健康检查: http://localhost:8085/
echo ================================
echo.
echo [按 Ctrl+C 停止服务]
echo.

python main.py

pause
