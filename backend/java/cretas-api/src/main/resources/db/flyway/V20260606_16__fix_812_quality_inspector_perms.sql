-- Issue #812 fix (2026-05-17): grant quality_inspector full read+write on quality module
--
-- Background
--   POST /api/mobile/{factoryId}/processing/quality/inspections is annotated
--   @RequirePermission({"quality:read_write"}) on ProcessingController.
--   GET /quality-defects (listDefects, summary, byInspection) is annotated
--   @RequirePermission({"quality:read_write", "quality:read"}).
--
--   quality_inspector previously had quality='w' (write only) in
--   platform_role_permissions. denormalizeLevel maps 'w' -> 'write', and
--   checkAction("write", "read_write") returns false (only "read_write" type
--   passes), so the inspector got 403 FORBIDDEN on submitting inspections.
--   checkAction("write", "read") also returns false, blocking GET /quality-defects.
--
--   Customer impact: F006 designated inspector (f006_quality_insp) cannot file
--   any quality inspection -- must go through f006_admin. JWT advertised
--   quality:* but POST returned 403, breaking UX trust.
--
-- Fix
--   Upgrade platform_role_permissions.quality_inspector.quality from 'w' to 'rw'.
--   The hardcoded fallback matrix in PermissionServiceImpl.java is also
--   updated in the same PR.
UPDATE platform_role_permissions
SET permission_level = 'rw',
    updated_at = NOW()
WHERE role_code = 'quality_inspector'
  AND module_code = 'quality'
  AND permission_level = 'w';
