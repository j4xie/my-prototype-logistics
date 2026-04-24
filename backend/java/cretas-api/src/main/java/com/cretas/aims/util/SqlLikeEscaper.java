package com.cretas.aims.util;

/**
 * Escape SQL LIKE special characters in user input.
 *
 * Background: PostgreSQL/MySQL LIKE treats `_` as "any single char" and
 * `%` as "any string". When user types a search keyword like `Bo_ny`, the
 * `_` is interpreted as wildcard, matching `Booany` / `Boyny` / etc — search
 * results too broad.
 *
 * Found via 2026-04-24 SQL audit (LIKE escape gap).
 *
 * Usage in Service layer:
 *   String safe = SqlLikeEscaper.escape(rawKeyword);
 *   repository.findByNameContaining(safe);  // Repository LIKE clause must use ESCAPE '\'
 *
 * Or pair with a Repository @Query that has explicit ESCAPE:
 *   @Query("SELECT c FROM Customer c WHERE c.name LIKE %:keyword% ESCAPE '\\'")
 */
public final class SqlLikeEscaper {

    private SqlLikeEscaper() {}

    /**
     * Escape `\`, `_`, `%` in user input for safe use in LIKE patterns.
     * Caller MUST ensure the SQL uses {@code ESCAPE '\\'} (default in most
     * dialects but explicit is safer).
     *
     * @param input user-provided search keyword (may be null)
     * @return escaped string, or null if input was null
     */
    public static String escape(String input) {
        if (input == null) {
            return null;
        }
        // Order matters: escape `\` first so we don't double-escape the
        // backslashes we add for `_` and `%`.
        return input
            .replace("\\", "\\\\")
            .replace("_", "\\_")
            .replace("%", "\\%");
    }
}
