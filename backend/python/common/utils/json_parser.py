"""
Robust JSON Parser for LLM Responses

Handles common LLM JSON output issues:
- Missing commas between objects: [{}{}] -> [{},{}]
- Trailing commas: [1,2,] -> [1,2]
- Code blocks: ```json ... ```
- Truncated/incomplete JSON
- Unterminated strings
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger(__name__)


def extract_json_from_text(text: str) -> Optional[str]:
    """
    Extract JSON string from text that may contain markdown code blocks.

    Args:
        text: Raw text potentially containing JSON

    Returns:
        Extracted JSON string or None if not found
    """
    if not text:
        return None

    # 1. Try to extract from markdown code blocks
    if "```json" in text:
        parts = text.split("```json")
        if len(parts) >= 2:
            json_part = parts[1].split("```")[0]
            return json_part.strip()

    if "```" in text:
        parts = text.split("```")
        if len(parts) >= 2:
            # Check if the content looks like JSON
            potential_json = parts[1].strip()
            if potential_json.startswith("{") or potential_json.startswith("["):
                return potential_json

    # 2. Find JSON object/array boundaries
    json_start = -1
    for i, char in enumerate(text):
        if char in "{[":
            json_start = i
            break

    if json_start < 0:
        return None

    # Find matching end
    start_char = text[json_start]
    end_char = "}" if start_char == "{" else "]"
    json_end = text.rfind(end_char)

    if json_end <= json_start:
        return None

    return text[json_start:json_end + 1]


def _fix_missing_commas(json_str: str) -> str:
    """
    Fix missing commas between JSON objects/arrays.

    Handles patterns like: [{}{}] -> [{},{}]
    """
    # Fix missing commas between objects: }{ -> },{
    json_str = re.sub(r'\}\s*\{', '},{', json_str)

    # Fix missing commas between arrays: ][ -> ],[
    json_str = re.sub(r'\]\s*\[', '],[', json_str)

    # Fix missing commas after values before objects: "value"{ -> "value",{
    json_str = re.sub(r'"\s*\{', '",{', json_str)
    json_str = re.sub(r'(\d)\s*\{', r'\1,{', json_str)
    json_str = re.sub(r'(true|false|null)\s*\{', r'\1,{', json_str, flags=re.IGNORECASE)

    # Fix missing commas after closing brace/bracket before key: }"key -> },"key
    json_str = re.sub(r'\}\s*"', '},"', json_str)
    json_str = re.sub(r'\]\s*"', '],"', json_str)

    return json_str


def _fix_trailing_commas(json_str: str) -> str:
    """
    Remove trailing commas before closing braces/brackets.

    Handles patterns like: [1,2,] -> [1,2]
    """
    # Remove trailing commas: ,} -> }
    json_str = re.sub(r',\s*([\}\]])', r'\1', json_str)

    return json_str


def _fix_unterminated_strings(json_str: str) -> str:
    """
    Attempt to fix unterminated strings by adding closing quotes.

    This is a best-effort fix for truncated JSON.
    """
    # Count quotes - if odd, try to add closing quote
    quote_count = json_str.count('"') - json_str.count('\\"')
    if quote_count % 2 == 1:
        # Find the last quote and check if it's opening
        last_quote = json_str.rfind('"')
        if last_quote > 0 and json_str[last_quote - 1] != '\\':
            # Check what comes after
            after = json_str[last_quote + 1:].strip()
            if not after or after[0] not in ',:}]':
                # Likely unterminated, add closing quote
                json_str = json_str + '"'

    return json_str


def _try_truncation_recovery(json_str: str) -> Optional[str]:
    """
    Attempt to recover valid JSON from truncated response.

    Strategy: Find the last valid closing brace/bracket at depth 0.
    """
    depth = 0
    in_string = False
    escape_next = False
    last_valid_pos = -1

    for i, char in enumerate(json_str):
        if escape_next:
            escape_next = False
            continue

        if char == '\\':
            escape_next = True
            continue

        if char == '"' and not escape_next:
            in_string = not in_string
            continue

        if in_string:
            continue

        if char == '{' or char == '[':
            depth += 1
        elif char == '}' or char == ']':
            depth -= 1
            if depth == 0:
                last_valid_pos = i
                # Don't break - we want the last valid position

    if last_valid_pos > 0:
        return json_str[:last_valid_pos + 1]

    return None


def robust_json_parse(
    text: str,
    fallback: Optional[Union[Dict, List]] = None
) -> Optional[Union[Dict[str, Any], List[Any]]]:
    """
    Robustly parse JSON from LLM responses.

    Handles common issues:
    - Missing commas between objects: [{}{}] -> [{},{}]
    - Trailing commas: [1,2,] -> [1,2]
    - Code blocks: ```json ... ```
    - Truncated/incomplete JSON

    Args:
        text: Raw text potentially containing JSON
        fallback: Value to return if parsing fails completely

    Returns:
        Parsed JSON as dict/list, or fallback value if parsing fails

    Example:
        >>> robust_json_parse('```json\\n{"key": "value"}\\n```')
        {'key': 'value'}

        >>> robust_json_parse('[{"a":1}{"b":2}]')  # Missing comma
        [{'a': 1}, {'b': 2}]
    """
    if not text:
        return fallback

    # Step 1: Extract JSON from text
    json_str = extract_json_from_text(text)
    if not json_str:
        logger.debug("No JSON found in text")
        return fallback

    # Step 2: Try direct parsing first (most efficient)
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        pass

    # Step 3: Apply fixes in order
    fixed = json_str

    # Fix trailing commas first (most common)
    fixed = _fix_trailing_commas(fixed)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Fix missing commas
    fixed = _fix_missing_commas(fixed)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Fix unterminated strings
    fixed = _fix_unterminated_strings(fixed)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Step 4: Try truncation recovery
    recovered = _try_truncation_recovery(fixed)
    if recovered:
        try:
            return json.loads(recovered)
        except json.JSONDecodeError:
            pass

    # Step 5: Log and return fallback
    logger.warning(f"Failed to parse JSON after all recovery attempts: {text[:200]}...")
    return fallback


def parse_llm_json_response(
    response: str,
    expected_key: Optional[str] = None,
    fallback_list: bool = False
) -> Union[Dict[str, Any], List[Any]]:
    """
    Parse LLM JSON response with specific expectations.

    Args:
        response: Raw LLM response
        expected_key: If provided, extract this key from the result
        fallback_list: If True, return empty list on failure; else empty dict

    Returns:
        Parsed result or fallback value
    """
    fallback = [] if fallback_list else {}
    result = robust_json_parse(response, fallback=fallback)

    if expected_key and isinstance(result, dict):
        return result.get(expected_key, fallback)

    return result
