#!/bin/bash
#
# MySQL to PostgreSQL Migration Script Converter
#
# Converts MySQL DDL/DML scripts to PostgreSQL compatible syntax
#
# Usage: ./convert-mysql-to-pg.sh <input_directory> [output_directory]
#
# If output_directory is not specified, creates 'migration-pg' in current directory

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track files needing manual review
MANUAL_REVIEW_FILES=()

print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  MySQL to PostgreSQL Converter${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

print_usage() {
    echo "Usage: $0 <input_directory> [output_directory]"
    echo ""
    echo "Arguments:"
    echo "  input_directory   Directory containing MySQL .sql files"
    echo "  output_directory  Output directory (default: ./migration-pg)"
    echo ""
    echo "Example:"
    echo "  $0 ./mysql-scripts"
    echo "  $0 ./mysql-scripts ./pg-scripts"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Convert a single SQL file
convert_file() {
    local input_file="$1"
    local output_file="$2"
    local filename=$(basename "$input_file")
    local needs_review=false
    local review_reasons=()

    log_info "Converting: $filename"

    # Create a temporary file for processing
    local temp_file=$(mktemp)
    cp "$input_file" "$temp_file"

    # ===========================================
    # 1. Data Type Conversions
    # ===========================================

    # DATETIME -> TIMESTAMP WITH TIME ZONE
    sed -i 's/\bDATETIME\b/TIMESTAMP WITH TIME ZONE/gi' "$temp_file"

    # TINYINT(1) -> BOOLEAN
    sed -i 's/\bTINYINT(1)\b/BOOLEAN/gi' "$temp_file"

    # TINYINT -> SMALLINT (for other tinyint usages)
    sed -i 's/\bTINYINT\b/SMALLINT/gi' "$temp_file"

    # INT NOT NULL AUTO_INCREMENT -> SERIAL NOT NULL (remove AUTO_INCREMENT later)
    # BIGINT NOT NULL AUTO_INCREMENT -> BIGSERIAL NOT NULL
    # First handle BIGINT
    sed -i 's/\bBIGINT\s\+NOT\s\+NULL\s\+AUTO_INCREMENT\b/BIGSERIAL NOT NULL/gi' "$temp_file"
    sed -i 's/\bBIGINT\s\+AUTO_INCREMENT\b/BIGSERIAL/gi' "$temp_file"

    # Then handle INT (after BIGINT to avoid partial matches)
    sed -i 's/\bINT\s\+NOT\s\+NULL\s\+AUTO_INCREMENT\b/SERIAL NOT NULL/gi' "$temp_file"
    sed -i 's/\bINT\s\+AUTO_INCREMENT\b/SERIAL/gi' "$temp_file"

    # Handle remaining AUTO_INCREMENT (standalone)
    sed -i 's/\bAUTO_INCREMENT\b//gi' "$temp_file"

    # MEDIUMTEXT -> TEXT
    sed -i 's/\bMEDIUMTEXT\b/TEXT/gi' "$temp_file"

    # LONGTEXT -> TEXT
    sed -i 's/\bLONGTEXT\b/TEXT/gi' "$temp_file"

    # MEDIUMBLOB -> BYTEA
    sed -i 's/\bMEDIUMBLOB\b/BYTEA/gi' "$temp_file"

    # LONGBLOB -> BYTEA
    sed -i 's/\bLONGBLOB\b/BYTEA/gi' "$temp_file"

    # BLOB -> BYTEA
    sed -i 's/\bBLOB\b/BYTEA/gi' "$temp_file"

    # DOUBLE -> DOUBLE PRECISION
    sed -i 's/\bDOUBLE\b/DOUBLE PRECISION/gi' "$temp_file"

    # ===========================================
    # 2. Remove MySQL-specific options
    # ===========================================

    # ON UPDATE CURRENT_TIMESTAMP
    sed -i 's/\s*ON\s\+UPDATE\s\+CURRENT_TIMESTAMP//gi' "$temp_file"

    # ENGINE=InnoDB (and other engines)
    sed -i 's/\s*ENGINE\s*=\s*[A-Za-z]*//gi' "$temp_file"

    # DEFAULT CHARSET=utf8mb4
    sed -i 's/\s*DEFAULT\s\+CHARSET\s*=\s*[A-Za-z0-9_]*//gi' "$temp_file"

    # CHARSET=utf8mb4 (without DEFAULT)
    sed -i 's/\s*CHARSET\s*=\s*[A-Za-z0-9_]*//gi' "$temp_file"

    # COLLATE=utf8mb4_unicode_ci
    sed -i 's/\s*COLLATE\s*=\s*[A-Za-z0-9_]*//gi' "$temp_file"

    # COLLATE utf8mb4_unicode_ci (without =)
    sed -i 's/\s*COLLATE\s\+[A-Za-z0-9_]*//gi' "$temp_file"

    # UNSIGNED
    sed -i 's/\s*UNSIGNED\b//gi' "$temp_file"

    # ROW_FORMAT=...
    sed -i 's/\s*ROW_FORMAT\s*=\s*[A-Za-z]*//gi' "$temp_file"

    # CHARACTER SET ...
    sed -i 's/\s*CHARACTER\s\+SET\s\+[A-Za-z0-9_]*//gi' "$temp_file"

    # COMMENT='...' (MySQL table/column comments - different syntax in PG)
    if grep -qi "COMMENT\s*=" "$temp_file"; then
        needs_review=true
        review_reasons+=("Contains COMMENT= syntax (needs conversion to PostgreSQL COMMENT ON)")
    fi
    # Remove inline comments for now (mark for review)
    sed -i "s/\s*COMMENT\s*=\s*'[^']*'//gi" "$temp_file"
    sed -i 's/\s*COMMENT\s*=\s*"[^"]*"//gi' "$temp_file"

    # ===========================================
    # 3. Syntax Conversions
    # ===========================================

    # Handle backticks - convert to double quotes or remove
    # For identifiers that are reserved words, use double quotes
    # For simple identifiers, just remove backticks
    sed -i 's/`\([a-zA-Z_][a-zA-Z0-9_]*\)`/\1/g' "$temp_file"

    # INSERT IGNORE INTO -> INSERT INTO ... ON CONFLICT DO NOTHING
    if grep -qi "INSERT\s\+IGNORE\s\+INTO" "$temp_file"; then
        needs_review=true
        review_reasons+=("Contains INSERT IGNORE - needs manual conversion to ON CONFLICT DO NOTHING")
        # Add comment marker
        sed -i 's/INSERT\s\+IGNORE\s\+INTO/-- TODO: Add ON CONFLICT DO NOTHING clause\nINSERT INTO/gi' "$temp_file"
    fi

    # REPLACE INTO -> needs manual handling
    if grep -qi "REPLACE\s\+INTO" "$temp_file"; then
        needs_review=true
        review_reasons+=("Contains REPLACE INTO - needs conversion to INSERT ... ON CONFLICT DO UPDATE")
        sed -i 's/REPLACE\s\+INTO/-- TODO: Convert to INSERT ... ON CONFLICT DO UPDATE\nINSERT INTO/gi' "$temp_file"
    fi

    # IF NOT EXISTS for tables (PostgreSQL supports this)
    # No change needed

    # IFNULL -> COALESCE
    sed -i 's/\bIFNULL\s*(/COALESCE(/gi' "$temp_file"

    # NOW() is supported in both, but CURRENT_TIMESTAMP is more standard
    # Keep NOW() as it works in PostgreSQL too

    # LIMIT x, y -> LIMIT y OFFSET x
    if grep -qiE "LIMIT\s+[0-9]+\s*,\s*[0-9]+" "$temp_file"; then
        needs_review=true
        review_reasons+=("Contains LIMIT x,y syntax - needs conversion to LIMIT y OFFSET x")
    fi

    # GROUP_CONCAT -> STRING_AGG
    if grep -qi "GROUP_CONCAT" "$temp_file"; then
        needs_review=true
        review_reasons+=("Contains GROUP_CONCAT - needs conversion to STRING_AGG")
        sed -i 's/GROUP_CONCAT/-- TODO: Convert to STRING_AGG\nGROUP_CONCAT/gi' "$temp_file"
    fi

    # ENUM type - PostgreSQL handles differently
    if grep -qi "ENUM\s*(" "$temp_file"; then
        needs_review=true
        review_reasons+=("Contains ENUM type - consider creating custom TYPE or using CHECK constraint")
    fi

    # ===========================================
    # 4. Index syntax adjustments
    # ===========================================

    # USING BTREE is supported in PostgreSQL, but often implicit
    sed -i 's/\s*USING\s\+BTREE//gi' "$temp_file"

    # FULLTEXT indexes need special handling
    if grep -qi "FULLTEXT" "$temp_file"; then
        needs_review=true
        review_reasons+=("Contains FULLTEXT index - needs conversion to PostgreSQL tsvector/GIN index")
    fi

    # ===========================================
    # 5. Clean up extra whitespace and empty lines
    # ===========================================

    # Remove trailing whitespace
    sed -i 's/[[:space:]]*$//' "$temp_file"

    # Remove multiple consecutive empty lines
    sed -i '/^$/N;/^\n$/d' "$temp_file"

    # ===========================================
    # 6. Add header comment
    # ===========================================

    {
        echo "-- ============================================"
        echo "-- Converted from MySQL to PostgreSQL"
        echo "-- Original file: $filename"
        echo "-- Conversion date: $(date '+%Y-%m-%d %H:%M:%S')"
        if [ "$needs_review" = true ]; then
            echo "-- WARNING: This file requires manual review!"
        fi
        echo "-- ============================================"
        echo ""
        cat "$temp_file"
    } > "$output_file"

    # Clean up
    rm "$temp_file"

    # Track files needing review
    if [ "$needs_review" = true ]; then
        MANUAL_REVIEW_FILES+=("$filename|${review_reasons[*]}")
        log_warn "  -> Needs manual review: ${review_reasons[*]}"
    fi
}

# Main execution
main() {
    print_header

    # Check arguments
    if [ $# -lt 1 ]; then
        log_error "Missing input directory argument"
        echo ""
        print_usage
        exit 1
    fi

    local input_dir="$1"
    local output_dir="${2:-./migration-pg}"

    # Validate input directory
    if [ ! -d "$input_dir" ]; then
        log_error "Input directory does not exist: $input_dir"
        exit 1
    fi

    # Create output directory
    mkdir -p "$output_dir"
    log_info "Output directory: $output_dir"
    echo ""

    # Find and convert all .sql files
    local file_count=0
    local converted_count=0

    while IFS= read -r -d '' sql_file; do
        file_count=$((file_count + 1))

        # Preserve directory structure
        local relative_path="${sql_file#$input_dir/}"
        local output_file="$output_dir/$relative_path"
        local output_subdir=$(dirname "$output_file")

        mkdir -p "$output_subdir"

        convert_file "$sql_file" "$output_file"
        converted_count=$((converted_count + 1))

    done < <(find "$input_dir" -name "*.sql" -type f -print0)

    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  Conversion Summary${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
    log_info "Total SQL files found: $file_count"
    log_info "Files converted: $converted_count"
    log_info "Output directory: $output_dir"
    echo ""

    # Report files needing manual review
    if [ ${#MANUAL_REVIEW_FILES[@]} -gt 0 ]; then
        echo -e "${YELLOW}============================================${NC}"
        echo -e "${YELLOW}  Files Requiring Manual Review${NC}"
        echo -e "${YELLOW}============================================${NC}"
        echo ""
        for entry in "${MANUAL_REVIEW_FILES[@]}"; do
            IFS='|' read -r filename reasons <<< "$entry"
            echo -e "${YELLOW}  - $filename${NC}"
            echo "    Reasons: $reasons"
            echo ""
        done

        # Save review list to file
        local review_file="$output_dir/MANUAL_REVIEW_REQUIRED.txt"
        {
            echo "Files Requiring Manual Review"
            echo "=============================="
            echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
            echo ""
            for entry in "${MANUAL_REVIEW_FILES[@]}"; do
                IFS='|' read -r filename reasons <<< "$entry"
                echo "File: $filename"
                echo "  Reasons: $reasons"
                echo ""
            done
            echo ""
            echo "Common Manual Conversions:"
            echo "-------------------------"
            echo ""
            echo "1. INSERT IGNORE INTO -> INSERT INTO ... ON CONFLICT (column) DO NOTHING"
            echo ""
            echo "2. REPLACE INTO -> INSERT INTO ... ON CONFLICT (column) DO UPDATE SET ..."
            echo ""
            echo "3. GROUP_CONCAT(col) -> STRING_AGG(col, ',')"
            echo ""
            echo "4. LIMIT offset, count -> LIMIT count OFFSET offset"
            echo ""
            echo "5. ENUM('a','b','c') -> Create TYPE or use CHECK constraint:"
            echo "   CREATE TYPE status_enum AS ENUM ('a', 'b', 'c');"
            echo "   -- or --"
            echo "   column VARCHAR(20) CHECK (column IN ('a', 'b', 'c'))"
            echo ""
            echo "6. FULLTEXT INDEX -> PostgreSQL full-text search:"
            echo "   CREATE INDEX idx_name ON table USING GIN(to_tsvector('english', column));"
            echo ""
            echo "7. COMMENT='...' -> COMMENT ON COLUMN table.column IS '...';"
        } > "$review_file"

        log_info "Review list saved to: $review_file"
    else
        log_info "All files converted successfully - no manual review required!"
    fi

    echo ""
    log_info "Conversion complete!"
}

# Run main function
main "$@"
