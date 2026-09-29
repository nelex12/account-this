@echo off
chcp 65001 > nul
rem Генерирует ключи сервера для .env (нужен Node.js, он же используется для фронтенда).
rem SERVER_SIGNING_KEY - приватный ключ Ed25519 (32-байтный seed, base64url): подпись сертификатов сотрудников.
rem                      Публичный ключ сервер вычисляет из него сам.
rem JWT_SIGNING_KEY    - секрет HMAC-SHA256 (32 байта, base64url): подпись JWT.
rem Скопируйте выведенные строки в .env. После смены SERVER_SIGNING_KEY старые сертификаты и логи
rem перестают проходить проверку подписи сервера, поэтому ключ генерируется один раз на окружение.

node -e "const c=require('crypto');const k=c.generateKeyPairSync('ed25519').privateKey.export({format:'jwk'});console.log('SERVER_SIGNING_KEY='+k.d);console.log('JWT_SIGNING_KEY='+c.randomBytes(32).toString('base64url'))"

pause
