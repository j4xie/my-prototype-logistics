package com.cretas.aims.controller;

import com.cretas.aims.entity.ReleaseNote;
import com.cretas.aims.repository.ReleaseNoteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * U-FEED-1 (Sprint 4 Wave 2 Chat L) — release-note feed endpoint.
 *
 * Read-only feed for all authenticated users; no RBAC gate since these are
 * non-confidential system announcements. (Admin write endpoints not in this
 * PR — release notes seeded via SQL or admin UI in follow-up.)
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/system/release-notes")
@RequiredArgsConstructor
public class ReleaseNoteController {

    private final ReleaseNoteRepository repository;

    @GetMapping
    public Map<String, Object> listActive(
            @RequestParam(value = "limit", defaultValue = "10") int limit
    ) {
        int capped = Math.max(1, Math.min(limit, 50));
        List<ReleaseNote> notes = repository.findActive(LocalDate.now());
        if (notes.size() > capped) {
            notes = notes.subList(0, capped);
        }
        return Map.of(
                "success", true,
                "data", Map.of(
                        "content", notes,
                        "total", notes.size()
                )
        );
    }
}
