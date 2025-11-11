# Testing Menu UI Requirements

**Version:** 1.0  
**Date:** 2025-01-27  
**Status:** Approved

---

## Overview

This document specifies the requirements for a Testing Menu UI feature that allows users to run test cases directly from the application interface. The feature provides a convenient way to execute test suites and view results without leaving the main application.

## Feature Description

The Testing Menu UI is a developer/QA tool that:
- Provides access to test cases via a floating action button
- Loads test cases from a JSON configuration file
- Executes test suites automatically against the API
- Displays test results in a minimal log format with expandable details
- Organizes tests by category/test suite for selective execution

## Key Requirements

### 1. Test Suite Categories as Menu Options

**CRITICAL:** Test suites are organized as **categories that can be run individually**, not as a single "run all" operation.

- Each test suite category is a separate menu option
- Users select which category to run (e.g., "Acceptance Tests", "Input Validation")
- Only one test suite can run at a time
- Test suites are independent and can be executed separately

**Test Suite Categories:**
1. Acceptance Tests (AT-001 to AT-004)
2. Input Validation (IV-001 to IV-007)
3. API Endpoint Tests (API-001 to API-008)
4. User Story Tests (US-001 to US-003)
5. RxNorm Integration (RX-001 to RX-006)
6. FDA NDC Directory (FDA-001 to FDA-007)
7. SIG Parsing (SIG-001 to SIG-008)
8. Package Selection (PKG-001 to PKG-009)

### 2. User Interface Components

#### 2.1 Floating Test Menu Button
- **Location:** Bottom-right corner of the screen
- **Type:** Floating Action Button (FAB)
- **Icon:** Test/beaker icon
- **Size:** 56px × 56px (touch-friendly)
- **Behavior:** Clicking opens the test suite panel
- **Accessibility:** Keyboard accessible, proper ARIA labels

#### 2.2 Test Suite Panel
- **Layout:** Modal/panel that slides in from right or overlays
- **Width:** 600px max (responsive)
- **Height:** 80vh max
- **Content:**
  - Header with "Test Suite" title and close button
  - Test suite menu (list of category options)
  - Test log area (scrollable results)
  - Summary section (pass/fail counts, duration)

#### 2.3 Test Suite Menu
- **Format:** List of buttons/cards, one per test suite category
- **Display:**
  - Test suite name
  - Test count (e.g., "Acceptance Tests (4 tests)")
  - Last run status (if available): "Last run: 3/4 passed"
- **Behavior:**
  - Clicking a suite runs only that suite's tests
  - Active/running suite is highlighted
  - Other suites disabled while one is running
  - Loading state shown on selected suite during execution

#### 2.4 Test Log Entry
- **Display Format:** Minimal log with abbreviated descriptions
- **Content:**
  - Test ID and name
  - Status badge (Pass/Fail/Running)
  - Abbreviated description (truncated with ellipsis)
  - Full description on hover (tooltip)
  - Duration (ms)
  - Expandable error details (if failed)
- **Visual Indicators:**
  - Green badge for pass
  - Red badge for fail
  - Gray badge for running
  - Icons: Checkmark (pass), X (fail), spinner (running)

### 3. Test Case Structure

Test cases are stored in a JSON file (`static/test-cases.json`) with the following structure:

```json
{
  "testSuites": [
    {
      "id": "acceptance-tests",
      "name": "Acceptance Tests",
      "tests": [
        {
          "id": "AT-001",
          "name": "Test name",
          "priority": "P0",
          "level": "E2E",
          "description": "Full description for hover tooltip",
          "descriptionShort": "Abbreviated description for display",
          "request": {
            "drug_input": "...",
            "sig": "...",
            "days_supply": 30
          },
          "assertions": {
            "totalQty": 60,
            "hasChosenPackage": true,
            "noFlags": true
          }
        }
      ]
    }
  ]
}
```

