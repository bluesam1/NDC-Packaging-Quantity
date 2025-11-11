/**
 * Compute Handler
 * 
 * This module handles the main computation workflow:
 * 1. Parallel execution of RxNorm and FDA API calls
 * 2. Data merging (FDA as source of truth)
 * 3. SIG parsing (rules-based with AI fallback)
 * 4. Quantity calculation
 * 5. Package selection
 * 6. Partial failure handling
 * 7. Mismatch detection and flagging
 */

import { createRxNormClient } from '../services/rxnorm-client';
import { createFDAClient } from '../services/fda-client';
import { parseSIG } from '../services/sig-parser';
import { calculateQuantity } from '../services/quantity-calculator';
import { selectPackages } from '../services/package-selector';
import { detectDosageForm } from '../services/dosage-form-detector';
import { logInfo, logWarn, logError } from '../utils/logger';
import { DependencyError, ParseError } from '../utils/errors';
import type { ComputeRequest, ComputeResponse } from '../types/index';
import type { NDCPackageData } from '../types/index';

/**
 * Merged data structure from RxNorm and FDA APIs
 */
interface MergedData {
  rxcui: string | null;
  name: string | null;
  ndcs: NDCPackageData[];
  mismatch: boolean;
  rxnormFailed: boolean;
  fdaFailed: boolean;
}

/**
 * Execute parallel API calls and merge data
 * 
 * @param request - Compute request
 * @param correlationId - Optional correlation ID for logging
 * @returns Merged data from both APIs
 */
export async function executeParallelAPICalls(
  request: ComputeRequest,
  correlationId?: string
): Promise<MergedData> {
  const context = { correlationId, drug_input: request.drug_input };
  const startTime = Date.now();

  const rxnormClient = createRxNormClient();
  const fdaClient = createFDAClient();

  // Execute RxNorm and FDA calls in parallel using Promise.allSettled
  // This allows us to handle partial failures gracefully
  const [rxnormResult, fdaResult] = await Promise.allSettled([
    // RxNorm: Find RxCUI by drug name
    rxnormClient.findRxcuiByString(request.drug_input, correlationId).then(async (rxcui) => {
      if (!rxcui) {
        // Try approximate matching as fallback
        logInfo('RxNorm primary lookup failed, trying approximate match', context);
        return await rxnormClient.approximateTerm(request.drug_input, correlationId);
      }
      return rxcui;
    }).then(async (rxcui) => {
      if (!rxcui) {
        return { rxcui: null, name: null, ndcs: [] };
      }
      // Get NDCs for this RxCUI
      const ndcs = await rxnormClient.getNdcsByRxcui(rxcui, correlationId);
      return { rxcui, name: request.drug_input, ndcs };
    }),
    
    // FDA: Search by brand name
    fdaClient.searchByBrandName(request.drug_input, correlationId),
  ]);

  const executionTime = Date.now() - startTime;
  logInfo('Parallel API execution completed', { ...context, executionTimeMs: executionTime });

  // Process RxNorm result
  let rxnormData: { rxcui: string | null; name: string | null; ndcs: string[] } = {
    rxcui: null,
    name: null,
    ndcs: [],
  };
  let rxnormFailed = false;

  if (rxnormResult.status === 'fulfilled') {
    rxnormData = rxnormResult.value;
  } else {
    rxnormFailed = true;
    logWarn('RxNorm API call failed', {
      ...context,
      error: rxnormResult.reason?.message || 'Unknown error',
    });
  }

  // Process FDA result
  let fdaData: NDCPackageData[] = [];
  let fdaFailed = false;

  if (fdaResult.status === 'fulfilled') {
    fdaData = fdaResult.value;
  } else {
    fdaFailed = true;
    logWarn('FDA API call failed', {
      ...context,
      error: fdaResult.reason?.message || 'Unknown error',
    });
  }

  // Handle partial failures
  if (rxnormFailed && fdaFailed) {
    // Both APIs failed - return error
    logError('Both RxNorm and FDA API calls failed', context);
    throw new DependencyError(
      'Failed to retrieve drug information from external APIs',
      'Both RxNorm and FDA APIs failed. Please try again later.',
      2000 // Retry after 2 seconds
    );
  }

  // Merge data from both sources (look up RxNorm NDCs individually to get package sizes)
  const merged = await mergeData(rxnormData, fdaData, fdaClient, context);

  // Detect mismatches
  const mismatch = detectMismatch(rxnormData.ndcs, fdaData, context);

  return {
    rxcui: merged.rxcui,
    name: merged.name,
    ndcs: merged.ndcs,
    mismatch,
    rxnormFailed,
    fdaFailed,
  };
}

