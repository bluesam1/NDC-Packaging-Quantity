# Test Plan: NDC Packaging & Quantity Calculator

**Date:** 2025-01-27  
**PRD Version:** 0.1

---

## Overview

**Test Strategy:** 127 scenarios (58 unit, 42 integration, 27 E2E)  
**Priority:** P0: 45, P1: 52, P2: 24, P3: 6  
**Execution Order:** P0 unit → P0 integration → P0 E2E → P1 → P2

---

## 1. Success Criteria (P0)

| ID | Level | Test |
|----|-------|------|
| SC-001 | Unit | Normalization accuracy ≥95% on validation set |
| SC-002 | INT | p95 latency ≤ 2s (network included) |
| SC-003 | INT | Handle ≥10 RPS burst without degradation |
| SC-004 | INT | Zero PHI persistence |
| SC-005 | INT | Log redaction (drug_input, sig redacted) |
| SC-006 | E2E | User satisfaction 4.5/5 rating |

**Validation Set:** amoxicillin 500mg, metformin 1000mg, atorvastatin 20mg, amoxicillin 250mg/5mL, albuterol inhaler, insulin lispro U100

---

## 2. Input Validation (P0)

| ID | Level | Test |
|----|-------|------|
| IV-001 | Unit | Accept brand/generic name (2-200 chars) |
| IV-002 | Unit | Accept NDC format (11 digits, optional hyphens) |
| IV-003 | Unit | Reject invalid NDC format → 400 |
| IV-004 | Unit | Accept sig (3-500 chars) |
| IV-005 | Unit | Accept days_supply (1-365 integer) |
| IV-006 | Unit | Reject days_supply out of range → 422 |
| IV-007 | INT | Return validation_error with field errors |

---

## 3. RxNorm Integration (P0)

| ID | Level | Test |
|----|-------|------|
| RX-001 | INT | Name → RxCUI normalization |
| RX-002 | INT | NDC → RxCUI resolution |
| RX-003 | INT | Handle timeout (5s) with retry (1 retry, exp backoff) |
| RX-004 | INT | Handle API failure gracefully |
| RX-005 | Unit | Cache: 1 hour TTL, LRU (1000 entries) |
| RX-006 | INT | Approximate matching fallback |

---

## 4. FDA NDC Directory (P0)

| ID | Level | Test |
|----|-------|------|
| FDA-001 | INT | NDC lookup with package metadata |
| FDA-002 | INT | Brand name search |
| FDA-003 | INT | Retrieve status, package size, dosage form |
| FDA-004 | INT | FDA as source of truth for activity status |
| FDA-005 | INT | Handle timeout/failure with retry |
| FDA-006 | Unit | Cache: 24 hours TTL, LRU |
| FDA-007 | INT | Flag mismatches when FDA/RxNorm disagree |

---

## 5. Parallel API Execution (P0)

| ID | Level | Test |
|----|-------|------|
| PAR-001 | INT | Execute RxNorm + FDA in parallel |
| PAR-002 | INT | Merge data correctly (FDA = truth for status) |
| PAR-003 | INT | Handle partial failure (one API fails) |
| PAR-004 | INT | Handle both APIs failing → 424 dependency_failure |

---

## 6. SIG Parsing (P0)

| ID | Level | Test |
|----|-------|------|
| SIG-001 | Unit | Rules: tablets/caps (QD/BID/TID/QID) |
| SIG-002 | Unit | Rules: liquids (X mL PO Y times daily) |
| SIG-003 | Unit | Rules: inhalers (N puffs BID) |
| SIG-004 | Unit | Rules: insulin (U units SC QD/BID) |
| SIG-005 | Unit | Normalize synonyms (PO, by mouth, QD=1/day, etc.) |
| SIG-006 | INT | AI fallback (OpenAI GPT-4o-mini) when rules fail |
| SIG-007 | INT | Feature flag USE_AI_FALLBACK (default: true) |
| SIG-008 | INT | Return parse_error when both fail → 422 |

