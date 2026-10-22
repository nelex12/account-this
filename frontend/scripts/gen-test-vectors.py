# Generates the golden vectors in src/offline/__tests__/fixtures.ts, independently of the app code.
# Needs: pip install cryptography.  Run: python3 scripts/gen-test-vectors.py > vectors.json
# (copy the values into fixtures.ts; the server key is the RFC 8032 test vector 1 from backend TestKeys.cs)
import base64, json
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization as ser
b64=lambda b: base64.urlsafe_b64encode(b).rstrip(b'=').decode()
unb=lambda s: base64.urlsafe_b64decode(s+'='*(-len(s)%4))
def pub(sk): return sk.public_key().public_bytes(ser.Encoding.Raw, ser.PublicFormat.Raw)
server_seed='nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A'
server=Ed25519PrivateKey.from_private_bytes(unb(server_seed))
assert b64(pub(server))=='11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo'
worker_seed=bytes(range(1,33)); worker=Ed25519PrivateKey.from_private_bytes(worker_seed)
tok=json.dumps({"workerId":"5b1d0c8a-2f4e-4a63-9d17-8e0c3a6f4b21","fio":"Иванов Иван Иванович","issuedAt":1790000000,"expiresAt":1790043200,"workerPublicKey":b64(pub(worker))},ensure_ascii=False,separators=(',',':'))
token=b64(tok.encode())
ssig=b64(server.sign(('AT1-TOKEN.'+token).encode()))
def make(op_json):
    op=b64(op_json.encode())
    wsig=b64(worker.sign(('AT1-OP.'+token+'.'+ssig+'.'+op).encode()))
    return op,wsig,f'AT1.{token}.{ssig}.{op}.{wsig}'
op_json=json.dumps({"action":"TAKE","toolCondition":"Good","toolId":"17c4e5a2-93b8-4f10-8d6a-0b2e7c9d4f35","toolName":"Дрель Bosch","timestamp":1790003600},ensure_ascii=False,separators=(',',':'))
op,wsig,qr=make(op_json)
out=dict(serverSeed=server_seed,serverPublicKey=b64(pub(server)),workerSeed=b64(worker_seed),workerPublicKey=b64(pub(worker)),tokenJson=tok,token=token,serverSignature=ssig,opJson=op_json,op=op,workerSignature=wsig,qr=qr)
print(json.dumps(out,ensure_ascii=False,indent=2))
