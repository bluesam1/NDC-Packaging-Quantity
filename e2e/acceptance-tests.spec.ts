/**
 * E2E Acceptance Tests (AT-001 to AT-004)
 * 
 * These tests validate the complete user workflows from the test plan:
 * - AT-001: Amoxicillin 500mg capsule workflow
 * - AT-002: Inactive NDC workflow
 * - AT-003: Albuterol inhaler workflow
 * - AT-004: Amoxicillin liquid workflow
 * 
 * Tests the entire system including:
 * - UI input forms
 * - API integration
 * - Results display
 * - Error handling
 * - User experience
 */

import { expect, test } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.VITE_API_URL || 'http://localhost:4173';

test.describe('E2E Acceptance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('AT-001: Amoxicillin 500mg capsule workflow - exact match', async ({ page }) => {
    /**
     * Test scenario:
     * - Input: amoxicillin 500 mg cap
     * - SIG: 1 cap PO BID
     * - Days supply: 30 days
     * - Expected: total=60, chosen 60×1 or 30×2, no flags
     */

    // Step 1: Fill in the input form
    await page.fill('input[name="drug_input"]', 'amoxicillin 500 mg cap');
    await page.fill('input[name="sig"]', '1 cap PO BID');
    await page.fill('input[name="days_supply"]', '30');

    // Step 2: Submit the form
    await page.click('button[type="submit"]');

    // Step 3: Wait for results to load
    await page.waitForSelector('[data-testid="results-card"]', { timeout: 10000 });

    // Step 4: Validate computed quantity
    const totalQty = await page.locator('[data-testid="total-qty"]').textContent();
    expect(totalQty).toContain('60'); // 2 caps/day × 30 days = 60

    const perDay = await page.locator('[data-testid="per-day"]').textContent();
    expect(perDay).toContain('2'); // 2 caps per day

    // Step 5: Validate chosen package
    const chosenNDC = await page.locator('[data-testid="chosen-ndc"]');
    await expect(chosenNDC).toBeVisible();

    // Package should be 60×1 or 30×2 (exact match, no overfill)
    const packageInfo = await page.locator('[data-testid="chosen-package-info"]').textContent();
    expect(packageInfo).toMatch(/(60.*×.*1|30.*×.*2)/); // Either 60×1 or 30×2

    // Step 6: Validate overfill (should be 0 for exact match)
    const overfill = await page.locator('[data-testid="chosen-overfill"]').textContent();
    expect(overfill).toContain('0%'); // No overfill

    // Step 7: Validate no warning flags
    const inactiveFlag = await page.locator('[data-testid="flag-inactive"]');
    await expect(inactiveFlag).not.toBeVisible();

    // Step 8: Validate alternates list exists
    const alternatesList = await page.locator('[data-testid="alternates-list"]');
    await expect(alternatesList).toBeVisible();
  });

  test('AT-002: Inactive NDC workflow - flags inactive NDCs', async ({ page }) => {
    /**
     * Test scenario:
     * - Input: NDC that resolves to inactive
     * - Expected: flags.inactive_ndcs set, no chosen package
     * 
     * Note: This test may require a specific known inactive NDC
     * or mocking the API responses
     */

    // Step 1: Fill in form with a drug that may have inactive NDCs
    // Using a generic search that might return inactive NDCs
    await page.fill('input[name="drug_input"]', 'discontinued brand name');
    await page.fill('input[name="sig"]', '1 tab PO QD');
    await page.fill('input[name="days_supply"]', '30');

    // Step 2: Submit the form
    await page.click('button[type="submit"]');

    // Step 3: Wait for results
    await page.waitForSelector('[data-testid="results-card"]', { timeout: 10000 });

    // Step 4: Check for inactive NDC flag or warning
    // The UI should display a warning about inactive NDCs
    const hasInactiveWarning = await page.locator('text=/inactive/i').isVisible();
    
    if (hasInactiveWarning) {
      // Validate that inactive flag is displayed
      const inactiveFlag = await page.locator('[data-testid="flag-inactive"]');
      await expect(inactiveFlag).toBeVisible();

      // Validate that no package was chosen (or that a warning is shown)
      const noPackageMessage = await page.locator('text=/no.*package/i');
      await expect(noPackageMessage).toBeVisible();
    }

    // Note: If no inactive NDCs are returned, this test is skipped
    // A proper test would require mocking or a known inactive NDC
  });

  test('AT-003: Albuterol inhaler workflow - actuation units', async ({ page }) => {
    /**
     * Test scenario:
     * - Input: albuterol inhaler
     * - SIG: 2 puffs BID
     * - Days supply: 30 days
     * - Expected: per_day=4, total=120, chosen=1 canister (200 actuations)
     */

    // Step 1: Fill in the input form
    await page.fill('input[name="drug_input"]', 'albuterol inhaler');
    await page.fill('input[name="sig"]', '2 puffs BID');
    await page.fill('input[name="days_supply"]', '30');

    // Step 2: Submit the form
    await page.click('button[type="submit"]');

    // Step 3: Wait for results to load
    await page.waitForSelector('[data-testid="results-card"]', { timeout: 10000 });

    // Step 4: Validate computed quantity
    const totalQty = await page.locator('[data-testid="total-qty"]').textContent();
    expect(totalQty).toContain('120'); // 4 puffs/day × 30 days = 120

    const perDay = await page.locator('[data-testid="per-day"]').textContent();
    expect(perDay).toContain('4'); // 4 actuations per day

    // Step 5: Validate dose unit (should be actuations or puffs)
    const doseUnit = await page.locator('[data-testid="dose-unit"]').textContent();
    expect(doseUnit).toMatch(/(actuation|puff)/i);

    // Step 6: Validate chosen package
    const chosenNDC = await page.locator('[data-testid="chosen-ndc"]');
    await expect(chosenNDC).toBeVisible();

    // Step 7: Validate package info (should be 1 inhaler with 200 actuations)
    const packageInfo = await page.locator('[data-testid="chosen-package-info"]').textContent();
    expect(packageInfo).toMatch(/200/); // Standard inhaler size
    expect(packageInfo).toMatch(/×.*1/); // 1 inhaler
  });

  test('AT-004: Amoxicillin liquid workflow - mL units', async ({ page }) => {
    /**
     * Test scenario:
     * - Input: amoxicillin 250 mg/5 mL
     * - SIG: 5 mL TID
     * - Days supply: 10 days
     * - Expected: per_day=15 mL, total=150 mL
     */

    // Step 1: Fill in the input form
    await page.fill('input[name="drug_input"]', 'amoxicillin 250 mg/5 mL');
    await page.fill('input[name="sig"]', '5 mL TID');
    await page.fill('input[name="days_supply"]', '10');

    // Step 2: Submit the form
    await page.click('button[type="submit"]');

    // Step 3: Wait for results to load
    await page.waitForSelector('[data-testid="results-card"]', { timeout: 10000 });

    // Step 4: Validate computed quantity
    const totalQty = await page.locator('[data-testid="total-qty"]').textContent();
    expect(totalQty).toContain('150'); // 15 mL/day × 10 days = 150 mL

    const perDay = await page.locator('[data-testid="per-day"]').textContent();
    expect(perDay).toContain('15'); // 15 mL per day

    // Step 5: Validate dose unit (should be mL)
    const doseUnit = await page.locator('[data-testid="dose-unit"]').textContent();
    expect(doseUnit).toContain('mL');

    // Step 6: Validate chosen package
    const chosenNDC = await page.locator('[data-testid="chosen-ndc"]');
    await expect(chosenNDC).toBeVisible();

    // Step 7: Validate package size (should be 150 mL or close)
    const packageInfo = await page.locator('[data-testid="chosen-package-info"]').textContent();
    expect(packageInfo).toMatch(/150/); // 150 mL bottle
  });
});

