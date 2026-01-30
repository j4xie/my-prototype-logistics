-- Time Clock Test Data
-- Generated: 2025-11-20
-- Purpose: Create realistic time clock records for testing
-- Users: super_admin (1), operator1 (3), testuser2 (5)
-- Period: Last 7 days

-- 清空现有数据（如果有）
DELETE FROM time_clock_records WHERE factory_id = 'CRETAS_2024_001';

-- Week 1: 2025-11-14 (Thursday) - Normal day for all users
INSERT INTO time_clock_records (
    user_id, username, factory_id, clock_date,
    clock_in_time, clock_out_time,
    break_start_time, break_end_time, break_duration_minutes,
    work_duration_minutes, overtime_minutes,
    status, attendance_status, work_type_id, work_type_name,
    clock_device, clock_location, is_manual_edit,
    created_at, updated_at
) VALUES
-- super_admin: 8:00-17:00, 1 hour lunch break
(1, 'super_admin', 'CRETAS_2024_001', '2025-11-14',
 '2025-11-14 08:00:00', '2025-11-14 17:00:00',
 '2025-11-14 12:00:00', '2025-11-14 13:00:00', 60,
 480, 0,
 'COMPLETED', 'PRESENT', 1, '管理工作',
 'Mobile-Android', '上海市浦东新区', false,
 '2025-11-14 08:00:00', '2025-11-14 17:00:00'),

-- operator1: 9:00-18:00, 1 hour lunch break
(3, 'operator1', 'CRETAS_2024_001', '2025-11-14',
 '2025-11-14 09:00:00', '2025-11-14 18:00:00',
 '2025-11-14 12:30:00', '2025-11-14 13:30:00', 60,
 480, 0,
 'COMPLETED', 'PRESENT', 2, '生产操作',
 'Mobile-iOS', '上海市浦东新区', false,
 '2025-11-14 09:00:00', '2025-11-14 18:00:00'),

-- testuser2: 7:00-16:00, 1 hour lunch break
(5, 'testuser2', 'CRETAS_2024_001', '2025-11-14',
 '2025-11-14 07:00:00', '2025-11-14 16:00:00',
 '2025-11-14 11:30:00', '2025-11-14 12:30:00', 60,
 480, 0,
 'COMPLETED', 'PRESENT', 2, '生产操作',
 'Mobile-Android', '上海市浦东新区', false,
 '2025-11-14 07:00:00', '2025-11-14 16:00:00');

-- Week 1: 2025-11-15 (Friday) - With overtime
INSERT INTO time_clock_records (
    user_id, username, factory_id, clock_date,
    clock_in_time, clock_out_time,
    break_start_time, break_end_time, break_duration_minutes,
    work_duration_minutes, overtime_minutes,
    status, attendance_status, work_type_id, work_type_name,
    clock_device, clock_location, is_manual_edit,
    created_at, updated_at
) VALUES
-- super_admin: 8:00-19:00 (2 hours overtime)
(1, 'super_admin', 'CRETAS_2024_001', '2025-11-15',
 '2025-11-15 08:00:00', '2025-11-15 19:00:00',
 '2025-11-15 12:00:00', '2025-11-15 13:00:00', 60,
 600, 120,
 'COMPLETED', 'PRESENT', 1, '管理工作',
 'Mobile-Android', '上海市浦东新区', false,
 '2025-11-15 08:00:00', '2025-11-15 19:00:00'),

-- operator1: 9:00-20:00 (3 hours overtime)
(3, 'operator1', 'CRETAS_2024_001', '2025-11-15',
 '2025-11-15 09:00:00', '2025-11-15 20:00:00',
 '2025-11-15 12:30:00', '2025-11-15 13:30:00', 60,
 600, 180,
 'COMPLETED', 'PRESENT', 2, '生产操作',
 'Mobile-iOS', '上海市浦东新区', false,
 '2025-11-15 09:00:00', '2025-11-15 20:00:00'),

-- testuser2: Normal day
(5, 'testuser2', 'CRETAS_2024_001', '2025-11-15',
 '2025-11-15 07:00:00', '2025-11-15 16:00:00',
 '2025-11-15 11:30:00', '2025-11-15 12:30:00', 60,
 480, 0,
 'COMPLETED', 'PRESENT', 2, '生产操作',
 'Mobile-Android', '上海市浦东新区', false,
 '2025-11-15 07:00:00', '2025-11-15 16:00:00');

-- Week 2: 2025-11-18 (Monday) - New week starts
INSERT INTO time_clock_records (
    user_id, username, factory_id, clock_date,
    clock_in_time, clock_out_time,
    break_start_time, break_end_time, break_duration_minutes,
    work_duration_minutes, overtime_minutes,
    status, attendance_status, work_type_id, work_type_name,
    clock_device, clock_location, is_manual_edit,
    created_at, updated_at
) VALUES
-- All users: Normal day
(1, 'super_admin', 'CRETAS_2024_001', '2025-11-18',
 '2025-11-18 08:00:00', '2025-11-18 17:00:00',
 '2025-11-18 12:00:00', '2025-11-18 13:00:00', 60,
 480, 0,
 'COMPLETED', 'PRESENT', 1, '管理工作',
 'Mobile-Android', '上海市浦东新区', false,
 '2025-11-18 08:00:00', '2025-11-18 17:00:00'),

