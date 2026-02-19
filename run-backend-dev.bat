@echo off
set "JAVA_HOME=C:\Program Files\Java\jdk-17"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api
call mvnw.cmd spring-boot:run -Dmaven.test.skip=true
pause
