/**
 * Vitest global test setup for web-admin.
 *
 * Provides localStorage mock and cleans up between tests.
 *
 * NOTE: Pinia init was attempted twice (PR #635 + PR #638) but reverted both
 * times. Each attempt surfaces more pre-existing TS errors + vitest assertion
 * failures (18+ TS, 5+ vitest tests through 3 CI rounds). Re-enabling Pinia
 * requires a dedicated multi-PR rabbit-hole cleanup. Tracked in #636.
 */
import { beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});
