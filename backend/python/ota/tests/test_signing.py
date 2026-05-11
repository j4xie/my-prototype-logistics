"""Signing layer: RSA-PKCS1v15-SHA256 + byte-exact JSON serialization.

Per spec §4 (signing algorithm) + §6.3 (test plan). Five tests covering:
- RSA signature verifies with the public key (openssl-equivalent verify)
- JSON byte-shape: separators=(',',':') matches JSON.stringify default (no whitespace)
- ensure_ascii=False preserves unicode (no \\uXXXX escapes)
- Dict key order matches the reference TypeScript impl's manifest field order
- SFV header format: sig="<base64>", keyid="main"

Byte-shape is critical: client signature verification fails if the bytes the
server signed don't match the bytes the client receives, which means our
json.dumps must reproduce JSON.stringify(manifest) byte-for-byte.
"""
from __future__ import annotations

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from ota.services import signing


def test_sign_rsa_sha256_produces_valid_base64(test_rsa_keypair):
    private_pem, public_pem = test_rsa_keypair
    data = b'{"id":"abc","createdAt":"2026-05-11T00:00:00Z"}'

    sig_b64 = signing.sign_rsa_sha256(data, private_pem)

    # Independently verify with the public key — proves the signature is real.
    import base64
    raw_sig = base64.b64decode(sig_b64)
    public_key = serialization.load_pem_public_key(public_pem)
    public_key.verify(raw_sig, data, padding.PKCS1v15(), hashes.SHA256())

    # And a tampered payload should fail.
    import pytest
    with pytest.raises(InvalidSignature):
        public_key.verify(raw_sig, b"tampered", padding.PKCS1v15(), hashes.SHA256())


def test_canonicalize_uses_no_whitespace_separators():
    """JS JSON.stringify(obj) emits no spaces; Python default emits ', ' and ': '."""
    manifest = {"id": "abc", "createdAt": "now"}

    js_default_equivalent = signing.canonicalize_for_signing(manifest)

    assert js_default_equivalent == '{"id":"abc","createdAt":"now"}'
    # Specifically NOT '{"id": "abc", "createdAt": "now"}' (Python default)
    assert ", " not in js_default_equivalent
    assert ": " not in js_default_equivalent


def test_canonicalize_ensure_ascii_false_preserves_unicode():
    """JS JSON.stringify emits raw \\u4e2d etc as actual unicode bytes, not escapes."""
    manifest = {"name": "白垩纪"}

    out = signing.canonicalize_for_signing(manifest)

    # Raw UTF-8, no \\uXXXX escape sequences.
    assert "白垩纪" in out
    assert "\\u" not in out


def test_canonicalize_preserves_dict_insertion_order():
    """Python 3.7+ dict preserves insertion order; canonicalize must NOT sort.

    Reference manifest field order per Expo TypeScript impl:
      id, createdAt, runtimeVersion, assets, launchAsset, metadata, extra
    """
    manifest = {
        "id": "the-id",
        "createdAt": "the-time",
        "runtimeVersion": "1.0.0",
        "assets": [],
        "launchAsset": {},
        "metadata": {},
        "extra": {},
    }

    out = signing.canonicalize_for_signing(manifest)

    # Keys must appear in insertion order, not alphabetical.
    assert out.index('"id"') < out.index('"createdAt"')
    assert out.index('"createdAt"') < out.index('"runtimeVersion"')
    assert out.index('"runtimeVersion"') < out.index('"assets"')
    assert out.index('"assets"') < out.index('"launchAsset"')
    assert out.index('"launchAsset"') < out.index('"metadata"')
    assert out.index('"metadata"') < out.index('"extra"')


def test_build_signature_header_uses_sfv_dictionary_format():
    """Expo expo-signature header is an SFV dictionary: sig="...", keyid="main"."""
    header = signing.build_signature_header(sig_b64="ABC+/=", keyid="main")

    assert header == 'sig="ABC+/=", keyid="main"'


# --- chat2 audit Important B: cached private-key loader ---


def test_load_private_key_cached_reuses_parsed_key(tmp_path, test_rsa_keypair):
    """Repeated calls with the same path must hit the lru_cache (no re-read)."""
    private_pem, _ = test_rsa_keypair
    key_path = tmp_path / "key.pem"
    key_path.write_bytes(private_pem)

    # Reset cache so we're not seeing leftovers from other tests.
    signing.load_private_key_cached.cache_clear()
    info_before = signing.load_private_key_cached.cache_info()
    assert info_before.hits == 0 and info_before.misses == 0

    k1 = signing.load_private_key_cached(str(key_path))
    k2 = signing.load_private_key_cached(str(key_path))
    k3 = signing.load_private_key_cached(str(key_path))

    info_after = signing.load_private_key_cached.cache_info()
    assert k1 is k2 is k3  # same object — proves cached
    assert info_after.misses == 1, "PEM should be parsed exactly once"
    assert info_after.hits == 2


def test_sign_with_loaded_key_matches_sign_rsa_sha256(test_rsa_keypair):
    """The cached-key signing path produces signatures the pem path would verify."""
    private_pem, public_pem = test_rsa_keypair
    data = b'{"id":"x"}'

    from cryptography.hazmat.primitives import serialization
    parsed = serialization.load_pem_private_key(private_pem, password=None)

    sig_b64 = signing.sign_with_loaded_key(data, parsed)

    # Verify with the public key.
    import base64
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding

    pub = serialization.load_pem_public_key(public_pem)
    pub.verify(base64.b64decode(sig_b64), data, padding.PKCS1v15(), hashes.SHA256())