**Required Fields:**
- `id`: Unique test identifier (e.g., "AT-001")
- `name`: Human-readable test name
- `priority`: P0, P1, P2, or P3
- `level`: Unit, Integration, or E2E
- `description`: Full description (shown on hover)
- `descriptionShort`: Abbreviated description (shown in log)
- `request`: API request payload
- `assertions`: Expected results to validate

### 4. Test Execution Behavior

#### 4.1 Execution Flow
1. User clicks floating test menu button
2. Test suite panel opens
3. User selects a test suite category
4. Tests in that category execute sequentially
5. Results display in real-time in the test log
6. Summary updates as tests complete

#### 4.2 Test Execution Rules
- Tests run **sequentially** (not in parallel) to avoid API rate limiting
- Delay between tests: 100ms (configurable)
- Only one test suite can run at a time
- Test execution can be cancelled (future enhancement)

#### 4.3 Result Validation
- Each test validates its assertions against the API response
- Pass: All assertions pass
- Fail: One or more assertions fail OR API error occurs
- Results include: pass/fail status, duration, error details (if failed)

### 5. User Interaction Flow

```
1. User sees floating test menu button (bottom-right)
2. User clicks button
3. Test suite panel opens
4. User sees list of test suite categories
5. User clicks a category (e.g., "Acceptance Tests")
6. Tests in that category begin executing
7. Test log shows results in real-time
8. Summary updates with pass/fail counts
9. User can close panel or select another category
```

### 6. Technical Requirements

#### 6.1 File Locations
- Test cases: `static/test-cases.json`
- Test runner service: `src/lib/services/testRunner.ts`
- Test results store: `src/lib/stores/testResults.ts`
- Components:
  - `src/lib/components/TestMenuButton.svelte`
  - `src/lib/components/TestSuitePanel.svelte`
  - `src/lib/components/TestLogEntry.svelte`

#### 6.2 Integration Points
- Main page: `src/routes/+page.svelte` (adds TestMenuButton)
- Component exports: `src/lib/components/index.ts`
- API service: Uses existing `computeQuantity` function from `src/lib/services/api.ts`

#### 6.3 Styling
- Use existing design tokens from `src/lib/styles/design-tokens.css`
- Follow existing component patterns
- Ensure responsive design (mobile-friendly)
- Match existing color scheme and typography

### 7. Accessibility Requirements

- Test menu button: Keyboard accessible (Enter/Space to activate)
- Panel: Focus trap when open
- Test log: Screen reader announcements for pass/fail
- Tooltips: Keyboard accessible (focus to show)
- All interactive elements: Proper ARIA labels
- Color coding: Not the only indicator (icons + text)

### 8. Error Handling

- Network errors: Display in test log with clear message
- Timeout errors: Mark test as failed with timeout message
- Invalid assertions: Show assertion failure details
- JSON parse errors: Handle gracefully with user-friendly message
- API errors: Capture and display error code and message

### 9. Performance Considerations

- Sequential test execution (avoid rate limiting)
- Configurable delay between tests (default: 100ms)
- Progress indicator during execution
- Efficient rendering of test log entries
- Cancel test run capability (future enhancement)

## Success Criteria

The feature is considered complete when:
- ✅ Floating test menu button is visible and functional
- ✅ Test suite panel opens/closes correctly
- ✅ Test suite categories are displayed as menu options
- ✅ Clicking a category runs only that suite's tests
- ✅ Test results display in real-time
- ✅ Abbreviated descriptions show with hover tooltips
- ✅ Test log shows pass/fail status, duration, and errors
- ✅ Summary shows accurate pass/fail counts
- ✅ All accessibility requirements met
- ✅ Responsive design works on mobile/tablet/desktop

## Out of Scope (Future Enhancements)

- Export test results to JSON/CSV
- Save test history
- Filter tests by priority/category
- Run tests in parallel
- Test result comparison over time
- Integration with CI/CD
- Running all test suites at once

## Notes

- This feature is primarily for developer/QA use
- Test cases are loaded from static JSON file (not dynamically generated)
- Focus is on E2E and Integration tests that can run via API
- Unit tests are not included (cannot run via API)

---

**Document Owner:** Product Owner  
**Last Updated:** 2025-01-27


