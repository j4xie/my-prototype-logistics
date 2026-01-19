#!/usr/bin/env python3
"""
Fix the 6 failing tests in Phase 1
"""
import json

def fix_test_case(test_case):
    """Fix SQL for specific failing test cases"""
    test_id = test_case.get('id', '')

    if 'testDataSetup' not in test_case or 'sql' not in test_case['testDataSetup']:
        return False

    sql = test_case['testDataSetup']['sql']
    if not sql:
        return False

    changed = False

    # Fix EQUIPMENT tests (TC-P1-EQUIPMENT-001, TC-P1-EQUIPMENT-002, TC-P2-SCALE-001)
    if test_id in ['TC-P1-EQUIPMENT-001', 'TC-P1-EQUIPMENT-002', 'TC-P2-SCALE-001']:
        # Replace equipment_type with type
        if 'equipment_type' in sql:
            sql = sql.replace('equipment_type', 'type')
            changed = True

        # Add missing mandatory fields: code, created_by
        if 'factory_equipment' in sql and 'code,' not in sql:
            # Find the INSERT INTO factory_equipment pattern
            if 'INSERT INTO factory_equipment (' in sql:
                # Add code and created_by to column list
                sql = sql.replace(
                    'INSERT INTO factory_equipment (id, factory_id, equipment_code,',
                    'INSERT INTO factory_equipment (id, created_at, updated_at, code, created_by, factory_id, equipment_code,'
                )

                # For each VALUES clause, need to add corresponding values
                # VALUES (8001, 'F001', 'EQ-001', ...)
                # Need to become: VALUES (8001, NOW(), NOW(), 'CODE_8001', 1, 'F001', 'EQ-001', ...)

                parts = sql.split('VALUES')
                if len(parts) == 2:
                    column_part = parts[0]
                    values_part = parts[1]

                    # Process each value tuple
                    import re
                    value_tuples = re.findall(r'\((\d+),\s*\'([^\']+)\',\s*\'([^\']+)\',\s*\'([^\']+)\',\s*\'([^\']+)\',\s*\'([^\']+)\',\s*NOW\(\),\s*NOW\(\)\)', values_part)

                    if value_tuples:
                        new_values = []
                        for tuple_data in value_tuples:
                            eq_id, factory_id, eq_code, eq_name, eq_type, status = tuple_data
                            new_tuple = f"({eq_id}, NOW(), NOW(), 'CODE_{eq_id}', 1, '{factory_id}', '{eq_code}', '{eq_name}', '{eq_type}', '{status}')"
                            new_values.append(new_tuple)

                        sql = column_part + 'VALUES ' + ', '.join(new_values) + ';'
                        changed = True

    # Fix ALERT tests (TC-P1-ALERT-001, TC-P1-ALERT-002, TC-P2-ALERT-003)
    if test_id in ['TC-P1-ALERT-001', 'TC-P1-ALERT-002', 'TC-P2-ALERT-003']:
        # Replace severity with level
        if 'severity' in sql:
            sql = sql.replace('severity', 'level')
            changed = True

        # Add triggered_at field
        if 'equipment_alerts' in sql and 'triggered_at' not in sql:
            # Add triggered_at to column list (after status, before created_at)
            sql = sql.replace(
                'status, created_at',
                'status, triggered_at, created_at'
            )

            # Add NOW() to each VALUES tuple (after status value, before NOW() for created_at)
            sql = sql.replace(
                '\'ACTIVE\', NOW()',
                '\'ACTIVE\', NOW(), NOW()'
            )
            changed = True

    if changed:
        test_case['testDataSetup']['sql'] = sql

    return changed

def main():
    filename = 'test-cases-phase1-30.json'

    print(f"Processing {filename}...")

    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if 'testCases' not in data:
        print("No testCases found")
        return

    fixed_count = 0
    target_ids = [
        'TC-P1-EQUIPMENT-001', 'TC-P1-EQUIPMENT-002',
        'TC-P1-ALERT-001', 'TC-P1-ALERT-002', 'TC-P2-ALERT-003',
        'TC-P2-SCALE-001'
    ]

    for test_case in data['testCases']:
        if test_case.get('id') in target_ids:
            if fix_test_case(test_case):
                fixed_count += 1
                print(f"✓ Fixed {test_case['id']}")

    # Write back
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nFixed {fixed_count}/6 test cases")
    print(f"Output written to {filename}")

if __name__ == '__main__':
    main()
