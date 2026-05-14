/**
 * Vitest global test setup for web-admin.
 *
 * Provides localStorage mock, Pinia store init, and cleans up between tests.
 */
import { beforeEach, afterEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

// Components using <script setup> with usePermissionStore / useAuthStore / etc.
// call getActivePinia() at mount time. Without an active Pinia instance the
// mount fails with "getActivePinia() was called but there was no active Pinia".
// Register a fresh Pinia per test so state is isolated.
beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});
