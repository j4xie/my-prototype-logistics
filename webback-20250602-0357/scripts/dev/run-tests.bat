@echo off
echo 正在运行食品溯源系统测试...

cd web-app

echo.
echo 1. 运行负载均衡测试
npm test -- src/network/load-balancing.test.js

echo.
echo 2. 运行性能基准测试
npm test -- src/network/performance-benchmark.test.js

echo.
echo 3. 运行批处理测试
npm test -- src/network/batch-processing.test.js

echo.
echo 4. 运行网络监控测试
npm test -- src/network/network-monitor.test.js

echo.
echo 所有测试已完成!
pause 