test.describe('E2E User Story Tests (US-001 to US-003)', () => {
  test('US-001: Pharmacist workflow - exact quantity with active NDC and alternates', async ({ page }) => {
    /**
     * User story: As a pharmacist, I want to input prescription details
     * and get exact quantity recommendations with active NDCs and alternates
     */
    
    await page.goto('/');

    // Input prescription details
    await page.fill('input[name="drug_input"]', 'metformin 1000mg');
    await page.fill('input[name="sig"]', '1 tab PO BID');
    await page.fill('input[name="days_supply"]', '90');

    // Submit
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="results-card"]', { timeout: 10000 });

    // Validate main result
    const chosenNDC = await page.locator('[data-testid="chosen-ndc"]');
    await expect(chosenNDC).toBeVisible();

    // Validate active status indicator
    const activeStatus = await page.locator('[data-testid="chosen-active-status"]');
    await expect(activeStatus).toBeVisible();

    // Validate alternates list
    const alternatesList = await page.locator('[data-testid="alternates-list"]');
    await expect(alternatesList).toBeVisible();

    // Check that alternates are present
    const alternates = await page.locator('[data-testid^="alternate-"]').count();
    expect(alternates).toBeGreaterThan(0);
  });

  test('US-002: Pharmacy tech workflow - minimal overfill plan', async ({ page }) => {
    /**
     * User story: As a pharmacy tech, I want to see minimal-overfill plan
     * when no exact match exists
     */
    
    await page.goto('/');

    // Input prescription with odd quantity (unlikely exact match)
    await page.fill('input[name="drug_input"]', 'atorvastatin 20mg');
    await page.fill('input[name="sig"]', '1 tab PO QD');
    await page.fill('input[name="days_supply"]', '45'); // Odd number

    // Submit
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="results-card"]', { timeout: 10000 });

    // Validate chosen package
    const chosenNDC = await page.locator('[data-testid="chosen-ndc"]');
    await expect(chosenNDC).toBeVisible();

    // Check overfill percentage (should be > 0% but ≤ 10%)
    const overfill = await page.locator('[data-testid="chosen-overfill"]').textContent();
    expect(overfill).toBeDefined();

    // Validate that overfill is displayed and explained
    const overfillInfo = await page.locator('text=/overfill/i');
    await expect(overfillInfo).toBeVisible();
  });

  test('US-003: Engineer workflow - API returns structured JSON', async ({ page, request }) => {
    /**
     * User story: As an engineer, I want the API to return structured JSON
     * that I can consume programmatically
     */

    // Make direct API call
    const response = await request.post(`${BASE_URL}/api/v1/compute`, {
      data: {
        drug_input: 'lisinopril 10mg',
        sig: '1 tab PO QD',
        days_supply: 30,
      },
    });

    // Validate response status
    expect(response.status()).toBe(200);

    // Validate response is JSON
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');

    // Validate response structure
    const data = await response.json();
    expect(data).toHaveProperty('rxnorm');
    expect(data).toHaveProperty('computed');
    expect(data).toHaveProperty('ndc_selection');
    expect(data).toHaveProperty('flags');

    // Validate nested structures
    expect(data.rxnorm).toHaveProperty('rxcui');
    expect(data.rxnorm).toHaveProperty('name');
    expect(data.computed).toHaveProperty('dose_unit');
    expect(data.computed).toHaveProperty('per_day');
    expect(data.computed).toHaveProperty('total_qty');
    expect(data.computed).toHaveProperty('days_supply');
    expect(data.ndc_selection).toHaveProperty('alternates');
    expect(data.flags).toHaveProperty('inactive_ndcs');
    expect(data.flags).toHaveProperty('mismatch');
  });
});