---

## 7. Quantity Calculation (P0)

| ID | Level | Test |
|----|-------|------|
| QTY-001 | Unit | total_qty = per_day × days_supply |
| QTY-002 | Unit | Unit normalization (tab, cap, mL, actuation, unit) |
| QTY-003 | Unit | Liquid rounding (nearest whole mL) |
| QTY-004 | Unit | Insulin concentration mapping (U100, U200) |

---

## 8. Package Selection (P0)

| ID | Level | Test |
|----|-------|------|
| PKG-001 | Unit | Prefer exact matches |
| PKG-002 | Unit | Minimal overfill ≤ 10% (OVERFILL_MAX) |
| PKG-003 | Unit | At most 1 extra package |
| PKG-004 | Unit | Multi-pack up to MAX_PACKS (3) |
| PKG-005 | Unit | Tie-break: fewer packs → lower overfill → larger package |
| PKG-006 | Unit | Single-NDC multi-pack (e.g., 30×2) |
| PKG-007 | INT | Active NDCs prioritized first |
| PKG-008 | INT | Only inactive available → no chosen, flags.inactive_ndcs |
| PKG-009 | Unit | Never underfill by default |

---

## 9. Response Format (P0)

| ID | Level | Test |
|----|-------|------|
| RES-001 | INT | Return JSON: rxnorm, computed, ndc_selection, flags |
| RES-002 | INT | flags.inactive_ndcs when inactive found |
| RES-003 | INT | flags.mismatch when data conflicts |
| RES-004 | INT | flags.conversion_notes when unit conversions applied |
| RES-005 | E2E | Display concise UI summary with flags |

---

## 10. Special Units (P1)

| ID | Level | Test |
|----|-------|------|
| SP-001 | Unit | Liquid conversions (mL, teaspoons) |
| SP-002 | Unit | Inhaler actuations default (200/canister, configurable) |
| SP-003 | Unit | Insulin pen/vial (mL/units) |
| SP-004 | INT | End-to-end: liquid prescription |
| SP-005 | INT | End-to-end: inhaler prescription |
| SP-006 | INT | End-to-end: insulin prescription |

---

## 11. API Endpoint (P0)

| ID | Level | Test |
|----|-------|------|
| API-001 | INT | POST /api/v1/compute with valid request → 200 |
| API-002 | INT | Invalid input → 400 validation_error |
| API-003 | INT | Unparseable SIG → 422 parse_error |
| API-004 | INT | External API failure → 424 dependency_failure |
| API-005 | INT | Unexpected error → 500 internal_error |
| API-006 | INT | Rate limit exceeded → 429 |
| API-007 | INT | Optional API key auth (configurable) |
| API-008 | INT | Per-IP rate limiting (10 req/min) |

---

## 12. Performance (P0)

| ID | Level | Test |
|----|-------|------|
| PERF-001 | INT | p95 latency ≤ 2s (network included) |
| PERF-002 | INT | ≥10 RPS burst without degradation |
| PERF-003 | INT | Load test: 100 concurrent requests |
| PERF-004 | INT | Cache hit performance |
| PERF-005 | INT | Cache miss performance |

---

## 13. Security & Privacy (P0)

| ID | Level | Test |
|----|-------|------|
| SEC-001 | INT | No PHI persisted |
| SEC-002 | INT | Log redaction: drug_input, sig redacted |
| SEC-003 | INT | HTTPS/TLS enforcement |
| SEC-004 | INT | Secrets via Firebase Secret Manager |
| SEC-005 | E2E | No PHI in browser storage |

---

## 14. Observability (P1)

| ID | Level | Test |
|----|-------|------|
| OBS-001 | INT | Collect metrics: p50/p95, error rate, parse-fail, inactive-only, overfill, pack count |
| OBS-002 | INT | Sampling: 10% prod, 100% staging |
| OBS-003 | INT | Log retention ≤30 days |
| OBS-004 | INT | Structured JSON logging |
| OBS-005 | INT | Cloud Monitoring alerts: error rate >5%, p95 >3s |

