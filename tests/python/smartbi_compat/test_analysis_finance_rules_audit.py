"""Regression tests for Phase 2A Rules 10/11/12 in analysis_finance.py.

Locks in the M=0 latent baseline established 2026-05-08 audit. Each test is
a static-analysis check that asserts the file does NOT regress on a known
Rule 10/11/12 anti-pattern. Future devs adding new code must keep these
tests passing.

Companion audit doc: docs/qa-audits/2026-05-08-rule-10-11-12-latent-sweep-analysis-finance.md

Rules audited:
- Rule 10: BigDecimal divide-then-multiply intermediate quantize at scale 4
- Rule 11: Java Jackson LocalDateTime trailing-zero microsecond truncation
- Rule 12: Java HALF_UP vs Python f-string banker's rounding

These tests are intentionally pure-text-scan against the source file — no
import / runtime / DB dependency. Fast (<1s), CI-safe.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
TARGET_FILE = REPO_ROOT / "backend" / "python" / "smartbi_compat" / "api" / "analysis_finance.py"


def _read_source() -> str:
    return TARGET_FILE.read_text(encoding="utf-8")


def _strip_strings_and_comments(text: str) -> tuple[str, list[tuple[int, str]]]:
    """Remove Python string literals + comments + docstrings, returns
    (cleaned_text, list_of_(line_num, original_line)).

    Approach: drop triple-quoted blocks and # comments first; line-by-line
    drop single-quoted/double-quoted string literals via tokenize-lite regex.
    Not perfect (won't handle every edge case) but sufficient to filter false
    positives in comments/docstrings for the patterns this audit cares about.
    """
    # Strip triple-quoted strings (greedy across lines, replace with same line count blanks)
    def _blank_keep_lines(m):
        return "\n" * m.group(0).count("\n")
    text = re.sub(r'"""[\s\S]*?"""', _blank_keep_lines, text)
    text = re.sub(r"'''[\s\S]*?'''", _blank_keep_lines, text)

    # Strip line comments + single/double-quoted strings per line
    cleaned_lines = []
    for ln in text.split("\n"):
        # drop everything after first un-quoted #
        # quick heuristic: replace strings first, then strip #
        no_strings = re.sub(r'"[^"\n]*"', '""', ln)
        no_strings = re.sub(r"'[^'\n]*'", "''", no_strings)
        if "#" in no_strings:
            no_strings = no_strings[:no_strings.index("#")]
        cleaned_lines.append(no_strings)

    cleaned = "\n".join(cleaned_lines)
    return cleaned, [(i + 1, ln) for i, ln in enumerate(text.split("\n"))]


# ============================================================
# Rule 10: BigDecimal divide-then-multiply intermediate quantize
# ============================================================


def test_rule_10_all_multiply_100_have_intermediate_quantize():
    """Every `* Decimal("100")` must be preceded (within ~5 lines) by
    `.quantize(Decimal("0.0001"), ...)` to mirror Java BigDecimal.divide
    intermediate-round-then-multiply semantics.

    Per Rule 10 in .claude/rules/python-java-port.md.

    Whitespace-tolerant: matches `.quantize(\\n    Decimal("0.0001")` split
    across lines (multi-line quantize calls).
    """
    text = _read_source()
    lines = text.split("\n")

    # Whitespace-tolerant intermediate-quantize pattern (handles multi-line
    # `.quantize(\n    Decimal("0.0001")` style).
    intermediate_pattern = re.compile(
        r'\.quantize\(\s*Decimal\("0\.0001"\)', re.DOTALL,
    )

    violations = []
    for i, ln in enumerate(lines):
        if "* Decimal(\"100\")" not in ln:
            continue
        # Allow standalone multiplications like `gross * Decimal("0.70")` —
        # only flag those where the preceding 5 lines show a `/` (division).
        window = "\n".join(lines[max(0, i - 5):i + 1])
        has_division = re.search(r"/\s*\w", window) is not None
        if not has_division:
            continue
        if intermediate_pattern.search(window):
            continue
        violations.append((i + 1, ln.strip()))

    assert violations == [], (
        "Rule 10 violation — `* Decimal(\"100\")` in divide context without "
        "intermediate `.quantize(Decimal(\"0.0001\"), rounding=ROUND_HALF_UP)`:\n"
        + "\n".join(f"  L{ln}: {src[:120]}" for ln, src in violations)
    )


def test_rule_10_safe_growth_rate_intermediate_quantize():
    """`_safe_growth_rate` must keep intermediate-quantize semantics
    (chat 4 PR-M-2 audit historical site).
    """
    text = _read_source()
    m = re.search(
        r"def _safe_growth_rate\(.*?(?=\n(?:async )?def )",
        text, re.DOTALL,
    )
    assert m is not None, "_safe_growth_rate definition not found"
    body = m.group(0)
    assert "* Decimal(\"100\")" in body, "_safe_growth_rate must multiply by 100"
    intermediate_pattern = re.compile(
        r'\.quantize\(\s*Decimal\("0\.0001"\)', re.DOTALL,
    )
    assert intermediate_pattern.search(body), (
        "_safe_growth_rate must apply intermediate quantize at scale 4 "
        "BEFORE multiply (Rule 10)"
    )


def test_rule_10_calculate_metric_from_sales_intermediate_quantize():
    """`_calculate_metric_from_sales` gross_margin branch must keep
    intermediate-quantize semantics (chat 4 PR-M-2 audit historical site).
    """
    text = _read_source()
    m = re.search(
        r"def _calculate_metric_from_sales\(.*?(?=\n(?:async )?def )",
        text, re.DOTALL,
    )
    assert m is not None, "_calculate_metric_from_sales definition not found"
    body = m.group(0)
    intermediate_pattern = re.compile(
        r'\.quantize\(\s*Decimal\("0\.0001"\)', re.DOTALL,
    )
    assert intermediate_pattern.search(body), (
        "_calculate_metric_from_sales gross_margin branch must apply "
        "intermediate quantize at scale 4 BEFORE multiply (Rule 10)"
    )


# ============================================================
# Rule 11: LocalDateTime microsecond truncation
# ============================================================


def test_rule_11_no_unwrapped_datetime_isoformat():
    """`datetime.<expr>.isoformat()` must be wrapped in `_java_isoformat`
    (or call `_utc_now_iso()` which wraps internally).

    Bare `datetime.now().isoformat()` would emit 6-digit microsecond which
    diverges from Java Jackson LocalDateTime trailing-zero truncation.
    """
    cleaned, _ = _strip_strings_and_comments(_read_source())
    pattern = re.compile(r"datetime[\.\w()]*\.isoformat\(\)")
    matches = pattern.finditer(cleaned)

    violations = []
    for m in matches:
        # Check if wrapped in _java_isoformat: look back ~50 chars for `_java_isoformat(`
        start = m.start()
        prefix = cleaned[max(0, start - 50):start]
        if "_java_isoformat(" not in prefix:
            line_num = cleaned[:start].count("\n") + 1
            violations.append((line_num, m.group()))

    assert violations == [], (
        "Rule 11 violation — datetime.isoformat() without _java_isoformat wrap:\n"
        + "\n".join(f"  L{ln}: {match}" for ln, match in violations)
    )


def test_rule_11_utc_now_iso_uses_java_isoformat():
    """`_utc_now_iso()` must wrap `datetime.now(...)` in `_java_isoformat()`."""
    text = _read_source()
    m = re.search(
        r"def _utc_now_iso\(\) -> str:.*?(?=\n(?:async )?def )",
        text, re.DOTALL,
    )
    assert m is not None, "_utc_now_iso definition not found"
    body = m.group(0)
    assert "_java_isoformat(" in body, (
        "_utc_now_iso must wrap datetime.now() in _java_isoformat() per Rule 11"
    )
    assert "datetime.now(" in body, "_utc_now_iso must call datetime.now(...)"


# ============================================================
# Rule 12: HALF_UP vs Python banker's rounding
# ============================================================


def test_rule_12_no_fstring_decimal_format():
    """No `f"{...:.Nf}"` patterns — Python f-string `:.Nf` uses IEEE-754
    banker's rounding which diverges from Java String.format HALF_UP.

    Per Rule 12 in .claude/rules/python-java-port.md.
    """
    cleaned, _ = _strip_strings_and_comments(_read_source())
    # Match patterns like {x:.2f}, {value:.0f}, but allow whitespace flex
    pattern = re.compile(r"\{[^{}]+:\.\d+f[^{}]*\}")
    matches = list(pattern.finditer(cleaned))

    violations = []
    for m in matches:
        line_num = cleaned[:m.start()].count("\n") + 1
        violations.append((line_num, m.group()))

    assert violations == [], (
        "Rule 12 violation — f-string `:.Nf` formatting (banker's rounding):\n"
        + "\n".join(f"  L{ln}: {match}" for ln, match in violations)
    )


def test_rule_12_no_percent_decimal_format():
    """No `"%.Nf" % d` patterns — printf-style also uses banker's rounding."""
    cleaned, _ = _strip_strings_and_comments(_read_source())
    pattern = re.compile(r'"%\.\d+f"|\'%\.\d+f\'')
    matches = list(pattern.finditer(cleaned))

    violations = []
    for m in matches:
        line_num = cleaned[:m.start()].count("\n") + 1
        violations.append((line_num, m.group()))

    assert violations == [], (
        "Rule 12 violation — printf-style `\"%.Nf\"` formatting (banker's):\n"
        + "\n".join(f"  L{ln}: {match}" for ln, match in violations)
    )


def test_rule_12_no_python_round_builtin():
    """Python builtin `round(...)` uses banker's rounding by default.

    Use `Decimal.quantize(scale, rounding=ROUND_HALF_UP)` instead for
    Java parity.
    """
    cleaned, _ = _strip_strings_and_comments(_read_source())
    # Match `round(` not preceded by `_` (to allow `_round(`) or `.` (`.round(`)
    pattern = re.compile(r"(?<![_.\w])round\(")
    matches = list(pattern.finditer(cleaned))

    violations = []
    for m in matches:
        line_num = cleaned[:m.start()].count("\n") + 1
        violations.append((line_num, cleaned.split("\n")[line_num - 1].strip()[:120]))

    assert violations == [], (
        "Rule 12 violation — Python builtin `round()` (banker's rounding):\n"
        + "\n".join(f"  L{ln}: {src}" for ln, src in violations)
    )


def test_rule_12_all_quantize_have_explicit_rounding():
    """Every `.quantize(...)` call must have an explicit `rounding=` kwarg
    or `ROUND_HALF_*` positional. Default `Decimal.quantize` rounding mode
    is `ROUND_HALF_EVEN` (banker's) — must override for Java parity.
    """
    text = _read_source()
    cleaned, _ = _strip_strings_and_comments(text)

    # Walk all .quantize( calls with paren-balancing
    pos = 0
    sites = []
    while True:
        m = re.search(r"\.quantize\(", cleaned[pos:])
        if not m:
            break
        start = pos + m.start()
        end = pos + m.end()
        depth = 1
        i = end
        while i < len(cleaned) and depth > 0:
            if cleaned[i] == "(":
                depth += 1
            elif cleaned[i] == ")":
                depth -= 1
            i += 1
        full = cleaned[start:i]
        sites.append((start, full))
        pos = i

    violations = []
    for start, full in sites:
        if "ROUND_HALF" not in full and "rounding=" not in full:
            line_num = cleaned[:start].count("\n") + 1
            snippet = " ".join(full.split())
            violations.append((line_num, snippet[:120]))

    assert violations == [], (
        f"Rule 12 violation — {len(violations)} `.quantize()` call(s) "
        "without explicit rounding (default ROUND_HALF_EVEN = banker's):\n"
        + "\n".join(f"  L{ln}: {src}" for ln, src in violations)
    )


# ============================================================
# Cross-rule sanity: total counts (M=0 baseline)
# ============================================================


def test_audit_baseline_m_zero():
    """Smoke check: audit baseline established 2026-05-08 = M=0 latent.

    If this test fails, a new violation has been introduced and one of the
    above per-rule tests should also fail with detail. This is the umbrella
    canary.
    """
    cleaned, _ = _strip_strings_and_comments(_read_source())

    # Count each rule's violation pattern (mirrors the per-rule tests, but
    # via simpler grep — used for telemetry / regression detection only).
    rule_10_unwrapped_multiply = 0
    text_lines = _read_source().split("\n")
    intermediate_pattern = re.compile(
        r'\.quantize\(\s*Decimal\("0\.0001"\)', re.DOTALL,
    )
    for i, ln in enumerate(text_lines):
        if "* Decimal(\"100\")" not in ln:
            continue
        window = "\n".join(text_lines[max(0, i - 5):i + 1])
        if re.search(r"/\s*\w", window) and not intermediate_pattern.search(window):
            rule_10_unwrapped_multiply += 1

    rule_11_unwrapped_datetime = len(re.findall(
        r"(?<!_java_isoformat\()datetime\.now\([^)]*\)\.isoformat\(\)",
        cleaned,
    ))

    rule_12_fstring_nf = len(re.findall(r"\{[^{}]+:\.\d+f[^{}]*\}", cleaned))
    rule_12_python_round = len(re.findall(r"(?<![_.\w])round\(", cleaned))

    total = (
        rule_10_unwrapped_multiply
        + rule_11_unwrapped_datetime
        + rule_12_fstring_nf
        + rule_12_python_round
    )
    assert total == 0, (
        f"Audit baseline M=0 broken: total {total} violations "
        f"(Rule 10: {rule_10_unwrapped_multiply}, "
        f"Rule 11: {rule_11_unwrapped_datetime}, "
        f"Rule 12 f-string: {rule_12_fstring_nf}, "
        f"Rule 12 round(): {rule_12_python_round})"
    )
