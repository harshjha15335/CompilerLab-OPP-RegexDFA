# Design Harness Audit Report

## Run Summary

- Run ID: `2026-10-06-172420674Z`
- Target: http://127.0.0.1:4174/#/opp/table
- Status: `success`
- Started: 2026-10-06T17:24:20.674Z
- Duration: 2473ms
- Viewports: desktop-1440 (1440x900), laptop-1280 (1280x800), tablet-768 (768x1024), mobile-390 (390x844), mobile-360 (360x800)

## Notices

These configuration and capability notices are informational and do not affect the audit score or status.

- `contrast-elements-skipped`: Some elements whose painted contrast could not be determined from computed styles were skipped; no contrast finding was emitted for them. Details: `{"viewports":\[{"viewport":"desktop-1440","skippedElementCount":20,"skippedByReason":{"background-image":20}},{"viewport":"laptop-1280","skippedElementCount":20,"skippedByReason":{"background-image":20}},{"viewport":"mobile-360","skippedElementCount":20,"skippedByReason":{"background-image":20}},{"viewport":"mobile-390","skippedElementCount":20,"skippedByReason":{"background-image":20}},{"viewport":"tablet-768","skippedElementCount":20,"skippedByReason":{"background-image":20}}\]}`.

## Advisory Score

**95/100** (strong)

- Formula: `epistemic-criterion-max-v2`
- Deduction model: one maximum scoreable occurrence per criterion, with legacy findings grouped by check name.
- Grouped pre-floor total deduction: 5
- Saturation: no — the grouped pre-floor deduction does not exceed 100.
- Compatibility: formula versions have different semantics; v1 and v2 values are not directly comparable.
- Grouped deductions:
  - `responsive.fixed-width.risk`: 0.5 points; 2 occurrences; viewports: `mobile-360`, `mobile-390`; representative: `finding-mobile-360-fixed-width-risk-1`. Maximum scoreable occurrence for criterion responsive.fixed-width.risk across 2 occurrences; low responsiveness finding with low confidence; heuristic risk score weight 0.25
  - `visual.text-clipping.none`: 4.5 points; 10 occurrences; viewports: `desktop-1440`, `laptop-1280`, `mobile-360`, `mobile-390`, `tablet-768`; representative: `finding-desktop-1440-text-clipping-1`. Maximum scoreable occurrence for criterion visual.text-clipping.none across 10 occurrences; medium visual-polish finding with medium confidence; deterministic risk score weight 0.6

Verdict: No deterministic failures in the captured scope.

Note: Advisory score starts at 100 and subtracts the maximum scoreable finding once per criterion (or legacy check name), weighted by severity, confidence, and evidence tier. Needs-review findings are score-exempt and omitted, as are other zero-weight findings. This formula is not directly comparable with epistemic-weight-v1. It is not an objective design-quality grade.

## Findings

### Deterministic Findings: Risks

