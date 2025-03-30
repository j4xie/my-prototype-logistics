@echo off
title MCP服务管理器
echo 正在启动MCP服务...
cd %~dp0
node start-mcp-services.js 