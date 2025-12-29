package com.cretas.aims.service;

import com.cretas.aims.dto.voice.VoiceRecognitionRequest;
import com.cretas.aims.dto.voice.VoiceRecognitionResponse;

/**
 * 讯飞语音识别服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
public interface IFlytekVoiceService {

    /**
     * 语音识别
     *
     * @param request 语音识别请求
     * @return 识别结果
     */
    VoiceRecognitionResponse recognize(VoiceRecognitionRequest request);

    /**
     * 检查服务是否可用
     *
     * @return true-可用，false-不可用
     */
    boolean isAvailable();

    /**
     * 获取服务版本信息
     *
     * @return 版本信息
     */
    String getVersion();
}
