# Design Harness Audit Report

## Run Summary

- Run ID: `2026-10-06-165146544Z`
- Target: http://127.0.0.1:4173/#/lr
- Status: `success`
- Started: 2026-10-06T16:51:46.544Z
- Duration: 2494ms
- Viewports: desktop-1440 (1440x900), laptop-1280 (1280x800), tablet-768 (768x1024), mobile-390 (390x844), mobile-360 (360x800)

## Advisory Score

**100/100** (strong)

- Formula: `epistemic-criterion-max-v2`
- Deduction model: one maximum scoreable occurrence per criterion, with legacy findings grouped by check name.
- Grouped pre-floor total deduction: 0
- Saturation: no — the grouped pre-floor deduction does not exceed 100.
- Compatibility: formula versions have different semantics; v1 and v2 values are not directly comparable.
- Grouped deductions: none.

Verdict: No deterministic failures in the captured scope.

Note: Advisory score starts at 100 and subtracts the maximum scoreable finding once per criterion (or legacy check name), weighted by severity, confidence, and evidence tier. Needs-review findings are score-exempt and omitted, as are other zero-weight findings. This formula is not directly comparable with epistemic-weight-v1. It is not an objective design-quality grade.

## Findings

No blocking deterministic findings were detected.

## Source-Backed Criteria

No source-backed criteria were attached to this audit.

## Evidence Links

- `screenshot-desktop-1440` (screenshot, desktop-1440): screenshots/desktop-1440.png
- `measurement-desktop-1440` (measurement, desktop-1440): see `audit.json` → `evidenceAssets` → `measurement-desktop-1440`
- `text-inventory-desktop-1440` (text-inventory, desktop-1440): see `audit.json` → `evidenceAssets` → `text-inventory-desktop-1440` (24 item(s))
- `aria-snapshot-desktop-1440` (aria-snapshot, desktop-1440): see `audit.json` → `evidenceAssets` → `aria-snapshot-desktop-1440` (playwright-aria-yaml)
- `screenshot-laptop-1280` (screenshot, laptop-1280): screenshots/laptop-1280.png
- `measurement-laptop-1280` (measurement, laptop-1280): see `audit.json` → `evidenceAssets` → `measurement-laptop-1280`
- `text-inventory-laptop-1280` (text-inventory, laptop-1280): see `audit.json` → `evidenceAssets` → `text-inventory-laptop-1280` (24 item(s))
- `aria-snapshot-laptop-1280` (aria-snapshot, laptop-1280): see `audit.json` → `evidenceAssets` → `aria-snapshot-laptop-1280` (playwright-aria-yaml)
- `screenshot-tablet-768` (screenshot, tablet-768): screenshots/tablet-768.png
- `measurement-tablet-768` (measurement, tablet-768): see `audit.json` → `evidenceAssets` → `measurement-tablet-768`
- `text-inventory-tablet-768` (text-inventory, tablet-768): see `audit.json` → `evidenceAssets` → `text-inventory-tablet-768` (24 item(s))
- `aria-snapshot-tablet-768` (aria-snapshot, tablet-768): see `audit.json` → `evidenceAssets` → `aria-snapshot-tablet-768` (playwright-aria-yaml)
- `screenshot-mobile-390` (screenshot, mobile-390): screenshots/mobile-390.png
- `measurement-mobile-390` (measurement, mobile-390): see `audit.json` → `evidenceAssets` → `measurement-mobile-390`
- `text-inventory-mobile-390` (text-inventory, mobile-390): see `audit.json` → `evidenceAssets` → `text-inventory-mobile-390` (24 item(s))
- `aria-snapshot-mobile-390` (aria-snapshot, mobile-390): see `audit.json` → `evidenceAssets` → `aria-snapshot-mobile-390` (playwright-aria-yaml)
- `screenshot-mobile-360` (screenshot, mobile-360): screenshots/mobile-360.png
- `measurement-mobile-360` (measurement, mobile-360): see `audit.json` → `evidenceAssets` → `measurement-mobile-360`
- `text-inventory-mobile-360` (text-inventory, mobile-360): see `audit.json` → `evidenceAssets` → `text-inventory-mobile-360` (24 item(s))
- `aria-snapshot-mobile-360` (aria-snapshot, mobile-360): see `audit.json` → `evidenceAssets` → `aria-snapshot-mobile-360` (playwright-aria-yaml)

## Recommendations

- Keep the current structure and continue with human visual review.

## Iteration Prompt Scaffold

```text
You are improving a UI using Design Harness evidence.
Target URL: http://127.0.0.1:4173/#/lr
Run ID: 2026-10-06-165146544Z
Use the deterministic findings below as evidence, then make one focused revision pass.
- No blocking deterministic findings were detected. Improve polish while preserving the current layout stability.
After revising, rerun the audit and compare the new report against this one.
```

## Optional Subjective Critique

No subjective critique was supplied. This report only contains deterministic audit findings.
