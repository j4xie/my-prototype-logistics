-- ============================================================================
-- Employee AI Analysis Test Data
-- Inserts 90 days of attendance, work sessions, and batch participation
-- for 5 employees in factory F001
--
-- Prerequisites: users table populated (workshop_sup1, warehouse_mgr1,
--   hr_admin1, quality_insp1, dispatcher1), production_batches for F001
-- ============================================================================

-- Step 0: Ensure work_types exist for F001
INSERT INTO work_types (factory_id, name, description, hourly_rate, created_at, updated_at)
SELECT 'F001', wt.name, wt.description, wt.hourly_rate, NOW(), NOW()
FROM (VALUES
  ('原料解冻', '冷冻原料的解冻处理', 25.00),
  ('分拣挑选', '原材料分拣和品质挑选', 22.00),
  ('切割加工', '鱼类切割和加工处理', 28.00),
  ('调味腌制', '调味料配比和腌制工序', 24.00),
  ('包装封装', '成品包装和真空封装', 20.00),
  ('质检抽样', '产品质量抽样检测', 30.00)
) AS wt(name, description, hourly_rate)
WHERE NOT EXISTS (
  SELECT 1 FROM work_types WHERE factory_id = 'F001' AND name = wt.name
);

-- Step 1: time_clock_records — 90 days × 5 employees
DO $$
DECLARE
  v_user RECORD;
  v_day DATE;
  v_clock_in TIMESTAMP;
  v_clock_out TIMESTAMP;
  v_work_min INTEGER;
  v_break_min INTEGER;
  v_status VARCHAR(30);
  v_rand DOUBLE PRECISION;
  v_day_of_week INTEGER;
BEGIN
  FOR v_user IN
    SELECT id, username FROM users
    WHERE factory_id = 'F001'
      AND username IN ('workshop_sup1', 'warehouse_mgr1', 'hr_admin1', 'quality_insp1', 'dispatcher1')
  LOOP
    FOR i IN 0..89 LOOP
      v_day := CURRENT_DATE - i;
      v_day_of_week := EXTRACT(DOW FROM v_day);

      -- Skip weekends
      IF v_day_of_week = 0 OR v_day_of_week = 6 THEN
        CONTINUE;
      END IF;

      v_rand := random();

      -- 95% NORMAL, 3% LATE, 1% EARLY_LEAVE, 1% ABSENT
      IF v_rand < 0.01 THEN
        -- ABSENT: skip this day entirely
        v_status := 'ABSENT';
        INSERT INTO time_clock_records (
          factory_id, user_id, clock_date, status, attendance_status,
          work_duration, break_duration, created_at, updated_at
        ) VALUES (
          'F001', v_user.id, v_day, 'completed', 'ABSENT',
          0, 0, v_day + TIME '08:00:00', v_day + TIME '08:00:00'
        );
        CONTINUE;
      ELSIF v_rand < 0.04 THEN
        -- LATE: clock in 10-45 min late
        v_clock_in := v_day + TIME '09:00:00' + (10 + floor(random() * 35)) * INTERVAL '1 minute';
        v_clock_out := v_day + TIME '18:00:00' + floor(random() * 30) * INTERVAL '1 minute';
        v_status := 'LATE';
      ELSIF v_rand < 0.05 THEN
        -- EARLY_LEAVE: clock out 30-60 min early
        v_clock_in := v_day + TIME '08:45:00' + floor(random() * 15) * INTERVAL '1 minute';
        v_clock_out := v_day + TIME '17:00:00' + floor(random() * 30) * INTERVAL '1 minute';
        v_status := 'EARLY_LEAVE';
      ELSE
        -- NORMAL: clock in 8:40-9:00, clock out 18:00-18:30
        v_clock_in := v_day + TIME '08:40:00' + floor(random() * 20) * INTERVAL '1 minute';
        v_clock_out := v_day + TIME '18:00:00' + floor(random() * 30) * INTERVAL '1 minute';
        v_status := 'NORMAL';
      END IF;

      -- Work duration = clock_out - clock_in in minutes, minus break
      v_break_min := 60 + floor(random() * 15)::INTEGER;  -- 60-75 min lunch
      v_work_min := EXTRACT(EPOCH FROM (v_clock_out - v_clock_in))::INTEGER / 60 - v_break_min;

      -- Clamp work_min to reasonable range
      IF v_work_min < 0 THEN v_work_min := 0; END IF;
      IF v_work_min > 720 THEN v_work_min := 720; END IF;

      INSERT INTO time_clock_records (
        factory_id, user_id, clock_date, clock_in_time, clock_out_time,
        work_duration, break_duration, status, attendance_status,
        created_at, updated_at
      ) VALUES (
        'F001', v_user.id, v_day, v_clock_in, v_clock_out,
        v_work_min, v_break_min, 'completed', v_status,
        v_clock_in, v_clock_out
      );
    END LOOP;
  END LOOP;
  RAISE NOTICE 'time_clock_records inserted for 5 employees × ~64 workdays';
