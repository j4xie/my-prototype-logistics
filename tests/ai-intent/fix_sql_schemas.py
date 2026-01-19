#!/usr/bin/env python3
"""
批量修正测试用例中的SQL语句,使其符合正确的schema
"""
import json
import re
from typing import Dict, List

# 正确的Schema定义(从sql_templates.txt提取)
CORRECT_SCHEMAS = {
    'material_batches': {
        'columns': [
            'id', 'created_at', 'deleted_at', 'updated_at', 'batch_number',
            'created_by', 'expire_date', 'factory_id', 'last_used_at',
            'material_type_id', 'notes', 'production_date', 'purchase_date',
            'quality_certificate', 'quantity_unit', 'inbound_date',
            'receipt_quantity', 'reserved_quantity', 'status', 'storage_location',
            'supplier_id', 'unit_price', 'used_quantity', 'weight_per_unit'
        ]
    },
    'raw_material_types': {
        'columns': [
            'id', 'created_at', 'deleted_at', 'updated_at', 'category', 'code',
            'created_by', 'factory_id', 'is_active', 'max_stock', 'min_stock',
            'name', 'notes', 'shelf_life_days', 'storage_type', 'unit', 'unit_price'
        ]
    },
    'production_batches': {
        'columns': [
            'id', 'created_at', 'deleted_at', 'updated_at', 'actual_quantity',
            'batch_number', 'created_by', 'defect_quantity', 'efficiency',
            'end_time', 'equipment_cost', 'equipment_id', 'equipment_name',
            'factory_id', 'good_quantity', 'labor_cost', 'material_cost', 'notes',
            'other_cost', 'planned_quantity', 'product_name', 'product_type_id',
            'production_plan_id', 'quality_status', 'quantity', 'start_time',
            'status', 'supervisor_id', 'supervisor_name', 'total_cost', 'unit',
            'unit_cost', 'work_duration_minutes', 'worker_count', 'yield_rate',
            'photo_completed_stages', 'photo_required', 'sop_config_id'
        ]
    },
    'quality_inspections': {
        'columns': [
            'id', 'created_at', 'deleted_at', 'updated_at', 'factory_id',
            'fail_count', 'inspection_date', 'inspector_id', 'notes',
            'pass_count', 'pass_rate', 'production_batch_id', 'result', 'sample_size'
        ]
    },
    'customers': {
        'columns': [
            'id', 'created_at', 'deleted_at', 'updated_at', 'billing_address',
            'business_license', 'code', 'contact_email', 'contact_name',
            'contact_person', 'contact_phone', 'created_by', 'credit_limit',
            'current_balance', 'customer_code', 'email', 'factory_id', 'industry',
            'is_active', 'name', 'notes', 'payment_terms', 'phone', 'rating',
            'rating_notes', 'shipping_address', 'tax_number', 'type'
        ]
    }
}

# 字段名修正映射
FIELD_CORRECTIONS = {
    'material_name': 'name',
    'customer_name': 'name',
    'material_category': 'category',
}

# 需要删除的不存在字段
INVALID_FIELDS = ['equipment_type', 'severity', 'alert_level']


