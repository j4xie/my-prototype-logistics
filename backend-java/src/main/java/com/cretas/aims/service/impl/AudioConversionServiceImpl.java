package com.cretas.aims.service.impl;

import com.cretas.aims.service.AudioConversionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ws.schild.jave.Encoder;
import ws.schild.jave.MultimediaObject;
import ws.schild.jave.encode.AudioAttributes;
import ws.schild.jave.encode.EncodingAttributes;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.UUID;

/**
 * 音频格式转换服务实现
 * 使用 JAVE2 库将 Android 录制的音频转换为讯飞要求的 PCM 格式
 *
 * @author Cretas Team
 * @since 2026-01-08
 */
@Service
@Slf4j
public class AudioConversionServiceImpl implements AudioConversionService {

    // 讯飞要求的 PCM 参数
    private static final int TARGET_SAMPLE_RATE = 16000;
    private static final int TARGET_CHANNELS = 1;
    private static final int TARGET_BIT_DEPTH = 16;

    @Override
    public String convertToPcm(String audioBase64, String inputFormat) {
        if (audioBase64 == null || audioBase64.isEmpty()) {
            log.warn("音频数据为空，跳过转换");
            return audioBase64;
        }

        Path tempInputPath = null;
        Path tempOutputPath = null;

        try {
            // 解码 Base64
            byte[] audioBytes = Base64.getDecoder().decode(audioBase64);

            // 检测实际格式
            String detectedFormat = detectFormat(audioBytes);
            log.info("检测到音频格式: {}, 声明格式: {}, 数据大小: {} bytes",
                     detectedFormat, inputFormat, audioBytes.length);

            // 如果已经是 PCM/WAV 且采样率正确，尝试直接使用
            if (isPcmFormat(audioBytes)) {
                log.info("音频已是 PCM 格式，检查是否需要跳过 WAV 头");
                return stripWavHeaderIfNeeded(audioBytes);
            }

            // 创建临时文件
            String suffix = "." + (detectedFormat.equals("unknown") ? inputFormat : detectedFormat);
            tempInputPath = Files.createTempFile("audio_input_" + UUID.randomUUID(), suffix);
            tempOutputPath = Files.createTempFile("audio_output_" + UUID.randomUUID(), ".wav");

            // 写入输入文件
            Files.write(tempInputPath, audioBytes);
            log.info("临时输入文件: {}", tempInputPath);

            // 配置 JAVE2 转换参数
            AudioAttributes audioAttrs = new AudioAttributes();
            audioAttrs.setCodec("pcm_s16le");  // 16-bit PCM
            audioAttrs.setSamplingRate(TARGET_SAMPLE_RATE);
            audioAttrs.setChannels(TARGET_CHANNELS);
            audioAttrs.setBitRate(TARGET_SAMPLE_RATE * TARGET_BIT_DEPTH * TARGET_CHANNELS);

            EncodingAttributes encodingAttrs = new EncodingAttributes();
            encodingAttrs.setOutputFormat("wav");
            encodingAttrs.setAudioAttributes(audioAttrs);

            // 执行转换
            Encoder encoder = new Encoder();
            MultimediaObject source = new MultimediaObject(tempInputPath.toFile());

            log.info("开始音频转换: {} -> PCM (16kHz, mono, 16bit)", detectedFormat);
            encoder.encode(source, tempOutputPath.toFile(), encodingAttrs);
            log.info("音频转换完成，输出文件: {}", tempOutputPath);

            // 读取输出文件并跳过 WAV 头 (44 字节)
            byte[] wavBytes = Files.readAllBytes(tempOutputPath);
            log.info("转换后 WAV 文件大小: {} bytes", wavBytes.length);

            return stripWavHeaderIfNeeded(wavBytes);

        } catch (Exception e) {
            log.error("音频转换失败，返回原始数据: {}", e.getMessage(), e);
            return audioBase64;
        } finally {
            // 清理临时文件
            try {
                if (tempInputPath != null) {
                    Files.deleteIfExists(tempInputPath);
                    log.debug("已删除临时输入文件: {}", tempInputPath);
                }
                if (tempOutputPath != null) {
                    Files.deleteIfExists(tempOutputPath);
                    log.debug("已删除临时输出文件: {}", tempOutputPath);
                }
            } catch (Exception e) {
                log.warn("清理临时文件失败: {}", e.getMessage());
            }
        }
    }

