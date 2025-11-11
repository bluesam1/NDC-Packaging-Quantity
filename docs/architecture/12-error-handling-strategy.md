# 12) Error Handling Strategy

### 12.1 General Approach

- **Error Model**: Structured error responses with `error_code` and `detail` fields
- **Exception Hierarchy**: Custom error classes extending base `AppError` with error codes
- **Error Propagation**: Errors caught at handler level, translated to `ErrorResponse` format

### 12.2 Logging Standards

- **Library**: Cloud Logging (native Firebase)
- **Format**: Structured JSON logs
- **Levels**: `info`, `warn`, `error`
- **Required Context**:
  - Correlation ID: Request ID (generated per request)
  - Service Context: Function name, region
  - User Context: Redacted (no PHI in logs)

**Log Redaction Rules**:
- Redact `drug_input` and `sig` from logs (replace with `[REDACTED]` or boolean flag)
- Keep `days_supply`, `error_code`, `rxcui`, `ndc` (not PHI)
- Never log full request/response bodies containing SIG text

### 12.3 Error Handling Patterns

#### External API Errors

- **Retry Policy**: Max 1 retry, exponential backoff (1000ms, 2000ms max)
- **Circuit Breaker**: None for MVP (deferred to v1.1)
- **Timeout Configuration**: 5 seconds per upstream request, 10 seconds total function budget
- **Error Translation**: Map external API errors to `ErrorResponse` format with appropriate `error_code`

#### Business Logic Errors

- **Custom Exceptions**: 
  - `ValidationError` → `400` with `validation_error` code
  - `ParseError` → `422` with `parse_error` code
  - `DependencyError` → `424` with `dependency_failure` code
- **User-Facing Errors**: Clear, actionable error messages in `error` and `detail` fields
- **Error Codes**: Deterministic codes for programmatic handling

#### Data Consistency

- **Transaction Strategy**: N/A (no database for MVP)
- **Compensation Logic**: Degraded mode with stale cache (48 hours max)
- **Idempotency**: N/A for MVP (stateless compute function)

---
