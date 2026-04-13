-- P1-8 数据迁移: product_samples.progress_notes JSON array → product_sample_tracking_records
--
-- 老数据格式 (ProductSampleServiceImpl.updateProgress L113-120):
--   [ {"time": "2026-04-11 14:30", "note": "...", "photoUrl": "..."}, ... ]
--
-- 迁移到独立 table, 字段映射:
--   elem->>'time'     → recorded_at (parse "YYYY-MM-DD HH24:MI", fallback NOW)
--   elem->>'note'     → content
--   elem->>'photoUrl' → attachment_url
--
-- 幂等安全: NOT EXISTS check 防止重复迁移 (同一 sample + content + recorded_at 只保留一条).

INSERT INTO product_sample_tracking_records (
    id, factory_id, sample_id, recorded_at, content, attachment_url,
    created_at, updated_at
)
SELECT
    gen_random_uuid()::text,
    s.factory_id,
    s.id,
    COALESCE(
        to_timestamp(elem->>'time', 'YYYY-MM-DD HH24:MI'),
        NOW()
    ) AS recorded_at,
    elem->>'note',
    elem->>'photoUrl',
    NOW(),
    NOW()
FROM product_samples s
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN s.progress_notes IS NULL OR s.progress_notes = '' OR s.progress_notes = '[]'
            THEN '[]'::jsonb
        ELSE s.progress_notes::jsonb
    END
) elem
WHERE NOT EXISTS (
    SELECT 1 FROM product_sample_tracking_records r
    WHERE r.sample_id = s.id
      AND r.content = (elem->>'note')
      AND r.recorded_at = COALESCE(
          to_timestamp(elem->>'time', 'YYYY-MM-DD HH24:MI'),
          NOW()
      )
);

-- 迁移统计 (不影响事务, 仅 log)
DO $$
DECLARE
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO migrated_count FROM product_sample_tracking_records;
    RAISE NOTICE '[P1-8 data migration] product_sample_tracking_records 总行数: %', migrated_count;
END $$;
