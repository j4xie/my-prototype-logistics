package com.cretas.aims.repository.voice;

import com.cretas.aims.entity.voice.VoiceRecognitionConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 语音识别配置仓库
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Repository
public interface VoiceRecognitionConfigRepository extends JpaRepository<VoiceRecognitionConfig, Long> {

    /**
     * 按工厂ID查询配置
     */
    Optional<VoiceRecognitionConfig> findByFactoryId(String factoryId);

    /**
     * 检查工厂配置是否存在
     */
    boolean existsByFactoryId(String factoryId);
}
