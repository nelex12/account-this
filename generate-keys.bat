@echo off
chcp 65001 > nul

node -e "const c=require('crypto');const k=c.generateKeyPairSync('ed25519').privateKey.export({format:'jwk'});console.log('SERVER_SIGNING_KEY='+k.d);console.log('JWT_SIGNING_KEY='+c.randomBytes(32).toString('base64url'))"

pause
