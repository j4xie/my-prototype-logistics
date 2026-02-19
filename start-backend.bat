@echo off
set "JAVA_HOME=C:\Program Files\Java\jdk-17"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d c:\Users\Steve\my-prototype-logistics\backend\java\cretas-api
java -Dspring.profiles.active=local -jar target\cretas-backend-system-1.0.0.jar
