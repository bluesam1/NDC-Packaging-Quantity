# NDC Packaging & Quantity Calculator — Product Requirements (Editable)

> Owner: Product Owner
> Version: 0.1 (draft)
> Last updated: *<date>*

---

## 1) Overview

A lightweight web+API tool that takes a drug input (name or NDC), SIG, and days’ supply, normalizes to RxNorm, retrieves valid NDCs and package sizes, computes quantity to dispense, ranks package selections (including multi-pack), and returns a structured result alongside a minimal UI summary.

**Goals**

* Fast, deterministic computation of quantity and package selection.
* Flag inactive or mismatched NDC/package scenarios.
* Ship a minimal, accurate MVP that’s easy to embed.

**Non‑Goals**

* Full eRx workflow, label printing, prior auth, or billing logic.
* Long‑term PHI storage.

**Primary Users**

* Pharmacists, techs, and clinical ops engineers.

---

## 2) Success Criteria (MVP)

* ≥95% normalization & quantity accuracy on a small validation set of representative drugs/SIGs.
* Displays chosen NDC and clear alternates; flags inactive/mismatch states.
* p95 latency ≤ 2 seconds per query (network included).
* Zero PHI persistence; only ephemeral logs (redacted inputs).
* **User satisfaction**: Attain user satisfaction ratings of 4.5/5 or higher in pilot testing.
* **Claim rejection reduction**: Decrease claim rejections related to NDC errors by 50%.
* **Validation methodology**: Accuracy measured on a validation set of representative drugs/SIGs covering tablets, liquids, inhalers, and insulin dosage forms.

---

## 3) User Stories

* **As a pharmacist**, I enter a drug + SIG + days’ supply and get an exact quantity with a recommended active NDC (plus alternates).
* **As a tech**, I can see when no active NDC fits exactly and the minimal‑overfill plan is proposed.
* **As an engineer**, I call a simple API to compute quantity and selection for embedding into a PMS or internal tool.

---

## 4) Functional Requirements

1. Accept **drug_input** (brand/generic name or NDC), **sig** (free text), and **days_supply**.
2. Normalize to RxCUI (RxNorm). If input is NDC, resolve to its RxCUI.
3. Fetch NDCs + package metadata (FDA NDC Directory; status, package sizes, dosage form).
4. Parse SIG → per‑day usage; compute **total_qty = per_day × days_supply**.
5. Rank NDCs:

   * Active first.
   * Prefer exact hits; otherwise minimal overfill (configurable threshold) and/or minimal underfill if allowed.
   * Support multi‑pack composition (e.g., 30×2, 60×1, etc.).
6. Return a **structured JSON** and a **concise UI summary** with flags (inactive_ndcs, mismatch, unit conversions applied).
7. Handle special units (liquids in mL, inhalers by actuations, insulin pens/vials by mL/units) with deterministic conversion tables.
8. Expose a single‑page UI for manual use and a versioned API for integrations.

---

## 5) Non‑Functional Requirements

* **Performance:** p95 ≤ 2s; handle ≥10 RPS burst without degradation.
* **Reliability:** Clear error codes and fallback messages when external APIs fail/time out.
* **Security & Privacy:** No PHI persisted; redact logs; HTTPS only.
* **Compliance:** Align with HIPAA boundary assumptions (compute‑only, no storage).
* **Observability & Telemetry (MVP, required):** Collect metrics (p50/p95 latency, error rate, parse‑fail rate, inactive‑only rate, overfill occurrences, selected‑pack count). Sampling 10% in prod (100% in staging). Retain logs ≤30 days. Alerts on uptime and error‑rate thresholds.

---

## 6) Integrations & Data Sources

**Note**: Detailed technical specifications for external API integrations are documented in `docs/architecture.md` §6 (External APIs).

* **RxNorm**: name→RxCUI normalization; NDC↔RxCUI crosswalk. Do **not** use for activity status.
* **FDA NDC Directory (Source of Truth)**: authoritative for **NDC activity status, package sizes, and marketing status**. If FDA and RxNorm disagree, trust FDA for status/packaging and RxNorm for ID mapping.
* **API Execution**: Parallel calls to RxNorm and FDA (no dependencies between them)
* **OpenAI API**: Used as fallback for SIG parsing when rules-based parser fails (see §8)
* Optional future: internal formulary/preferred NDC lists to bias ranking.

