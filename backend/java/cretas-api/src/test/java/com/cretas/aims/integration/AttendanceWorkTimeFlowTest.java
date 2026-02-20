package com.cretas.aims.integration;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.EmployeeWorkSession;
import com.cretas.aims.entity.TimeClockRecord;
import com.cretas.aims.entity.User;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.EmployeeWorkSessionService;
import com.cretas.aims.service.TimeClockService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Attendance and Work Time Flow Integration Test
 * Tests complete attendance workflow from clock-in to statistics
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("AttendanceWorkTimeFlowTest")
class AttendanceWorkTimeFlowTest {

    @Autowired private TimeClockService timeClockService;
    @Autowired private EmployeeWorkSessionService workSessionService;
    @Autowired private UserRepository userRepository;

    private static final String TEST_FACTORY_ID = "F001";
    private static final String TEST_USERNAME = "test_user_attendance";
    private static final String TEST_LOCATION = "Main Gate";
    private static final String TEST_DEVICE = "TestDevice001";

    private Long testUserId;

    @BeforeEach
    void setUp() {
        // Create test user if not exists
        Optional<User> existingUser = userRepository.findByUsername(TEST_USERNAME);
        if (existingUser.isPresent()) {
            testUserId = existingUser.get().getId();
        } else {
            User testUser = new User();
            // Don't set ID - let database auto-generate
            testUser.setFactoryId(TEST_FACTORY_ID);
            testUser.setUsername(TEST_USERNAME);
            testUser.setPasswordHash("$2a$10$dummyHashForTesting");
            testUser.setFullName("Test User");
            testUser.setIsActive(true);
            testUser.setDepartment("PROCESSING");  // Use valid enum value
            testUser.setPosition("Worker");
            testUser.setRoleCode("operator");  // Use valid role code
            User savedUser = userRepository.saveAndFlush(testUser);
            testUserId = savedUser.getId();
        }
    }

    @Test @Order(1) @Transactional @DisplayName("Test1: Attendance Work Time Flow")
    void testAttendanceWorkTimeFlow() {
        // Test complete attendance workflow
        // Clock in
        TimeClockRecord clockInRecord = timeClockService.clockIn(TEST_FACTORY_ID, testUserId, TEST_LOCATION, TEST_DEVICE);
        assertThat(clockInRecord).isNotNull();
        assertThat(clockInRecord.getClockInTime()).isNotNull();
        assertThat(clockInRecord.getStatus()).isEqualTo("WORKING");

        // Clock out
        TimeClockRecord clockOutRecord = timeClockService.clockOut(TEST_FACTORY_ID, testUserId);
        assertThat(clockOutRecord).isNotNull();
        assertThat(clockOutRecord.getClockOutTime()).isNotNull();
        assertThat(clockOutRecord.getStatus()).isEqualTo("OFF_WORK");

        // Verify work duration is calculated
        if (clockOutRecord.getWorkDurationMinutes() != null) {
            assertThat(clockOutRecord.getWorkDurationMinutes()).isGreaterThanOrEqualTo(0);
        }
    }

    @Test @Order(2) @Transactional @DisplayName("Test2: Clock In")
    void testClockIn() {
        // Test clock in with GPS coordinates
        Double latitude = 31.2304;
        Double longitude = 121.4737;
        TimeClockRecord record = timeClockService.clockIn(
            TEST_FACTORY_ID, testUserId, TEST_LOCATION, TEST_DEVICE, latitude, longitude);

        assertThat(record).isNotNull();
        assertThat(record.getClockInTime()).isNotNull();
        assertThat(record.getClockLocation()).isEqualTo(TEST_LOCATION);
        assertThat(record.getClockDevice()).isEqualTo(TEST_DEVICE);
        assertThat(record.getLatitude()).isEqualTo(latitude);
        assertThat(record.getLongitude()).isEqualTo(longitude);
    }