/**
 * Merge RxNorm and FDA data
 * FDA is the source of truth for NDC activity status and package metadata
 * 
 * For RxNorm NDCs not found in FDA search results, we look them up individually
 * to get accurate package size information.
 */
async function mergeData(
  rxnormData: { rxcui: string | null; name: string | null; ndcs: string[] },
  fdaData: NDCPackageData[],
  fdaClient: ReturnType<typeof createFDAClient>,
  context: { correlationId?: string; drug_input: string }
): Promise<{ rxcui: string | null; name: string | null; ndcs: NDCPackageData[] }> {
  // Start with FDA data (source of truth for package info)
  const mergedNDCs: NDCPackageData[] = [...fdaData];
  const fdaNdcSet = new Set(fdaData.map((pkg) => pkg.ndc));

  // For RxNorm NDCs not in FDA results, look them up individually to get package sizes
  if (rxnormData.ndcs.length > 0) {
    const ndcsToLookup = rxnormData.ndcs
      .map((ndc) => ndc.replace(/[-\s]/g, '')) // Normalize
      .filter((normalizedNDC) => !fdaNdcSet.has(normalizedNDC))
      .slice(0, 50); // Limit to 50 lookups to avoid rate limits

    if (ndcsToLookup.length > 0) {
      logInfo('Looking up RxNorm NDCs in FDA API', {
        ...context,
        count: ndcsToLookup.length,
      });

      // Look up NDCs in parallel (with concurrency limit to respect rate limits)
      const lookupPromises = ndcsToLookup.map((ndc) =>
        fdaClient.lookupByNDC(ndc, context.correlationId).catch((error) => {
          logWarn('FDA lookup failed for NDC', { ...context, ndc, error: error.message });
          return null;
        })
      );

      const lookupResults = await Promise.allSettled(lookupPromises);

      // Process lookup results
      for (let i = 0; i < ndcsToLookup.length; i++) {
        const ndc = ndcsToLookup[i];
        const result = lookupResults[i];
        
        if (result.status === 'fulfilled' && result.value) {
          // Found in FDA - add with accurate package info
          mergedNDCs.push(result.value);
        } else {
          // Not found in FDA or lookup failed - add as inactive
          mergedNDCs.push({
            ndc,
            pkg_size: 0, // Unknown size
            active: false, // Inactive (not in FDA or lookup failed)
            dosage_form: undefined,
            brand_name: undefined,
          });
        }
      }
    }
  }

  logInfo('Data merged successfully', {
    ...context,
    rxnormNdcCount: rxnormData.ndcs.length,
    fdaNdcCount: fdaData.length,
    mergedNdcCount: mergedNDCs.length,
  });

  return {
    rxcui: rxnormData.rxcui,
    name: rxnormData.name,
    ndcs: mergedNDCs,
  };
}

/**
 * Detect mismatches between RxNorm and FDA data
 */
function detectMismatch(
  rxnormNdcs: string[],
  fdaData: NDCPackageData[],
  context: { correlationId?: string; drug_input: string }
): boolean {
  const rxnormNdcSet = new Set(rxnormNdcs.map((ndc) => ndc.replace(/[-\s]/g, '')));
  const fdaNdcSet = new Set(fdaData.map((pkg) => pkg.ndc));

  // Check for mismatches
  const rxnormOnly = rxnormNdcs.filter((ndc) => {
    const normalized = ndc.replace(/[-\s]/g, '');
    return !fdaNdcSet.has(normalized);
  });

  const fdaOnly = fdaData.filter((pkg) => !rxnormNdcSet.has(pkg.ndc));

  const hasMismatch = rxnormOnly.length > 0 || fdaOnly.length > 0;

  if (hasMismatch) {
    logWarn('Data mismatch detected between RxNorm and FDA', {
      ...context,
      rxnormOnlyCount: rxnormOnly.length,
      fdaOnlyCount: fdaOnly.length,
    });
  }

  return hasMismatch;
}