| ID | Severity | Confidence | Category | Viewport | Determinism | Result | Criterion | Problem | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| finding-desktop-1440-text-clipping-1 | medium | medium | visual-polish | desktop-1440 | deterministic | risk | visual.text-clipping.none | Text may be clipped in caption. | `screenshot-desktop-1440`, `measurement-desktop-1440`, `text-inventory-desktop-1440`, `aria-snapshot-desktop-1440` |
| finding-desktop-1440-text-clipping-2 | medium | medium | visual-polish | desktop-1440 | deterministic | risk | visual.text-clipping.none | Text may be clipped in th:nth-of-type(1) > span. | `screenshot-desktop-1440`, `measurement-desktop-1440`, `text-inventory-desktop-1440`, `aria-snapshot-desktop-1440` |
| finding-laptop-1280-text-clipping-1 | medium | medium | visual-polish | laptop-1280 | deterministic | risk | visual.text-clipping.none | Text may be clipped in caption. | `screenshot-laptop-1280`, `measurement-laptop-1280`, `text-inventory-laptop-1280`, `aria-snapshot-laptop-1280` |
| finding-laptop-1280-text-clipping-2 | medium | medium | visual-polish | laptop-1280 | deterministic | risk | visual.text-clipping.none | Text may be clipped in th:nth-of-type(1) > span. | `screenshot-laptop-1280`, `measurement-laptop-1280`, `text-inventory-laptop-1280`, `aria-snapshot-laptop-1280` |
| finding-tablet-768-text-clipping-1 | medium | medium | visual-polish | tablet-768 | deterministic | risk | visual.text-clipping.none | Text may be clipped in caption. | `screenshot-tablet-768`, `measurement-tablet-768`, `text-inventory-tablet-768`, `aria-snapshot-tablet-768` |
| finding-tablet-768-text-clipping-2 | medium | medium | visual-polish | tablet-768 | deterministic | risk | visual.text-clipping.none | Text may be clipped in th:nth-of-type(1) > span. | `screenshot-tablet-768`, `measurement-tablet-768`, `text-inventory-tablet-768`, `aria-snapshot-tablet-768` |
| finding-mobile-390-text-clipping-1 | medium | medium | visual-polish | mobile-390 | deterministic | risk | visual.text-clipping.none | Text may be clipped in caption. | `screenshot-mobile-390`, `measurement-mobile-390`, `text-inventory-mobile-390`, `aria-snapshot-mobile-390` |
| finding-mobile-390-text-clipping-2 | medium | medium | visual-polish | mobile-390 | deterministic | risk | visual.text-clipping.none | Text may be clipped in th:nth-of-type(1) > span. | `screenshot-mobile-390`, `measurement-mobile-390`, `text-inventory-mobile-390`, `aria-snapshot-mobile-390` |
| finding-mobile-360-text-clipping-1 | medium | medium | visual-polish | mobile-360 | deterministic | risk | visual.text-clipping.none | Text may be clipped in caption. | `screenshot-mobile-360`, `measurement-mobile-360`, `text-inventory-mobile-360`, `aria-snapshot-mobile-360` |
| finding-mobile-360-text-clipping-2 | medium | medium | visual-polish | mobile-360 | deterministic | risk | visual.text-clipping.none | Text may be clipped in th:nth-of-type(1) > span. | `screenshot-mobile-360`, `measurement-mobile-360`, `text-inventory-mobile-360`, `aria-snapshot-mobile-360` |

### Heuristic Review Prompts

| ID | Severity | Confidence | Category | Viewport | Determinism | Result | Criterion | Problem | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| finding-mobile-390-fixed-width-risk-1 | low | low | responsiveness | mobile-390 | heuristic | risk | responsive.fixed-width.risk | Element caption appears wider than the viewport and may create brittle responsive behavior. | `screenshot-mobile-390`, `measurement-mobile-390`, `text-inventory-mobile-390`, `aria-snapshot-mobile-390` |
| finding-mobile-360-fixed-width-risk-1 | low | low | responsiveness | mobile-360 | heuristic | risk | responsive.fixed-width.risk | Element caption appears wider than the viewport and may create brittle responsive behavior. | `screenshot-mobile-360`, `measurement-mobile-360`, `text-inventory-mobile-360`, `aria-snapshot-mobile-360` |

## Source-Backed Criteria