(3, 'operator1', 'CRETAS_2024_001', '2025-11-18',
 '2025-11-18 09:00:00', '2025-11-18 18:00:00',
 '2025-11-18 12:30:00', '2025-11-18 13:30:00', 60,
 480, 0,
 'COMPLETED', 'PRESENT', 2, '生产操作',
 'Mobile-iOS', '上海市浦东新区', false,
 '2025-11-18 09:00:00', '2025-11-18 18:00:00'),

(5, 'testuser2', 'CRETAS_2024_001', '2025-11-18',
 '2025-11-18 07:00:00', '2025-11-18 16:00:00',
 '2025-11-18 11:30:00', '2025-11-18 12:30:00', 60,
 480, 0,
 'COMPLETED', 'PRESENT', 2, '生产操作',
 'Mobile-Android', '上海市浦东新区', false,
 '2025-11-18 07:00:00', '2025-11-18 16:00:00');

-- Week 2: 2025-11-19 (Tuesday) - Late arrival
INSERT INTO time_clock_records (
    user_id, username, factory_id, clock_date,
    clock_in_time, clock_out_time,
    break_start_time, break_end_time, break_duration_minutes,
    work_duration_minutes, overtime_minutes,
    status, attendance_status, work_type_id, work_type_name,
    clock_device, clock_location, is_manual_edit, notes,
    created_at, updated_at
) VALUES
-- super_admin: Normal
(1, 'super_admin', 'CRETAS_2024_001', '2025-11-19',
 '2025-11-19 08:00:00', '2025-11-19 17:00:00',
 '2025-11-19 12:00:00', '2025-11-19 13:00:00', 60,
 480, 0,
 'COMPLETED', 'PRESENT', 1, '管理工作',
 'Mobile-Android', '上海市浦东新区', false, NULL,
 '2025-11-19 08:00:00', '2025-11-19 17:00:00'),

-- operator1: Late by 30 minutes
(3, 'operator1', 'CRETAS_2024_001', '2025-11-19',
 '2025-11-19 09:30:00', '2025-11-19 18:00:00',
 '2025-11-19 12:30:00', '2025-11-19 13:30:00', 60,
 450, 0,
 'COMPLETED', 'LATE', 2, '生产操作',
 'Mobile-iOS', '上海市浦东新区', false, '迟到30分钟',
 '2025-11-19 09:30:00', '2025-11-19 18:00:00'),

-- testuser2: Normal
(5, 'testuser2', 'CRETAS_2024_001', '2025-11-19',
 '2025-11-19 07:00:00', '2025-11-19 16:00:00',
 '2025-11-19 11:30:00', '2025-11-19 12:30:00', 60,
 480, 0,
 'COMPLETED', 'PRESENT', 2, '生产操作',
 'Mobile-Android', '上海市浦东新区', false, NULL,
 '2025-11-19 07:00:00', '2025-11-19 16:00:00');

-- Week 2: 2025-11-20 (Wednesday - TODAY) - In progress records
INSERT INTO time_clock_records (
    user_id, username, factory_id, clock_date,
    clock_in_time, clock_out_time,
    break_start_time, break_end_time, break_duration_minutes,
    work_duration_minutes, overtime_minutes,
    status, attendance_status, work_type_id, work_type_name,
    clock_device, clock_location, is_manual_edit,
    created_at, updated_at
) VALUES
-- super_admin: Clocked in, not out yet
(1, 'super_admin', 'CRETAS_2024_001', '2025-11-20',
 '2025-11-20 08:00:00', NULL,
 NULL, NULL, 0,
 0, 0,
 'CLOCKED_IN', 'PRESENT', 1, '管理工作',
 'Mobile-Android', '上海市浦东新区', false,
 '2025-11-20 08:00:00', '2025-11-20 08:00:00'),

-- operator1: On break
(3, 'operator1', 'CRETAS_2024_001', '2025-11-20',
 '2025-11-20 09:00:00', NULL,
 '2025-11-20 12:30:00', NULL, 0,
 0, 0,
 'ON_BREAK', 'PRESENT', 2, '生产操作',
 'Mobile-iOS', '上海市浦东新区', false,
 '2025-11-20 09:00:00', '2025-11-20 12:30:00'),

-- testuser2: Completed (early shift)
(5, 'testuser2', 'CRETAS_2024_001', '2025-11-20',
 '2025-11-20 07:00:00', '2025-11-20 16:00:00',
 '2025-11-20 11:30:00', '2025-11-20 12:30:00', 60,
 480, 0,
 'COMPLETED', 'PRESENT', 2, '生产操作',
 'Mobile-Android', '上海市浦东新区', false,
 '2025-11-20 07:00:00', '2025-11-20 16:00:00');

-- Verify data
SELECT
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT clock_date) as unique_dates,
    MIN(clock_date) as earliest_date,
    MAX(clock_date) as latest_date
FROM time_clock_records
WHERE factory_id = 'CRETAS_2024_001';
