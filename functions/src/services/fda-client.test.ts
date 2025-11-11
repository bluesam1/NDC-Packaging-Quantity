/**
 * FDA Client Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import axios, { type AxiosInstance } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { FDAClient } from './fda-client';
import { RateLimitError, DependencyError } from '../utils/errors';

describe('FDAClient', () => {
  let client: FDAClient;
  let mockAxios: MockAdapter;
  let axiosInstance: AxiosInstance;

  beforeEach(() => {
    axiosInstance = axios.create({
      baseURL: 'https://api.fda.gov/drug/ndc.json',
    });
    mockAxios = new MockAdapter(axiosInstance);

    vi.spyOn(axios, 'create').mockReturnValue(axiosInstance);

    client = new FDAClient({
      baseUrl: 'https://api.fda.gov/drug/ndc.json',
      timeout: 5000,
      maxRetries: 1,
      cacheTTL: 1000,
      rateLimit: 3,
    });
  });

  afterEach(() => {
    mockAxios.restore();
    vi.restoreAllMocks();
  });

  describe('lookupByNDC', () => {
    it('should lookup NDC by code', async () => {
      mockAxios.onGet('/', { params: { search: 'product_ndc:01234567890', limit: 1 } }).reply(200, {
        results: [
          {
            product_ndc: '01234-5678-90',
            package_size: '30',
            active: 'TRUE',
            dosage_form: 'TABLET',
            brand_name: 'Test Drug',
          },
        ],
      });

      const result = await client.lookupByNDC('01234-5678-90');
      expect(result).toBeDefined();
      // NDC normalization removes hyphens
      expect(result?.ndc).toBe('01234567890');
      expect(result?.pkg_size).toBe(30);
      expect(result?.active).toBe(true);
      expect(result?.dosage_form).toBe('TABLET');
    });

    it('should normalize NDC format', async () => {
      // NDC normalization converts '12345-678-90' to '01234567890' (adds leading zero for 10 digits)
      mockAxios.onGet('/', { params: { search: 'product_ndc:01234567890', limit: 1 } }).reply(200, {
        results: [
          {
            product_ndc: '01234-5678-90',
            package_size: '30',
            active: 'TRUE',
          },
        ],
      });

      const result = await client.lookupByNDC('12345-678-90');
      expect(result?.ndc).toBe('01234567890');
    });

    it('should return null when NDC not found', async () => {
      mockAxios.onGet('/', { params: { search: 'product_ndc:00000000000', limit: 1 } }).reply(200, {
        results: [],
      });

      const result = await client.lookupByNDC('00000000000');
      expect(result).toBeNull();
    });

    it('should cache results', async () => {
      mockAxios.onGet('/', { params: { search: 'product_ndc:12345678901', limit: 1 } }).reply(200, {
        results: [
          {
            product_ndc: '12345-678-90',
            package_size: '30',
            active: 'TRUE',
          },
        ],
      });

      const result1 = await client.lookupByNDC('12345-678-90');
      const result2 = await client.lookupByNDC('12345-678-90');

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(mockAxios.history.get.length).toBe(1);
    });

    it('should handle 4xx errors without retry', async () => {
      mockAxios.onGet('/', { params: { search: 'product_ndc:12345678901', limit: 1 } }).reply(404);

      const result = await client.lookupByNDC('12345-678-90');
      expect(result).toBeNull();
    });

    it('should retry on 5xx errors', async () => {
      // NDC normalization converts to '01234567890'
      mockAxios
        .onGet('/', { params: { search: 'product_ndc:01234567890', limit: 1 } })
        .replyOnce(500)
        .onGet('/', { params: { search: 'product_ndc:01234567890', limit: 1 } })
        .reply(200, {
          results: [
            {
              product_ndc: '01234-5678-90',
              package_size: '30',
              active: 'TRUE',
            },
          ],
        });

      const result = await client.lookupByNDC('12345-678-90');
      expect(result).toBeDefined();
      expect(mockAxios.history.get.length).toBe(2);
    });
  });

  describe('searchByBrandName', () => {
    it('should search by brand name', async () => {
      mockAxios.onGet('/', { params: { search: 'brand_name:aspirin', limit: 100 } }).reply(200, {
        results: [
          {
            product_ndc: '01234-5678-90',
            package_size: '30',
            active: 'TRUE',
            brand_name: 'Aspirin',
          },
          {
            product_ndc: '01234-5678-91',
            package_size: '60',
            active: 'TRUE',
            brand_name: 'Aspirin',
          },
        ],
      });

      const result = await client.searchByBrandName('aspirin');
      expect(result).toHaveLength(2);
      // NDC normalization removes hyphens
      expect(result[0].ndc).toBe('01234567890');
      expect(result[1].ndc).toBe('01234567891');
    });

    it('should return empty array when no results found', async () => {
      mockAxios.onGet('/', { params: { search: 'brand_name:nonexistent', limit: 100 } }).reply(200, {
        results: [],
      });

      const result = await client.searchByBrandName('nonexistent');
      expect(result).toEqual([]);
    });

    it('should cache results', async () => {
      mockAxios.onGet('/', { params: { search: 'brand_name:aspirin', limit: 100 } }).reply(200, {
        results: [
          {
            product_ndc: '12345-678-90',
            package_size: '30',
            active: 'TRUE',
            brand_name: 'Aspirin',
          },
        ],
      });

      const result1 = await client.searchByBrandName('aspirin');
      const result2 = await client.searchByBrandName('aspirin');

      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
      expect(mockAxios.history.get.length).toBe(1);
    });
  });

  describe('rate limiting', () => {
    it('should throw RateLimitError when rate limit exceeded', async () => {
      const limitedClient = new FDAClient({
        baseUrl: 'https://api.fda.gov/drug/ndc.json',
        rateLimit: 1,
        cacheTTL: 0,
      });

      mockAxios.onGet('/').reply(200, { results: [] });

      await limitedClient.lookupByNDC('12345678901');

      await expect(limitedClient.lookupByNDC('12345678902')).rejects.toThrow(RateLimitError);
    });
  });

  describe('error handling', () => {
    it('should throw DependencyError on network errors', async () => {
      mockAxios.onGet('/').networkError();

      await expect(client.lookupByNDC('12345678901')).rejects.toThrow(DependencyError);
    });

    it('should throw DependencyError on timeout', async () => {
      mockAxios.onGet('/').timeout();

      await expect(client.lookupByNDC('12345678901')).rejects.toThrow(DependencyError);
    });
  });
});

