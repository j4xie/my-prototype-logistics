#!/usr/bin/env python3
"""
MySQL to PostgreSQL Data Migration Script
Migrates data from MySQL (creats-test) to PostgreSQL (cretas_db)
"""

import pymysql
import psycopg2
from psycopg2 import sql
import sys
import json
from datetime import datetime, date
from decimal import Decimal

# MySQL Configuration
MYSQL_CONFIG = {
    'host': 'localhost',
    'user': 'creats-test',
    'password': 'R8mwtyFEDMDPBwC8',
    'database': 'creats-test',
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}

# PostgreSQL Configuration
PG_CONFIG = {
    'host': 'localhost',
    'user': 'cretas_user',
    'password': 'Cretas2026Pg',
    'database': 'cretas_db',
    'port': 5432
}

# MySQL to PostgreSQL type mapping
TYPE_MAPPING = {
    'tinyint(1)': 'BOOLEAN',
    'tinyint': 'SMALLINT',
    'smallint': 'SMALLINT',
    'mediumint': 'INTEGER',
    'int': 'INTEGER',
    'bigint': 'BIGINT',
    'float': 'REAL',
    'double': 'DOUBLE PRECISION',
    'decimal': 'DECIMAL',
    'varchar': 'VARCHAR',
    'char': 'CHAR',
    'text': 'TEXT',
    'mediumtext': 'TEXT',
    'longtext': 'TEXT',
    'tinytext': 'TEXT',
    'blob': 'BYTEA',
    'mediumblob': 'BYTEA',
    'longblob': 'BYTEA',
    'datetime': 'TIMESTAMP',
    'timestamp': 'TIMESTAMP',
    'date': 'DATE',
    'time': 'TIME',
    'json': 'JSONB',
    'enum': 'VARCHAR(50)',
}

def get_mysql_connection():
    return pymysql.connect(**MYSQL_CONFIG)

def get_pg_connection():
    return psycopg2.connect(**PG_CONFIG)

def get_tables(mysql_conn):
    """Get list of all tables from MySQL"""
    with mysql_conn.cursor() as cursor:
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """, (MYSQL_CONFIG['database'],))
        return [row['table_name'] for row in cursor.fetchall()]

def get_table_columns(mysql_conn, table_name):
    """Get column information for a table"""
    with mysql_conn.cursor() as cursor:
        cursor.execute("""
            SELECT column_name, data_type, column_type, is_nullable,
                   column_default, column_key, extra
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (MYSQL_CONFIG['database'], table_name))
        return cursor.fetchall()

def convert_mysql_type(mysql_type, column_type):
    """Convert MySQL type to PostgreSQL type"""
    mysql_type = mysql_type.lower()
    column_type = column_type.lower()

    # Handle tinyint(1) as boolean
    if 'tinyint(1)' in column_type:
        return 'BOOLEAN'

    # Handle enum
    if mysql_type == 'enum':
        return 'VARCHAR(100)'

    # Handle varchar/char with length
    if mysql_type in ('varchar', 'char'):
        import re
        match = re.search(r'\((\d+)\)', column_type)
        if match:
            length = match.group(1)
            return f'{mysql_type.upper()}({length})'

    # Handle decimal with precision
    if mysql_type == 'decimal':
        import re
        match = re.search(r'\((\d+),(\d+)\)', column_type)
        if match:
            return f'DECIMAL({match.group(1)},{match.group(2)})'

    return TYPE_MAPPING.get(mysql_type, 'TEXT')

def create_table_ddl(table_name, columns):
    """Generate PostgreSQL CREATE TABLE DDL"""
    col_defs = []
    primary_keys = []

    for col in columns:
        col_name = col['column_name']
        pg_type = convert_mysql_type(col['data_type'], col['column_type'])
        nullable = 'NULL' if col['is_nullable'] == 'YES' else 'NOT NULL'

        # Handle auto_increment
        if 'auto_increment' in col.get('extra', '').lower():
            if 'bigint' in col['column_type'].lower():
                pg_type = 'BIGSERIAL'
            else:
                pg_type = 'SERIAL'
            nullable = ''  # SERIAL implies NOT NULL

        # Handle primary key
        if col['column_key'] == 'PRI':
            primary_keys.append(col_name)

        # Handle default values
        default = ''
        if col['column_default'] is not None:
            default_val = col['column_default']
            if default_val == 'CURRENT_TIMESTAMP':
                default = 'DEFAULT CURRENT_TIMESTAMP'
            elif pg_type == 'BOOLEAN':
                default = f"DEFAULT {'TRUE' if default_val == '1' else 'FALSE'}"
            elif 'INT' in pg_type or 'SERIAL' in pg_type or 'DECIMAL' in pg_type:
                default = f"DEFAULT {default_val}"
            else:
                default = f"DEFAULT '{default_val}'"

        col_def = f'    "{col_name}" {pg_type} {nullable} {default}'.strip()
        col_defs.append(col_def)

    ddl = f'CREATE TABLE IF NOT EXISTS "{table_name}" (\n'
    ddl += ',\n'.join(col_defs)

    if primary_keys:
        pk_list = ", ".join(['"{}"'.format(pk) for pk in primary_keys])
        ddl += ',\n    PRIMARY KEY ({})'.format(pk_list)

    ddl += '\n);'
    return ddl

