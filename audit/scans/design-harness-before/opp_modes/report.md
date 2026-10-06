# Design Harness Audit Report

## Run Summary

- Run ID: `2026-10-06-165143682Z`
- Target: http://127.0.0.1:4173/#/opp/modes
- Status: `success`
- Started: 2026-10-06T16:51:43.682Z
- Duration: 2855ms
- Viewports: desktop-1440 (1440x900), laptop-1280 (1280x800), tablet-768 (768x1024), mobile-390 (390x844), mobile-360 (360x800)

## Notices

These configuration and capability notices are informational and do not affect the audit score or status.

- `contrast-elements-skipped`: Some elements whose painted contrast could not be determined from computed styles were skipped; no contrast finding was emitted for them. Details: `{"viewports":\[{"viewport":"desktop-1440","skippedElementCount":4,"skippedByReason":{"background-image":4}},{"viewport":"laptop-1280","skippedElementCount":4,"skippedByReason":{"background-image":4}},{"viewport":"mobile-360","skippedElementCount":4,"skippedByReason":{"background-image":4}},{"viewport":"mobile-390","skippedElementCount":4,"skippedByReason":{"background-image":4}},{"viewport":"tablet-768","skippedElementCount":4,"skippedByReason":{"background-image":4}}\]}`.

## Advisory Score

**86.5/100** (usable)

- Formula: `epistemic-criterion-max-v2`
- Deduction model: one maximum scoreable occurrence per criterion, with legacy findings grouped by check name.
- Grouped pre-floor total deduction: 13.5
- Saturation: no — the grouped pre-floor deduction does not exceed 100.
- Compatibility: formula versions have different semantics; v1 and v2 values are not directly comparable.
- Grouped deductions:
  - `a11y.target-size.minimum`: 4.5 points; 1 occurrence; viewports: `laptop-1280`; representative: `finding-laptop-1280-tap-target-risk-1`. Maximum scoreable occurrence for criterion a11y.target-size.minimum across 1 occurrence; medium accessibility finding with medium confidence; deterministic risk score weight 0.6
  - `a11y.text-contrast.minimum`: 4.5 points; 7 occurrences; viewports: `desktop-1440`, `laptop-1280`, `mobile-360`, `mobile-390`, `tablet-768`; representative: `finding-desktop-1440-contrast-risk-1`. Maximum scoreable occurrence for criterion a11y.text-contrast.minimum across 7 occurrences; medium accessibility finding with medium confidence; deterministic risk score weight 0.6
  - `hierarchy.heading-structure.sane`: 4.5 points; 5 occurrences; viewports: `desktop-1440`, `laptop-1280`, `mobile-360`, `mobile-390`, `tablet-768`; representative: `finding-desktop-1440-heading-level-skip-1`. Maximum scoreable occurrence for criterion hierarchy.heading-structure.sane across 5 occurrences; medium hierarchy finding with medium confidence; deterministic risk score weight 0.6

Verdict: Usable with 13 deterministic risks.

Note: Advisory score starts at 100 and subtracts the maximum scoreable finding once per criterion (or legacy check name), weighted by severity, confidence, and evidence tier. Needs-review findings are score-exempt and omitted, as are other zero-weight findings. This formula is not directly comparable with epistemic-weight-v1. It is not an objective design-quality grade.

## Findings

### Deterministic Findings: Risks

