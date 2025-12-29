package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.voice.VoiceRecognitionRequest;
import com.cretas.aims.dto.voice.VoiceRecognitionResponse;
import com.cretas.aims.service.IFlytekVoiceService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.Map;

/**
 * 语音识别控制器
 * 提供讯飞语音识别代理 API
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@RestController
@RequestMapping("/api/mobile/voice")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class VoiceRecognitionController {

    private final IFlytekVoiceService voiceService;

    /**
     * 语音识别
     *
     * POST /api/mobile/voice/recognize
     *
     * 请求体:
     * {
     *   "audioData": "base64编码的音频数据",
     *   "format": "raw",
     *   "encoding": "raw",
     *   "sampleRate": 16000,
     *   "language": "zh_cn",
     *   "ptt": true
     * }
     *
     * 响应:
     * {
     *   "success": true,
     *   "data": {
     *     "code": 0,
     *     "message": "识别成功",
     *     "text": "识别出的文本",
     *     "sid": "会话ID",
     *     "isFinal": true
     *   }
     * }
     */
    @PostMapping("/recognize")
    public ResponseEntity<ApiResponse<VoiceRecognitionResponse>> recognize(
            @Valid @RequestBody VoiceRecognitionRequest request) {

        log.info("收到语音识别请求: format={}, encoding={}, sampleRate={}, audioLength={}",
            request.getFormat(),
            request.getEncoding(),
            request.getSampleRate(),
            request.getAudioData() != null ? request.getAudioData().length() : 0);

        try {
            VoiceRecognitionResponse response = voiceService.recognize(request);

            if (response.getCode() == 0) {
                log.info("语音识别成功: text={}", response.getText());
                return ResponseEntity.ok(ApiResponse.success(response));
            } else {
                log.warn("语音识别失败: code={}, message={}",
                    response.getCode(), response.getMessage());
                return ResponseEntity.ok(ApiResponse.error(response.getMessage()));
            }

        } catch (Exception e) {
            log.error("语音识别异常", e);
            return ResponseEntity.ok(ApiResponse.error("语音识别服务异常: " + e.getMessage()));
        }
    }

    /**
     * 检查语音服务状态
     *
     * GET /api/mobile/voice/health
     */
    @GetMapping("/health")
    public ResponseEntity<ApiResponse<Map<String, Object>>> health() {
        Map<String, Object> status = new HashMap<>();
        status.put("available", voiceService.isAvailable());
        status.put("version", voiceService.getVersion());
        status.put("provider", "iFlytek");

        return ResponseEntity.ok(ApiResponse.success(status));
    }

    /**
     * 获取支持的音频格式
     *
     * GET /api/mobile/voice/formats
     */
    @GetMapping("/formats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSupportedFormats() {
        Map<String, Object> formats = new HashMap<>();

        formats.put("sampleRates", new int[]{16000, 8000});
        formats.put("formats", new String[]{"raw", "mp3", "speex", "speex-wb"});
        formats.put("encodings", new String[]{"raw", "lame", "speex", "speex-wb"});
        formats.put("languages", new String[]{"zh_cn", "en_us"});
        formats.put("maxDuration", 60);

        return ResponseEntity.ok(ApiResponse.success(formats));
    }
}
