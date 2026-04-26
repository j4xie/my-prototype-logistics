/**
 * Capability layer types — 数据织网 Sub-Project A.
 * Mirrors Python backend response from GET /api/smartbi/capability/{factoryId}.
 *
 * Note: snake_case field names match the Python response verbatim. We do NOT
 * apply transformKeys to capability responses (template_status keys are
 * semantic template codes that must stay snake_case).
 */

export interface RequiresSpec {
  /** All fields must be in the factory's available set. */
  all: string[];
  /** Optional: at least one field must be in the available set. */
  any?: string[];
  description?: string;
}

export interface TemplateStatus {
  /** true = renderable, false = missing fields, null = deferred (B-stage). */
  satisfied: boolean | null;
  /** Field names that are missing (only checks `requires.all`). */
  missing: string[];
  /** Set when requires=None or absent (B-stage TODO). */
  deferred?: boolean;
}

export interface UnlockSuggestion {
  missing_field: string;
  unlocks_count: number;
  unlocks_examples: string[];
  cta: string;
}

export interface CapabilityResponse {
  factory_id: string;
  available_fields: string[];
  /** Map keyed by template code (snake_case identifier). */
  template_status: Record<string, TemplateStatus>;
  unlock_suggestions: UnlockSuggestion[];
  /** A v1.0 returns null. B-stage Sheet Merger fills it: [["2025-01-01", "2025-12-31"], ...]. */
  time_coverage: string[][] | null;
}

export interface CardManifestEntry {
  id: string;
  page: string;
  title: string;
  /** Canonical field names from smartbi/canonical/aliases.py. */
  requires: string[];
  description?: string;
  /** spec §6.3: default 'placeholder'. Set 'hide' for admin/experiment/RBAC cards. */
  fallbackMode?: 'hide' | 'placeholder';
}
