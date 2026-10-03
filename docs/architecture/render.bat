@echo off
chcp 65001 > nul
rem Перерисовывает схемы *.mmd в images\ (PNG 4K, большие — ещё и 8K). Нужен Node.js, он же используется для фронтенда.
rem Mermaid CLI скачивается через npx при первом запуске (вместе с Chromium для отрисовки).
node "%~dp0render.mjs"
pause
