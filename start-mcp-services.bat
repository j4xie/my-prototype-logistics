@echo off
title MCP服务管理器
echo 正在启动MCP服务...

REM 设置Magic MCP的API密钥环境变量
set TWENTY_FIRST_API_KEY=72b532ab1fcdcfcb7f4556d0743434f10fb61dd929c12795d25565aca347ad3a

REM 启动Browser Tools MCP
start "Browser Tools MCP" cmd /c "npx -y @agentdeskai/browser-tools-mcp@1.2.0"

REM 启动Magic MCP (使用环境变量)
start "Magic MCP" cmd /c "npx -y @smithery/cli@latest run @21st-dev/magic-mcp"

REM 启动Neon MCP
start "Neon MCP" cmd /c "npx -y @neondatabase/mcp-server-neon start napi_88x8jzryt6fewwb8ts6owfi2ov23xptlb1798ynl3mlfymv17lzifduyr1t3ly88"

echo 所有MCP服务已启动！
echo 关闭此窗口将结束所有MCP服务。

REM 保持批处理文件运行，不自动关闭
pause > nul 