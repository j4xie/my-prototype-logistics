"""RSA-PKCS1v15-SHA256 signing + byte-exact JSON canonicalization.

Per spec §4. Two responsibilities:
1. canonicalize_for_signing(obj) — produce the exact UTF-8 bytes JavaScript
   `JSON.stringify(obj)` would produce. CRITICAL: separators=(',',':') and
   ensure_ascii=False; dict insertion order preserved.
2. sign_rsa_sha256(data, private_pem) — RSA signature with PKCS#1 v1.5 padding
   and SHA-256 hash, returned base64-encoded for the expo-signature SFV header.
"""
from __future__ import annotations

import base64
import json

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding


def canonicalize_for_signing(obj) -> str:
    """Serialize `obj` to a string byte-exact with `JSON.stringify(obj)` in JS.

    Key points:
    - separators=(',',':') matches JS no-whitespace default
    - ensure_ascii=False matches JS raw-unicode emission
    - Python dict insertion order is preserved (no sort_keys)
    """
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def sign_rsa_sha256(data: bytes, private_key_pem: bytes) -> str:
    """Sign `data` with RSA-PKCS1v15 + SHA-256. Returns base64(signature)."""
    private_key = serialization.load_pem_private_key(private_key_pem, password=None)
    signature = private_key.sign(data, padding.PKCS1v15(), hashes.SHA256())
    return base64.b64encode(signature).decode("ascii")


def build_signature_header(sig_b64: str, keyid: str = "main") -> str:
    """Build the SFV-dictionary value for the `expo-signature` header.

    Format: sig="<base64>", keyid="<id>"

    Per RFC 8941 SFV dictionary; the values are quoted strings.
    """
    return f'sig="{sig_b64}", keyid="{keyid}"'
