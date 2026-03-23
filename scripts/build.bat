@echo off
set "JAVA_HOME=C:\Program Files\Java\jdk-17"
cd /d c:\Users\Steve\my-prototype-logistics\backend\java\cretas-api
echo Current dir: %CD%
echo JAVA_HOME: %JAVA_HOME%
call "c:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\mvnw.cmd" clean package -Dmaven.test.skip=true