def fix_insert_statement(sql: str, table_name: str) -> str:
    """
    修正单个INSERT语句
    """
    if not sql or table_name not in CORRECT_SCHEMAS:
        return sql

    # 使用更精确的正则来匹配嵌套括号
    # 首先找到VALUES关键字的位置
    values_pos = re.search(r'\bVALUES\s*\(', sql, re.IGNORECASE)
    if not values_pos:
        return sql

    # 提取列名部分
    columns_part = sql[:values_pos.start()]
    pattern = r'INSERT INTO ' + table_name + r'\s*\((.*?)\)'
    match = re.search(pattern, columns_part, re.IGNORECASE | re.DOTALL)

    if not match:
        return sql

    columns_str = match.group(1)

    # 提取VALUES部分 - 从VALUES关键字开始到结尾
    values_part = sql[values_pos.start():]

    # 找到VALUES后的括号内容
    # 需要处理嵌套括号和引号
    paren_count = 0
    in_quotes = False
    quote_char = None
    values_content = []
    start_idx = -1

    for i, char in enumerate(values_part):
        if char in ('"', "'") and (i == 0 or values_part[i-1] != '\\'):
            if not in_quotes:
                in_quotes = True
                quote_char = char
            elif char == quote_char:
                in_quotes = False
                quote_char = None

        if not in_quotes:
            if char == '(':
                if paren_count == 0:
                    start_idx = i + 1
                paren_count += 1
            elif char == ')':
                paren_count -= 1
                if paren_count == 0 and start_idx != -1:
                    values_content.append(values_part[start_idx:i])
                    break

    if not values_content:
        return sql

    values_str = values_content[0]

    # 分割列名
    columns = [col.strip() for col in columns_str.split(',')]

    # 修正列名
    corrected_columns = []
    for col in columns:
        # 应用字段名修正
        if col in FIELD_CORRECTIONS:
            corrected_columns.append(FIELD_CORRECTIONS[col])
        # 跳过不存在的字段
        elif col in INVALID_FIELDS:
            continue
        # 验证字段是否在schema中
        elif col in CORRECT_SCHEMAS[table_name]['columns']:
            corrected_columns.append(col)
        else:
            # 字段不在schema中,尝试修正
            print(f"Warning: Column '{col}' not in {table_name} schema")
            corrected_columns.append(col)

    # 重构INSERT语句
    new_sql = f"INSERT INTO {table_name} ({', '.join(corrected_columns)}) VALUES ({values_str})"

    return new_sql


def fix_sql_in_test_case(test_case: Dict) -> Dict:
    """
    修正单个测试用例中的SQL
    """
    if 'testDataSetup' not in test_case:
        return test_case

    setup = test_case['testDataSetup']

    # 如果sql字段为空或null,不处理
    if not setup.get('sql'):
        return test_case

    sql = setup['sql']

    # 分割多个SQL语句
    statements = [s.strip() for s in sql.split(';') if s.strip()]

    fixed_statements = []
    for stmt in statements:
        # 检测是INSERT语句
        if stmt.upper().startswith('INSERT INTO'):
            # 提取表名
            table_match = re.search(r'INSERT INTO\s+(\w+)', stmt, re.IGNORECASE)
            if table_match:
                table_name = table_match.group(1)
                # 修正时间格式 - 确保使用完整的datetime格式
                stmt = re.sub(r"'(\d{4}-\d{2}-\d{2})'(?!\s*\d{2}:\d{2}:\d{2})", r"'\1 00:00:00'", stmt)
                # 修正INSERT语句
                fixed_stmt = fix_insert_statement(stmt, table_name)
                fixed_statements.append(fixed_stmt)
            else:
                fixed_statements.append(stmt)
        else:
            fixed_statements.append(stmt)

    # 重新组合SQL
    test_case['testDataSetup']['sql'] = '; '.join(fixed_statements) + ';'

    return test_case


def process_test_file(input_file: str, output_file: str = None):
    """
    处理整个测试文件
    """
    if output_file is None:
        output_file = input_file.replace('.json', '.fixed.json')

    print(f"Processing {input_file}...")

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 处理每个测试用例
        if 'testCases' in data:
            for i, test_case in enumerate(data['testCases']):
                data['testCases'][i] = fix_sql_in_test_case(test_case)
                if (i + 1) % 10 == 0:
                    print(f"  Processed {i + 1} test cases...")

        # 保存修正后的文件
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"✓ Saved to {output_file}")
        print(f"  Total test cases: {len(data.get('testCases', []))}")

    except Exception as e:
        print(f"✗ Error processing {input_file}: {e}")
        import traceback
        traceback.print_exc()


def main():
    """
    批量处理所有测试文件
    """
    test_files = [
        'test-cases-phase1-30.json',
        'test-cases-p0-remaining-140.json',
        'test-cases-p1-complete-165.json',
        'test-cases-p2p3-complete-165.json'
    ]

    print("=" * 60)
    print("SQL Schema Fixer for Test Cases")
    print("=" * 60)
    print()

    for test_file in test_files:
        process_test_file(test_file)
        print()

    print("=" * 60)
    print("All files processed successfully!")
    print("=" * 60)


if __name__ == '__main__':
    main()
