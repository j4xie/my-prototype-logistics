#!/usr/bin/env node

/**
 * Management Module i18n Migration Script
 * This script systematically migrates all management screen files to use i18n
 */

const fs = require('fs');
const path = require('path');

const SCREENS_DIR = path.join(__dirname, '../src/screens/management');

// Files to migrate
const filesToMigrate = [
  'UserManagementScreen.tsx',
  'DepartmentManagementScreen.tsx',
  'ProductTypeManagementScreen.tsx',
  'MaterialTypeManagementScreen.tsx',
  'SupplierManagementScreen.tsx',
  'CustomerManagementScreen.tsx',
  'SupplierAdmissionScreen.tsx',
  'FactorySettingsScreen.tsx',
  'ConversionRateScreen.tsx',
  'ShipmentManagementScreen.tsx',
  'WorkSessionManagementScreen.tsx',
  'RuleConfigurationScreen.tsx',
  'WorkTypeManagementScreen.tsx',
  'MaterialSpecManagementScreen.tsx',
  'DisposalRecordManagementScreen.tsx',
  'SopConfigScreen.tsx',
  'WhitelistManagementScreen.tsx',
  'MaterialConversionDetailScreen.tsx',
  'EntityDataExportScreen.tsx',
  'AISettingsScreen.tsx',
];

function migrateFile(filename) {
  const filePath = path.join(SCREENS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filename}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Step 1: Add useTranslation import if not present
  if (!content.includes("import { useTranslation }") && !content.includes("from 'react-i18next'")) {
    // Find the last import statement
    const importRegex = /^import .+ from ['"'].+['"];?$/gm;
    const imports = content.match(importRegex);

    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertPosition = lastImportIndex + lastImport.length;

      content = content.slice(0, insertPosition) +
                "\nimport { useTranslation } from 'react-i18next';" +
                content.slice(insertPosition);
      modified = true;
      console.log(`✅ Added useTranslation import to ${filename}`);
    }
  }

  // Step 2: Add const { t } = useTranslation('management'); after component declaration
  if (!content.includes("useTranslation('management')")) {
    // Find the component function declaration
    const componentRegex = /export default function \w+\(\) \{/;
    const match = content.match(componentRegex);

    if (match) {
      const componentStart = content.indexOf(match[0]);
      const insertPosition = componentStart + match[0].length;

      content = content.slice(0, insertPosition) +
                "\n  const { t } = useTranslation('management');" +
                content.slice(insertPosition);
      modified = true;
      console.log(`✅ Added useTranslation hook to ${filename}`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`📝 Updated: ${filename}\n`);
    return true;
  } else {
    console.log(`⏭️  Skipped (already migrated): ${filename}\n`);
    return false;
  }
}

function main() {
  console.log('🚀 Starting Management Module i18n Migration\n');
  console.log(`Found ${filesToMigrate.length} files to migrate\n`);

  let migratedCount = 0;
  let skippedCount = 0;

  filesToMigrate.forEach(filename => {
    const result = migrateFile(filename);
    if (result) {
      migratedCount++;
    } else {
      skippedCount++;
    }
  });

  console.log('\n✨ Migration Summary:');
  console.log(`   Migrated: ${migratedCount} files`);
  console.log(`   Skipped: ${skippedCount} files`);
  console.log(`   Total: ${filesToMigrate.length} files`);
  console.log('\n⚠️  Note: This script only adds the imports and hook.');
  console.log('   You still need to replace Chinese strings with t() calls manually.');
}

main();