END $$;


-- Step 2: employee_work_sessions — 1-3 sessions per employee per workday
-- NOTE: work_type_id is INTEGER but work_types.id is VARCHAR on this DB.
-- We use dummy integer 1-5 since there's no FK constraint.
DO $$
DECLARE
  v_user RECORD;
  v_day DATE;
  v_day_of_week INTEGER;
  v_session_count INTEGER;
  v_wt_id INTEGER;
  v_start TIMESTAMP;
  v_end_ts TIMESTAMP;
  v_actual_min INTEGER;
  v_hourly NUMERIC(10,2);
  v_labor_cost NUMERIC(10,2);
  v_j INTEGER;
  v_hourly_rates NUMERIC[] := ARRAY[25.00, 22.00, 28.00, 24.00, 20.00];
BEGIN
  FOR v_user IN
    SELECT id, username FROM users
    WHERE factory_id = 'F001'
      AND username IN ('workshop_sup1', 'warehouse_mgr1', 'hr_admin1', 'quality_insp1', 'dispatcher1')
  LOOP
    FOR i IN 0..89 LOOP
      v_day := CURRENT_DATE - i;
      v_day_of_week := EXTRACT(DOW FROM v_day);
      IF v_day_of_week = 0 OR v_day_of_week = 6 THEN
        CONTINUE;
      END IF;

      -- 1-3 sessions per day (weighted: 30% 1, 50% 2, 20% 3)
      IF random() < 0.3 THEN v_session_count := 1;
      ELSIF random() < 0.8 THEN v_session_count := 2;
      ELSE v_session_count := 3;
      END IF;

      v_start := v_day + TIME '09:00:00';

      FOR v_j IN 1..v_session_count LOOP
        -- Pick a random work type ID (1-5)
        v_wt_id := 1 + floor(random() * 5)::INTEGER;

        -- Session duration: 90-240 min
        v_actual_min := 90 + floor(random() * 150)::INTEGER;
        v_end_ts := v_start + v_actual_min * INTERVAL '1 minute';

        -- Don't go past 18:00
        IF v_end_ts > v_day + TIME '18:00:00' THEN
          v_end_ts := v_day + TIME '18:00:00';
          v_actual_min := EXTRACT(EPOCH FROM (v_end_ts - v_start))::INTEGER / 60;
        END IF;
        IF v_actual_min <= 0 THEN
          EXIT;
        END IF;

        v_hourly := v_hourly_rates[v_wt_id];
        v_labor_cost := (v_actual_min / 60.0) * v_hourly;

        INSERT INTO employee_work_sessions (
          factory_id, user_id, work_type_id, start_time, end_time,
          break_minutes, actual_work_minutes, status, hourly_rate, labor_cost,
          created_at, updated_at
        ) VALUES (
          'F001', v_user.id, v_wt_id, v_start, v_end_ts,
          0, v_actual_min, 'completed', v_hourly, v_labor_cost,
          v_start, v_end_ts
        );

        -- Next session starts after a 15-30 min gap
        v_start := v_end_ts + (15 + floor(random() * 15)) * INTERVAL '1 minute';
      END LOOP;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'employee_work_sessions inserted for 5 employees';
END $$;


-- Step 3: batch_work_sessions — link employees to existing production batches
DO $$
DECLARE
  v_batch RECORD;
  v_user RECORD;
  v_users BIGINT[];
  v_selected BIGINT[];
  v_worker_count INTEGER;
  v_idx INTEGER;
  v_check_in TIMESTAMP;
  v_check_out TIMESTAMP;
  v_work_min INTEGER;
  v_labor_cost NUMERIC(10,2);
  v_session_id BIGINT;
