package com.cretas.aims.repository;

import com.cretas.aims.entity.scale.ScaleProtocolTestCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 秤协议测试用例 Repository
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Repository
public interface ScaleProtocolTestCaseRepository extends JpaRepository<ScaleProtocolTestCase, String> {

    /**
     * 查找某协议的所有测试用例
     */
    List<ScaleProtocolTestCase> findByProtocolIdOrderByPriorityAsc(String protocolId);

    /**
     * 查找某协议的启用测试用例
     */
    List<ScaleProtocolTestCase> findByProtocolIdAndIsActiveTrueOrderByPriorityAsc(String protocolId);

    /**
     * 查找失败的测试用例
     */
    List<ScaleProtocolTestCase> findByLastRunResult(ScaleProtocolTestCase.TestResult lastRunResult);

    /**
     * 查找正面测试用例 (非负面测试)
     */
    List<ScaleProtocolTestCase> findByProtocolIdAndIsNegativeTestFalseAndIsActiveTrue(String protocolId);

    /**
     * 查找负面测试用例
     */
    List<ScaleProtocolTestCase> findByProtocolIdAndIsNegativeTestTrueAndIsActiveTrue(String protocolId);

    /**
     * 删除某协议的所有测试用例
     */
    void deleteByProtocolId(String protocolId);
}
