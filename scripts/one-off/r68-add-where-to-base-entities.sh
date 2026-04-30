#!/usr/bin/env bash
# R68-FIX-A bulk: add @Where(clause = "deleted_at IS NULL") to every BaseEntity subclass
# that doesn't already have @Where or @SQLRestriction.
#
# Why: BaseEntity has @Where on @MappedSuperclass which Hibernate silently ignores.
# Verified empirically R68 against Department. Each subclass needs the annotation directly.
#
# Idempotent: skips files that already have @Where or @SQLRestriction.
# Safe: only edits files that match `extends BaseEntity` AND lack the annotation.

set -e

cd "$(dirname "$0")/../.."

ENTITY_ROOT="backend/java/cretas-api/src/main/java/com/cretas/aims/entity"

# Find all BaseEntity subclasses not already having @Where or @SQLRestriction
TARGETS=$(find "$ENTITY_ROOT" -name "*.java" \
  | xargs grep -lE "extends BaseEntity" 2>/dev/null \
  | xargs grep -L "@Where\|@SQLRestriction" 2>/dev/null \
  | sort)

if [ -z "$TARGETS" ]; then
    echo "No targets — all BaseEntity subclasses already protected."
    exit 0
fi

COUNT=$(echo "$TARGETS" | wc -l)
echo "Found $COUNT BaseEntity subclasses lacking @Where:"

for FILE in $TARGETS; do
    REL=${FILE#$ENTITY_ROOT/}
    echo "  $REL"

    # 1. Add import if not present (handle different Hibernate import locations)
    if ! grep -q "import org.hibernate.annotations.Where;" "$FILE"; then
        # Insert after the lombok / jpa imports cluster — find last `^import` line
        # and add @Where import after it
        LAST_IMPORT=$(grep -n "^import " "$FILE" | tail -1 | cut -d: -f1)
        if [ -n "$LAST_IMPORT" ]; then
            sed -i "${LAST_IMPORT}a import org.hibernate.annotations.Where;" "$FILE"
        else
            echo "    WARN: no import block found in $REL, skipping"
            continue
        fi
    fi

    # 2. Add @Where annotation right before `public class XXX extends BaseEntity {`
    # Match the public class declaration line and prepend @Where on its own line
    if ! grep -q "@Where(clause" "$FILE"; then
        sed -i 's|^public class \([A-Za-z0-9_]*\) extends BaseEntity|@Where(clause = "deleted_at IS NULL")\npublic class \1 extends BaseEntity|' "$FILE"
    fi
done

echo ""
echo "Done. Verification:"
PROTECTED=$(find "$ENTITY_ROOT" -name "*.java" | xargs grep -lE "@Where|@SQLRestriction" 2>/dev/null | wc -l)
TOTAL=$(find "$ENTITY_ROOT" -name "*.java" | xargs grep -lE "extends BaseEntity" 2>/dev/null | wc -l)
echo "  $PROTECTED entities now have @Where (target: $TOTAL)"
