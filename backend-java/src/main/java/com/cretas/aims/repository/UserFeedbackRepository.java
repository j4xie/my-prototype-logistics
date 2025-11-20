package com.cretas.aims.repository;

import com.cretas.aims.entity.UserFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 用户反馈数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-20
 */
@Repository
public interface UserFeedbackRepository extends JpaRepository<UserFeedback, Integer> {
    /**
     * 根据工厂ID查找反馈列表
     */
    List<UserFeedback> findByFactoryIdOrderByCreatedAtDesc(String factoryId);

    /**
     * 根据工厂ID和用户ID查找反馈列表
     */
    List<UserFeedback> findByFactoryIdAndUserIdOrderByCreatedAtDesc(String factoryId, Integer userId);

    /**
     * 根据工厂ID和状态查找反馈列表
     */
    List<UserFeedback> findByFactoryIdAndStatusOrderByCreatedAtDesc(String factoryId, String status);
}