- `visual.text-clipping.none` (deterministic/risk, computed-style): Visible text is not clipped. Sources used by emitted findings: [GOV.UK Design System layout guidance](https://design-system.service.gov.uk/styles/layout/) (official-pattern); [Nielsen Norman Group Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) (industry-heuristic).
- `responsive.fixed-width.risk` (heuristic/risk, computed-style): Wide content does not block small viewports. Sources used by emitted findings: [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/) (official-testable); [GOV.UK Design System layout guidance](https://design-system.service.gov.uk/styles/layout/) (official-pattern).

## Evidence Links

- `screenshot-desktop-1440` (screenshot, desktop-1440): screenshots/desktop-1440.png
- `measurement-desktop-1440` (measurement, desktop-1440): see `audit.json` → `evidenceAssets` → `measurement-desktop-1440`
- `text-inventory-desktop-1440` (text-inventory, desktop-1440): see `audit.json` → `evidenceAssets` → `text-inventory-desktop-1440` (46 item(s))
- `aria-snapshot-desktop-1440` (aria-snapshot, desktop-1440): see `audit.json` → `evidenceAssets` → `aria-snapshot-desktop-1440` (playwright-aria-yaml)
- `screenshot-laptop-1280` (screenshot, laptop-1280): screenshots/laptop-1280.png
- `measurement-laptop-1280` (measurement, laptop-1280): see `audit.json` → `evidenceAssets` → `measurement-laptop-1280`
- `text-inventory-laptop-1280` (text-inventory, laptop-1280): see `audit.json` → `evidenceAssets` → `text-inventory-laptop-1280` (46 item(s))
- `aria-snapshot-laptop-1280` (aria-snapshot, laptop-1280): see `audit.json` → `evidenceAssets` → `aria-snapshot-laptop-1280` (playwright-aria-yaml)
- `screenshot-tablet-768` (screenshot, tablet-768): screenshots/tablet-768.png
- `measurement-tablet-768` (measurement, tablet-768): see `audit.json` → `evidenceAssets` → `measurement-tablet-768`
- `text-inventory-tablet-768` (text-inventory, tablet-768): see `audit.json` → `evidenceAssets` → `text-inventory-tablet-768` (46 item(s))
- `aria-snapshot-tablet-768` (aria-snapshot, tablet-768): see `audit.json` → `evidenceAssets` → `aria-snapshot-tablet-768` (playwright-aria-yaml)
- `screenshot-mobile-390` (screenshot, mobile-390): screenshots/mobile-390.png
- `measurement-mobile-390` (measurement, mobile-390): see `audit.json` → `evidenceAssets` → `measurement-mobile-390`
- `text-inventory-mobile-390` (text-inventory, mobile-390): see `audit.json` → `evidenceAssets` → `text-inventory-mobile-390` (46 item(s))
- `aria-snapshot-mobile-390` (aria-snapshot, mobile-390): see `audit.json` → `evidenceAssets` → `aria-snapshot-mobile-390` (playwright-aria-yaml)
- `screenshot-mobile-360` (screenshot, mobile-360): screenshots/mobile-360.png
- `measurement-mobile-360` (measurement, mobile-360): see `audit.json` → `evidenceAssets` → `measurement-mobile-360`
- `text-inventory-mobile-360` (text-inventory, mobile-360): see `audit.json` → `evidenceAssets` → `text-inventory-mobile-360` (46 item(s))
- `aria-snapshot-mobile-360` (aria-snapshot, mobile-360): see `audit.json` → `evidenceAssets` → `aria-snapshot-mobile-360` (playwright-aria-yaml)

## Recommendations

- `finding-desktop-1440-text-clipping-1`: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling. Criterion: `visual.text-clipping.none`. Evidence: `screenshot-desktop-1440`, `measurement-desktop-1440`, `text-inventory-desktop-1440`, `aria-snapshot-desktop-1440`.
- `finding-desktop-1440-text-clipping-2`: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling. Criterion: `visual.text-clipping.none`. Evidence: `screenshot-desktop-1440`, `measurement-desktop-1440`, `text-inventory-desktop-1440`, `aria-snapshot-desktop-1440`.
- `finding-laptop-1280-text-clipping-1`: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling. Criterion: `visual.text-clipping.none`. Evidence: `screenshot-laptop-1280`, `measurement-laptop-1280`, `text-inventory-laptop-1280`, `aria-snapshot-laptop-1280`.
- `finding-laptop-1280-text-clipping-2`: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling. Criterion: `visual.text-clipping.none`. Evidence: `screenshot-laptop-1280`, `measurement-laptop-1280`, `text-inventory-laptop-1280`, `aria-snapshot-laptop-1280`.
- `finding-tablet-768-text-clipping-1`: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling. Criterion: `visual.text-clipping.none`. Evidence: `screenshot-tablet-768`, `measurement-tablet-768`, `text-inventory-tablet-768`, `aria-snapshot-tablet-768`.
- `finding-tablet-768-text-clipping-2`: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling. Criterion: `visual.text-clipping.none`. Evidence: `screenshot-tablet-768`, `measurement-tablet-768`, `text-inventory-tablet-768`, `aria-snapshot-tablet-768`.
- `finding-mobile-390-text-clipping-1`: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling. Criterion: `visual.text-clipping.none`. Evidence: `screenshot-mobile-390`, `measurement-mobile-390`, `text-inventory-mobile-390`, `aria-snapshot-mobile-390`.
- `finding-mobile-390-text-clipping-2`: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling. Criterion: `visual.text-clipping.none`. Evidence: `screenshot-mobile-390`, `measurement-mobile-390`, `text-inventory-mobile-390`, `aria-snapshot-mobile-390`.
- `finding-mobile-390-fixed-width-risk-1`: Use responsive max-width, flexible grid/flex sizing, or container-relative units instead of brittle wide sizing. Criterion: `responsive.fixed-width.risk`. Evidence: `screenshot-mobile-390`, `measurement-mobile-390`, `text-inventory-mobile-390`, `aria-snapshot-mobile-390`.
- `finding-mobile-360-text-clipping-1`: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling. Criterion: `visual.text-clipping.none`. Evidence: `screenshot-mobile-360`, `measurement-mobile-360`, `text-inventory-mobile-360`, `aria-snapshot-mobile-360`.
- `finding-mobile-360-text-clipping-2`: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling. Criterion: `visual.text-clipping.none`. Evidence: `screenshot-mobile-360`, `measurement-mobile-360`, `text-inventory-mobile-360`, `aria-snapshot-mobile-360`.
- `finding-mobile-360-fixed-width-risk-1`: Use responsive max-width, flexible grid/flex sizing, or container-relative units instead of brittle wide sizing. Criterion: `responsive.fixed-width.risk`. Evidence: `screenshot-mobile-360`, `measurement-mobile-360`, `text-inventory-mobile-360`, `aria-snapshot-mobile-360`.

## Iteration Prompt Scaffold

```text
You are improving a UI using Design Harness evidence.
Target URL: http://127.0.0.1:4174/#/opp/table
Run ID: 2026-10-06-172420674Z
Use the deterministic findings below as evidence, then make one focused revision pass.
- visual polish: finding-desktop-1440-text-clipping-1: Text may be clipped in caption. Criterion: visual.text-clipping.none. Recommendation: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling.
  viewport: desktop-1440
  selector: caption
  region: x=284, y=303, width=1, height=1
  evidenceRefs: screenshot-desktop-1440, measurement-desktop-1440, text-inventory-desktop-1440, aria-snapshot-desktop-1440
  sourceRefs: govuk-layout, nng-usability-heuristics
- visual polish: finding-desktop-1440-text-clipping-2: Text may be clipped in th:nth-of-type(1) > span. Criterion: visual.text-clipping.none. Recommendation: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling.
  viewport: desktop-1440
  selector: th:nth-of-type(1) > span
  region: x=314, y=271, width=1, height=1
  evidenceRefs: screenshot-desktop-1440, measurement-desktop-1440, text-inventory-desktop-1440, aria-snapshot-desktop-1440
  sourceRefs: govuk-layout, nng-usability-heuristics
- visual polish: finding-laptop-1280-text-clipping-1: Text may be clipped in caption. Criterion: visual.text-clipping.none. Recommendation: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling.
  viewport: laptop-1280
  selector: caption
  region: x=265, y=280, width=1, height=1
  evidenceRefs: screenshot-laptop-1280, measurement-laptop-1280, text-inventory-laptop-1280, aria-snapshot-laptop-1280
  sourceRefs: govuk-layout, nng-usability-heuristics
- visual polish: finding-laptop-1280-text-clipping-2: Text may be clipped in th:nth-of-type(1) > span. Criterion: visual.text-clipping.none. Recommendation: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling.
  viewport: laptop-1280
  selector: th:nth-of-type(1) > span
  region: x=290, y=254, width=1, height=1
  evidenceRefs: screenshot-laptop-1280, measurement-laptop-1280, text-inventory-laptop-1280, aria-snapshot-laptop-1280
  sourceRefs: govuk-layout, nng-usability-heuristics
- visual polish: finding-tablet-768-text-clipping-1: Text may be clipped in caption. Criterion: visual.text-clipping.none. Recommendation: Allow the container to grow, wrap text, reduce copy length, or adjust overflow styling.
  viewport: tablet-768
  selector: caption
  region: x=160, y=308, width=1, height=1
  evidenceRefs: screenshot-tablet-768, measurement-tablet-768, text-inventory-tablet-768, aria-snapshot-tablet-768
  sourceRefs: govuk-layout, nng-usability-heuristics
After revising, rerun the audit and compare the new report against this one.
```

## Optional Subjective Critique

No subjective critique was supplied. The findings above are shown with their recorded classifications.
