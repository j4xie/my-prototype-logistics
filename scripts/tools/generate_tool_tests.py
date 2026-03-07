#!/usr/bin/env python3
"""
Generate natural language test cases for Cretas AI tools using DashScope LLM.

Reads tool schemas from data/tool_schemas.json (produced by export_tool_schemas.py)
and uses DashScope qwen3.5 (or configurable model) to generate realistic user queries
that would trigger each tool.

Usage:
    python generate_tool_tests.py                              # defaults
    python generate_tool_tests.py --per-tool 5                 # 5 cases per tool
    python generate_tool_tests.py --dry-run                    # preview without LLM calls
    python generate_tool_tests.py --input custom.json          # custom input
    python generate_tool_tests.py --model qwen-plus            # use different model

Environment variables:
    DASHSCOPE_API_KEY  -- Required. DashScope API key for LLM calls.
"""

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
DEFAULT_INPUT = PROJECT_ROOT / "data" / "tool_schemas.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "tool_test_cases.json"
DEFAULT_MODEL = "qwen3-235b-a22b"
DEFAULT_PER_TOOL = 3

# DashScope OpenAI-compatible endpoint
DASHSCOPE_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"

# Rough token estimates for cost tracking
ESTIMATED_PROMPT_TOKENS_PER_TOOL = 350
ESTIMATED_COMPLETION_TOKENS_PER_TOOL = 400  # per test case batch


def get_api_key() -> str:
    """Get DashScope API key from environment."""
    key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not key:
        logger.error(
            "DASHSCOPE_API_KEY environment variable is not set.\n"
            "Set it via: export DASHSCOPE_API_KEY=sk-..."
        )
        sys.exit(1)
    return key


def _derive_intent_code(tool_name: str) -> str:
    """
    Derive a likely intent code from a tool name.
    Convention: tool name is snake_case, intent code is UPPER_SNAKE_CASE.
    e.g. 'equipment_list' -> 'EQUIPMENT_LIST'
    """
    return tool_name.upper()


def build_prompt(tool: dict[str, Any], num_cases: int) -> str:
    """
    Build the LLM prompt for generating test cases for a single tool.
    """
    tool_name = tool["name"]
    description = tool.get("description", "")
    parameters = tool.get("parameters", {})
    properties = parameters.get("properties", {})
    required = parameters.get("required", [])

    # Build parameter description
    param_lines = []
    for param_name, param_info in properties.items():
        p_type = param_info.get("type", "string")
        p_desc = param_info.get("description", "")
        p_default = param_info.get("default", "")
        req_marker = " (required)" if param_name in required else " (optional)"
        line = f"  - {param_name}: {p_type}{req_marker} -- {p_desc}"
        if p_default:
            line += f" [default: {p_default}]"
        param_lines.append(line)

    params_text = "\n".join(param_lines) if param_lines else "  (no parameters)"
    intent_code = _derive_intent_code(tool_name)

    prompt = f"""You are a test case generator for a Chinese food factory management system (食品溯源系统).

Given the following tool definition, generate exactly {num_cases} natural language test queries in Chinese that a factory worker/manager would realistically say to invoke this tool.

## Tool Definition
- Name: {tool_name}
- Description: {description}
- Intent Code: {intent_code}
- Parameters:
{params_text}

## Requirements
1. Each query must be in natural Chinese (the way a factory employee would speak)
2. Queries should vary in formality: some casual ("帮我查下..."), some formal ("请查询...")
3. Include specific parameter values where the tool has required parameters
4. If the tool has optional parameters, some queries should include them and some should not
5. Each query should be unambiguous and clearly map to this tool
6. Do NOT include any tool names, intent codes, or technical terms in the queries

## Output Format
Return a JSON array of objects. Each object has:
- "query": the natural language query (string, Chinese)
- "expected_params": a dict of expected parameter extractions (use realistic values)

Example output format:
[
  {{"query": "帮我看看设备列表", "expected_params": {{}}}},
  {{"query": "查一下第2页的设备，每页显示10条", "expected_params": {{"page": 2, "size": 10}}}}
]

Return ONLY the JSON array, no markdown fences, no explanation."""

    return prompt


