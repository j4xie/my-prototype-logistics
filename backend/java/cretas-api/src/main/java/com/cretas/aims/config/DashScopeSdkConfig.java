package com.cretas.aims.config;

import com.alibaba.dashscope.aigc.generation.Generation;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * DashScope SDK 配置类
 * 提供 Generation bean 用于 ArenaRL 锦标赛服务
 *
 * @author Cretas Team
 * @since 2026-01-19
 */
@Configuration
public class DashScopeSdkConfig {

    /**
     * 提供 DashScope Generation 实例
     * ArenaRLTournamentServiceImpl 需要此 bean
     */
    @Bean
    public Generation dashScopeGeneration() {
        return new Generation();
    }
}