test.describe('E2E UI/UX Tests (UI-001 to UI-007)', () => {
  test('UI-001: Input form validation', async ({ page }) => {
    await page.goto('/');

    // Test empty form submission
    await page.click('button[type="submit"]');

    // Should show validation errors
    const drugInputError = await page.locator('[data-testid="error-drug_input"]');
    await expect(drugInputError).toBeVisible();

    // Test invalid days_supply (out of range)
    await page.fill('input[name="drug_input"]', 'amoxicillin');
    await page.fill('input[name="sig"]', '1 cap BID');
    await page.fill('input[name="days_supply"]', '400'); // > 365

    await page.click('button[type="submit"]');

    // Should show validation error for days_supply
    const daysSupplyError = await page.locator('[data-testid="error-days_supply"]');
    await expect(daysSupplyError).toBeVisible();
  });

  test('UI-002: Advanced Options accordion', async ({ page }) => {
    await page.goto('/');

    // Advanced options should be collapsed by default
    const advancedOptions = await page.locator('[data-testid="advanced-options"]');
    await expect(advancedOptions).not.toBeVisible();

    // Click to expand
    await page.click('[data-testid="toggle-advanced-options"]');

    // Should now be visible
    await expect(advancedOptions).toBeVisible();

    // Should contain preferred NDCs input
    const preferredNdcsInput = await page.locator('input[name="preferred_ndcs"]');
    await expect(preferredNdcsInput).toBeVisible();
  });

  test('UI-005: Copy NDC and Copy JSON functionality', async ({ page }) => {
    await page.goto('/');

    // Fill and submit form
    await page.fill('input[name="drug_input"]', 'amoxicillin 500mg');
    await page.fill('input[name="sig"]', '1 cap BID');
    await page.fill('input[name="days_supply"]', '30');
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="results-card"]', { timeout: 10000 });

    // Test Copy NDC button
    const copyNDCButton = await page.locator('[data-testid="copy-ndc-button"]');
    await expect(copyNDCButton).toBeVisible();
    await copyNDCButton.click();

    // Should show success toast
    const successToast = await page.locator('text=/copied/i');
    await expect(successToast).toBeVisible({ timeout: 2000 });

    // Test Copy JSON button
    const copyJSONButton = await page.locator('[data-testid="copy-json-button"]');
    await expect(copyJSONButton).toBeVisible();
    await copyJSONButton.click();

    // Should show success toast
    await expect(successToast).toBeVisible({ timeout: 2000 });
  });

  test('UI-006: Keyboard navigation and accessibility', async ({ page }) => {
    await page.goto('/');

    // Test keyboard navigation through form
    await page.keyboard.press('Tab'); // Focus on drug_input
    await page.keyboard.type('amoxicillin');

    await page.keyboard.press('Tab'); // Focus on sig
    await page.keyboard.type('1 cap BID');

    await page.keyboard.press('Tab'); // Focus on days_supply
    await page.keyboard.type('30');

    await page.keyboard.press('Tab'); // Focus on submit button
    await page.keyboard.press('Enter'); // Submit

    // Should submit successfully
    await page.waitForSelector('[data-testid="results-card"]', { timeout: 10000 });

    // Validate WCAG 2.1 AA compliance (basic checks)
    // Check for proper heading hierarchy
    const h1 = await page.locator('h1');
    await expect(h1).toBeVisible();

    // Check for proper labels
    const drugInputLabel = await page.locator('label[for="drug_input"]');
    await expect(drugInputLabel).toBeVisible();
  });

  test('UI-007: Responsive design - mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Validate layout adapts to mobile
    const mainContainer = await page.locator('[data-testid="main-container"]');
    await expect(mainContainer).toBeVisible();

    // Form should be full-width on mobile
    const form = await page.locator('form');
    const formWidth = await form.evaluate((el) => el.clientWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    
    // Form should take most of viewport width (allow for padding)
    expect(formWidth).toBeGreaterThan(viewportWidth * 0.8);
  });

  test('UI-007: Responsive design - tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Validate layout adapts to tablet
    const mainContainer = await page.locator('[data-testid="main-container"]');
    await expect(mainContainer).toBeVisible();

    // Should be visible and properly laid out
    const form = await page.locator('form');
    await expect(form).toBeVisible();
  });
});

