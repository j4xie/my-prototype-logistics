#!/usr/bin/env python3
"""
Export tool definitions from the Cretas AI ToolRegistry.

Extracts tool names, descriptions, and parameter schemas from one of three sources:
  - db:   PostgreSQL tool_embeddings table (name + description only, no params schema)
  - java: Parse Java ToolExecutor source files under ai/tool/impl/ (full schema)
  - api:  Call the Java backend API (if an endpoint exists)

Default source is 'java' since it contains the complete schema definitions.

Usage:
    python export_tool_schemas.py                         # java source, output to data/tool_schemas.json
    python export_tool_schemas.py --source db              # from PostgreSQL
    python export_tool_schemas.py --output my_tools.json   # custom output path
    python export_tool_schemas.py --source java --verbose  # with debug logging
"""

import argparse
import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Project root detection
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent  # scripts/tools/ -> project root
TOOL_IMPL_DIR = PROJECT_ROOT / "backend" / "java" / "cretas-api" / "src" / "main" / "java" / "com" / "cretas" / "aims" / "ai" / "tool" / "impl"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "tool_schemas.json"

# ---------------------------------------------------------------------------
# Database defaults (overridable via env vars)
# ---------------------------------------------------------------------------
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", "5432"))
DB_NAME = os.environ.get("DB_NAME", "cretas_db")
DB_USER = os.environ.get("DB_USER", "cretas_user")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "cretas_pass")


