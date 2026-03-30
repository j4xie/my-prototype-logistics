/**
 * Vitest global test setup for web-admin.
 *
 * Provides localStorage mock and cleans up between tests.
 */

// jsdom provides localStorage by default, but we reset it between tests
// to ensure test isolation.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});
