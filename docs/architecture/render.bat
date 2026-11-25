@echo off
chcp 65001 > nul
node "%~dp0render.mjs"
pause