    @Override
    public String detectFormat(byte[] audioBytes) {
        if (audioBytes == null || audioBytes.length < 12) {
            return "unknown";
        }

        // WAV: "RIFF....WAVE"
        if (audioBytes[0] == 'R' && audioBytes[1] == 'I' && audioBytes[2] == 'F' && audioBytes[3] == 'F' &&
            audioBytes[8] == 'W' && audioBytes[9] == 'A' && audioBytes[10] == 'V' && audioBytes[11] == 'E') {
            return "wav";
        }

        // MP4/M4A: "ftyp" at offset 4
        if (audioBytes.length > 8 &&
            audioBytes[4] == 'f' && audioBytes[5] == 't' && audioBytes[6] == 'y' && audioBytes[7] == 'p') {
            // 进一步检查具体类型
            if (audioBytes.length > 11) {
                String brand = new String(audioBytes, 8, 4);
                log.debug("检测到 ftyp 品牌: {}", brand);
                if (brand.startsWith("3gp")) {
                    return "3gp";
                }
            }
            return "m4a";
        }

        // AAC ADTS: starts with 0xFF 0xF1 or 0xFF 0xF9
        if ((audioBytes[0] & 0xFF) == 0xFF && ((audioBytes[1] & 0xF0) == 0xF0)) {
            return "aac";
        }

        // MP3: ID3 or 0xFF 0xFB/0xFF 0xFA
        if ((audioBytes[0] == 'I' && audioBytes[1] == 'D' && audioBytes[2] == '3') ||
            ((audioBytes[0] & 0xFF) == 0xFF && (audioBytes[1] & 0xE0) == 0xE0)) {
            return "mp3";
        }

        // OGG: "OggS"
        if (audioBytes[0] == 'O' && audioBytes[1] == 'g' && audioBytes[2] == 'g' && audioBytes[3] == 'S') {
            return "ogg";
        }

        // AMR: "#!AMR"
        if (audioBytes[0] == '#' && audioBytes[1] == '!' && audioBytes[2] == 'A' &&
            audioBytes[3] == 'M' && audioBytes[4] == 'R') {
            return "amr";
        }

        // WEBM: 0x1A 0x45 0xDF 0xA3
        if ((audioBytes[0] & 0xFF) == 0x1A && (audioBytes[1] & 0xFF) == 0x45 &&
            (audioBytes[2] & 0xFF) == 0xDF && (audioBytes[3] & 0xFF) == 0xA3) {
            return "webm";
        }

        log.warn("无法识别音频格式，前16字节: {}", bytesToHex(audioBytes, 16));
        return "unknown";
    }

    @Override
    public boolean isPcmFormat(byte[] audioBytes) {
        if (audioBytes == null || audioBytes.length < 44) {
            return false;
        }

        // 检查 WAV 头
        if (audioBytes[0] != 'R' || audioBytes[1] != 'I' || audioBytes[2] != 'F' || audioBytes[3] != 'F' ||
            audioBytes[8] != 'W' || audioBytes[9] != 'A' || audioBytes[10] != 'V' || audioBytes[11] != 'E') {
            return false;
        }

        // 检查是否是 PCM (格式代码 1)
        // WAV 格式码在 offset 20-21 (little-endian)
        int formatCode = (audioBytes[20] & 0xFF) | ((audioBytes[21] & 0xFF) << 8);
        boolean isPcm = formatCode == 1;

        if (isPcm) {
            // 读取采样率 (offset 24-27, little-endian)
            int sampleRate = (audioBytes[24] & 0xFF) |
                            ((audioBytes[25] & 0xFF) << 8) |
                            ((audioBytes[26] & 0xFF) << 16) |
                            ((audioBytes[27] & 0xFF) << 24);
            // 读取通道数 (offset 22-23, little-endian)
            int channels = (audioBytes[22] & 0xFF) | ((audioBytes[23] & 0xFF) << 8);

            log.info("WAV PCM 参数: 采样率={}, 通道数={}", sampleRate, channels);
        }

        return isPcm;
    }

    /**
     * 如果是 WAV 格式，跳过头部，返回纯 PCM 数据的 Base64
     */
    private String stripWavHeaderIfNeeded(byte[] audioBytes) {
        if (audioBytes == null || audioBytes.length < 44) {
            return Base64.getEncoder().encodeToString(audioBytes);
        }

        // 检查是否有 WAV 头
        if (audioBytes[0] == 'R' && audioBytes[1] == 'I' && audioBytes[2] == 'F' && audioBytes[3] == 'F') {
            // 查找 "data" 标记的实际位置
            int dataOffset = findDataChunkOffset(audioBytes);
            if (dataOffset > 0 && dataOffset < audioBytes.length) {
                log.info("跳过 WAV 头，data 偏移量: {}, PCM 数据大小: {} bytes",
                         dataOffset, audioBytes.length - dataOffset);
                byte[] pcmBytes = new byte[audioBytes.length - dataOffset];
                System.arraycopy(audioBytes, dataOffset, pcmBytes, 0, pcmBytes.length);
                return Base64.getEncoder().encodeToString(pcmBytes);
            }
        }

        return Base64.getEncoder().encodeToString(audioBytes);
    }

    /**
     * 查找 WAV 文件中 "data" chunk 的实际数据开始位置
     */
    private int findDataChunkOffset(byte[] audioBytes) {
        // 搜索 "data" 标记
        for (int i = 12; i < audioBytes.length - 8; i++) {
            if (audioBytes[i] == 'd' && audioBytes[i + 1] == 'a' &&
                audioBytes[i + 2] == 't' && audioBytes[i + 3] == 'a') {
                // "data" 后面 4 字节是 chunk size，实际数据从第 8 字节开始
                return i + 8;
            }
        }
        // 默认 WAV 头大小
        return 44;
    }

    /**
     * 将字节数组转换为十六进制字符串（用于调试）
     */
    private String bytesToHex(byte[] bytes, int maxLength) {
        StringBuilder sb = new StringBuilder();
        int len = Math.min(bytes.length, maxLength);
        for (int i = 0; i < len; i++) {
            sb.append(String.format("%02X ", bytes[i] & 0xFF));
        }
        return sb.toString().trim();
    }
}
