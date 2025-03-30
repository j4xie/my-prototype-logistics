@echo off
echo 正在启动Magic MCP服务...

REM 设置环境变量
set TWENTY_FIRST_API_KEY=72b532ab1fcdcfcb7f4556d0743434f10fb61dd929c12795d25565aca347ad3a

REM 创建日志目录
if not exist logs mkdir logs

REM 启动Magic MCP
echo 启动Magic MCP...
start "Magic MCP" cmd /c "set TWENTY_FIRST_API_KEY=72b532ab1fcdcfcb7f4556d0743434f10fb61dd929c12795d25565aca347ad3a && npx -y @smithery/cli@latest run @21st-dev/magic-mcp > logs\magic-mcp.log 2>&1"

echo Magic MCP服务已启动！
echo 关闭此窗口将结束所有MCP服务
pause 