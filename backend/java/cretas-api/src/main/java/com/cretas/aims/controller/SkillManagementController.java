package com.cretas.aims.controller;

import com.cretas.aims.entity.smartbi.SmartBiSkill;
import com.cretas.aims.repository.smartbi.SmartBiSkillRepository;
import com.cretas.aims.service.governance.ToolAutoComposerService;
import com.cretas.aims.service.governance.ToolAutoComposerService.SkillRecommendation;
import com.cretas.aims.service.skill.SkillRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Skill 管理 REST API
 *
 * 提供 Skill CRUD + Tool 共现分析 + 自动组合推荐。
 * 配合 governance 元工具使用，也可直接从 web-admin 调用。
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/governance/skills")
@RequiredArgsConstructor
public class SkillManagementController {

    private final SmartBiSkillRepository skillRepository;
    private final SkillRegistry skillRegistry;
    private final ToolAutoComposerService autoComposerService;

    /**
     * 列出所有 Skills（来自 SkillRegistry，包含 DB + file + default）
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> listSkills() {
        List<Map<String, Object>> skills = autoComposerService.listAllSkills();
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", skills,
                "message", "共 " + skills.size() + " 个 Skill"
        ));
    }

    /**
     * 获取 Skill 详情
     */
    @GetMapping("/{skillName}")
    public ResponseEntity<Map<String, Object>> getSkill(@PathVariable String skillName) {
        var skillDef = skillRegistry.getSkill(skillName);
        if (skillDef.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "Skill '" + skillName + "' 不存在"
            ));
        }
        var def = skillDef.get();
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", Map.of(
                        "name", def.getName(),
                        "displayName", def.getDisplayName() != null ? def.getDisplayName() : "",
                        "description", def.getDescription() != null ? def.getDescription() : "",
                        "tools", def.getTools() != null ? def.getTools() : List.of(),
                        "triggers", def.getTriggers() != null ? def.getTriggers() : List.of(),
                        "source", def.getSource() != null ? def.getSource() : "unknown",
                        "version", def.getVersion() != null ? def.getVersion() : "1.0.0",
                        "enabled", def.isEnabled(),
                        "hasExecutionGraph", def.hasExecutionGraph()
                )
        ));
    }

    /**
     * 创建新 Skill (仅管理员)
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN', 'PLATFORM_ADMIN')")
    public ResponseEntity<Map<String, Object>> createSkill(@RequestBody Map<String, Object> body) {
        try {
            String name = (String) body.get("name");
            String displayName = (String) body.get("displayName");
            List<String> tools = (List<String>) body.get("tools");
            List<String> triggers = (List<String>) body.get("triggers");
            String description = (String) body.get("description");
            String category = (String) body.get("category");

            if (name == null || tools == null || tools.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", "name 和 tools 为必填项"
                ));
            }

            // displayName 为 nullable=false，自动填充
            if (displayName == null || displayName.isBlank()) {
                displayName = name.replace("-", " ").replace("_", " ");
            }

            SmartBiSkill skill = autoComposerService.composeSkill(
                    name, displayName, tools, triggers, description, category);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", Map.of("id", skill.getId(), "name", skill.getName()),
                    "message", "Skill '" + name + "' 创建成功"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", e.getMessage()
            ));
        }
    }

    /**
     * 启用/禁用 Skill (仅管理员)
     */
    @RequestMapping(value = "/{skillName}/active", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN', 'PLATFORM_ADMIN')")
    public ResponseEntity<Map<String, Object>> toggleSkill(
            @PathVariable String skillName,
            @RequestBody Map<String, Boolean> body) {
        Optional<SmartBiSkill> skillOpt = skillRepository.findByName(skillName);
        if (skillOpt.isEmpty()) {
            return ResponseEntity.ok(Map.of("success", false, "message", "Skill 不存在"));
        }
        SmartBiSkill skill = skillOpt.get();
        skill.setEnabled(body.getOrDefault("enabled", true));
        skillRepository.save(skill);
        skillRegistry.refresh();
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Skill '" + skillName + "' 已" + (skill.getEnabled() ? "启用" : "禁用")
        ));
    }

    /**
     * 删除 Skill (仅管理员，且仅 DB skill 可删除)
     */
    @DeleteMapping("/{skillName}")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN', 'PLATFORM_ADMIN')")
    public ResponseEntity<Map<String, Object>> deleteSkill(@PathVariable String skillName) {
        Optional<SmartBiSkill> skillOpt = skillRepository.findByName(skillName);
        if (skillOpt.isEmpty()) {
            return ResponseEntity.ok(Map.of("success", false, "message", "Skill 不存在或不是数据库 Skill"));
        }
        skillRepository.delete(skillOpt.get());
        skillRegistry.refresh();
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Skill '" + skillName + "' 已删除"
        ));
    }

    // --- Auto-composition endpoints ---

    /**
     * 获取 Tool 共现模式分析
     */
    @GetMapping("/patterns")
    public ResponseEntity<Map<String, Object>> getPatterns(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "3") int minCount) {
        var coOccurrences = autoComposerService.mineCoOccurrences(factoryId, days, minCount);
        var sequences = autoComposerService.mineSequences(factoryId, days, minCount);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", Map.of(
                        "co_occurrences", coOccurrences,
                        "sequences", sequences,
                        "period_days", days
                )
        ));
    }

    /**
     * 获取 Skill 自动组合推荐
     */
    @GetMapping("/recommendations")
    public ResponseEntity<Map<String, Object>> getRecommendations(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "30") int days) {
        List<SkillRecommendation> recommendations = autoComposerService
                .generateRecommendations(factoryId, days);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", recommendations,
                "message", "共 " + recommendations.size() + " 个推荐"
        ));
    }
}