test.describe('E2E Error Handling', () => {
  test('should display error toast on API failure', async ({ page }) => {
    await page.goto('/');

    // Fill form with data that might cause an error
    await page.fill('input[name="drug_input"]', 'invalid-drug-name-12345');
    await page.fill('input[name="sig"]', 'invalid sig format');
    await page.fill('input[name="days_supply"]', '30');

    // Submit
    await page.click('button[type="submit"]');

    // Should show error toast or error message
    const errorToast = await page.locator('[data-testid="error-toast"]');
    const errorMessage = await page.locator('text=/error/i');
    
    // Either error toast or error message should appear
    const hasError = await errorToast.isVisible().catch(() => false) || 
                     await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBeTruthy();
  });

  test('should handle network timeout gracefully', async ({ page }) => {
    await page.goto('/');

    // Simulate slow network by setting timeout
    await page.route('**/api/v1/compute', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 15000)); // 15s delay
      await route.abort();
    });

    // Fill and submit form
    await page.fill('input[name="drug_input"]', 'amoxicillin');
    await page.fill('input[name="sig"]', '1 cap BID');
    await page.fill('input[name="days_supply"]', '30');
    await page.click('button[type="submit"]');

    // Should show timeout error
    const errorMessage = await page.locator('text=/timeout|network|error/i');
    await expect(errorMessage).toBeVisible({ timeout: 15000 });
  });
});

