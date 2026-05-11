"""RSA-PKCS1v15-SHA256 signing + byte-exact JSON canonicalization.

Per spec §4. Two responsibilities:
1. canonicalize_for_signing(obj) — produce the exact UTF-8 bytes JavaScript
   `JSON.stringify(obj)` would produce. CRITICAL: separators=(',',':') and
   ensure_ascii=False; dict insertion order preserved.
2. sign_rsa_sha256(data, private_pem) — RSA signature with PKCS#1 v1.5 padding
   and SHA-256 hash, returned base64-encoded for the expo-signature SFV header.

Per chat2 audit Important B: the parsed RSA key is cached so each manifest
request does NOT re-read + re-parse the PEM file. `load_private_key_cached`
keys off the absolute path string so test fixtures with different paths get
distinct cache entries.
"""
from __future__ import annotations

import base64
import json
from functools import lru_cache
from pathlib import Path

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
    """Sign `data` with RSA-PKCS1v15 + SHA-256. Returns base64(signature).

    Kept for direct PEM-bytes use (tests, ad-hoc tooling). Production request
    paths should prefer `sign_with_loaded_key` + `load_private_key_cached` to
    avoid re-parsing the PEM on every request.
    """
    private_key = serialization.load_pem_private_key(private_key_pem, password=None)
    return _sign(private_key, data)


def _sign(private_key, data: bytes) -> str:
    signature = private_key.sign(data, padding.PKCS1v15(), hashes.SHA256())
    return base64.b64encode(signature).decode("ascii")


@lru_cache(maxsize=4)
def load_private_key_cached(key_path: str):
    """Read + parse a PEM private key, memoized by absolute path string.

    Per chat2 audit Important B: the manifest endpoint signed every response
    by re-reading the PEM file + re-parsing it via `load_pem_private_key`,
    which is ~1ms per call. With a 1000 RPS burst that's wasted CPU. lru_cache
    makes subsequent calls O(1). maxsize=4 covers prod + test + the two test
    fixtures used by pytest.
    """
    pem_bytes = Path(key_path).read_bytes()
    return serialization.load_pem_private_key(pem_bytes, password=None)


def sign_with_loaded_key(data: bytes, private_key) -> str:
    """Sign with an already-loaded `cryptography` private-key object."""
    return _sign(private_key, data)


def build_signature_header(sig_b64: str, keyid: str = "main") -> str:
    """Build the SFV-dictionary value for the `expo-signature` header.

    Format: sig="<base64>", keyid="<id>"

    Per RFC 8941 SFV dictionary; the values are quoted strings.
    """
    return f'sig="{sig_b64}", keyid="{keyid}"'
