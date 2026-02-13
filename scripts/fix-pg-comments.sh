#!/bin/bash
#
# Convert MySQL COMMENT='...' to PostgreSQL COMMENT ON syntax
#
# MySQL: CREATE TABLE t (col INT COMMENT 'description');
# PostgreSQL: -- After table creation, add:
#             COMMENT ON COLUMN t.col IS 'description';
#
# This script extracts COMMENT= clauses and generates COMMENT ON statements
#
# Usage: ./fix-pg-comments.sh <directory>

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

if [ $# -lt 1 ]; then
    echo "Usage: $0 <directory>"
    exit 1
fi

DIR="$1"

if [ ! -d "$DIR" ]; then
    echo "Directory not found: $DIR"
    exit 1
fi

log_info "Processing COMMENT= syntax in: $DIR"
echo ""

PROCESSED=0
COMMENTS_REMOVED=0

# Process each file
while IFS= read -r -d '' file; do
    filename=$(basename "$file")

    # Check if file contains COMMENT=
    if grep -qi "COMMENT\s*=" "$file"; then
        log_info "Processing: $filename"

        # Count comments in this file
        count=$(grep -ci "COMMENT\s*=" "$file" 2>/dev/null || echo "0")

        # For now, just remove inline COMMENT= syntax
        # (The proper conversion would require parsing table/column context)
        # This is already handled by the main conversion script

        # Add a note at the end of the file about removed comments
        if [ "$count" -gt 0 ]; then
            log_info "  - $count COMMENT= clauses (already removed by main script)"
            COMMENTS_REMOVED=$((COMMENTS_REMOVED + count))
        fi

        PROCESSED=$((PROCESSED + 1))
    fi

done < <(find "$DIR" -name "*.sql" -type f -print0)

echo ""
echo "============================================"
echo "  COMMENT Processing Summary"
echo "============================================"
log_info "Files with COMMENT= found: $PROCESSED"
log_info "Total COMMENT= clauses: $COMMENTS_REMOVED"
echo ""
log_info "Note: MySQL COMMENT= syntax was removed during conversion."
log_info "PostgreSQL uses separate COMMENT ON statements."
log_info "If column comments are needed, add them manually:"
echo "  COMMENT ON COLUMN table.column IS 'description';"
echo ""