| ID | Severity | Confidence | Category | Viewport | Determinism | Result | Criterion | Problem | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| finding-desktop-1440-contrast-risk-1 | medium | medium | accessibility | desktop-1440 | deterministic | risk | a11y.text-contrast.minimum | DOM-computed text contrast may be low in div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(1) > span (1.16:1, target 4.5:1). | `screenshot-desktop-1440`, `measurement-desktop-1440`, `text-inventory-desktop-1440`, `aria-snapshot-desktop-1440` |
| finding-desktop-1440-contrast-risk-2 | medium | medium | accessibility | desktop-1440 | deterministic | risk | a11y.text-contrast.minimum | DOM-computed text contrast may be low in div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(2) > span (1.16:1, target 4.5:1). | `screenshot-desktop-1440`, `measurement-desktop-1440`, `text-inventory-desktop-1440`, `aria-snapshot-desktop-1440` |
| finding-desktop-1440-heading-level-skip-1 | medium | medium | hierarchy | desktop-1440 | deterministic | risk | hierarchy.heading-structure.sane | Heading section:nth-of-type(1) > div > h3 jumps from level 1 to level 3. | `screenshot-desktop-1440`, `measurement-desktop-1440`, `text-inventory-desktop-1440`, `aria-snapshot-desktop-1440` |
| finding-laptop-1280-contrast-risk-1 | medium | medium | accessibility | laptop-1280 | deterministic | risk | a11y.text-contrast.minimum | DOM-computed text contrast may be low in div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(1) > span (1.16:1, target 4.5:1). | `screenshot-laptop-1280`, `measurement-laptop-1280`, `text-inventory-laptop-1280`, `aria-snapshot-laptop-1280` |
| finding-laptop-1280-contrast-risk-2 | medium | medium | accessibility | laptop-1280 | deterministic | risk | a11y.text-contrast.minimum | DOM-computed text contrast may be low in div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(2) > span (1.16:1, target 4.5:1). | `screenshot-laptop-1280`, `measurement-laptop-1280`, `text-inventory-laptop-1280`, `aria-snapshot-laptop-1280` |
| finding-laptop-1280-heading-level-skip-1 | medium | medium | hierarchy | laptop-1280 | deterministic | risk | hierarchy.heading-structure.sane | Heading section:nth-of-type(1) > div > h3 jumps from level 1 to level 3. | `screenshot-laptop-1280`, `measurement-laptop-1280`, `text-inventory-laptop-1280`, `aria-snapshot-laptop-1280` |
| finding-laptop-1280-tap-target-risk-1 | medium | medium | accessibility | laptop-1280 | deterministic | risk | a11y.target-size.minimum | Interactive target tr:nth-of-type(3) > th > button appears smaller than the configured minimum target size. | `screenshot-laptop-1280`, `measurement-laptop-1280`, `text-inventory-laptop-1280`, `aria-snapshot-laptop-1280` |
| finding-tablet-768-contrast-risk-1 | medium | medium | accessibility | tablet-768 | deterministic | risk | a11y.text-contrast.minimum | DOM-computed text contrast may be low in div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(1) > span (1.16:1, target 4.5:1). | `screenshot-tablet-768`, `measurement-tablet-768`, `text-inventory-tablet-768`, `aria-snapshot-tablet-768` |
| finding-tablet-768-heading-level-skip-1 | medium | medium | hierarchy | tablet-768 | deterministic | risk | hierarchy.heading-structure.sane | Heading section:nth-of-type(1) > div > h3 jumps from level 1 to level 3. | `screenshot-tablet-768`, `measurement-tablet-768`, `text-inventory-tablet-768`, `aria-snapshot-tablet-768` |
| finding-mobile-390-contrast-risk-1 | medium | medium | accessibility | mobile-390 | deterministic | risk | a11y.text-contrast.minimum | DOM-computed text contrast may be low in div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(1) > span (1.16:1, target 4.5:1). | `screenshot-mobile-390`, `measurement-mobile-390`, `text-inventory-mobile-390`, `aria-snapshot-mobile-390` |
| finding-mobile-390-heading-level-skip-1 | medium | medium | hierarchy | mobile-390 | deterministic | risk | hierarchy.heading-structure.sane | Heading section:nth-of-type(1) > div > h3 jumps from level 1 to level 3. | `screenshot-mobile-390`, `measurement-mobile-390`, `text-inventory-mobile-390`, `aria-snapshot-mobile-390` |
| finding-mobile-360-contrast-risk-1 | medium | medium | accessibility | mobile-360 | deterministic | risk | a11y.text-contrast.minimum | DOM-computed text contrast may be low in div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(1) > span (1.16:1, target 4.5:1). | `screenshot-mobile-360`, `measurement-mobile-360`, `text-inventory-mobile-360`, `aria-snapshot-mobile-360` |
| finding-mobile-360-heading-level-skip-1 | medium | medium | hierarchy | mobile-360 | deterministic | risk | hierarchy.heading-structure.sane | Heading section:nth-of-type(1) > div > h3 jumps from level 1 to level 3. | `screenshot-mobile-360`, `measurement-mobile-360`, `text-inventory-mobile-360`, `aria-snapshot-mobile-360` |

