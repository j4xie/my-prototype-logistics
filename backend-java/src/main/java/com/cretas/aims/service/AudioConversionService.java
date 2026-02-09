package com.cretas.aims.service;

/**
 * 音频格式转换服务接口
 * 用于将 Android 录制的音频转换为讯飞 API 要求的格式
 *
 * @author Cretas Team
 * @since 2026-01-08
 */
public interface AudioConversionService {

    /**
     * 将 Base64 编码的音频转换为 PCM 格式
     *
     * @param audioBase64 原始音频的 Base64 编码
     * @param inputFormat 输入格式 (如: "m4a", "aac", "3gp", "wav")
     * @return 转换后的 PCM 音频 Base64 编码 (16kHz, mono, 16bit)
     */
    String convertToPcm(String audioBase64, String inputFormat);

    /**
     * 检测音频格式
     *
     * @param audioBytes 音频数据字节数组
     * @return 检测到的格式 (如: "wav", "m4a", "aac", "3gp", "unknown")
     */
    String detectFormat(byte[] audioBytes);

    /**
     * 检查音频是否已经是 PCM 格式
     *
     * @param audioBytes 音频数据字节数组
     * @return true 如果是 PCM 格式
     */
    boolean isPcmFormat(byte[] audioBytes);
}
