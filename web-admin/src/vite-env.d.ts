/// <reference types="vite/client" />

/**
 * Build-time constants injected by vite.config.ts `define`.
 * Used by ServiceCodeBadge.vue (P3 #89) for customer issue reporting.
 */
declare const __APP_VERSION__: string;
declare const __COMMIT_SHA__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PREFIX?: string;
  readonly VITE_SMARTBI_URL?: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_PYTHON_URL?: string;
  readonly VITE_CUSTOMER_SERVICE_URL?: string;
  readonly VITE_COMMIT_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