## Source-Backed Criteria

- `a11y.text-contrast.minimum` (deterministic/risk, computed-style): Text contrast meets configured threshold. Sources used by emitted findings: [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/) (official-testable).
- `hierarchy.heading-structure.sane` (deterministic/risk, static-dom): Heading structure is understandable. Sources used by emitted findings: [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/) (official-testable); [GOV.UK Design System layout guidance](https://design-system.service.gov.uk/styles/layout/) (official-pattern); [Nielsen Norman Group Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) (industry-heuristic).
- `a11y.target-size.minimum` (deterministic/risk, computed-style): Interactive targets meet minimum geometry. Sources used by emitted findings: [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/) (official-testable); [IBM Carbon accessibility overview](https://carbondesignsystem.com/guidelines/accessibility/overview/) (industry-heuristic); [Shopify Polaris accessibility guidance](https://polaris.shopify.com/foundations/accessibility) (industry-heuristic).

## Evidence Links

- `screenshot-desktop-1440` (screenshot, desktop-1440): screenshots/desktop-1440.png
- `measurement-desktop-1440` (measurement, desktop-1440): see `audit.json` → `evidenceAssets` → `measurement-desktop-1440`
- `text-inventory-desktop-1440` (text-inventory, desktop-1440): see `audit.json` → `evidenceAssets` → `text-inventory-desktop-1440` (92 item(s))
- `aria-snapshot-desktop-1440` (aria-snapshot, desktop-1440): see `audit.json` → `evidenceAssets` → `aria-snapshot-desktop-1440` (playwright-aria-yaml)
- `screenshot-laptop-1280` (screenshot, laptop-1280): screenshots/laptop-1280.png
- `measurement-laptop-1280` (measurement, laptop-1280): see `audit.json` → `evidenceAssets` → `measurement-laptop-1280`
- `text-inventory-laptop-1280` (text-inventory, laptop-1280): see `audit.json` → `evidenceAssets` → `text-inventory-laptop-1280` (92 item(s))
- `aria-snapshot-laptop-1280` (aria-snapshot, laptop-1280): see `audit.json` → `evidenceAssets` → `aria-snapshot-laptop-1280` (playwright-aria-yaml)
- `screenshot-tablet-768` (screenshot, tablet-768): screenshots/tablet-768.png
- `measurement-tablet-768` (measurement, tablet-768): see `audit.json` → `evidenceAssets` → `measurement-tablet-768`
- `text-inventory-tablet-768` (text-inventory, tablet-768): see `audit.json` → `evidenceAssets` → `text-inventory-tablet-768` (92 item(s))
- `aria-snapshot-tablet-768` (aria-snapshot, tablet-768): see `audit.json` → `evidenceAssets` → `aria-snapshot-tablet-768` (playwright-aria-yaml)
- `screenshot-mobile-390` (screenshot, mobile-390): screenshots/mobile-390.png
- `measurement-mobile-390` (measurement, mobile-390): see `audit.json` → `evidenceAssets` → `measurement-mobile-390`
- `text-inventory-mobile-390` (text-inventory, mobile-390): see `audit.json` → `evidenceAssets` → `text-inventory-mobile-390` (92 item(s))
- `aria-snapshot-mobile-390` (aria-snapshot, mobile-390): see `audit.json` → `evidenceAssets` → `aria-snapshot-mobile-390` (playwright-aria-yaml)
- `screenshot-mobile-360` (screenshot, mobile-360): screenshots/mobile-360.png
- `measurement-mobile-360` (measurement, mobile-360): see `audit.json` → `evidenceAssets` → `measurement-mobile-360`
- `text-inventory-mobile-360` (text-inventory, mobile-360): see `audit.json` → `evidenceAssets` → `text-inventory-mobile-360` (92 item(s))
- `aria-snapshot-mobile-360` (aria-snapshot, mobile-360): see `audit.json` → `evidenceAssets` → `aria-snapshot-mobile-360` (playwright-aria-yaml)

## Recommendations

- `finding-desktop-1440-contrast-risk-1`: Increase foreground/background contrast or adjust font size and weight for readable text. Criterion: `a11y.text-contrast.minimum`. Evidence: `screenshot-desktop-1440`, `measurement-desktop-1440`, `text-inventory-desktop-1440`, `aria-snapshot-desktop-1440`.
- `finding-desktop-1440-contrast-risk-2`: Increase foreground/background contrast or adjust font size and weight for readable text. Criterion: `a11y.text-contrast.minimum`. Evidence: `screenshot-desktop-1440`, `measurement-desktop-1440`, `text-inventory-desktop-1440`, `aria-snapshot-desktop-1440`.
- `finding-desktop-1440-heading-level-skip-1`: Use headings to describe page and section structure in a clear order. Criterion: `hierarchy.heading-structure.sane`. Evidence: `screenshot-desktop-1440`, `measurement-desktop-1440`, `text-inventory-desktop-1440`, `aria-snapshot-desktop-1440`.
- `finding-laptop-1280-contrast-risk-1`: Increase foreground/background contrast or adjust font size and weight for readable text. Criterion: `a11y.text-contrast.minimum`. Evidence: `screenshot-laptop-1280`, `measurement-laptop-1280`, `text-inventory-laptop-1280`, `aria-snapshot-laptop-1280`.
- `finding-laptop-1280-contrast-risk-2`: Increase foreground/background contrast or adjust font size and weight for readable text. Criterion: `a11y.text-contrast.minimum`. Evidence: `screenshot-laptop-1280`, `measurement-laptop-1280`, `text-inventory-laptop-1280`, `aria-snapshot-laptop-1280`.
- `finding-laptop-1280-heading-level-skip-1`: Use headings to describe page and section structure in a clear order. Criterion: `hierarchy.heading-structure.sane`. Evidence: `screenshot-laptop-1280`, `measurement-laptop-1280`, `text-inventory-laptop-1280`, `aria-snapshot-laptop-1280`.
- `finding-laptop-1280-tap-target-risk-1`: Increase the control hit area or spacing so the target is easier to activate. Criterion: `a11y.target-size.minimum`. Evidence: `screenshot-laptop-1280`, `measurement-laptop-1280`, `text-inventory-laptop-1280`, `aria-snapshot-laptop-1280`.
- `finding-tablet-768-contrast-risk-1`: Increase foreground/background contrast or adjust font size and weight for readable text. Criterion: `a11y.text-contrast.minimum`. Evidence: `screenshot-tablet-768`, `measurement-tablet-768`, `text-inventory-tablet-768`, `aria-snapshot-tablet-768`.
- `finding-tablet-768-heading-level-skip-1`: Use headings to describe page and section structure in a clear order. Criterion: `hierarchy.heading-structure.sane`. Evidence: `screenshot-tablet-768`, `measurement-tablet-768`, `text-inventory-tablet-768`, `aria-snapshot-tablet-768`.
- `finding-mobile-390-contrast-risk-1`: Increase foreground/background contrast or adjust font size and weight for readable text. Criterion: `a11y.text-contrast.minimum`. Evidence: `screenshot-mobile-390`, `measurement-mobile-390`, `text-inventory-mobile-390`, `aria-snapshot-mobile-390`.
- `finding-mobile-390-heading-level-skip-1`: Use headings to describe page and section structure in a clear order. Criterion: `hierarchy.heading-structure.sane`. Evidence: `screenshot-mobile-390`, `measurement-mobile-390`, `text-inventory-mobile-390`, `aria-snapshot-mobile-390`.
- `finding-mobile-360-contrast-risk-1`: Increase foreground/background contrast or adjust font size and weight for readable text. Criterion: `a11y.text-contrast.minimum`. Evidence: `screenshot-mobile-360`, `measurement-mobile-360`, `text-inventory-mobile-360`, `aria-snapshot-mobile-360`.
- `finding-mobile-360-heading-level-skip-1`: Use headings to describe page and section structure in a clear order. Criterion: `hierarchy.heading-structure.sane`. Evidence: `screenshot-mobile-360`, `measurement-mobile-360`, `text-inventory-mobile-360`, `aria-snapshot-mobile-360`.

## Iteration Prompt Scaffold

```text
You are improving a UI using Design Harness evidence.
Target URL: http://127.0.0.1:4173/#/opp/modes
Run ID: 2026-10-06-165143682Z
Use the deterministic findings below as evidence, then make one focused revision pass.
- semantics: finding-desktop-1440-contrast-risk-1: DOM-computed text contrast may be low in div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(1) > span (1.16:1, target 4.5:1). Criterion: a11y.text-contrast.minimum. Recommendation: Increase foreground/background contrast or adjust font size and weight for readable text.
  viewport: desktop-1440
  selector: div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(1) > span
  region: x=731, y=818, width=71, height=18
  evidenceRefs: screenshot-desktop-1440, measurement-desktop-1440, text-inventory-desktop-1440, aria-snapshot-desktop-1440
  sourceRefs: wcag-2-2
- semantics: finding-desktop-1440-contrast-risk-2: DOM-computed text contrast may be low in div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(2) > span (1.16:1, target 4.5:1). Criterion: a11y.text-contrast.minimum. Recommendation: Increase foreground/background contrast or adjust font size and weight for readable text.
  viewport: desktop-1440
  selector: div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(2) > span
  region: x=1183, y=818, width=89, height=18
  evidenceRefs: screenshot-desktop-1440, measurement-desktop-1440, text-inventory-desktop-1440, aria-snapshot-desktop-1440
  sourceRefs: wcag-2-2
- structure: finding-desktop-1440-heading-level-skip-1: Heading section:nth-of-type(1) > div > h3 jumps from level 1 to level 3. Criterion: hierarchy.heading-structure.sane. Recommendation: Use headings to describe page and section structure in a clear order.
  viewport: desktop-1440
  selector: section:nth-of-type(1) > div > h3
  region: x=61, y=253, width=420, height=22
  evidenceRefs: screenshot-desktop-1440, measurement-desktop-1440, text-inventory-desktop-1440, aria-snapshot-desktop-1440
  sourceRefs: wcag-2-2, govuk-layout, nng-usability-heuristics
- semantics: finding-laptop-1280-contrast-risk-1: DOM-computed text contrast may be low in div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(1) > span (1.16:1, target 4.5:1). Criterion: a11y.text-contrast.minimum. Recommendation: Increase foreground/background contrast or adjust font size and weight for readable text.
  viewport: laptop-1280
  selector: div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(1) > span
  region: x=673, y=718, width=71, height=18
  evidenceRefs: screenshot-laptop-1280, measurement-laptop-1280, text-inventory-laptop-1280, aria-snapshot-laptop-1280
  sourceRefs: wcag-2-2
- semantics: finding-laptop-1280-contrast-risk-2: DOM-computed text contrast may be low in div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(2) > span (1.16:1, target 4.5:1). Criterion: a11y.text-contrast.minimum. Recommendation: Increase foreground/background contrast or adjust font size and weight for readable text.
  viewport: laptop-1280
  selector: div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(2) > span
  region: x=1038, y=718, width=89, height=18
  evidenceRefs: screenshot-laptop-1280, measurement-laptop-1280, text-inventory-laptop-1280, aria-snapshot-laptop-1280
  sourceRefs: wcag-2-2
After revising, rerun the audit and compare the new report against this one.
```

## Optional Subjective Critique

No subjective critique was supplied. This report only contains deterministic audit findings.
