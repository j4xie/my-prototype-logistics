# Archive Directory

This directory contains archived code and files that are no longer actively used but preserved for reference.

## Contents

### smartbi-rule-detection/
Archived rule-based detection code from the SmartBI structure detector.
- **Date**: 2026-01-27
- **Reason**: Switched to LLM-first detection mode for better accuracy
- **Contents**:
  - `rule_based_detector_archived.py` - Rule-based detection methods and documentation

### smartbi-temp-files/
Temporary files generated during SmartBI development and testing.
- Screenshots, JSON responses, test logs
- These can be safely deleted if storage is needed

### temp-test-scripts/
One-off test scripts that were used during development.
- `test_batch*.py` - Batch testing scripts
- `query_smartbi*.py` - SmartBI query test scripts
- `test_smartbi_e2e.py` - End-to-end test script

### temp-misc/
Miscellaneous temporary files.
- `ralph_loop_*.json` - AI intent testing results
- `openapi*.json` - OpenAPI spec files
- Shell scripts for ad-hoc testing

### legacy-python-services/
Old standalone Python services that have been superseded by the unified `smartbi` service.
- **excel-service/**: Excel parsing service (now in smartbi/services/excel_parser.py)
- **error-analysis-service/**: Error analysis service (now in smartbi/services/*)
- **python-services/**: Modular Python services structure (not deployed)

## Notes

The `smartbi/` directory in the project root is the active Python service running on port 8083.
All SmartBI functionality is now consolidated there with LLM-first detection mode enabled.

To restore any archived code, simply copy it back to the appropriate location.