def export_from_db() -> list[dict[str, Any]]:
    """
    Export tool definitions from the PostgreSQL tool_embeddings table.

    Returns a list of dicts with keys: name, description, category, keywords.
    Note: the DB table stores embeddings and metadata but NOT the full JSON Schema
    for parameters -- only the Java source files have that.
    """
    try:
        import psycopg2
    except ImportError:
        logger.error(
            "psycopg2 is not installed. Install it with: pip install psycopg2-binary"
        )
        sys.exit(1)

    logger.info(
        "Connecting to PostgreSQL %s:%s/%s as %s", DB_HOST, DB_PORT, DB_NAME, DB_USER
    )

    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
        )
    except psycopg2.OperationalError as e:
        logger.error("Failed to connect to PostgreSQL: %s", e)
        sys.exit(1)

    tools: list[dict[str, Any]] = []
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT tool_name, tool_description, tool_category, keywords
                FROM tool_embeddings
                ORDER BY tool_name
                """
            )
            rows = cur.fetchall()
            logger.info("Fetched %d rows from tool_embeddings", len(rows))

            for row in rows:
                tool_name, description, category, keywords_raw = row

                # keywords is stored as JSON text in the DB
                keywords = None
                if keywords_raw:
                    try:
                        keywords = (
                            json.loads(keywords_raw)
                            if isinstance(keywords_raw, str)
                            else keywords_raw
                        )
                    except (json.JSONDecodeError, TypeError):
                        keywords = None

                tools.append(
                    {
                        "name": tool_name,
                        "description": description or "",
                        "category": category or "",
                        "keywords": keywords or [],
                        "parameters": {
                            "type": "object",
                            "properties": {},
                            "required": [],
                        },
                    }
                )
    finally:
        conn.close()

    return tools


def _parse_java_string_concat(text: str) -> str:
    """
    Parse a Java string that may use + concatenation across lines.
    e.g.:  "foo" +\n  "bar"  -> "foobar"
    """
    # Remove line continuations and + operators between string literals
    text = text.strip()
    # Match quoted segments and join them
    parts = re.findall(r'"((?:[^"\\]|\\.)*)"', text)
    return "".join(parts)


def _parse_parameters_schema_block(content: str, method_start: int) -> dict[str, Any]:
    """
    Parse the getParametersSchema() method body to extract the JSON Schema.

    This uses a heuristic approach: find all properties.put(...) calls and
    schema.put("required", ...) calls to reconstruct the schema.
    """
    # Find the method body by counting braces
    brace_count = 0
    method_body_start = None
    method_body_end = None

    i = method_start
    while i < len(content):
        if content[i] == "{":
            brace_count += 1
            if method_body_start is None:
                method_body_start = i
        elif content[i] == "}":
            brace_count -= 1
            if brace_count == 0:
                method_body_end = i
                break
        i += 1

    if method_body_start is None or method_body_end is None:
        return {"type": "object", "properties": {}, "required": []}

    body = content[method_body_start:method_body_end + 1]

    schema: dict[str, Any] = {"type": "object", "properties": {}, "required": []}

    # Extract property definitions: properties.put("name", map)
    # Look for property names defined via put("propName", ...)
    prop_names = re.findall(r'properties\.put\(\s*"([^"]+)"', body)

    for prop_name in prop_names:
        prop_info: dict[str, Any] = {}

        # Find the block that defines this property's attributes
        # Look for the variable assignment pattern: Map<...> propName = new HashMap<>();
        # then propName.put("type", "..."); propName.put("description", "...");
        # OR inline patterns like: page.put("type", "integer");

        # Try to find the variable name used for this property
        # Pattern: properties.put("propName", varName)
        var_match = re.search(
            r'properties\.put\(\s*"'
            + re.escape(prop_name)
            + r'"\s*,\s*(\w+)\s*\)',
            body,
        )
        if var_match:
            var_name = var_match.group(1)
            # Now find all var_name.put(...) calls
            type_match = re.search(
                var_name + r'\.put\(\s*"type"\s*,\s*"([^"]+)"', body
            )
            if type_match:
                prop_info["type"] = type_match.group(1)

            desc_match = re.search(
                var_name + r'\.put\(\s*"description"\s*,\s*"([^"]*(?:"[^"]*)*)"', body
            )
            if desc_match:
                raw_desc = desc_match.group(0)
                # Extract the description value (may be concatenated)
                desc_val_match = re.search(
                    r'\.put\(\s*"description"\s*,\s*(.*?)\s*\)\s*;',
                    raw_desc,
                    re.DOTALL,
                )
                if desc_val_match:
                    prop_info["description"] = _parse_java_string_concat(
                        desc_val_match.group(1)
                    )
                else:
                    prop_info["description"] = type_match.group(
                        0
                    ) if type_match else ""

            # Check for default value
            default_match = re.search(
                var_name + r'\.put\(\s*"default"\s*,\s*(.+?)\s*\)', body
            )
            if default_match:
                default_val = default_match.group(1).strip().strip('"')
                # Try to parse as number
                try:
                    prop_info["default"] = int(default_val)
                except ValueError:
                    try:
                        prop_info["default"] = float(default_val)
                    except ValueError:
                        prop_info["default"] = default_val

            # Check for enum values
            enum_match = re.search(
                var_name + r'\.put\(\s*"enum"\s*,\s*(.*?)\s*\)\s*;',
                body,
                re.DOTALL,
            )
            if enum_match:
                enum_vals = re.findall(r'"([^"]+)"', enum_match.group(1))
                if enum_vals:
                    prop_info["enum"] = enum_vals

        if not prop_info:
            prop_info = {"type": "string", "description": prop_name}

        schema["properties"][prop_name] = prop_info

    # Extract required parameters
    # Pattern: schema.put("required", Arrays.asList("param1", "param2"))
    # or: schema.put("required", List.of("param1", "param2"))
    # or: schema.put("required", Collections.emptyList())
    required_match = re.search(
        r'schema\.put\(\s*"required"\s*,\s*(.*?)\s*\)\s*;', body, re.DOTALL
    )
    if required_match:
        required_body = required_match.group(1)
        if "emptyList" not in required_body:
            required_params = re.findall(r'"([^"]+)"', required_body)
            schema["required"] = required_params

    return schema


def export_from_java() -> list[dict[str, Any]]:
    """
    Parse Java ToolExecutor implementation files to extract tool definitions.

    Scans all .java files under ai/tool/impl/ for classes that implement ToolExecutor
    (via AbstractTool or AbstractBusinessTool), and extracts:
      - getToolName() return value
      - getDescription() return value
      - getParametersSchema() structure
    """
    if not TOOL_IMPL_DIR.exists():
        logger.error("Tool impl directory not found: %s", TOOL_IMPL_DIR)
        sys.exit(1)

    java_files = sorted(TOOL_IMPL_DIR.rglob("*.java"))
    logger.info("Found %d Java files in %s", len(java_files), TOOL_IMPL_DIR)

    tools: list[dict[str, Any]] = []

    for java_file in java_files:
        try:
            content = java_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            logger.warning("Skipping file with encoding issues: %s", java_file.name)
            continue

        # Skip non-tool files (test files, abstracts, etc.)
        if "abstract class" in content.lower() and "getToolName" not in content:
            continue

        # Must implement ToolExecutor (directly or via extends AbstractTool/AbstractBusinessTool)
        if not re.search(
            r"(implements\s+ToolExecutor|extends\s+Abstract(Business)?Tool)", content
        ):
            continue

        # Extract tool name from getToolName()
        name_match = re.search(
            r'getToolName\(\)\s*\{[^}]*return\s+"([^"]+)"', content, re.DOTALL
        )
        if not name_match:
            logger.debug("No getToolName() found in %s, skipping", java_file.name)
            continue
        tool_name = name_match.group(1)

        # Extract description from getDescription()
        desc_match = re.search(
            r"getDescription\(\)\s*\{[^}]*return\s+(.*?)\s*;\s*\}",
            content,
            re.DOTALL,
        )
        description = ""
        if desc_match:
            description = _parse_java_string_concat(desc_match.group(1))

        # Extract parameters schema from getParametersSchema()
        schema_match = re.search(r"getParametersSchema\(\)", content)
        parameters: dict[str, Any] = {
            "type": "object",
            "properties": {},
            "required": [],
        }
        if schema_match:
            parameters = _parse_parameters_schema_block(content, schema_match.start())

        # Determine category from file path (subdirectory name)
        rel_path = java_file.relative_to(TOOL_IMPL_DIR)
        category = str(rel_path.parent) if rel_path.parent != Path(".") else "general"

        tools.append(
            {
                "name": tool_name,
                "description": description,
                "category": category,
                "parameters": parameters,
            }
        )
        logger.debug("Parsed tool: %s (%s)", tool_name, java_file.name)

    logger.info("Successfully parsed %d tool definitions from Java sources", len(tools))
    return tools


def export_from_api() -> list[dict[str, Any]]:
    """
    Export tool definitions by calling the Java backend API.

    Attempts to call a health/debug endpoint that might expose tool definitions.
    Falls back to the tool_embeddings approach if no API is available.
    """
    try:
        import requests
    except ImportError:
        logger.error("requests is not installed. Install it with: pip install requests")
        sys.exit(1)

    api_base = os.environ.get("API_BASE_URL", "http://localhost:10010")

    # Try known endpoints that might list tools
    endpoints_to_try = [
        "/api/mobile/ai/tools",
        "/api/mobile/debug/tools",
        "/api/internal/tools",
    ]

    for endpoint in endpoints_to_try:
        url = f"{api_base}{endpoint}"
        logger.info("Trying API endpoint: %s", url)
        try:
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    tools_data = data
                elif isinstance(data, dict) and "data" in data:
                    tools_data = data["data"]
                else:
                    continue

                tools = []
                for item in tools_data:
                    # Handle OpenAI function calling format: {type, function: {name, description, parameters}}
                    if "function" in item:
                        func = item["function"]
                        tools.append(
                            {
                                "name": func.get("name", ""),
                                "description": func.get("description", ""),
                                "parameters": func.get(
                                    "parameters",
                                    {
                                        "type": "object",
                                        "properties": {},
                                        "required": [],
                                    },
                                ),
                            }
                        )
                    else:
                        tools.append(
                            {
                                "name": item.get("name", item.get("toolName", "")),
                                "description": item.get(
                                    "description",
                                    item.get("toolDescription", ""),
                                ),
                                "parameters": item.get(
                                    "parameters",
                                    {
                                        "type": "object",
                                        "properties": {},
                                        "required": [],
                                    },
                                ),
                            }
                        )
                logger.info(
                    "Fetched %d tools from API endpoint %s", len(tools), endpoint
                )
                return tools
        except requests.RequestException as e:
            logger.debug("Endpoint %s failed: %s", endpoint, e)
            continue

    logger.warning(
        "No API endpoint returned tool definitions. "
        "Falling back to Java source parsing."
    )
    return export_from_java()


def main():
    parser = argparse.ArgumentParser(
        description="Export tool definitions from the Cretas AI ToolRegistry.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Sources:
  java  Parse Java source files under ai/tool/impl/ (default, full schema)
  db    Query PostgreSQL tool_embeddings table (name + description only)
  api   Call Java backend API endpoint (falls back to java if unavailable)

Environment variables:
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD  -- PostgreSQL connection
  API_BASE_URL  -- Java backend base URL (default: http://localhost:10010)
        """,
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=str(DEFAULT_OUTPUT),
        help="Output JSON file path (default: data/tool_schemas.json)",
    )
    parser.add_argument(
        "--source",
        "-s",
        choices=["db", "java", "api"],
        default="java",
        help="Data source: db, java, or api (default: java)",
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

    logger.info("Source: %s", args.source)
    logger.info("Output: %s", args.output)

    # Export based on source
    if args.source == "db":
        tools = export_from_db()
    elif args.source == "api":
        tools = export_from_api()
    else:
        tools = export_from_java()

    if not tools:
        logger.warning("No tools found. Output file will contain an empty array.")

    # Ensure output directory exists
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(tools, f, ensure_ascii=False, indent=2)

    logger.info("Exported %d tool schemas to %s", len(tools), output_path)

    # Print summary
    print(f"\n{'='*60}")
    print(f"Export Summary")
    print(f"{'='*60}")
    print(f"  Source:       {args.source}")
    print(f"  Total tools:  {len(tools)}")
    print(f"  Output file:  {output_path}")

    if tools:
        # Group by category
        categories: dict[str, int] = {}
        for t in tools:
            cat = t.get("category", "uncategorized")
            categories[cat] = categories.get(cat, 0) + 1
        print(f"\n  Categories:")
        for cat, count in sorted(categories.items()):
            print(f"    {cat}: {count}")

        # Show tools with parameters
        tools_with_params = sum(
            1
            for t in tools
            if t.get("parameters", {}).get("properties")
        )
        print(f"\n  Tools with parameters: {tools_with_params}")
        print(f"  Tools without parameters: {len(tools) - tools_with_params}")

    print(f"{'='*60}")


if __name__ == "__main__":
    main()
