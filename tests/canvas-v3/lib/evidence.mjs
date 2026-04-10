// tests/canvas-v3/lib/evidence.mjs

/**
 * Build a test evidence object following E2E skill requirements.
 */
export function buildEvidence({
  testId,
  description,
  action,
  filled = null,
  toast = null,
  apiResponse = null,
  listAfter = null,
  validation = null,
  screenshot = null,
  detail = null,
  extra = {},
}) {
  return {
    testId,
    description,
    action,
    evidence: {
      filled,
      toast,
      apiResponse,
      listAfter,
      validation,
      screenshot,
      detail,
      ...extra,
    },
    result: null,
  };
}

export function validateEvidence(evidence, requiredFields = ['filled', 'toast', 'apiResponse']) {
  const missing = requiredFields.filter(
    f => evidence.evidence[f] === null || evidence.evidence[f] === undefined
  );
  return { valid: missing.length === 0, missing };
}
