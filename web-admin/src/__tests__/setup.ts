/**
 * Vitest global test setup for web-admin.
 *
 * Provides localStorage mock and cleans up between tests.
 *
 * NOTE: Pinia init was attempted in PR #635 but reverted — exposing the
 * setup gap surfaced 9+ pre-existing TS errors in vue-tsc build that
 * blocked clean CI. Re-enabling Pinia init must be paired with a TS
 * error cleanup PR (separate scope). Tracked as follow-up after #635.
 */
import { beforeEach, afterEach } from 'vitest';

// jsdom provides localStorage by default, but we reset it between tests
// to ensure test isolation.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});
