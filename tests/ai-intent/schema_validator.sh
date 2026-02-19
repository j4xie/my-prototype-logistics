#!/bin/bash

# ============================================================================
# Schema Validator - 数据库Schema验证和SQL生成工具
# ============================================================================
# 用途:
# 1. 查询实际数据库schema
# 2. 验证INSERT语句的列名
# 3. 生成标准INSERT模板
# ============================================================================

set -e

# 配置
DB_HOST="${DB_HOST:-47.100.235.168}"
DB_USER="${DB_USER:-creats-test}"
DB_PASS="${DB_PASS:?请设置环境变量 DB_PASS}"
DB_NAME="${DB_NAME:-creats-test}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_DIR="${SCRIPT_DIR}/.schema_cache"
mkdir -p "$CACHE_DIR"

# ============================================================================
# 查询表结构
# ============================================================================

get_table_schema() {
    local table_name="$1"
    local cache_file="${CACHE_DIR}/${table_name}.schema"

    # 使用缓存(5分钟有效)
    if [ -f "$cache_file" ]; then
        local cache_age=$(($(date +%s) - $(stat -f %m "$cache_file" 2>/dev/null || stat -c %Y "$cache_file" 2>/dev/null)))
        if [ "$cache_age" -lt 300 ]; then
            cat "$cache_file"
            return 0
        fi
    fi

    # 查询schema
    local schema=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" -D "$DB_NAME" -N -e "
        SELECT
            COLUMN_NAME,
            DATA_TYPE,
            IS_NULLABLE,
            COLUMN_DEFAULT,
            COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '$DB_NAME'
          AND TABLE_NAME = '$table_name'
        ORDER BY ORDINAL_POSITION;
    " 2>/dev/null)

    if [ -z "$schema" ]; then
        echo "ERROR: Table '$table_name' not found" >&2
        return 1
    fi

    # 保存缓存
    echo "$schema" > "$cache_file"
    echo "$schema"
}

# ============================================================================
# 获取表的列名列表
# ============================================================================

get_table_columns() {
    local table_name="$1"
    get_table_schema "$table_name" | awk '{print $1}' | tr '\n' ',' | sed 's/,$//'
}

# ============================================================================
# 生成INSERT模板
# ============================================================================

generate_insert_template() {
    local table_name="$1"
    local prefix="${2:-TEST}"

    echo "-- Insert template for $table_name"
    echo "-- Usage: Fill in the VALUES(...) section with your test data"
    echo ""

    local schema=$(get_table_schema "$table_name")
    if [ -z "$schema" ]; then
        return 1
    fi

    # 生成列名部分
    local columns=""
    local values=""
    local first=true

    while IFS=$'\t' read -r col_name data_type is_nullable col_default col_key; do
        # 跳过auto_increment的id列(如果是主键且没有默认值)
        if [ "$col_key" = "PRI" ] && [ "$col_name" = "id" ] && [ -z "$col_default" ]; then
            continue
        fi

        if [ "$first" = false ]; then
            columns="${columns}, "
            values="${values}, "
        fi
        first=false

        columns="${columns}${col_name}"

        # 根据数据类型生成示例值
        case "$data_type" in
            varchar|char|text|enum)
                if [[ "$col_name" =~ created_at|updated_at ]]; then
                    values="${values}NOW()"
                elif [[ "$col_name" =~ _id$ ]] && [ "$col_name" != "id" ]; then
                    values="${values}'${prefix}_REF_ID'"
                else
                    values="${values}'${prefix}_VALUE'"
                fi
                ;;
            int|bigint|smallint|tinyint)
                if [[ "$col_name" =~ _id$ ]]; then
                    values="${values}1"
                else
                    values="${values}100"
                fi
                ;;
            decimal|float|double)
                values="${values}100.00"
                ;;
            date)
                values="${values}'2026-01-16'"
                ;;
            datetime|timestamp)
                if [[ "$col_name" =~ created_at|updated_at ]]; then
                    values="${values}NOW()"
                else
                    values="${values}'2026-01-16 08:00:00'"
                fi
                ;;
            *)
                values="${values}'${prefix}_VALUE'"
                ;;
        esac
    done <<< "$schema"

    echo "INSERT INTO ${table_name} (${columns})"
    echo "VALUES (${values});"
    echo ""
}

# ============================================================================
# 验证INSERT语句
# ============================================================================

validate_insert_sql() {
    local sql="$1"

    # 提取表名
    local table_name=$(echo "$sql" | grep -oP 'INSERT INTO\s+\K\w+' | head -1)
    if [ -z "$table_name" ]; then
        echo "ERROR: Cannot extract table name from SQL" >&2
        return 1
    fi

    # 提取列名
    local columns=$(echo "$sql" | grep -oP '\(\K[^)]+(?=\)\s*VALUES)' | tr -d ' ')
    if [ -z "$columns" ]; then
        echo "ERROR: Cannot extract columns from SQL" >&2
        return 1
    fi

    # 获取实际schema
    local actual_columns=$(get_table_columns "$table_name")
    if [ -z "$actual_columns" ]; then
        return 1
    fi

    # 验证每个列名
    local errors=0
    IFS=',' read -ra COLS <<< "$columns"
    for col in "${COLS[@]}"; do
        if [[ ! ",$actual_columns," =~ ",$col," ]]; then
            echo "ERROR: Column '$col' does not exist in table '$table_name'" >&2
            ((errors++))
        fi
    done

    if [ $errors -eq 0 ]; then
        echo "✅ SQL validation passed for table '$table_name'"
        return 0
    else
        echo "❌ Found $errors invalid columns in SQL" >&2
        echo "Available columns: $actual_columns" >&2
        return 1
    fi
}

# ============================================================================
# 生成常用表的模板
# ============================================================================

generate_common_templates() {
    local output_file="${1:-${SCRIPT_DIR}/sql_templates.txt}"

    local tables=(
        "material_batches"
        "raw_material_types"
        "production_batches"
        "quality_inspections"
        "customers"
    )

    {
        echo "# SQL Templates for Common Tables"
        echo "# Generated: $(date)"
        echo "# Database: $DB_NAME @ $DB_HOST"
        echo ""
        echo "=================================================="
        echo ""

        for table in "${tables[@]}"; do
            generate_insert_template "$table" "TEST"
            echo "=================================================="
            echo ""
        done
    } > "$output_file"

    echo "✅ Templates generated: $output_file"
}

# ============================================================================
# 主函数
# ============================================================================

main() {
    local command="${1:-help}"
    shift || true

    case "$command" in
        schema)
            get_table_schema "$@"
            ;;
        columns)
            get_table_columns "$@"
            ;;
        template)
            generate_insert_template "$@"
            ;;
        validate)
            validate_insert_sql "$@"
            ;;
        generate-templates)
            generate_common_templates "$@"
            ;;
        help|*)
            cat <<EOF
Schema Validator - Usage

Commands:
  schema <table_name>           - Show table schema
  columns <table_name>          - List table columns
  template <table_name> [prefix] - Generate INSERT template
  validate "<sql>"              - Validate INSERT statement
  generate-templates [output]   - Generate templates for common tables

Examples:
  ./schema_validator.sh schema material_batches
  ./schema_validator.sh template material_batches "MB_TEST"
  ./schema_validator.sh validate "INSERT INTO material_batches (id, batch_number) VALUES ('MB_001', 'BATCH-001')"
  ./schema_validator.sh generate-templates

Environment Variables:
  DB_HOST, DB_USER, DB_PASS, DB_NAME

EOF
            ;;
    esac
}

# 如果直接执行脚本
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
