"""Multipart/mixed response builder + directive constructors.

Per spec §2.1 (response shapes) + §6.4 (test plan). Tests cover:
- normal update response: manifest part + extensions part
- no-update response: single directive part with type=noUpdateAvailable
- rollback response: single directive part with type=rollBackToEmbedded
- boundary string randomized per response (different across two calls)
- per-part expo-signature header threading
- RFC 2046 CRLF separators (not \\n)
"""
from __future__ import annotations

import json

from ota.services import directives, multipart


def test_no_update_directive_shape():
    assert directives.no_update_available() == {"type": "noUpdateAvailable"}


def test_rollback_directive_shape():
    d = directives.rollback_to_embedded("2026-05-11T00:00:00.000Z")
    assert d == {
        "type": "rollBackToEmbedded",
        "parameters": {"commitTime": "2026-05-11T00:00:00.000Z"},
    }


def test_normal_update_response_has_manifest_and_extensions_parts():
    body, content_type = multipart.build_normal_update_response(
        manifest_json='{"id":"abc"}',
        extensions_json='{"assetRequestHeaders":{}}',
        manifest_signature_header=None,
    )

    text = body.decode("utf-8")
    assert 'name="manifest"' in text
    assert 'name="extensions"' in text
    assert '{"id":"abc"}' in text
    assert '{"assetRequestHeaders":{}}' in text
    assert content_type.startswith("multipart/mixed; boundary=")
    # Final boundary terminator must be present.
    boundary = content_type.split("boundary=", 1)[1]
    assert f"--{boundary}--" in text


def test_no_update_response_has_only_directive_part():
    body, content_type = multipart.build_directive_response(
        directive_json=json.dumps(directives.no_update_available()),
        signature_header=None,
    )

    text = body.decode("utf-8")
    assert 'name="directive"' in text
    assert '"noUpdateAvailable"' in text
    # No manifest / extensions parts.
    assert 'name="manifest"' not in text
    assert 'name="extensions"' not in text


def test_rollback_response_has_only_directive_part():
    body, content_type = multipart.build_directive_response(
        directive_json=json.dumps(
            directives.rollback_to_embedded("2026-05-11T00:00:00.000Z")
        ),
        signature_header=None,
    )

    text = body.decode("utf-8")
    assert 'name="directive"' in text
    assert '"rollBackToEmbedded"' in text
    assert '"2026-05-11T00:00:00.000Z"' in text


def test_boundary_is_random_per_response():
    _b1, ct1 = multipart.build_directive_response('{}', signature_header=None)
    _b2, ct2 = multipart.build_directive_response('{}', signature_header=None)

    boundary1 = ct1.split("boundary=", 1)[1]
    boundary2 = ct2.split("boundary=", 1)[1]

    assert boundary1 != boundary2  # very high probability with 32-byte hex


def test_signature_header_threaded_into_manifest_part():
    """When provided, the signature_header must appear in the manifest part headers."""
    sig = 'sig="abc/+=", keyid="main"'

    body, _ = multipart.build_normal_update_response(
        manifest_json='{"id":"x"}',
        extensions_json='{}',
        manifest_signature_header=sig,
    )

    text = body.decode("utf-8")
    assert sig in text
    # Signature must appear BEFORE the body in the same part (header block).
    sig_pos = text.index(sig)
    manifest_body_pos = text.index('{"id":"x"}')
    assert sig_pos < manifest_body_pos


def test_parts_use_crlf_line_endings():
    """RFC 2046 mandates \\r\\n between header lines and the blank line."""
    body, _ = multipart.build_directive_response('{}', signature_header=None)

    assert b"\r\n" in body
    # No bare \n that isn't preceded by \r (apart from the inside of the JSON body)
    # Simpler check: the part header block before JSON body uses \r\n separators
    text = body.decode("utf-8")
    header_block, _, _ = text.partition('{}')
    # Each header line ends with \r\n, blank \r\n separates from body
    assert header_block.count("\r\n") >= 3