BEGIN
  -- Collect employee IDs
  SELECT array_agg(id) INTO v_users
  FROM users
  WHERE factory_id = 'F001'
    AND username IN ('workshop_sup1', 'warehouse_mgr1', 'hr_admin1', 'quality_insp1', 'dispatcher1');

  IF v_users IS NULL OR array_length(v_users, 1) = 0 THEN
    RAISE NOTICE 'No target employees found, skipping batch_work_sessions';
    RETURN;
  END IF;

  FOR v_batch IN
    SELECT id, batch_number, start_time, end_time, worker_count, status
    FROM production_batches
    WHERE factory_id = 'F001'
      AND status IN ('COMPLETED', 'PRODUCING')
      AND start_time IS NOT NULL
    ORDER BY start_time
  LOOP
    -- 2-4 workers per batch
    v_worker_count := 2 + floor(random() * 3)::INTEGER;
    IF v_worker_count > array_length(v_users, 1) THEN
      v_worker_count := array_length(v_users, 1);
    END IF;

    -- Shuffle and pick v_worker_count employees
    v_selected := ARRAY[]::BIGINT[];
    WHILE array_length(v_selected, 1) IS NULL OR array_length(v_selected, 1) < v_worker_count LOOP
      v_idx := 1 + floor(random() * array_length(v_users, 1))::INTEGER;
      IF NOT (v_users[v_idx] = ANY(v_selected)) THEN
        v_selected := array_append(v_selected, v_users[v_idx]);
      END IF;
    END LOOP;

    -- Insert a batch_work_session for each selected employee
    FOR v_idx IN 1..array_length(v_selected, 1) LOOP
      v_check_in := v_batch.start_time + floor(random() * 30) * INTERVAL '1 minute';

      IF v_batch.end_time IS NOT NULL THEN
        v_check_out := v_batch.end_time - floor(random() * 30) * INTERVAL '1 minute';
      ELSE
        -- PRODUCING batch: checkout = check_in + 4-6 hours
        v_check_out := v_check_in + (240 + floor(random() * 120)) * INTERVAL '1 minute';
      END IF;

      v_work_min := GREATEST(0, EXTRACT(EPOCH FROM (v_check_out - v_check_in))::INTEGER / 60);
      v_labor_cost := (v_work_min / 60.0) * (22.00 + random() * 8.00);

      -- Find a matching work session (if one exists for this user on this day)
      SELECT id INTO v_session_id
      FROM employee_work_sessions
      WHERE user_id = v_selected[v_idx]
        AND factory_id = 'F001'
        AND start_time::date = v_check_in::date
      ORDER BY start_time
      LIMIT 1;

      INSERT INTO batch_work_sessions (
        batch_id, work_session_id, employee_id, work_minutes, labor_cost,
        check_in_time, check_out_time, status, notes,
        created_at, updated_at
      ) VALUES (
        v_batch.id, v_session_id, v_selected[v_idx], v_work_min, v_labor_cost,
        v_check_in, v_check_out,
        CASE WHEN v_batch.status = 'COMPLETED' THEN 'completed' ELSE 'working' END,
        CASE floor(random() * 6)::INTEGER
          WHEN 0 THEN '原料解冻'
          WHEN 1 THEN '分拣挑选'
          WHEN 2 THEN '切割加工'
          WHEN 3 THEN '调味腌制'
          WHEN 4 THEN '包装封装'
          ELSE '质检抽样'
        END,
        v_check_in, v_check_out
      );
    END LOOP;
  END LOOP;
  RAISE NOTICE 'batch_work_sessions inserted for production batches';
END $$;

-- Summary query (optional, for verification)
-- SELECT 'time_clock_records' AS tbl, COUNT(*) FROM time_clock_records WHERE factory_id='F001'
-- UNION ALL SELECT 'employee_work_sessions', COUNT(*) FROM employee_work_sessions WHERE factory_id='F001'
-- UNION ALL SELECT 'batch_work_sessions', COUNT(*) FROM batch_work_sessions WHERE EXISTS (SELECT 1 FROM production_batches pb WHERE pb.id=batch_work_sessions.batch_id AND pb.factory_id='F001');
