"""Quick test to verify metric calculator fixes."""
import sys
sys.path.insert(0, 'C:/Users/Steve/my-prototype-logistics/smartbi')

from services.metric_calculator import MetricCalculator
import pandas as pd

def main():
    calc = MetricCalculator()
    passed = 0
    total = 0

    # Test 1: COUNT(*) handling
    total += 1
    formula = 'SUM(金额) / COUNT(*)'
    converted = calc._convert_sql_to_pandas(formula)
    test1_pass = 'ROWCOUNT()' in converted
    print(f'Test 1 - COUNT(*) conversion:')
    print(f'  Input:  {formula}')
    print(f'  Output: {converted}')
    print(f'  Result: {"PASS" if test1_pass else "FAIL"}')
    if test1_pass:
        passed += 1

    # Test 2: Formula validation with numeric expression
    total += 1
    is_valid = calc._validate_formula_ready('100.0 - 50.0')
    print(f'\nTest 2 - Formula validation (valid):')
    print(f'  Input:  100.0 - 50.0')
    print(f'  Valid: {is_valid}')
    print(f'  Result: {"PASS" if is_valid else "FAIL"}')
    if is_valid:
        passed += 1

    # Test 3: Formula validation with unresolved reference
    total += 1
    is_invalid = not calc._validate_formula_ready('销售额 / 100.0')
    print(f'\nTest 3 - Formula validation (invalid):')
    print(f'  Input:  销售额 / 100.0')
    print(f'  Invalid: {is_invalid}')
    print(f'  Result: {"PASS" if is_invalid else "FAIL"}')
    if is_invalid:
        passed += 1

    # Test 4: SQL syntax detection - CASE WHEN
    total += 1
    sql_formula = 'SUM(CASE WHEN type=1 THEN amount END)'
    is_not_calculable = not calc._is_formula_calculable(sql_formula)
    print(f'\nTest 4 - SQL CASE WHEN detection:')
    print(f'  Input:  {sql_formula}')
    print(f'  Blocked: {is_not_calculable}')
    print(f'  Result: {"PASS" if is_not_calculable else "FAIL"}')
    if is_not_calculable:
        passed += 1

    # Test 5: SQL syntax detection - simple formula should pass
    total += 1
    simple_formula = 'SUM(金额) - SUM(成本)'
    is_calculable = calc._is_formula_calculable(simple_formula)
    print(f'\nTest 5 - Simple formula allowed:')
    print(f'  Input:  {simple_formula}')
    print(f'  Calculable: {is_calculable}')
    print(f'  Result: {"PASS" if is_calculable else "FAIL"}')
    if is_calculable:
        passed += 1

    print(f'\n{"="*40}')
    print(f'Summary: {passed}/{total} tests passed')
    print(f'{"="*40}')

    return 0 if passed == total else 1

if __name__ == '__main__':
    sys.exit(main())
