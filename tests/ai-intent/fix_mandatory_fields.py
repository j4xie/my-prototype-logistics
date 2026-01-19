#!/usr/bin/env python3
"""
Fix mandatory fields in test case SQL statements
"""
import json
import re
import sys
from typing import Dict, List

# Mandatory fields for each table (NOT NULL without defaults)
MANDATORY_FIELDS = {
    'raw_material_types': {
        'required': ['id', 'created_at', 'updated_at', 'code', 'created_by', 'factory_id', 'is_active', 'name', 'unit'],
        'defaults': {
            'id': "'MT_{}_001'",
            'created_at': 'NOW()',
            'updated_at': 'NOW()',
            'code': "'MT_CODE_{}'",
            'created_by': '1',
            'factory_id': "'F001'",
            'is_active': '1',
            'name': "'测试原料_{}'",
            'unit': "'kg'"
        }
    },
    'material_batches': {
        'required': ['id', 'created_at', 'updated_at', 'batch_number', 'created_by', 'factory_id',
                     'material_type_id', 'quantity_unit', 'inbound_date', 'receipt_quantity',
                     'reserved_quantity', 'status', 'used_quantity'],
        'defaults': {
            'id': "'MB_{}_001'",
            'created_at': 'NOW()',
            'updated_at': 'NOW()',
            'batch_number': "'BATCH-{}-001'",
            'created_by': '1',
            'factory_id': "'F001'",
            'material_type_id': "'MT_001'",
            'quantity_unit': "'kg'",
            'inbound_date': 'CURDATE()',
            'receipt_quantity': '1000.00',
            'reserved_quantity': '0.00',
            'status': "'AVAILABLE'",
            'used_quantity': '0.00'
        }
    },
    'production_batches': {
        'required': ['id', 'created_at', 'updated_at', 'batch_number', 'factory_id',
                     'product_type_id', 'quantity', 'status', 'unit'],
        'defaults': {
            'id': '{}',
            'created_at': 'NOW()',
            'updated_at': 'NOW()',
            'batch_number': "'PB-{}-001'",
            'factory_id': "'F001'",
            'product_type_id': "'PT_001'",
            'quantity': '1000.00',
            'status': "'COMPLETED'",
            'unit': "'kg'"
        }
    },
    'quality_inspections': {
        'required': ['id', 'created_at', 'updated_at', 'factory_id', 'fail_count',
                     'inspection_date', 'inspector_id', 'pass_count', 'production_batch_id', 'sample_size'],
        'defaults': {
            'id': "'QI_{}_001'",
            'created_at': 'NOW()',
            'updated_at': 'NOW()',
            'factory_id': "'F001'",
            'fail_count': '0.00',
            'inspection_date': 'CURDATE()',
            'inspector_id': '1',
            'pass_count': '100.00',
            'production_batch_id': '1',
            'sample_size': '100.00'
        }
    },
    'customers': {
        'required': ['id', 'created_at', 'updated_at', 'code', 'created_by',
                     'customer_code', 'factory_id', 'is_active', 'name'],
        'defaults': {
            'id': "'CUST_{}_001'",
            'created_at': 'NOW()',
            'updated_at': 'NOW()',
            'code': "'CUST_CODE_{}'",
            'created_by': '1',
            'customer_code': "'CC_{}'",
            'factory_id': "'F001'",
            'is_active': '1',
            'name': "'测试客户_{}'"
        }
    }
}

def extract_table_name(sql: str) -> str:
    """Extract table name from INSERT statement"""
    match = re.search(r'INSERT\s+INTO\s+(\w+)', sql, re.IGNORECASE)
    return match.group(1) if match else None

