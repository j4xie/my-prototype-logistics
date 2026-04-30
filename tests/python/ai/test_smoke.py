"""Smoke test that ai/ package can be imported."""


def test_ai_package_importable():
    import ai
    assert ai.__name__ == "ai"


def test_ai_matcher_subpackage_importable():
    import ai.matcher
    assert ai.matcher.__name__ == "ai.matcher"
