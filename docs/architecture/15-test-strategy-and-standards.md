# 15) Test Strategy and Standards

### 15.1 Testing Philosophy

- **Approach**: Test-after development (TDD deferred to v1.1)
- **Coverage Goals**: 
  - Unit tests: Core algorithms (SIG parser, package selector)
  - Integration tests: API endpoint with emulators
  - E2E tests: Critical user flows (deferred to v1.1)
- **Test Pyramid**: Focus on unit and integration tests for MVP

### 15.2 Test Types and Organization

#### Unit Tests

- **Framework**: TBD (Jest or Vitest recommended)
- **File Convention**: `*.test.ts` co-located with source
- **Location**: `functions/src/**/*.test.ts`, `src/**/*.test.ts`
- **Mocking Library**: TBD (Jest mocks or Vitest mocks)
- **Coverage Requirement**: Core algorithms (SIG parser, package selector) - 80%+

**AI Agent Requirements**:
- Generate tests for all public methods
- Cover edge cases and error conditions
- Follow AAA pattern (Arrange, Act, Assert)
- Mock all external dependencies (RxNorm, FDA, OpenAI)

#### Integration Tests

- **Scope**: API endpoint with Firebase emulators
- **Location**: `functions/tests/integration/`
- **Test Infrastructure**:
  - **Firebase Emulators**: Functions + Hosting emulators for local testing
  - **Mock APIs**: Express server for RxNorm/FDA during integration tests

#### E2E Tests

- **Framework**: TBD (Playwright or Cypress recommended)
- **Scope**: Critical user flows (deferred to v1.1)
- **Environment**: Staging environment
- **Test Data**: Synthetic test data (no real PHI)

### 15.3 Test Data Management

- **Strategy**: Synthetic test data, fixtures for common scenarios
- **Fixtures**: `tests/fixtures/` directory
- **Factories**: Test data factories for generating test cases
- **Cleanup**: Stateless tests (no cleanup needed for MVP)

### 15.4 Continuous Testing

- **CI Integration**: Manual testing for MVP (automation deferred to v1.1)
- **Performance Tests**: Manual performance testing (p95 latency validation)
- **Security Tests**: Manual security review before production

---
