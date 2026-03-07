# App Manual UI/UX Deep Audit Report

**Date**: 2026-03-05
**Target**: `platform/app-manual/index.html` (~2700 lines, ~129KB)
**URL**: https://www.cretaceousfuture.com/app-manual/
**Mode**: Full | Language: Chinese | Agents: 3 Researchers + Analyst + Critic + Integrator

---

## Executive Summary

`platform/app-manual/index.html` overall quality is good: CSS variable system well-established, lightbox accessibility fully implemented (aria-modal + focus trap + Escape + focus restore), `prefers-reduced-motion` covered, skip-link implemented. Main improvement areas: semantic headings (24 divs should be h3), minimum font size too small (10 instances of 10-11px), and role-badge color hardcoding. Total: 30 findings — 2 P0, 12 P1, 16 P2.

**Overall Score: 7.2/10** (can reach 8.0+ after P0 fixes)

---

## Consensus & Disagreements

### Verified Consensus

| # | Issue | Verified | Confidence |
|---|-------|----------|------------|
| C1 | 24x `<div class="step-title">` should be `<h3>` | Confirmed | 95% |
| C2 | 10-11px font sizes (10 instances) below readability floor | Confirmed | 98% |
| C3 | 8x `transition: all` (not 5 as initially reported) | Confirmed | 90% |
| C4 | Gradient text missing high-contrast fallback | Confirmed | 90% |
| C5 | Google Fonts render-blocking `<link>` | Confirmed | 85% |
| C6 | CSS variable foundation solid (26 vars in :root) | Confirmed | 100% |

### Resolved Disagreements

| # | Issue | Researcher Claim | Critic Correction | Resolution |
|---|-------|-----------------|-------------------|------------|
| D1 | Lightbox missing aria-modal | Reported missing | Code line 2585 has `role="dialog" aria-modal="true"` + full focus trap | **REMOVED from issues** |
| D2 | Touch targets <44px as P0 | Analyst: P0 | Desktop-primary page, WCAG AA requires 24px | **Downgraded to P1** |
| D3 | 320px breakpoint missing as P0 | Analyst: P0 | `clamp()` handles fluid layout, <0.5% devices | **Downgraded to P2** |
| D4 | SVG noise scroll repaint | Researcher: P1 | `position: fixed` creates compositing layer | **Downgraded to P2** |
| D5 | Role badge hardcoded count | Researcher: 5/5 | Actual: 6/9 hardcoded, 3 already use CSS vars | **Corrected count** |

---

## Priority List

### P0 — Must Fix (2 items)

**P0-1: Semantic Headings (24x div → h3)**
- Impact: Screen readers cannot navigate chapter structure; SEO missing content hierarchy
- Fix: Batch replace `<div class="step-title">` → `<h3 class="step-title">`, add CSS reset `margin: 0; font-size: inherit;`
- Effort: ~30 min

**P0-2: Minimum Font Size (10-11px → 12-13px)**
- Impact: WCAG 1.4.4 compliance, mobile readability
- Selectors: `.hero-role-sub`, `.chapter-tag`, `.step-label`, `.role-badge`, `.phone-label`, `.step-number`, `.timeline-tip`
- Effort: ~20 min

### P1 — Short-term (12 items)

| # | Issue | Confidence | Fix |
|---|-------|-----------|-----|
| P1-1 | Role badge 6/9 colors hardcoded | 85% | Extract to CSS variables |
| P1-2 | `transition: all` 8 instances | 90% | Replace with specific properties |
| P1-3 | Nav touch targets ~34px height | 75% | Increase padding to 44px height |
| P1-4 | Google Fonts render-blocking | 85% | Add `<link rel="preload">` |
| P1-5 | High-contrast gradient text invisible | 90% | Add `@media (forced-colors: active)` fallback |
| P1-6 | No `focus-visible` styles | 80% | Add global `:focus-visible` outline |
| P1-7 | `scroll-behavior` not in reduced-motion | 80% | Add `html { scroll-behavior: auto; }` in media query |
| P1-8 | Font sizes lack design tokens | 70% | Add `--text-xs/sm/base/lg/xl/2xl` variables |
| P1-9 | z-index values unmanaged | 70% | Add `--z-nav/overlay/lightbox` variables |
| P1-10 | box-shadow inconsistent | 65% | Add `--shadow-sm/md/lg` variables |
| P1-11 | Some img alt attributes empty | 75% | Verify all phone-screen imgs have alt |
| P1-12 | Sections missing `aria-labelledby` | 70% | Associate each section with its h2 id |

### P2 — Optional (16 items)

320px breakpoint, SVG noise optimization, CSS externalization, `will-change` optimization, nav active state enhancement, `<picture>` + WebP, lazy loading audit, line-height tuning, decorative text contrast, mobile hamburger menu, TOC anchor enhancement, print stylesheet expansion, CSP meta tag, OG image size verification, `theme-color` meta, multi-size favicon.

---

## Systemic Patterns

1. **Token coverage incomplete**: Color vars (26) well done, but font-size/shadow/z-index not tokenized → hardcoded values scattered
2. **Semantic HTML awareness gap**: All step-titles use div, reflecting visual-driven (not structure-driven) development
3. **Uneven a11y investment**: Lightbox (aria-modal/focus trap/Escape/focus restore) excellent, but heading hierarchy and font floors neglected — a11y effort concentrated on interactive components, not content structure

---

## Action Plan

### Immediate (this week)
1. 24x `<div class="step-title">` → `<h3 class="step-title">`
2. 10x 10-11px font sizes → 12-13px minimum

### Short-term (2 weeks)
3. Role badge colors → CSS variables
4. `transition: all` → specific properties
5. Add `@media (forced-colors: active)` fallback
6. Google Fonts `<link>` → add `rel="preload"`
7. Add global `:focus-visible` styles
8. `prefers-reduced-motion` → add `scroll-behavior: auto`

### Conditional (when needed)
9. Font-size/shadow/z-index tokenization (next major revision)
10. 320px breakpoint (only if small-screen feedback received)
11. Screenshot WebP optimization (when image count grows)

---

## Dimension Scores

| Dimension | Score (1-10) | Notes |
|-----------|-------------|-------|
| Visual Design | 8.5 | Mature dark theme, polished animations, elegant typography |
| CSS Engineering | 7.0 | Good variable foundation, incomplete token coverage |
| Accessibility | 6.0 | Lightbox excellent, headings/font-size/contrast gaps |
| Performance | 7.5 | Core metrics reasonable, font loading and images improvable |
| Responsive | 7.0 | Good clamp() usage, narrow screens and mobile nav gaps |
| **Overall** | **7.2** | Above average, can reach 8.0+ after P0 fixes |

---

## Process Note
- Mode: Full
- Researchers deployed: 3 (CSS/Visual, Responsive/A11y/Perf, Browser Explorer)
- Browser explorer: ON (1 page visited)
- Total sources found: 36+
- Key disagreements: 5 resolved (1 factual error corrected, 3 priority downgrades, 1 count correction)
- Phases completed: Research (parallel) + Browser → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase-grounded audit)
- Healer: All checks passed
- Competitor profiles: N/A