def convert_value(value, pg_type):
    """Convert a MySQL value to PostgreSQL compatible value"""
    if value is None:
        return None

    if pg_type == 'BOOLEAN':
        return bool(value) if isinstance(value, int) else value

    if isinstance(value, datetime):
        return value

    if isinstance(value, date):
        return value

    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, bytes):
        return psycopg2.Binary(value)

    if isinstance(value, dict) or isinstance(value, list):
        return json.dumps(value)

    return value

def migrate_table_data(mysql_conn, pg_conn, table_name, columns, batch_size=1000):
    """Migrate data from MySQL to PostgreSQL"""
    col_names = [col['column_name'] for col in columns]
    pg_types = [convert_mysql_type(col['data_type'], col['column_type']) for col in columns]

    # Count rows
    with mysql_conn.cursor() as cursor:
        cursor.execute(f'SELECT COUNT(*) as cnt FROM `{table_name}`')
        total_rows = cursor.fetchone()['cnt']

    if total_rows == 0:
        return 0

    print(f"    Migrating {total_rows} rows...")

    # Read and insert in batches
    offset = 0
    migrated = 0

    with mysql_conn.cursor() as mysql_cursor:
        with pg_conn.cursor() as pg_cursor:
            while offset < total_rows:
                mysql_cursor.execute(f'SELECT * FROM `{table_name}` LIMIT {batch_size} OFFSET {offset}')
                rows = mysql_cursor.fetchall()

                if not rows:
                    break

                # Prepare insert statement
                placeholders = ', '.join(['%s'] * len(col_names))
                col_list = ', '.join(['"{}"'.format(c) for c in col_names])
                insert_sql = f'INSERT INTO "{table_name}" ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'

                for row in rows:
                    values = []
                    for i, col_name in enumerate(col_names):
                        value = convert_value(row.get(col_name), pg_types[i])
                        values.append(value)

                    try:
                        pg_cursor.execute(insert_sql, values)
                        migrated += 1
                    except Exception as e:
                        print(f"      Error inserting row: {e}")
                        continue

                pg_conn.commit()
                offset += batch_size
                print(f"      Progress: {min(offset, total_rows)}/{total_rows}")

    return migrated

def migrate_database():
    """Main migration function"""
    print("=" * 60)
    print("MySQL to PostgreSQL Migration")
    print("=" * 60)
    print(f"Source: {MYSQL_CONFIG['database']}@{MYSQL_CONFIG['host']}")
    print(f"Target: {PG_CONFIG['database']}@{PG_CONFIG['host']}")
    print("=" * 60)

    mysql_conn = get_mysql_connection()
    pg_conn = get_pg_connection()

    try:
        # Get all tables
        tables = get_tables(mysql_conn)
        print(f"\nFound {len(tables)} tables to migrate\n")

        success_count = 0
        error_count = 0

        for i, table_name in enumerate(tables, 1):
            print(f"[{i}/{len(tables)}] Processing table: {table_name}")

            try:
                # Get columns
                columns = get_table_columns(mysql_conn, table_name)

                # Create table in PostgreSQL
                ddl = create_table_ddl(table_name, columns)
                with pg_conn.cursor() as cursor:
                    cursor.execute(ddl)
                pg_conn.commit()
                print(f"    Table created/exists")

                # Migrate data
                migrated = migrate_table_data(mysql_conn, pg_conn, table_name, columns)
                print(f"    Migrated {migrated} rows")

                success_count += 1

            except Exception as e:
                print(f"    ERROR: {e}")
                error_count += 1
                pg_conn.rollback()
                continue

        print("\n" + "=" * 60)
        print("Migration Summary")
        print("=" * 60)
        print(f"Total tables: {len(tables)}")
        print(f"Successful: {success_count}")
        print(f"Errors: {error_count}")
        print("=" * 60)

    finally:
        mysql_conn.close()
        pg_conn.close()

if __name__ == '__main__':
    migrate_database()