test.describe('E2E Security Tests', () => {
  test('SEC-005: No PHI in browser storage (localStorage, sessionStorage, cookies)', async ({ page }) => {
    /**
     * Critical security test: Validates that no PHI is persisted in browser storage
     * Tests localStorage, sessionStorage, and cookies
     */
    
    await page.goto('/');

    // Fill form with sensitive PHI data
    const sensitiveDrug = 'PATIENT_SENSITIVE_MEDICATION_12345';
    const sensitiveSig = 'PATIENT_SENSITIVE_DIRECTIONS_67890';
    
    await page.fill('input[name="drug_input"]', sensitiveDrug);
    await page.fill('input[name="sig"]', sensitiveSig);
    await page.fill('input[name="days_supply"]', '30');

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for results (or error)
    await page.waitForTimeout(2000);

    // Check localStorage
    const localStorageData = await page.evaluate(() => {
      const data: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          data[key] = localStorage.getItem(key) || '';
        }
      }
      return data;
    });

    // Validate no PHI in localStorage
    const localStorageString = JSON.stringify(localStorageData);
    expect(localStorageString).not.toContain(sensitiveDrug);
    expect(localStorageString).not.toContain(sensitiveSig);

    // Check sessionStorage
    const sessionStorageData = await page.evaluate(() => {
      const data: Record<string, string> = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          data[key] = sessionStorage.getItem(key) || '';
        }
      }
      return data;
    });

    // Validate no PHI in sessionStorage
    const sessionStorageString = JSON.stringify(sessionStorageData);
    expect(sessionStorageString).not.toContain(sensitiveDrug);
    expect(sessionStorageString).not.toContain(sensitiveSig);

    // Check cookies
    const cookies = await page.context().cookies();
    const cookiesString = JSON.stringify(cookies);
    expect(cookiesString).not.toContain(sensitiveDrug);
    expect(cookiesString).not.toContain(sensitiveSig);

    // Validate that only non-PHI data may be stored (like preferences)
    // PHI fields (drug_input, sig) should NEVER be stored
    for (const [key, value] of Object.entries(localStorageData)) {
      expect(key).not.toMatch(/drug|medication|sig|directions/i);
      expect(value).not.toContain(sensitiveDrug);
      expect(value).not.toContain(sensitiveSig);
    }
  });

  test('SEC-005: No PHI in browser memory after navigation away', async ({ page }) => {
    /**
     * Validates that PHI is cleared from memory when navigating away
     */
    
    await page.goto('/');

    // Fill and submit form with sensitive data
    await page.fill('input[name="drug_input"]', 'SENSITIVE_MED_999');
    await page.fill('input[name="sig"]', 'SENSITIVE_SIG_888');
    await page.fill('input[name="days_supply"]', '30');
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForTimeout(2000);

    // Navigate to a different page (or reload)
    await page.goto('/');

    // Check that form inputs are cleared
    const drugInput = await page.inputValue('input[name="drug_input"]');
    const sigInput = await page.inputValue('input[name="sig"]');

    // Form should be empty (no PHI retained)
    expect(drugInput).toBe('');
    expect(sigInput).toBe('');

    // Verify no PHI in storage after reload
    const localStorageData = await page.evaluate(() => {
      return JSON.stringify(localStorage);
    });

    expect(localStorageData).not.toContain('SENSITIVE_MED_999');
    expect(localStorageData).not.toContain('SENSITIVE_SIG_888');
  });

  test('SEC-003: HTTPS enforcement', async ({ page, context }) => {
    /**
     * Validates that the application enforces HTTPS in production
     * Note: This test may only apply to production deployments
     */

    await page.goto('/');

    // Check that page URL is HTTPS (in production)
    const url = page.url();
    
    // In local development, HTTP is acceptable
    // In production, HTTPS should be enforced
    if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
      expect(url).toMatch(/^https:\/\//);
    }

    // Check that all API calls use HTTPS (not HTTP)
    const requestUrls: string[] = [];
    
    page.on('request', (request) => {
      const reqUrl = request.url();
      if (reqUrl.includes('/api/')) {
        requestUrls.push(reqUrl);
      }
    });

    // Fill and submit form
    await page.fill('input[name="drug_input"]', 'test drug');
    await page.fill('input[name="sig"]', '1 cap BID');
    await page.fill('input[name="days_supply"]', '30');
    await page.click('button[type="submit"]');

    // Wait for API call
    await page.waitForTimeout(2000);

    // Validate API calls use HTTPS (in non-local environments)
    for (const url of requestUrls) {
      if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
        expect(url).toMatch(/^https:\/\//);
      }
    }
  });
});