def call_dashscope(
    api_key: str,
    prompt: str,
    model: str = DEFAULT_MODEL,
) -> str:
    """
    Call DashScope LLM API using the OpenAI-compatible endpoint.
    Returns the text content of the response.
    """
    try:
        import requests
    except ImportError:
        logger.error("requests is not installed. Install it with: pip install requests")
        sys.exit(1)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a precise test case generator. "
                    "Return only valid JSON arrays as instructed."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 2000,
        "enable_thinking": False,
    }

    try:
        resp = requests.post(
            DASHSCOPE_API_URL,
            headers=headers,
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return content.strip()
    except requests.RequestException as e:
        logger.error("DashScope API call failed: %s", e)
        if hasattr(e, "response") and e.response is not None:
            logger.error("Response body: %s", e.response.text[:500])
        raise


def parse_llm_response(raw: str) -> list[dict[str, Any]]:
    """
    Parse the LLM response into a list of test case dicts.
    Handles cases where the LLM wraps output in markdown code fences.
    """
    text = raw.strip()
    # Remove markdown code fences if present
    if text.startswith("```"):
        # Remove opening fence (possibly with language tag)
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3].strip()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
        logger.warning("LLM returned non-array JSON, wrapping in list")
        return [parsed]
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse LLM response as JSON: %s", e)
        logger.debug("Raw response: %s", text[:500])
        return []


def generate_dry_run_cases(
    tool: dict[str, Any], num_cases: int
) -> list[dict[str, Any]]:
    """
    Generate placeholder test cases without calling the LLM (for --dry-run mode).
    """
    tool_name = tool["name"]
    description = tool.get("description", "")
    # Take the first sentence of the description as a hint
    hint = description.split("。")[0] if description else tool_name

    cases = []
    templates = [
        f"帮我{hint}",
        f"请查询{hint}相关信息",
        f"我想看看{hint}",
        f"给我查一下{hint}",
        f"显示{hint}",
    ]
    for i in range(min(num_cases, len(templates))):
        cases.append(
            {
                "query": templates[i],
                "expected_params": {},
            }
        )
    return cases


