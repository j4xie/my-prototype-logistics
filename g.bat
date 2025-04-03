@echo off
:: Batch wrapper for g.ps1
powershell -ExecutionPolicy Bypass -File "%~dp0g.ps1" %* 