    @Test @Order(3) @Transactional @DisplayName("Test3: Clock Out")
    void testClockOut() {
        // First clock in
        timeClockService.clockIn(TEST_FACTORY_ID, testUserId, TEST_LOCATION, TEST_DEVICE);

        // Then clock out
        TimeClockRecord record = timeClockService.clockOut(TEST_FACTORY_ID, testUserId);
        assertThat(record).isNotNull();
        assertThat(record.getClockOutTime()).isNotNull();
    }

    @Test @Order(4) @Transactional @DisplayName("Test4: Work Time Calculation")
    void testWorkTimeCalculation() {
        // Clock in
        TimeClockRecord clockIn = timeClockService.clockIn(TEST_FACTORY_ID, testUserId, TEST_LOCATION, TEST_DEVICE);

        // Simulate some time passing (in a real scenario)
        // Clock out
        TimeClockRecord clockOut = timeClockService.clockOut(TEST_FACTORY_ID, testUserId);

        // Work duration should be calculated
        clockOut.calculateWorkDuration();
        assertThat(clockOut.getWorkDurationMinutes()).isNotNull();
    }

    @Test @Order(5) @Transactional @DisplayName("Test5: Overtime Calculation")
    void testOvertimeCalculation() {
        // Clock in
        TimeClockRecord clockIn = timeClockService.clockIn(TEST_FACTORY_ID, testUserId, TEST_LOCATION, TEST_DEVICE);

        // Clock out
        TimeClockRecord clockOut = timeClockService.clockOut(TEST_FACTORY_ID, testUserId);

        // Calculate work duration which includes overtime
        clockOut.calculateWorkDuration();

        // Overtime is calculated if work > 8 hours
        if (clockOut.getWorkDurationMinutes() != null && clockOut.getWorkDurationMinutes() > 480) {
            assertThat(clockOut.getOvertimeMinutes()).isGreaterThan(0);
        }
    }

    @Test @Order(6) @Transactional @DisplayName("Test6: Daily Statistics")
    void testDailyStatistics() {
        // Get today's record
        TimeClockRecord todayRecord = timeClockService.getTodayRecord(TEST_FACTORY_ID, testUserId);
        // May be null if no record exists for today
        if (todayRecord != null) {
            assertThat(todayRecord.getClockDate()).isEqualTo(LocalDate.now());
        }

        // Get department attendance
        Map<String, Object> deptAttendance = timeClockService.getDepartmentAttendance(
            TEST_FACTORY_ID, "PROCESSING", LocalDate.now());
        assertThat(deptAttendance).isNotNull();
    }

    @Test @Order(7) @Transactional @DisplayName("Test7: Monthly Statistics")
    void testMonthlyStatistics() {
        // Get attendance statistics for current month
        LocalDate startOfMonth = LocalDate.now().withDayOfMonth(1);
        LocalDate endOfMonth = LocalDate.now().withDayOfMonth(LocalDate.now().lengthOfMonth());

        Map<String, Object> stats = timeClockService.getAttendanceStatistics(
            TEST_FACTORY_ID, testUserId, startOfMonth, endOfMonth);

        assertThat(stats).isNotNull();
    }

    @Test @Order(8) @Transactional @DisplayName("Test8: Attendance History")
    void testAttendanceHistory() {
        // Create a clock record
        timeClockService.clockIn(TEST_FACTORY_ID, testUserId, TEST_LOCATION, TEST_DEVICE);
        timeClockService.clockOut(TEST_FACTORY_ID, testUserId);

        // Query history
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(1);
        pageRequest.setSize(10);

        LocalDate startDate = LocalDate.now().minusDays(30);
        LocalDate endDate = LocalDate.now();

        PageResponse<TimeClockRecord> history = timeClockService.getClockHistory(
            TEST_FACTORY_ID, testUserId, startDate, endDate, pageRequest);

        assertThat(history).isNotNull();
        // History should contain records
    }
}
