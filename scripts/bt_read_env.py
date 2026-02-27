"""Read server config via Baota Panel API"""
import requests, json, base64, re, urllib3, sys
urllib3.disable_warnings()

BT_URL = 'https://47.100.235.168:8888/658e3b15'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0'
s = requests.Session()
s.verify = False
s.headers.update({'User-Agent': UA})

# Step 1: Get login page
resp = s.get(BT_URL)

pk_match = re.search(r"vite_public_encryption = '(-----BEGIN PUBLIC KEY-----[^']+-----END PUBLIC KEY-----)'", resp.text)
token_match = re.search(r"vite_public_login_token = '([^']+)'", resp.text)

pub_key_pem = pk_match.group(1)
if '\n' not in pub_key_pem:
    pub_key_pem = pub_key_pem.replace('-----BEGIN PUBLIC KEY-----', '-----BEGIN PUBLIC KEY-----\n').replace('-----END PUBLIC KEY-----', '\n-----END PUBLIC KEY-----')

login_token = token_match.group(1)
print(f"Login token: {login_token}")

# Step 2: RSA encrypt password
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5
pub_key = RSA.import_key(pub_key_pem)
cipher = PKCS1_v1_5.new(pub_key)
encrypted_pass = base64.b64encode(cipher.encrypt(b'baotaiWQ3PUc')).decode()

# Step 3: Try login - test both endpoints and payloads
endpoints = [
    ('https://47.100.235.168:8888/login', {'username': 'user', 'password': encrypted_pass, 'code': '', 'vcode': '', 'login_token': login_token}),
    ('https://47.100.235.168:8888/658e3b15', {'username': 'user', 'password': encrypted_pass, 'code': '', 'vcode': '', 'login_token': login_token}),
    ('https://47.100.235.168:8888/login', {'username': 'user', 'password': encrypted_pass}),
]

for url, data in endpoints:
    try:
        r = s.post(url, data=data)
        raw = r.content
        # Try multiple decodings
        for enc in ['utf-8', 'gbk', 'gb2312', 'latin1']:
            try:
                text = raw.decode(enc)
                d = json.loads(text)
                msg = d.get('msg', '')
                print(f"[{enc}] {url.split('/')[-1]}: status={d.get('status')} msg={msg}")
                if d.get('status'):
                    print("LOGIN SUCCESS!")
                    # Continue with file reading
                    x_token = d.get('token', '') or d.get('request_token', '')
                    print(f"Token: {x_token[:30]}..." if x_token else "No token")

                    headers = {'x-http-token': x_token} if x_token else {}
                    fr = s.post('https://47.100.235.168:8888/files?action=GetFileBody',
                               data={'path': '/www/wwwroot/cretas/code/backend/python/.env'}, headers=headers)
                    fd = fr.json()
                    if fd.get('status'):
                        print("\n=== SERVER .env (AI keys) ===")
                        for line in fd['data'].split('\n'):
                            if any(k in line.upper() for k in ['LLM', 'API_KEY', 'DASHSCOPE', 'MODEL', 'SECRET']):
                                print(line)
                    sys.exit(0)
                break
            except:
                continue
    except Exception as e:
        print(f"Error {url}: {e}")

print("\nAll login attempts failed")