---

## 15. Acceptance Tests (P0)

| ID | Level | Test |
|----|-------|------|
| AT-001 | E2E | `amoxicillin 500 mg cap`, `1 cap PO BID`, `30 days` → total=60, chosen 60×1 or 30×2, no flags |
| AT-002 | E2E | Input NDC resolves to inactive → flags.inactive_ndcs, no chosen |
| AT-003 | E2E | `albuterol inhaler`, `2 puffs BID`, `30 days` (200 actuations) → per-day=4, total=120, chosen=1 canister |
| AT-004 | E2E | `amoxicillin 250 mg/5 mL`, `5 mL TID`, `10 days` → per-day=15 mL, total=150 mL |

---

## 16. User Stories (P0-P1)

| ID | Level | Test |
|----|-------|------|
| US-001 | E2E | Pharmacist: input → exact quantity + active NDC + alternates |
| US-002 | E2E | Tech: see minimal-overfill plan when no exact match |
| US-003 | INT | Engineer: API call returns structured JSON |

---

## 17. UI/UX (P1-P2)

| ID | Level | Test |
|----|-------|------|
| UI-001 | E2E | Input form: drug_input, sig, days_supply with validation |
| UI-002 | E2E | Advanced Options accordion (collapsed) |
| UI-003 | E2E | Results: quantity (prominent), selected package, alternates |
| UI-004 | E2E | Flags display: inactive, mismatch, conversion notes |
| UI-005 | E2E | Copy NDC and Copy JSON functionality |
| UI-006 | E2E | WCAG 2.1 AA: keyboard nav, screen reader, contrast |
| UI-007 | E2E | Responsive: mobile, tablet (768-1024px), desktop |

---

## 18. Edge Cases (P0-P1)

| ID | Level | Test |
|----|-------|------|
| EC-001 | INT | Only inactive NDCs → no chosen, flags.inactive_ndcs |
| EC-002 | INT | Invalid NDC format → 400 |
| EC-003 | INT | Days supply out of range → 422 |
| EC-004 | INT | SIG unparseable → 422 with guidance |
| EC-005 | INT | Degraded mode: stale cache (48h max) with stale_data flag |

---

## Test Execution

### Environments
- **Unit:** No dependencies, fast
- **Integration:** Firebase emulators + mock APIs (RxNorm, FDA, OpenAI)
- **E2E:** Staging with real APIs (or mocks)

### Frameworks
- **Unit:** Vitest
- **Integration:** Vitest + Firebase emulators
- **E2E:** Playwright
- **Performance:** k6

### Quality Gates
- **Pre-commit:** P0 unit tests pass, ≥80% coverage on changed files
- **Pre-merge:** All P0 tests pass, ≥80% overall coverage
- **Pre-deploy:** All P0/P1 pass, performance ≤2s, acceptance tests pass

---

## Test Data

**Validation Set:**
- Tablets: amoxicillin 500mg, metformin 1000mg, atorvastatin 20mg
- Liquids: amoxicillin 250mg/5mL, prednisolone 15mg/5mL
- Inhalers: albuterol, fluticasone
- Insulin: insulin lispro U100, insulin glargine U100

**Edge Cases:**
- Inactive NDCs
- Invalid formats
- Unparseable SIGs
- Out-of-range values

---

## Risk Areas

| Risk | Test Coverage |
|------|---------------|
| Incorrect quantity | QTY-001, QTY-002, AT-001, AT-004 |
| Wrong NDC selected | PKG-001 to PKG-009, AT-001 |
| PHI leakage | SEC-001, SEC-002, SEC-005 |
| Performance degradation | PERF-001 to PERF-005 |
| API failures | RX-003, FDA-005, PAR-003, PAR-004 |
| SIG parsing failures | SIG-001 to SIG-008 |
