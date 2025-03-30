@echo off
echo 正在设置环境变量并启动服务...

:: 设置环境变量
SET TWENTY_FIRST_API_KEY=72b532ab1fcdcfcb7f4556d0743434f10fb61dd929c12795d25565aca347ad3a

:: 创建日志目录
if not exist logs mkdir logs

:: 启动Magic MCP服务
echo 启动Magic MCP服务...
start "Magic MCP" cmd /c "SET TWENTY_FIRST_API_KEY=72b532ab1fcdcfcb7f4556d0743434f10fb61dd929c12795d25565aca347ad3a && npx -y @smithery/cli@latest run @21st-dev/magic-mcp > logs\magic-mcp.log 2>&1"

echo 服务已启动
echo 请检查logs目录下的日志文件以确认服务状态
echo.
echo 按任意键退出...
pause > nul 