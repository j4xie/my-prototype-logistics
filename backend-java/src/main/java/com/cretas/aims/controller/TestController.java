package com.cretas.aims.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

/**
 * 测试控制器 - 仅用于开发测试
 * 生产环境应该删除此文件
 */
@Tag(name = "测试接口")
@RestController
@RequestMapping("/api/test")
@RequiredArgsConstructor
public class TestController {

    private final PasswordEncoder passwordEncoder;

    @Operation(summary = "生成BCrypt密码哈希")
    @GetMapping("/encode-password")
    public String encodePassword(@RequestParam String password) {
        return passwordEncoder.encode(password);
    }

    @Operation(summary = "验证BCrypt密码")
    @GetMapping("/verify-password")
    public String verifyPassword(@RequestParam String rawPassword, @RequestParam String encodedPassword) {
        boolean matches = passwordEncoder.matches(rawPassword, encodedPassword);
        return "Password matches: " + matches;
    }
}
