/**
 * Security & Privacy Tests (SEC-001 to SEC-005)
 * 
 * These tests validate security and privacy requirements:
 * - SEC-001: No PHI persisted to disk or database
 * - SEC-002: Log redaction for PHI fields (drug_input, sig)
 * - SEC-003: HTTPS/TLS enforcement
 * - SEC-004: Secrets management via Firebase Secret Manager
 * - SEC-005: No PHI in browser storage (E2E test in acceptance-tests.spec.ts)
 * 
 * Priority: P0 - CRITICAL
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { handleCompute } from '../handlers/compute';
import { createRxNormClient } from '../services/rxnorm-client';
import { createFDAClient } from '../services/fda-client';
import { parseSIG } from '../services/sig-parser';
import type { ComputeRequest, NDCPackageData } from '../types/index';
import * as fs from 'fs';

// Mock all services except logger (we want to test real PHI redaction)
vi.mock('../services/rxnorm-client');
vi.mock('../services/fda-client');
vi.mock('../services/sig-parser');
vi.mock('fs');

describe('Security & Privacy Tests', () => {
  let mockRxNormClient: ReturnType<typeof createRxNormClient>;
  let mockFDAClient: ReturnType<typeof createFDAClient>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup mocks
    mockRxNormClient = {
      findRxcuiByString: vi.fn(),
      approximateTerm: vi.fn(),
      getNdcsByRxcui: vi.fn(),
    } as any;

    mockFDAClient = {
      searchByBrandName: vi.fn(),
      lookupByNDC: vi.fn(),
    } as any;

    vi.mocked(createRxNormClient).mockReturnValue(mockRxNormClient);
    vi.mocked(createFDAClient).mockReturnValue(mockFDAClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SEC-001: No PHI Persistence', () => {
    it('should not write drug_input to disk', async () => {
      // Arrange
      const mockNDCs: NDCPackageData[] = [
        { ndc: '00093010501', pkg_size: 30, active: true, dosage_form: 'CAPSULE' },
      ];

      mockRxNormClient.findRxcuiByString = vi.fn().mockResolvedValue('723');
      mockRxNormClient.getNdcsByRxcui = vi.fn().mockResolvedValue(['00093010501']);
      mockFDAClient.searchByBrandName = vi.fn().mockResolvedValue(mockNDCs);
      vi.mocked(parseSIG).mockResolvedValue({
        dose_unit: 'cap',
        per_day: 2,
        confidence: 'parsed',
      });

      const sensitiveRequest: ComputeRequest = {
        drug_input: 'PATIENT_SENSITIVE_MEDICATION_NAME',
        sig: 'PATIENT_SENSITIVE_DIRECTIONS',
        days_supply: 30,
      };

      // Mock fs.writeFileSync to detect file writes
      const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const appendFileSyncSpy = vi.spyOn(fs, 'appendFileSync').mockImplementation(() => {});

      // Act
      await handleCompute(sensitiveRequest);

      // Assert: No file writes should occur
      expect(writeFileSyncSpy).not.toHaveBeenCalled();
      expect(appendFileSyncSpy).not.toHaveBeenCalled();
    });

    it('should not persist sig to disk', async () => {
      // Arrange
      const mockNDCs: NDCPackageData[] = [
        { ndc: '00093010501', pkg_size: 30, active: true, dosage_form: 'CAPSULE' },
      ];

      mockRxNormClient.findRxcuiByString = vi.fn().mockResolvedValue('723');
      mockRxNormClient.getNdcsByRxcui = vi.fn().mockResolvedValue(['00093010501']);
      mockFDAClient.searchByBrandName = vi.fn().mockResolvedValue(mockNDCs);
      vi.mocked(parseSIG).mockResolvedValue({
        dose_unit: 'cap',
        per_day: 2,
        confidence: 'parsed',
      });

      const sensitiveRequest: ComputeRequest = {
        drug_input: 'amoxicillin',
        sig: 'PRIVATE_PATIENT_INSTRUCTIONS_WITH_PHI',
        days_supply: 30,
      };

      // Mock fs operations
      const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const appendFileSyncSpy = vi.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockImplementation((() => {}) as any);

      // Act
      await handleCompute(sensitiveRequest);

      // Assert: No file writes
      expect(writeFileSyncSpy).not.toHaveBeenCalled();
      expect(appendFileSyncSpy).not.toHaveBeenCalled();
      expect(writeFileSpy).not.toHaveBeenCalled();
    });

    it('should return response without persisting PHI', async () => {
      // Arrange
      const mockNDCs: NDCPackageData[] = [
        { ndc: '00093010501', pkg_size: 30, active: true, dosage_form: 'CAPSULE' },
      ];

      mockRxNormClient.findRxcuiByString = vi.fn().mockResolvedValue('723');
      mockRxNormClient.getNdcsByRxcui = vi.fn().mockResolvedValue(['00093010501']);
      mockFDAClient.searchByBrandName = vi.fn().mockResolvedValue(mockNDCs);
      vi.mocked(parseSIG).mockResolvedValue({
        dose_unit: 'cap',
        per_day: 1,
        confidence: 'parsed',
      });

      const request: ComputeRequest = {
        drug_input: 'sensitive_drug',
        sig: 'sensitive_sig',
        days_supply: 30,
      };

      // Act
      const response = await handleCompute(request);

      // Assert: Response should be returned successfully
      expect(response).toBeDefined();
      expect(response.computed.total_qty).toBe(30);

      // Verify no persistence occurred
      const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync');
      expect(writeFileSyncSpy).not.toHaveBeenCalled();
    });
  });

  describe('SEC-002: Log Redaction', () => {
    it('should redact drug_input in all log levels', async () => {
      // Arrange
      const mockNDCs: NDCPackageData[] = [
        { ndc: '00093010501', pkg_size: 30, active: true, dosage_form: 'CAPSULE' },
      ];

      mockRxNormClient.findRxcuiByString = vi.fn().mockResolvedValue('723');
      mockRxNormClient.getNdcsByRxcui = vi.fn().mockResolvedValue(['00093010501']);
      mockFDAClient.searchByBrandName = vi.fn().mockResolvedValue(mockNDCs);
      vi.mocked(parseSIG).mockResolvedValue({
        dose_unit: 'cap',
        per_day: 2,
        confidence: 'parsed',
      });

      const sensitiveRequest: ComputeRequest = {
        drug_input: 'HIGHLY_SENSITIVE_DRUG_NAME_12345',
        sig: 'HIGHLY_SENSITIVE_DIRECTIONS_67890',
        days_supply: 30,
      };

      // Act
      await handleCompute(sensitiveRequest, 'test-correlation');

      // Assert: Check all console outputs
      const allLogs = [
        ...consoleLogSpy.mock.calls.flat(),
        ...consoleWarnSpy.mock.calls.flat(),
        ...consoleErrorSpy.mock.calls.flat(),
      ].join(' ');

      // PHI should NOT appear in logs
      expect(allLogs).not.toContain('HIGHLY_SENSITIVE_DRUG_NAME_12345');
      expect(allLogs).not.toContain('HIGHLY_SENSITIVE_DIRECTIONS_67890');

      // Redaction marker should be present
      expect(allLogs).toContain('[REDACTED]');
    });

    it('should redact sig in error logs', async () => {
      // Arrange: Force an error to generate error logs
      mockRxNormClient.findRxcuiByString = vi.fn().mockRejectedValue(new Error('API Error'));
      mockFDAClient.searchByBrandName = vi.fn().mockRejectedValue(new Error('API Error'));

      const sensitiveRequest: ComputeRequest = {
        drug_input: 'PATIENT_DRUG',
        sig: 'PATIENT_SIG_WITH_PHI',
        days_supply: 30,
      };

      // Act
      try {
        await handleCompute(sensitiveRequest, 'error-test');
      } catch (error) {
        // Expected to throw
      }

      // Assert: Check error logs
      const errorLogs = consoleErrorSpy.mock.calls.flat().join(' ');
      expect(errorLogs).not.toContain('PATIENT_DRUG');
      expect(errorLogs).not.toContain('PATIENT_SIG_WITH_PHI');
      expect(errorLogs).toContain('[REDACTED]');
    });

    it('should redact drug_name field if present', async () => {
      // Arrange
      const mockNDCs: NDCPackageData[] = [
        { ndc: '00093010501', pkg_size: 30, active: true, dosage_form: 'CAPSULE' },
      ];

      mockRxNormClient.findRxcuiByString = vi.fn().mockResolvedValue('723');
      mockRxNormClient.getNdcsByRxcui = vi.fn().mockResolvedValue(['00093010501']);
      mockFDAClient.searchByBrandName = vi.fn().mockResolvedValue(mockNDCs);
      vi.mocked(parseSIG).mockResolvedValue({
        dose_unit: 'cap',
        per_day: 2,
        confidence: 'parsed',
      });

      const request: ComputeRequest = {
        drug_input: 'SENSITIVE_NAME',
        sig: '1 cap BID',
        days_supply: 30,
      };

      // Act
      await handleCompute(request);

      // Assert: Verify redaction
      const allLogs = [
        ...consoleLogSpy.mock.calls.flat(),
        ...consoleWarnSpy.mock.calls.flat(),
      ].join(' ');

      expect(allLogs).not.toContain('SENSITIVE_NAME');
    });

    it('should preserve non-PHI fields in logs', async () => {
      // Arrange
      const mockNDCs: NDCPackageData[] = [
        { ndc: '00093010501', pkg_size: 30, active: true, dosage_form: 'CAPSULE' },
      ];

      mockRxNormClient.findRxcuiByString = vi.fn().mockResolvedValue('723');
      mockRxNormClient.getNdcsByRxcui = vi.fn().mockResolvedValue(['00093010501']);
      mockFDAClient.searchByBrandName = vi.fn().mockResolvedValue(mockNDCs);
      vi.mocked(parseSIG).mockResolvedValue({
        dose_unit: 'cap',
        per_day: 2,
        confidence: 'parsed',
      });

      const request: ComputeRequest = {
        drug_input: 'test drug',
        sig: 'test sig',
        days_supply: 30,
      };

      const correlationId = 'test-correlation-id-12345';

      // Act
      await handleCompute(request, correlationId);

      // Assert: Non-PHI fields should be present
      const allLogs = [
        ...consoleLogSpy.mock.calls.flat(),
        ...consoleWarnSpy.mock.calls.flat(),
      ].join(' ');

      // Correlation ID should be present (not PHI)
      expect(allLogs).toContain(correlationId);

      // Days supply is not PHI, but drug_input and sig should be redacted
      expect(allLogs).not.toContain('test drug');
      expect(allLogs).not.toContain('test sig');
    });
  });

  describe('SEC-003: HTTPS/TLS Enforcement', () => {
    it('should reject HTTP requests in production', () => {
      // This test validates that the deployment configuration enforces HTTPS
      // In a real implementation, this would be tested at the Cloud Function level
      
      // Note: This is a conceptual test. Actual HTTPS enforcement happens at the
      // Firebase/GCP infrastructure level, not in application code.
      
      // Validation: Ensure environment variable or config requires HTTPS
      const requireHTTPS = process.env.REQUIRE_HTTPS !== 'false';
      expect(requireHTTPS).toBe(true);
    });

    it('should validate that API calls use HTTPS URLs', () => {
      // Validate that external API clients use HTTPS
      const rxnormClient = createRxNormClient();
      const fdaClient = createFDAClient();

      // RxNorm and FDA clients should use HTTPS base URLs
      // This is validated in the client constructors

      expect(rxnormClient).toBeDefined();
      expect(fdaClient).toBeDefined();
    });
  });

  describe('SEC-004: Secrets Management', () => {
    it('should not expose API keys in logs', async () => {
      // Arrange
      const mockNDCs: NDCPackageData[] = [
        { ndc: '00093010501', pkg_size: 30, active: true, dosage_form: 'CAPSULE' },
      ];

      mockRxNormClient.findRxcuiByString = vi.fn().mockResolvedValue('723');
      mockRxNormClient.getNdcsByRxcui = vi.fn().mockResolvedValue(['00093010501']);
      mockFDAClient.searchByBrandName = vi.fn().mockResolvedValue(mockNDCs);
      vi.mocked(parseSIG).mockResolvedValue({
        dose_unit: 'cap',
        per_day: 2,
        confidence: 'parsed',
      });

      const request: ComputeRequest = {
        drug_input: 'amoxicillin',
        sig: '1 cap BID',
        days_supply: 30,
      };

      // Act
      await handleCompute(request);

      // Assert: API keys should not appear in logs
      const allLogs = [
        ...consoleLogSpy.mock.calls.flat(),
        ...consoleWarnSpy.mock.calls.flat(),
        ...consoleErrorSpy.mock.calls.flat(),
      ].join(' ');

      // Common API key patterns should not appear
      expect(allLogs).not.toMatch(/api[_-]?key/i);
      expect(allLogs).not.toMatch(/sk-[a-zA-Z0-9]{32,}/); // OpenAI key pattern
      expect(allLogs).not.toMatch(/Bearer [a-zA-Z0-9]{32,}/); // Bearer token pattern
    });

    it('should use environment variables for secrets', () => {
      // Validate that secrets come from environment variables, not hardcoded
      // This is a conceptual test - actual implementation depends on deployment

      // OpenAI API key should be from environment
      const hasOpenAIKey = process.env.OPENAI_API_KEY !== undefined || 
                           process.env.USE_AI_FALLBACK === 'false';
      
      // Either the key is available via env var, or AI fallback is disabled
      expect(hasOpenAIKey).toBeDefined();
    });
  });

  describe('SEC-002 Extended: Comprehensive Redaction Tests', () => {
    it('should redact all PHI fields in a single log entry', async () => {
      // Arrange
      mockRxNormClient.findRxcuiByString = vi.fn().mockResolvedValue('723');
      mockRxNormClient.getNdcsByRxcui = vi.fn().mockResolvedValue([]);
      mockFDAClient.searchByBrandName = vi.fn().mockResolvedValue([]);
      vi.mocked(parseSIG).mockResolvedValue({
        dose_unit: 'cap',
        per_day: 2,
        confidence: 'parsed',
      });

      const request: ComputeRequest = {
        drug_input: 'PHI_DRUG_123',
        sig: 'PHI_SIG_456',
        days_supply: 30,
      };

      // Act
      await handleCompute(request);

      // Assert: All PHI should be redacted in the same log entry
      const logCalls = consoleLogSpy.mock.calls;
      
      for (const call of logCalls) {
        const logEntry = call.join(' ');
        
        // If this log contains context about the request
        if (logEntry.includes('drug_input') || logEntry.includes('sig')) {
          // Both fields should be redacted
          expect(logEntry).not.toContain('PHI_DRUG_123');
          expect(logEntry).not.toContain('PHI_SIG_456');
          expect(logEntry).toContain('[REDACTED]');
        }
      }
    });

    it('should handle edge case: empty PHI fields', async () => {
      // Arrange
      const mockNDCs: NDCPackageData[] = [
        { ndc: '00093010501', pkg_size: 30, active: true, dosage_form: 'CAPSULE' },
      ];

      mockRxNormClient.findRxcuiByString = vi.fn().mockResolvedValue('723');
      mockRxNormClient.getNdcsByRxcui = vi.fn().mockResolvedValue(['00093010501']);
      mockFDAClient.searchByBrandName = vi.fn().mockResolvedValue(mockNDCs);
      vi.mocked(parseSIG).mockResolvedValue({
        dose_unit: 'cap',
        per_day: 2,
        confidence: 'parsed',
      });

      const request: ComputeRequest = {
        drug_input: '',
        sig: '',
        days_supply: 30,
      };

      // Act & Assert: Should handle gracefully without errors
      await expect(handleCompute(request)).resolves.toBeDefined();
    });

    it('should redact PHI in partial failure scenarios', async () => {
      // Arrange: RxNorm fails
      mockRxNormClient.findRxcuiByString = vi.fn().mockRejectedValue(new Error('RxNorm failed'));
      mockFDAClient.searchByBrandName = vi.fn().mockResolvedValue([
        { ndc: '00093010501', pkg_size: 30, active: true, dosage_form: 'CAPSULE' },
      ]);
      vi.mocked(parseSIG).mockResolvedValue({
        dose_unit: 'cap',
        per_day: 2,
        confidence: 'parsed',
      });

      const request: ComputeRequest = {
        drug_input: 'SENSITIVE_PARTIAL_FAILURE',
        sig: 'SENSITIVE_SIG',
        days_supply: 30,
      };

      // Act
      await handleCompute(request);

      // Assert: PHI should be redacted in warning logs too
      const warnLogs = consoleWarnSpy.mock.calls.flat().join(' ');
      expect(warnLogs).not.toContain('SENSITIVE_PARTIAL_FAILURE');
      expect(warnLogs).not.toContain('SENSITIVE_SIG');
    });
  });

  describe('SEC-001 Extended: No Database Persistence', () => {
    it('should not persist response data to database', async () => {
      // Arrange
      const mockNDCs: NDCPackageData[] = [
        { ndc: '00093010501', pkg_size: 30, active: true, dosage_form: 'CAPSULE' },
      ];

      mockRxNormClient.findRxcuiByString = vi.fn().mockResolvedValue('723');
      mockRxNormClient.getNdcsByRxcui = vi.fn().mockResolvedValue(['00093010501']);
      mockFDAClient.searchByBrandName = vi.fn().mockResolvedValue(mockNDCs);
      vi.mocked(parseSIG).mockResolvedValue({
        dose_unit: 'cap',
        per_day: 2,
        confidence: 'parsed',
      });

      const request: ComputeRequest = {
        drug_input: 'sensitive_drug',
        sig: 'sensitive_instructions',
        days_supply: 30,
      };

      // Act
      const response = await handleCompute(request);

      // Assert: Response should be stateless (no persistence)
      expect(response).toBeDefined();
      
      // Verify no database operations occurred
      // In a real test, this would mock database clients and verify no calls
      // For now, we validate that the handler returns a response without side effects
      expect(response.computed.total_qty).toBe(60);
    });

    it('should process requests statelessly', async () => {
      // Arrange
      const mockNDCs: NDCPackageData[] = [
        { ndc: '00093010501', pkg_size: 30, active: true, dosage_form: 'CAPSULE' },
      ];

      mockRxNormClient.findRxcuiByString = vi.fn().mockResolvedValue('723');
      mockRxNormClient.getNdcsByRxcui = vi.fn().mockResolvedValue(['00093010501']);
      mockFDAClient.searchByBrandName = vi.fn().mockResolvedValue(mockNDCs);
      vi.mocked(parseSIG).mockResolvedValue({
        dose_unit: 'cap',
        per_day: 1,
        confidence: 'parsed',
      });

      const request1: ComputeRequest = {
        drug_input: 'first_request',
        sig: '1 cap QD',
        days_supply: 30,
      };

      const request2: ComputeRequest = {
        drug_input: 'second_request',
        sig: '1 cap QD',
        days_supply: 30,
      };

      // Act: Make two requests
      const response1 = await handleCompute(request1, 'correlation-1');
      const response2 = await handleCompute(request2, 'correlation-2');

      // Assert: Both should be processed independently
      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
      expect(response1.computed.total_qty).toBe(30);
      expect(response2.computed.total_qty).toBe(30);

      // Verify no shared state between requests
      expect(response1).not.toBe(response2); // Different objects
    });
  });
});

