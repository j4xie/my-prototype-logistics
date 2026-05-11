"""Shared pytest fixtures for ota/tests.

Fixtures accumulate as more tests come online. Keep them small and composable.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


@pytest.fixture(scope="session")
def test_rsa_keypair() -> tuple[bytes, bytes]:
    """RSA-2048 keypair used across signing tests, generated once per session.

    Returns (private_pem, public_pem). Real prod key is generated via openssl
    and read from disk (see spec §4.5).
    """
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_pem, public_pem


@pytest.fixture
def ota_root(tmp_path: Path) -> Path:
    """Empty OTA filesystem root layout: <ota_root>/updates/, <ota_root>/keys/."""
    (tmp_path / "updates").mkdir()
    (tmp_path / "keys").mkdir()
    return tmp_path


@pytest.fixture
def sample_metadata() -> dict:
    """A minimal valid metadata.json shape, mirroring `expo export` output.

    Real expo-cli emits a richer doc; this is the subset our server reads.
    """
    return {
        "version": 0,
        "bundler": "metro",
        "fileMetadata": {
            "android": {
                "bundle": "bundles/index-abc123.hbc",
                "assets": [
                    {"path": "assets/img-1.png", "ext": "png"},
                    {"path": "assets/font-roboto.ttf", "ext": "ttf"},
                ],
            },
            "ios": {
                "bundle": "bundles/index-def456.hbc",
                "assets": [],
            },
        },
    }


@pytest.fixture
def sample_expo_config() -> dict:
    """A minimal expoConfig.json snapshot used by the client to reflect app metadata."""
    return {
        "name": "白垩纪AI Agent",
        "slug": "CretasFoodTrace",
        "version": "1.0.0",
        "runtimeVersion": {"policy": "appVersion"},
    }


@pytest.fixture
def ota_settings(ota_root: Path, test_rsa_keypair):
    """OTASettings pointed at the test ota_root with a real RSA keypair on disk."""
    from ota.config import OTASettings

    private_pem, _public_pem = test_rsa_keypair
    key_path = ota_root / "keys" / "ota_private.pem"
    key_path.write_bytes(private_pem)
    return OTASettings(
        base_path=ota_root,
        private_key_path=key_path,
        admin_token="test-admin-token-secret",
        hostname="http://test.local",
        default_channel="production",
    )


@pytest.fixture
def client(ota_settings):
    """FastAPI TestClient with our router mounted and settings dependency overridden."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from ota.api.endpoints import router
    from ota.config import get_settings

    app = FastAPI()
    app.include_router(router, prefix="/api/ota")
    app.dependency_overrides[get_settings] = lambda: ota_settings
    return TestClient(app)


@pytest.fixture
def populated_bundle_dir(
    ota_root: Path, sample_metadata: dict, sample_expo_config: dict
) -> Path:
    """A complete update bundle directory ready for manifest construction.

    Layout: <ota_root>/updates/1.0.0/production/200/{metadata.json, expoConfig.json,
                                                     bundles/index-abc123.hbc,
                                                     assets/img-1.png,
                                                     assets/font-roboto.ttf}
    """
    bundle = ota_root / "updates" / "1.0.0" / "production" / "200"
    bundle.mkdir(parents=True)
    (bundle / "metadata.json").write_text(
        json.dumps(sample_metadata), encoding="utf-8"
    )
    (bundle / "expoConfig.json").write_text(
        json.dumps(sample_expo_config), encoding="utf-8"
    )
    (bundle / "bundles").mkdir()
    (bundle / "bundles" / "index-abc123.hbc").write_bytes(b"// fake hbc bundle bytes\n")
    (bundle / "assets").mkdir()
    (bundle / "assets" / "img-1.png").write_bytes(b"\x89PNG\r\n\x1a\nfake-png")
    (bundle / "assets" / "font-roboto.ttf").write_bytes(b"\x00\x01\x00\x00fake-ttf")
    return bundle