def main():
    parser = argparse.ArgumentParser(
        description="Generate natural language test cases for Cretas AI tools using LLM.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Environment variables:
    DASHSCOPE_API_KEY   Required. DashScope API key.

Examples:
    # Generate 3 test cases per tool (default)
    python generate_tool_tests.py

    # Generate 5 cases per tool with a specific model
    python generate_tool_tests.py --per-tool 5 --model qwen-plus

    # Dry run: see what would be generated without making LLM calls
    python generate_tool_tests.py --dry-run

    # Filter to specific tools
    python generate_tool_tests.py --filter equipment
        """,
    )
    parser.add_argument(
        "--input",
        "-i",
        type=str,
        default=str(DEFAULT_INPUT),
        help="Input tool schemas JSON file (default: data/tool_schemas.json)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=str(DEFAULT_OUTPUT),
        help="Output test cases JSON file (default: data/tool_test_cases.json)",
    )
    parser.add_argument(
        "--per-tool",
        "-n",
        type=int,
        default=DEFAULT_PER_TOOL,
        help=f"Number of test cases per tool (default: {DEFAULT_PER_TOOL})",
    )
    parser.add_argument(
        "--model",
        "-m",
        type=str,
        default=DEFAULT_MODEL,
        help=f"DashScope model to use (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--dry-run",
        "-d",
        action="store_true",
        help="Preview without making LLM calls (generates placeholder cases)",
    )
    parser.add_argument(
        "--filter",
        "-f",
        type=str,
        default=None,
        help="Only generate for tools whose name contains this substring",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable debug logging",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Load input
    input_path = Path(args.input)
    if not input_path.exists():
        logger.error(
            "Input file not found: %s\n"
            "Run export_tool_schemas.py first to generate it.",
            input_path,
        )
        sys.exit(1)

    with open(input_path, "r", encoding="utf-8") as f:
        tools: list[dict[str, Any]] = json.load(f)

    logger.info("Loaded %d tool schemas from %s", len(tools), input_path)

    # Apply filter
    if args.filter:
        tools = [t for t in tools if args.filter.lower() in t["name"].lower()]
        logger.info("After filter '%s': %d tools", args.filter, len(tools))

    if not tools:
        logger.warning("No tools to process. Exiting.")
        sys.exit(0)

    # Estimate tokens
    total_prompt_tokens = len(tools) * ESTIMATED_PROMPT_TOKENS_PER_TOOL
    total_completion_tokens = (
        len(tools) * args.per_tool * ESTIMATED_COMPLETION_TOKENS_PER_TOOL
    )
    total_estimated_tokens = total_prompt_tokens + total_completion_tokens

    print(f"\n{'='*60}")
    print(f"Test Case Generation Plan")
    print(f"{'='*60}")
    print(f"  Tools to process:     {len(tools)}")
    print(f"  Cases per tool:       {args.per_tool}")
    print(f"  Total cases:          ~{len(tools) * args.per_tool}")
    print(f"  Model:                {args.model}")
    print(f"  Dry run:              {args.dry_run}")
    print(f"  Est. prompt tokens:   ~{total_prompt_tokens:,}")
    print(f"  Est. completion tokens: ~{total_completion_tokens:,}")
    print(f"  Est. total tokens:    ~{total_estimated_tokens:,}")
    print(f"{'='*60}\n")

    if not args.dry_run:
        api_key = get_api_key()
    else:
        api_key = ""

    # Generate test cases
    all_results: list[dict[str, Any]] = []
    total_cases = 0
    failures = 0
    start_time = time.time()

    for idx, tool in enumerate(tools, 1):
        tool_name = tool["name"]
        intent_code = _derive_intent_code(tool_name)
        logger.info(
            "[%d/%d] Generating %d cases for: %s",
            idx,
            len(tools),
            args.per_tool,
            tool_name,
        )

        if args.dry_run:
            cases = generate_dry_run_cases(tool, args.per_tool)
        else:
            prompt = build_prompt(tool, args.per_tool)
            logger.debug("Prompt length: %d chars", len(prompt))

            try:
                raw_response = call_dashscope(api_key, prompt, args.model)
                cases = parse_llm_response(raw_response)
                if not cases:
                    logger.warning("No valid cases parsed for %s", tool_name)
                    failures += 1
                    cases = []
            except Exception as e:
                logger.error("Failed to generate cases for %s: %s", tool_name, e)
                failures += 1
                cases = []

            # Rate limiting: brief pause between API calls
            if idx < len(tools):
                time.sleep(0.5)

        # Attach intent code to each case
        for case in cases:
            case["expected_intent"] = intent_code

        tool_result = {
            "tool_name": tool_name,
            "description": tool.get("description", ""),
            "category": tool.get("category", ""),
            "test_cases": cases,
        }
        all_results.append(tool_result)
        total_cases += len(cases)

    elapsed = time.time() - start_time

    # Write output
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    # Print summary
    print(f"\n{'='*60}")
    print(f"Generation Summary")
    print(f"{'='*60}")
    print(f"  Total tools processed:  {len(tools)}")
    print(f"  Total test cases:       {total_cases}")
    print(f"  Failed tools:           {failures}")
    print(f"  Elapsed time:           {elapsed:.1f}s")
    print(f"  Output file:            {output_path}")
    if not args.dry_run:
        print(f"  Est. tokens used:       ~{total_estimated_tokens:,}")
    print(f"{'='*60}")

    if failures > 0:
        logger.warning(
            "%d tool(s) failed to generate test cases. "
            "Check logs for details.",
            failures,
        )


if __name__ == "__main__":
    main()