def parse_insert_statement(sql: str) -> tuple:
    """Parse INSERT statement to extract columns and values"""
    # Match: INSERT INTO table (col1, col2) VALUES (val1, val2)
    # Use a more careful regex that properly handles nested parentheses
    match = re.search(
        r'INSERT\s+INTO\s+(\w+)\s*\((.*?)\)\s*VALUES\s*\((.*)\)',
        sql,
        re.IGNORECASE | re.DOTALL
    )

    if not match:
        return None, None, None

    table = match.group(1)
    columns = [c.strip() for c in match.group(2).split(',')]

    # Parse values more carefully (handle commas in strings and function calls)
    value_str = match.group(3).strip()
    # Remove trailing semicolon if present
    if value_str.endswith(';'):
        value_str = value_str[:-1].strip()

    values = []
    current_val = ""
    in_quotes = False
    quote_char = None
    paren_depth = 0

    for char in value_str:
        if char in ("'", '"') and (not in_quotes or char == quote_char):
            in_quotes = not in_quotes
            quote_char = char if in_quotes else None
            current_val += char
        elif char == '(' and not in_quotes:
            paren_depth += 1
            current_val += char
        elif char == ')' and not in_quotes:
            paren_depth -= 1
            current_val += char
        elif char == ',' and not in_quotes and paren_depth == 0:
            values.append(current_val.strip())
            current_val = ""
        else:
            current_val += char

    if current_val.strip():
        values.append(current_val.strip())

    return table, columns, values

def generate_complete_insert(table: str, existing_columns: List[str], existing_values: List[str], test_id: str) -> str:
    """Generate complete INSERT with all mandatory fields"""
    if table not in MANDATORY_FIELDS:
        # Return original if table not in our list
        return None

    config = MANDATORY_FIELDS[table]
    required_fields = config['required']
    defaults = config['defaults']

    # Build column-value mapping from existing
    col_val_map = {}
    for col, val in zip(existing_columns, existing_values):
        col_val_map[col] = val

    # Add missing mandatory fields with defaults
    counter = test_id.split('-')[-1] if '-' in test_id else '001'

    for field in required_fields:
        if field not in col_val_map:
            default_template = defaults.get(field, "'DEFAULT'")
            # Replace {} with counter for dynamic values
            if '{}' in default_template:
                col_val_map[field] = default_template.replace('{}', counter)
            else:
                col_val_map[field] = default_template

    # Generate new INSERT statement
    all_columns = [col for col in required_fields if col in col_val_map]
    all_values = [col_val_map[col] for col in all_columns]

    # Add optional fields that were in original
    for col, val in col_val_map.items():
        if col not in all_columns:
            all_columns.append(col)
            all_values.append(val)

    new_sql = f"INSERT INTO {table} ({', '.join(all_columns)}) VALUES ({', '.join(all_values)});"
    return new_sql

def fix_test_case_sql(test_case: dict) -> bool:
    """Fix SQL in a single test case"""
    if 'testDataSetup' not in test_case or 'sql' not in test_case['testDataSetup']:
        return False

    sql = test_case['testDataSetup']['sql']
    if not sql or sql == 'null':
        return False

    # Handle multiple SQL statements separated by semicolons
    statements = [s.strip() for s in sql.split(';') if s.strip()]
    fixed_statements = []
    changed = False

    for stmt in statements:
        if not stmt.upper().startswith('INSERT'):
            fixed_statements.append(stmt)
            continue

        table, columns, values = parse_insert_statement(stmt)

        if not table or not columns or not values:
            fixed_statements.append(stmt)
            continue

        if table in MANDATORY_FIELDS:
            test_id = test_case.get('id', '001')
            new_sql = generate_complete_insert(table, columns, values, test_id)

            if new_sql:
                fixed_statements.append(new_sql.rstrip(';'))
                changed = True
            else:
                fixed_statements.append(stmt)
        else:
            fixed_statements.append(stmt)

    if changed:
        test_case['testDataSetup']['sql'] = ' '.join(fixed_statements) + ';'

    return changed

def fix_test_file(input_file: str, output_file: str = None):
    """Fix all test cases in a JSON file"""
    if output_file is None:
        output_file = input_file

    print(f"Processing {input_file}...")

    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if 'testCases' not in data:
        print("No testCases found in file")
        return

    fixed_count = 0
    total_count = len(data['testCases'])

    for test_case in data['testCases']:
        if fix_test_case_sql(test_case):
            fixed_count += 1

    # Write back
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Fixed {fixed_count}/{total_count} test cases")
    print(f"Output written to {output_file}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 fix_mandatory_fields.py <test_case_file.json> [output_file.json]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file

    fix_test_file(input_file, output_file)
