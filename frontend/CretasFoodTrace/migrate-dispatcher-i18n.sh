#!/bin/bash

# Dispatcher i18n Migration Script
# This script automates the migration of remaining dispatcher module files to use i18n

echo "Starting dispatcher i18n migration..."

# Define files to migrate
FILES=(
  "src/screens/dispatcher/plan/ResourceOverviewScreen.tsx"
  "src/screens/dispatcher/plan/ApprovalListScreen.tsx"
  "src/screens/dispatcher/plan/BatchWorkersScreen.tsx"
  "src/screens/dispatcher/plan/TaskAssignmentScreen.tsx"
  "src/screens/dispatcher/plan/MixedBatchScreen.tsx"
  "src/screens/dispatcher/plan/PlanListScreen.tsx"
  "src/screens/dispatcher/plan/PlanGanttScreen.tsx"
  "src/screens/dispatcher/plan/PlanDetailScreen.tsx"
  "src/screens/dispatcher/plan/PlanCreateScreen.tsx"
  "src/screens/dispatcher/profile/DSStatisticsScreen.tsx"
  "src/screens/dispatcher/profile/DSProfileScreen.tsx"
  "src/screens/dispatcher/ai/AIWorkerOptimizeScreen.tsx"
  "src/screens/dispatcher/ai/AIScheduleGenerateScreen.tsx"
  "src/screens/dispatcher/ai/AICompletionProbScreen.tsx"
  "src/screens/dispatcher/ai/AIScheduleScreen.tsx"
  "src/screens/dispatcher/personnel/PersonnelDetailScreen.tsx"
  "src/screens/dispatcher/personnel/PersonnelTransferScreen.tsx"
  "src/screens/dispatcher/personnel/PersonnelListScreen.tsx"
  "src/screens/dispatcher/personnel/PersonnelScheduleScreen.tsx"
  "src/screens/dispatcher/personnel/PersonnelAttendanceScreen.tsx"
)

# Count
TOTAL=${#FILES[@]}
CURRENT=0

for file in "${FILES[@]}"; do
  CURRENT=$((CURRENT + 1))
  echo "[$CURRENT/$TOTAL] Processing $file..."

  if [ ! -f "$file" ]; then
    echo "  ⚠️  File not found, skipping..."
    continue
  fi

  # Check if already migrated (has useTranslation)
  if grep -q "useTranslation" "$file"; then
    echo "  ✓ Already migrated, skipping..."
    continue
  fi

  # Create backup
  cp "$file" "$file.bak"

  # Add import
  sed -i '' "s/import { useNavigation } from '@react-navigation\/native';/import { useNavigation } from '@react-navigation\/native';\nimport { useTranslation } from 'react-i18next';/g" "$file"

  # Add hook in component (looking for common patterns)
  sed -i '' "s/const navigation = useNavigation();/const navigation = useNavigation();\n  const { t } = useTranslation('dispatcher');/g" "$file"
  sed -i '' "s/const navigation = useNavigation<.*>();/&\n  const { t } = useTranslation('dispatcher');/g" "$file"

  echo "  ✓ Added imports and hooks"
  echo "  ⚠️  Manual translation key replacements still required"
done

echo ""
echo "Migration script completed!"
echo "⚠️  IMPORTANT: You must manually replace Chinese text with t() calls"
echo "   Refer to src/i18n/locales/zh-CN/dispatcher.json for available keys"
echo ""
echo "Backups created with .bak extension"