---

## 7) Core Algorithm (Deterministic Path)

1. **Normalize** input to RxCUI.
2. **Enumerate** candidate NDCs + packages (active prioritized via FDA Directory).
3. **Parse SIG** → per‑day consumption (rules engine; see §8).
4. **Compute quantity**: `total_qty = per_day × days_supply`.
5. **Select packages**:

   * Prefer exact matches.
   * Otherwise minimal overfill **≤ OVERFILL_MAX (10%)** and at most **1 extra package** by default.
   * Multi‑pack combos allowed up to **MAX_PACKS (3)**.
   * Tie‑break order: **fewer packs → lower overfill → larger package**.
6. **Emit** JSON with chosen package, alternates, and flags (inactive list, mismatch, conversion notes).

---

## 8) SIG Parsing Rules (MVP)

* **Approach:** Hybrid approach for MVP (meets "AI-accelerated" requirement - **this is an MVP feature, not deferred to v1.1**):
  1. **Primary**: Rules-based parser (fast, deterministic regex + small grammar)
  2. **Fallback**: OpenAI API (GPT-4o-mini) when rules fail
  3. **Feature Flag**: `USE_AI_FALLBACK` (default: true for MVP)
* **AI Model**: GPT-4o-mini (cost-effective for MVP, ~$0.00001 per request average with 10% fallback rate)
* **Ambiguity Handling**: Return first valid match; log ambiguous cases for future improvement (MVP simplification: don't return multiple interpretations)
* Rule‑based patterns for common forms:

  * Tablets/Caps: `1 tab/cap PO QD/BID/TID/QID/PRN(limit)` → per‑day = {1,2,3,4}.
  * Liquids: `X mL PO Y times daily` → per‑day = X×Y; unit = mL.
  * Inhalers: `N puffs BID` → per‑day = N×2; canister actuations default (e.g., 200).
  * Insulin: `U units SC QD/BID` with concentration mapping (e.g., U100).
* Normalize synonyms (PO, by mouth; QD=1/day; BID=2/day; etc.).
* **Confidence**: Binary (parsed/not-parsed) for MVP
* **AI Fallback**: If rules fail and `USE_AI_FALLBACK=true`, call OpenAI API with structured prompt to parse SIG and return JSON format
* **Fallback:** if both rules and AI fail, return `flags.mismatch=true` with guidance; do not guess.

---

## 9) API Specification

**Note**: Complete API specification including request/response schemas, error codes, authentication, and rate limiting details are documented in `docs/architecture.md` §8 (API Specification).

**Summary**:
* **Endpoint**: `POST /api/v1/compute`
* **Request**: `drug_input`, `sig`, `days_supply`, optional `preferred_ndcs` and `quantity_unit_override`
* **Response**: Structured JSON with `rxnorm`, `computed`, `ndc_selection`, and `flags`
* **Error Codes**: `validation_error`, `parse_error`, `dependency_failure`, `internal_error`, `rate_limit_exceeded`
* **Authentication**: Optional API key (configurable per environment)
* **Rate Limiting**: Per-IP (10 req/min) for MVP

---

## 10) Data Models

**Note**: Complete TypeScript type definitions for `ComputeRequest`, `ComputeResponse`, and `ErrorResponse` are documented in `docs/architecture.md` §4 (Data Models).

**Summary**:
* **ComputeRequest**: Input payload with `drug_input`, `sig`, `days_supply`, and optional fields
* **ComputeResponse**: Output payload with `rxnorm`, `computed`, `ndc_selection`, and `flags`
* **ErrorResponse**: Standardized error format with `error_code`, `detail`, and optional `retry_after_ms`

---

## 11) User Experience

**Note**: Complete UI/UX specifications including component details, design system, accessibility requirements, and responsive design are documented in `docs/front-end-spec.md`.

**Summary**:
* Single-page application with input form and results display
* **Advanced Options** (collapsed): preferred NDCs, unit override, max overfill
* **Results**: Quantity display, chosen NDC, alternates list, flags/warnings
* **Accessibility**: WCAG 2.1 Level AA compliance required
* **Responsive**: Mobile-first, tablet-optimized (768px-1024px), desktop support

---

## 12) Validation & Edge Cases

**Input Validation Rules**

* **drug_input**: 
  * Required, minimum 2 characters, maximum 200 characters
  * Accepts drug names (brand/generic) or NDC format (11 digits with optional hyphens: `00000-1111-22` or `00000111122`)
  * Sanitize: Remove control characters, trim whitespace
* **sig**: 
  * Required, minimum 3 characters, maximum 500 characters
  * Free text, accepts common prescription abbreviations and formats
  * Sanitize: Remove control characters, trim whitespace
* **days_supply**: 
  * Required, integer, minimum 1, maximum 365
  * Must be a positive whole number
* **preferred_ndcs** (optional): 
  * Array of strings, each must be valid NDC format (11 digits)
  * Maximum 10 NDCs
* **quantity_unit_override** (optional): 
  * Must be one of: `'tab'`, `'cap'`, `'mL'`, `'actuation'`, `'unit'`

**Edge Cases**

* Only inactive NDCs available → no `chosen`, `flags.inactive_ndcs` populated.
* Liquid rounding rules (e.g., round to nearest whole mL unless override).
* Inhaler canister actuations default (configurable per product).
* Insulin concentration mapping (U100/U200/etc.).
* Multi‑pack cap at **MAX_PACKS** (config) to prevent absurd combos.
* **Invalid NDC format** → return `400` with `error_code: "validation_error"` and field error
* **Days supply out of range** → return `422` with `error_code: "validation_error"` and field error
* **SIG unparseable** → return `422` with `error_code: "parse_error"` and guidance message
* **Error Recovery**: Provide clear error messages with actionable guidance; suggest common fixes for validation errors

---

## 13) Observability & Telemetry

**Note**: Detailed telemetry, logging, and monitoring specifications are documented in `docs/architecture.md` §16 (Monitoring and Observability).

**Summary**:
* **Required Metrics**: p50/p95 latency, error rate, parse-fail rate, inactive-only rate, overfill occurrences, selected-pack count
* **Sampling**: 10% in production, 100% in staging
* **Retention**: ≤30 days, no PHI, redact `drug_input` and `sig` from logs
* **Alert Thresholds**: Error rate >5% over 5 minutes, p95 latency >3 seconds over 5 minutes
* **Implementation**: Cloud Logging (structured JSON) and Cloud Monitoring (default alerts)

---

## 14) Security & Compliance

**Note**: Detailed security requirements including input validation, authentication, secrets management, and data protection are documented in `docs/architecture.md` §13 (Security).

**Summary**:
* No persistent PHI; redact `drug_input` and `sig` from logs
* HTTPS/TLS everywhere; secrets via Firebase Secret Manager
* Optional API key authentication (configurable per environment)
* HIPAA boundary assumptions: compute-only, no storage

---

## 15) Technical Architecture

**Note**: Complete technical architecture including technology stack, system design, components, deployment strategy, and implementation details are documented in `docs/architecture.md`.

**Summary**:
* **Architecture**: Serverless (Jamstack) - SvelteKit frontend + Firebase Cloud Functions v2 backend
* **Platform**: Firebase (Hosting + Functions + Secret Manager)
* **Key Technical Decisions**:
  * Parallel execution of RxNorm and FDA API calls
  * In-memory LRU caching (no database for MVP)
  * Hybrid SIG parsing (rules-based with AI fallback)
  * Degraded mode with stale cache support (48 hours max)
  * Manual deployment for MVP (CI/CD automation deferred to v1.1)

---

## 16) Epics

### Epic 1: Foundation & Project Infrastructure

**Goal**: Establish project foundation, development environment, API contract, and basic infrastructure to support all subsequent development work.

**Description**: This epic sets up the complete project infrastructure including repository structure, TypeScript configuration, Firebase project initialization, build tooling (Vite), API contract definition, type system, and basic Cloud Function skeleton. It delivers a deployable foundation with a health-check endpoint and establishes all development tooling, testing framework, and local development environment.

**Stories**:
- **Story 1.1**: Project Repository & Build Setup
  - Initialize SvelteKit project with Vite
  - Configure TypeScript, ESLint, Prettier
  - Set up Firebase project (Hosting + Functions)
  - Configure `@sveltejs/adapter-static` for static builds
  - Establish project structure and folder organization
- **Story 1.2**: API Contract & Type Definitions
  - Define TypeScript types for `ComputeRequest`, `ComputeResponse`, `ErrorResponse`
  - Create API contract documentation
  - Set up Zod validation schemas
  - Define error codes and response structures
- **Story 1.3**: Firebase Cloud Function Skeleton
  - Create Cloud Function (v2) with CORS configuration
  - Set up Firebase Secret Manager integration
  - Implement basic request/response handling
  - Add health-check endpoint
  - Configure Firebase Hosting rewrites
- **Story 1.4**: Local Development Environment
  - Set up Firebase emulators (Hosting + Functions)
  - Configure local development scripts
  - Create mock API server for RxNorm/FDA (for local dev)
  - Document local development workflow

---

### Epic 2: Core Computation Engine

**Goal**: Implement the core business logic for drug normalization, NDC retrieval, SIG parsing, quantity calculation, and package selection to deliver the primary value proposition of accurate quantity computation.

**Description**: This epic implements the heart of the application - the computation engine that normalizes drug inputs, retrieves NDC data from external APIs, parses prescription SIGs, calculates quantities, and selects optimal package combinations. It includes integration with RxNorm and FDA APIs, hybrid SIG parsing (rules-based with AI fallback), multi-pack selection algorithm, and comprehensive error handling.

**Stories**:
- **Story 2.1**: RxNorm API Integration
  - Implement RxNorm client with caching (1 hour TTL, LRU cache)
  - Support name→RxCUI normalization
  - Support NDC→RxCUI resolution
  - Implement approximate matching fallback
  - Add error handling and retry logic (1 retry, exponential backoff)
  - Add rate limiting (10 req/sec per instance)
- **Story 2.2**: FDA NDC Directory API Integration
  - Implement FDA API client with caching (24 hours TTL, LRU cache)
  - Support NDC lookup and brand name search
  - Retrieve package metadata (size, status, dosage form)
  - Add error handling and retry logic
  - Add rate limiting (3 req/sec per instance)
- **Story 2.3**: Parallel API Execution & Data Merging
  - Implement parallel execution of RxNorm and FDA calls
  - Merge data from both sources (FDA as source of truth for status)
  - Handle partial failures gracefully
  - Flag mismatches when data conflicts
- **Story 2.4**: Rules-Based SIG Parser
  - Implement regex-based parser for common SIG patterns
  - Support tablets/capsules (QD, BID, TID, QID)
  - Support basic liquid formats
  - Normalize synonyms (PO, by mouth, etc.)
  - Return binary confidence (parsed/not-parsed)
- **Story 2.5**: AI Fallback SIG Parser
  - Integrate OpenAI API (GPT-4o-mini)
  - Implement AI fallback when rules fail
  - Add feature flag `USE_AI_FALLBACK` (default: true)
  - Structure AI prompt for JSON response
  - Handle AI parsing errors gracefully
- **Story 2.6**: Quantity Calculation Engine
  - Compute `total_qty = per_day × days_supply`
  - Handle unit normalization
  - Support basic unit types (tab, cap) for MVP
- **Story 2.7**: Multi-Pack Selection Algorithm
  - Implement greedy algorithm for package selection
  - Pre-filter NDCs by active status
  - Try 1-pack, 2-pack, 3-pack combinations per NDC
  - Score and rank (exact match > minimal overfill > fewer packs)
  - Support single-NDC multi-pack (e.g., 30×2)
  - Enforce MAX_PACKS (3) and OVERFILL_MAX (10%)
- **Story 2.8**: Input Validation & Error Handling
  - Implement Zod validation for all inputs
  - Validate drug_input format (name or NDC)
  - Validate days_supply (1-365)
  - Validate preferred_ndcs format
  - Return structured error responses with field errors
  - Implement comprehensive error handling for all failure modes

---

### Epic 3: User Interface

**Goal**: Deliver a functional, accessible, responsive user interface that allows users to input prescription data and view computed results with clear visual feedback.

**Description**: This epic implements the single-page web application UI using SvelteKit. It includes the input form, results display, alternate packages list, flags/warnings display, toast notifications, and copy JSON functionality. The UI must be WCAG 2.1 Level AA compliant, responsive (mobile, tablet, desktop), and provide excellent user experience with clear visual hierarchy and feedback.

**Stories**:
- **Story 3.1**: UI Foundation & Design System
  - Set up SvelteKit components structure
  - Implement design system (colors, typography, spacing)
  - Create reusable components (Button, Input, Card, Badge)
  - Configure responsive breakpoints
  - Set up accessibility foundation (ARIA, semantic HTML)
- **Story 3.2**: Input Form Component
  - Create form with drug_input, sig, days_supply fields
  - Implement form validation with error messages
  - Add Advanced Options accordion (preferred NDCs, unit override, max overfill)
  - Add Calculate button with loading state
  - Implement keyboard navigation and screen reader support
- **Story 3.3**: Results Display Component
  - Display computed quantity (large, prominent)
  - Show selected package with NDC, package size, packs, overfill
  - Display status badges (Active/Inactive)
  - Show overfill/underfill indicators with color coding
  - Implement copy NDC functionality
- **Story 3.4**: Alternates & Flags Display
  - Create collapsible alternates list
  - Display alternate NDCs with package details
  - Show flags section (inactive NDCs, mismatch, conversion notes)
  - Implement warning/error/info badges
  - Add Copy JSON button with toast notification
- **Story 3.5**: Toast Notification System
  - Implement toast component for user feedback
  - Show notifications for inactive NDCs, mismatches, errors
  - Support success, warning, error, info types
  - Add auto-dismiss and manual dismiss
  - Ensure screen reader announcements
- **Story 3.6**: API Integration & State Management
  - Connect UI to Cloud Function API
  - Implement request/response handling
  - Add loading states and error handling
  - Handle API errors with user-friendly messages
  - Implement retry logic for failed requests
- **Story 3.7**: Responsive Design & Accessibility
  - Ensure mobile-first responsive design
  - Optimize for tablet viewports (768px-1024px)
  - Test on iPad and Android tablets
  - Verify WCAG 2.1 AA compliance (keyboard nav, screen readers, contrast)
  - Test with assistive technologies

---

### Epic 4: Special Units & Production Readiness

**Goal**: Extend the computation engine to handle special dosage forms (liquids, inhalers, insulin), implement comprehensive telemetry, enhance error handling, and deploy to production with all monitoring and security measures in place.

**Description**: This epic extends the core computation engine to support special dosage forms beyond basic tablets/capsules, implements production-grade telemetry and logging, enhances error handling with degraded mode support, and completes the production deployment with secrets management, monitoring, and documentation.

**Stories**:
- **Story 4.1**: Liquid Dosage Form Support
  - Extend SIG parser for liquid formats (mL, teaspoons, etc.)
  - Implement liquid unit conversions
  - Add rounding rules for liquid quantities
  - Support concentration-based calculations
- **Story 4.2**: Inhaler Dosage Form Support
  - Extend SIG parser for inhaler formats (puffs, actuations)
  - Implement default actuation counts (e.g., 200 per canister)
  - Support configurable actuation counts per product
  - Handle canister-based quantity calculations
- **Story 4.3**: Insulin Dosage Form Support
  - Extend SIG parser for insulin formats (units, mL)
  - Implement insulin concentration mapping (U100, U200, etc.)
  - Support pen and vial formats
  - Handle unit conversions for insulin
- **Story 4.4**: Telemetry & Structured Logging
  - Implement structured JSON logging
  - Collect metrics (p50/p95 latency, error rate, parse-fail rate, etc.)
  - Add log redaction for PHI (drug_input, sig)
  - Set up Cloud Logging integration
  - Implement sampling (10% prod, 100% staging)
- **Story 4.5**: Monitoring & Alerting
  - Configure Cloud Monitoring alerts
  - Set alert thresholds (error rate >5%, p95 >3s)
  - Implement uptime monitoring
  - Set up error rate tracking
- **Story 4.6**: Enhanced Error Handling & Degraded Mode
  - Implement degraded mode with stale cache (48 hours)
  - Add `stale_data` flag to responses
  - Enhance error messages with actionable guidance
  - Implement comprehensive retry logic for all failure scenarios
  - Add timeout handling (5s upstream, 10s total)
- **Story 4.7**: Rate Limiting & Security
  - Implement per-IP rate limiting (10 req/min)
  - Add API key authentication (optional, via feature flag)
  - Configure CORS policy (Firebase Hosting origin in prod)
  - Implement input sanitization
  - Add security headers
- **Story 4.8**: Production Deployment
  - Configure production Firebase project
  - Set up Firebase Secret Manager (OPENAI_API_KEY, API_KEY)
  - Configure production environment variables
  - Deploy to Firebase Hosting + Functions
  - Set up production monitoring and alerts
  - Create deployment documentation
- **Story 4.9**: Documentation & Testing
  - Write API documentation
  - Create user guide
  - Document deployment process
  - Create acceptance test suite
  - Validate against acceptance test examples
  - Perform end-to-end testing

---

## 17) Milestones

* **M0** (1–2 days): Repo scaffold, types, API contract, stubbed SIG parser, Firebase project init.
* **M1** (3–5 days): RxNorm + FDA clients, ranking logic, minimal UI, Cloud Function `compute`, local + emulator tests.
* **M2** (2–3 days): Liquids/inhalers/insulin conversions; **telemetry plumbing**; error handling; **Firebase Hosting + Functions deploy**.
* **M3** (1–2 days): Hardening, docs, production config/secrets, cut MVP.

**Epic-to-Milestone Mapping**:
- **Epic 1** (Foundation) → M0
- **Epic 2** (Core Computation) → M1
- **Epic 3** (User Interface) → M1 (parallel with Epic 2)
- **Epic 4** (Special Units & Production) → M2, M3

---

## 18) Acceptance Tests (Examples)

1. `amoxicillin 500 mg cap`, `1 cap PO BID`, `30 days` → total=60; chosen active NDC 60×1 or 30×2; no flags.
2. Input NDC resolves to inactive → `flags.inactive_ndcs` contains NDC; no chosen.
3. `albuterol inhaler`, `2 puffs BID`, `30 days` with 200 actuations/canister → per‑day=4; total=120; chosen=1 canister; no flags.
4. `amoxicillin 250 mg/5 mL`, `5 mL TID`, `10 days` → per‑day=15 mL; total=150 mL; package size rounding ok.

---

## 19) Decisions (Locked for MVP)

* **SIG parsing:** Hybrid approach (rules-based primary, OpenAI API fallback) for MVP (meets "AI-accelerated" requirement). Feature flag `USE_AI_FALLBACK` (default: true).
* **Unit coverage (MVP):** tablets/capsules, oral liquids (mL), inhalers (actuations), insulin (units/mL, U100). Next: ophthalmic/otic, topicals, patches.
* **Overfill policy:** prefer exact; allow overfill ≤10% and at most **1 extra package**; never underfill by default; tie‑break → fewer packs → lower overfill → larger package.
* **Multi-pack:** Single-NDC multi-pack only for MVP (30×2). Mixed-NDC combinations (30×1 + 60×1) deferred to v1.1.
* **NDC status source of truth:** FDA NDC Directory (activity, packaging, marketing). RxNorm only for ID mapping.
* **UI scope:** single‑page with collapsed **Advanced Options** (preferred NDCs, unit override, max overfill). WCAG 2.1 Level AA compliant.
* **Telemetry:** required; metrics + sampling as in §13; no PHI; logs ≤30 days.
* **Hosting:** Firebase Hosting + Functions (us‑central1); outbound only to RxNorm/FDA/openFDA; optional API key check on `/api/*`.
* **Caching:** In-memory only (LRU cache, 1000 entries). No Firestore for MVP.
* **Error & timeouts:** upstream timeouts 5s with 1 retry; on failure return `424` with `error_code` and `retry_after_ms`. No circuit breakers for MVP.
* **API versioning:** expose `/api/v1/compute`; future breaking changes → `/api/v2`; keep previous version 90 days with deprecation header.
* **Deployment:** Manual deploy via `firebase deploy` for MVP. CI/CD automation deferred to v1.1.
* **Rate Limiting:** Per-IP rate limiting (10 req/min) for MVP. Distributed rate limiting deferred to v1.1.

---

## 20) Appendix

### 20.1 Configuration Defaults

* `OVERFILL_MAX = 10%` - Maximum allowed overfill percentage
* `MAX_PACKS = 3` - Maximum number of packages in multi-pack combinations
* `DEFAULT_INHALER_ACTUATIONS = 200` - Default actuations per inhaler canister
* `INSULIN_CONCENTRATION = { U100: 100 }` - Insulin concentration mapping

**Note**: Implementation details for timeouts, retry logic, and caching are documented in `docs/architecture.md`.

### 20.2 Future Enhancements

* Preferred NDC biasing
* Formulary awareness
* Enhanced AI SIG assist
* UI theming
* CI/CD automation
* Distributed rate limiting
* Mixed-NDC multi-pack combinations
