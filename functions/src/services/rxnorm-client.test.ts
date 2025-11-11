/**
 * RxNorm Client Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import axios, { type AxiosInstance } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { RxNormClient } from './rxnorm-client';
import { RateLimitError, DependencyError } from '../utils/errors';

describe('RxNormClient', () => {
  let client: RxNormClient;
  let mockAxios: MockAdapter;
  let axiosInstance: AxiosInstance;

  beforeEach(() => {
    // Create a real axios instance for mocking
    axiosInstance = axios.create({
      baseURL: 'https://rxnav.nlm.nih.gov/REST/',
    });
    mockAxios = new MockAdapter(axiosInstance);

    // Mock axios.create to return our mockable instance
    vi.spyOn(axios, 'create').mockReturnValue(axiosInstance);

    client = new RxNormClient({
      baseUrl: 'https://rxnav.nlm.nih.gov/REST/',
      timeout: 5000,
      maxRetries: 1,
      cacheTTL: 1000, // Short TTL for testing
      rateLimit: 10,
    });
  });

  afterEach(() => {
    mockAxios.restore();
    vi.restoreAllMocks();
  });

  describe('findRxcuiByString', () => {
    it('should find RxCUI by drug name', async () => {
      mockAxios.onGet('findRxcuiByString', { params: { name: 'aspirin' } }).reply(200, {
        idGroup: {
          rxnormId: ['12345'],
        },
      });

      const result = await client.findRxcuiByString('aspirin');
      expect(result).toBe('12345');
    });

    it('should return null when drug not found', async () => {
      mockAxios.onGet('findRxcuiByString', { params: { name: 'nonexistent' } }).reply(200, {
        idGroup: {
          rxnormId: [],
        },
      });

      const result = await client.findRxcuiByString('nonexistent');
      expect(result).toBeNull();
    });

    it('should cache results', async () => {
      mockAxios.onGet('findRxcuiByString', { params: { name: 'aspirin' } }).reply(200, {
        idGroup: {
          rxnormId: ['12345'],
        },
      });

      const result1 = await client.findRxcuiByString('aspirin');
      const result2 = await client.findRxcuiByString('aspirin');

      expect(result1).toBe('12345');
      expect(result2).toBe('12345');
      expect(mockAxios.history.get.length).toBe(1); // Only one API call
    });

    it('should handle 4xx errors without retry', async () => {
      mockAxios.onGet('findRxcuiByString', { params: { name: 'aspirin' } }).reply(404);

      const result = await client.findRxcuiByString('aspirin');
      expect(result).toBeNull();
    });

    it('should retry on 5xx errors', async () => {
      mockAxios
        .onGet('findRxcuiByString', { params: { name: 'aspirin' } })
        .replyOnce(500)
        .onGet('findRxcuiByString', { params: { name: 'aspirin' } })
        .reply(200, {
          idGroup: {
            rxnormId: ['12345'],
          },
        });

      const result = await client.findRxcuiByString('aspirin');
      expect(result).toBe('12345');
      expect(mockAxios.history.get.length).toBe(2); // Initial + retry
    });

    it('should throw RateLimitError when rate limit exceeded', async () => {
      // Create a client with very low rate limit
      const limitedClient = new RxNormClient({
        baseUrl: 'https://rxnav.nlm.nih.gov/REST/',
        rateLimit: 1, // 1 req/sec
        cacheTTL: 0, // No cache to ensure API calls
      });

      // Make first request
      mockAxios.onGet('findRxcuiByString').reply(200, {
        idGroup: { rxnormId: ['12345'] },
      });

      await limitedClient.findRxcuiByString('aspirin');

      // Second request immediately should fail rate limit (within 1 second window)
      await expect(limitedClient.findRxcuiByString('aspirin2')).rejects.toThrow(RateLimitError);
    });
  });

  describe('getNdcsByRxcui', () => {
    it('should get NDCs by RxCUI', async () => {
      mockAxios.onGet('rxcui/12345/ndcs').reply(200, {
        ndcGroup: {
          ndcList: {
            ndc: ['12345-6789-01', '12345-6789-02'],
          },
        },
      });

      const result = await client.getNdcsByRxcui('12345');
      expect(result).toEqual(['12345-6789-01', '12345-6789-02']);
    });

    it('should return empty array when no NDCs found', async () => {
      mockAxios.onGet('rxcui/12345/ndcs').reply(200, {
        ndcGroup: {
          ndcList: {
            ndc: [],
          },
        },
      });

      const result = await client.getNdcsByRxcui('12345');
      expect(result).toEqual([]);
    });

    it('should cache results', async () => {
      mockAxios.onGet('rxcui/12345/ndcs').reply(200, {
        ndcGroup: {
          ndcList: {
            ndc: ['12345-6789-01'],
          },
        },
      });

      const result1 = await client.getNdcsByRxcui('12345');
      const result2 = await client.getNdcsByRxcui('12345');

      expect(result1).toEqual(['12345-6789-01']);
      expect(result2).toEqual(['12345-6789-01']);
      expect(mockAxios.history.get.length).toBe(1);
    });
  });

  describe('approximateTerm', () => {
    it('should find approximate match', async () => {
      mockAxios.onGet('approximateTerm', { params: { term: 'aspirin' } }).reply(200, {
        approximateGroup: {
          candidate: [
            { rxcui: '12345', score: '100' },
            { rxcui: '12346', score: '90' },
          ],
        },
      });

      const result = await client.approximateTerm('aspirin');
      expect(result).toBe('12345'); // Highest score
    });

    it('should return null when no matches found', async () => {
      mockAxios.onGet('approximateTerm', { params: { term: 'nonexistent' } }).reply(200, {
        approximateGroup: {
          candidate: [],
        },
      });

      const result = await client.approximateTerm('nonexistent');
      expect(result).toBeNull();
    });

    it('should cache results', async () => {
      mockAxios.onGet('approximateTerm', { params: { term: 'aspirin' } }).reply(200, {
        approximateGroup: {
          candidate: [{ rxcui: '12345', score: '100' }],
        },
      });

      const result1 = await client.approximateTerm('aspirin');
      const result2 = await client.approximateTerm('aspirin');

      expect(result1).toBe('12345');
      expect(result2).toBe('12345');
      expect(mockAxios.history.get.length).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should throw DependencyError on network errors', async () => {
      mockAxios.onGet('findRxcuiByString').networkError();

      await expect(client.findRxcuiByString('aspirin')).rejects.toThrow(DependencyError);
    });

    it('should throw DependencyError on timeout', async () => {
      mockAxios.onGet('findRxcuiByString').timeout();

      await expect(client.findRxcuiByString('aspirin')).rejects.toThrow(DependencyError);
    });
  });
});

