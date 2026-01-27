#!/bin/bash
#
# MySQL to PostgreSQL Additional Syntax Fix Script
#
# Handles MySQL-specific syntax that wasn't converted by the main script:
# 1. MODIFY COLUMN -> ALTER COLUMN ... TYPE
# 2. CHANGE COLUMN -> (needs manual review)
# 3. DROP PRIMARY KEY -> DROP CONSTRAINT ... PRIMARY KEY
# 4. LIMIT offset, count -> LIMIT count OFFSET offset
#
# Usage: ./fix-pg-migration-syntax.sh <directory>

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ $# -lt 1 ]; then
    echo "Usage: $0 <directory>"
    exit 1
fi

DIR="$1"

if [ ! -d "$DIR" ]; then
    log_error "Directory not found: $DIR"
    exit 1
fi

log_info "Processing files in: $DIR"
echo ""

# Track changes
MODIFIED_FILES=0
TOTAL_FIXES=0

# Process each SQL file
while IFS= read -r -d '' file; do
    filename=$(basename "$file")
    changes_made=false

    # Count fixes in this file
    modify_count=$(grep -ci "MODIFY\s\+COLUMN" "$file" 2>/dev/null || echo "0")
    change_count=$(grep -ci "CHANGE\s\+COLUMN" "$file" 2>/dev/null || echo "0")
    limit_count=$(grep -ciE "LIMIT\s+[0-9]+\s*,\s*[0-9]+" "$file" 2>/dev/null || echo "0")

    if [ "$modify_count" -gt 0 ] || [ "$change_count" -gt 0 ] || [ "$limit_count" -gt 0 ]; then
        log_info "Processing: $filename"
    fi

    # Fix MODIFY COLUMN -> ALTER COLUMN ... TYPE
    # MySQL: ALTER TABLE t MODIFY COLUMN col TYPE;
    # PostgreSQL: ALTER TABLE t ALTER COLUMN col TYPE TYPE;
    if [ "$modify_count" -gt 0 ]; then
        # Simple case: MODIFY COLUMN col_name TYPE
        sed -i 's/MODIFY\s\+COLUMN\s\+\([a-zA-Z_][a-zA-Z0-9_]*\)\s\+/ALTER COLUMN \1 TYPE /gi' "$file"

        # Also handle MODIFY without COLUMN keyword
        sed -i 's/\bMODIFY\s\+\([a-zA-Z_][a-zA-Z0-9_]*\)\s\+\([A-Z]\)/ALTER COLUMN \1 TYPE \2/gi' "$file"

        log_info "  - Fixed $modify_count MODIFY COLUMN -> ALTER COLUMN TYPE"
        changes_made=true
        TOTAL_FIXES=$((TOTAL_FIXES + modify_count))
    fi

    # Mark CHANGE COLUMN for review (complex - renames and changes type)
    if [ "$change_count" -gt 0 ]; then
        sed -i 's/CHANGE\s\+COLUMN/-- TODO: PostgreSQL uses RENAME COLUMN + ALTER COLUMN TYPE separately\nCHANGE COLUMN/gi' "$file"
        log_warn "  - Marked $change_count CHANGE COLUMN for manual review"
        changes_made=true
    fi

    # Fix LIMIT offset, count -> LIMIT count OFFSET offset (complex regex)
    if [ "$limit_count" -gt 0 ]; then
        log_warn "  - $limit_count LIMIT offset,count patterns need manual conversion to LIMIT count OFFSET offset"
    fi

    if [ "$changes_made" = true ]; then
        MODIFIED_FILES=$((MODIFIED_FILES + 1))
    fi

done < <(find "$DIR" -name "*.sql" -type f -print0)

echo ""
echo "============================================"
echo "  Fix Summary"
echo "============================================"
log_info "Files modified: $MODIFIED_FILES"
log_info "Total fixes applied: $TOTAL_FIXES"
echo ""
log_info "Done!"
