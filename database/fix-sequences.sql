-- fix-sequences.sql
-- 修复所有 SERIAL 列的序列值
-- 在 pgloader 迁移完成后执行

DO $$
DECLARE
    r RECORD;
    max_val BIGINT;
    seq_name TEXT;
BEGIN
    -- 遍历所有有主键的表
    FOR r IN (
        SELECT
            tc.table_schema,
            tc.table_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = 'public'
    ) LOOP
        -- 获取序列名
        seq_name := pg_get_serial_sequence(r.table_schema || '.' || r.table_name, r.column_name);

        IF seq_name IS NOT NULL THEN
            -- 获取最大值
            EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I.%I',
                          r.column_name, r.table_schema, r.table_name) INTO max_val;

            -- 设置序列值
            EXECUTE format('SELECT setval(%L, %s)', seq_name, max_val + 1);

            RAISE NOTICE 'Fixed sequence % for %.% to %',
                         seq_name, r.table_name, r.column_name, max_val + 1;
        END IF;
    END LOOP;
END $$;

-- 验证序列值
SELECT
    schemaname,
    sequencename,
    last_value
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;