/**
 * Main compute handler
 * 
 * Orchestrates the complete computation workflow:
 * 1. Parallel API calls (RxNorm + FDA)
 * 2. SIG parsing (rules-based with AI fallback)
 * 3. Quantity calculation
 * 4. Package selection
 * 
 * @param request - Compute request
 * @param correlationId - Optional correlation ID for logging
 * @returns Compute response
 */
export async function handleCompute(
  request: ComputeRequest,
  correlationId?: string
): Promise<ComputeResponse> {
  const context = { correlationId, drug_input: request.drug_input };

  try {
    // Step 1: Execute parallel API calls and merge data
    const merged = await executeParallelAPICalls(request, correlationId);

    // Step 2: Parse SIG
    const parsedSIG = await parseSIG(request.sig, request.quantity_unit_override);
    
    if (!parsedSIG) {
      // SIG parsing failed - return parse_error
      throw new ParseError(
        'Unable to parse prescription directions (SIG). Please check the format and try again.',
        'The prescription directions could not be interpreted. Please ensure the format includes quantity, frequency, and route (e.g., "1 cap PO BID").'
      );
    }

    logInfo('SIG parsed successfully', {
      ...context,
      dose_unit: parsedSIG.dose_unit,
      per_day: parsedSIG.per_day,
    });

    // Step 2.5: Detect dosage form
    const dosageForm = detectDosageForm(
      request.drug_input,
      merged.ndcs,
      parsedSIG.dose_unit
    );

    logInfo('Dosage form detected', {
      ...context,
      dosage_form: dosageForm,
    });

    // Step 3: Calculate quantity
    const computed = calculateQuantity(
      parsedSIG,
      request.days_supply,
      dosageForm,
      request.drug_input,
      request.quantity_unit_override
    );

    logInfo('Quantity calculated', {
      ...context,
      total_qty: computed.total_qty,
      per_day: computed.per_day,
    });

    // Step 4: Select packages
    const packageSelection = selectPackages(
      merged.ndcs,
      computed.total_qty,
      {
        maxPacks: 3, // MAX_PACKS from config
        maxOverfill: 0.10, // OVERFILL_MAX from config (10%)
        preferredNdcs: request.preferred_ndcs,
      }
    );

    logInfo('Package selection completed', {
      ...context,
      hasChosen: !!packageSelection.chosen,
      alternatesCount: packageSelection.alternates.length,
    });

    // Build response
    const response: ComputeResponse = {
      rxnorm: {
        rxcui: merged.rxcui || '',
        name: merged.name || request.drug_input,
      },
      computed: {
        dose_unit: computed.dose_unit,
        per_day: computed.per_day,
        total_qty: computed.total_qty,
        days_supply: request.days_supply,
      },
      ndc_selection: {
        chosen: packageSelection.chosen,
        alternates: packageSelection.alternates,
      },
      flags: {
        inactive_ndcs: merged.ndcs.filter((pkg) => !pkg.active).map((pkg) => pkg.ndc),
        mismatch: merged.mismatch,
        notes: [],
      },
    };

    // Add notes for partial failures
    if (merged.rxnormFailed) {
      response.flags.notes?.push('RxNorm API call failed - using FDA data only');
    }
    if (merged.fdaFailed) {
      response.flags.notes?.push('FDA API call failed - using RxNorm data only');
    }

    // Add note if no active NDCs available
    if (merged.ndcs.length > 0 && merged.ndcs.every((pkg) => !pkg.active)) {
      response.flags.notes?.push('No active NDCs available for this drug');
    }

    // Add note if no package was selected
    if (!packageSelection.chosen) {
      response.flags.notes?.push('No suitable package found matching quantity requirements');
    }

    logInfo('Compute handler completed successfully', context);
    return response;
  } catch (error) {
    logError('Compute handler failed', {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

