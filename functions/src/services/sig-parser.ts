/**
 * SIG Parser Service
 * 
 * This module provides a hybrid parser for prescription SIGs (Signa):
 * 1. Rules-based parser (fast) - tries regex patterns first
 * 2. AI fallback (accurate) - uses OpenAI GPT-4o-mini when rules fail
 * 
 * Returns null when both parsers fail.
 */

import OpenAI from 'openai';
import { logInfo, logWarn, logError } from '../utils/logger';
import { convertToML, isLiquidUnit } from '../utils/unit-conversions';
import { startTimer, recordCounter, METRICS } from '../utils/metrics';

/**
 * Parsed SIG data structure
 */
export interface ParsedSIG {
  dose_unit: string; // e.g., "tab", "cap", "mL"
  per_day: number; // Total quantity per day
  confidence: 'parsed'; // Binary: 'parsed' or 'not-parsed'
}

/**
 * SIG parsing result with metadata for reasoning
 */
export interface ParsedSIGWithMetadata {
  parsed: ParsedSIG | null;
  method: 'rules' | 'ai' | 'failed';
  sub_method?: 'time-based' | 'frequency-based'; // Sub-method for rules-based parsing
  quantity_per_dose?: number;
  frequency?: number;
  unit_conversion?: { from: string; to: string; original: number; converted: number };
}

/**
 * Frequency mapping for common abbreviations and spellings
 */
const FREQUENCY_MAP: Record<string, number> = {
  // Abbreviations
  'qd': 1,
  'q.d.': 1,
  'q d': 1,
  'once daily': 1,
  'once a day': 1,
  'once per day': 1,
  'each morning': 1,
  'every morning': 1,
  'in the morning': 1,
  '1x daily': 1,
  '1x/day': 1,
  '1 x daily': 1,
  'bid': 2,
  'b.i.d.': 2,
  'b i d': 2,
  'twice daily': 2,
  'twice a day': 2,
  '2x daily': 2,
  '2x/day': 2,
  '2 x daily': 2,
  'tid': 3,
  't.i.d.': 3,
  't i d': 3,
  'three times daily': 3,
  'three times a day': 3,
  '3x daily': 3,
  '3x/day': 3,
  '3 x daily': 3,
  'qid': 4,
  'q.i.d.': 4,
  'q i d': 4,
  'four times daily': 4,
  'four times a day': 4,
  '4x daily': 4,
  '4x/day': 4,
  '4 x daily': 4,
};

/**
 * Unit normalization map
 */
const UNIT_MAP: Record<string, string> = {
  'tablet': 'tab',
  'tablets': 'tab',
  'tab': 'tab',
  'tabs': 'tab',
  'capsule': 'cap',
  'capsules': 'cap',
  'cap': 'cap',
  'caps': 'cap',
  'ml': 'mL',
  'milliliter': 'mL',
  'milliliters': 'mL',
  'millilitre': 'mL',
  'millilitres': 'mL',
  'teaspoon': 'mL',
  'teaspoons': 'mL',
  'tsp': 'mL',
  'tablespoon': 'mL',
  'tablespoons': 'mL',
  'tbsp': 'mL',
  'oz': 'mL',
  'ounce': 'mL',
  'ounces': 'mL',
  'puff': 'actuation',
  'puffs': 'actuation',
  'actuation': 'actuation',
  'actuations': 'actuation',
  'inhalation': 'actuation',
  'inhalations': 'actuation',
  'spray': 'actuation',
  'sprays': 'actuation',
  'unit': 'unit',
  'units': 'unit',
};

/**
 * Normalize frequency string to number
 */
function normalizeFrequency(freqStr: string): number | null {
  const normalized = freqStr.toLowerCase().trim();
  return FREQUENCY_MAP[normalized] || null;
}

/**
 * Normalize unit string
 */
function normalizeUnit(unitStr: string): string | null {
  const normalized = unitStr.toLowerCase().trim();
  return UNIT_MAP[normalized] || null;
}

/**
 * Extract frequency from SIG text
 */
function extractFrequency(sig: string): number | null {
  // Try to match frequency patterns
  const frequencyPatterns = [
    // Abbreviations (QD, BID, TID, QID)
    /\b(qd|q\.d\.|q d|bid|b\.i\.d\.|b i d|tid|t\.i\.d\.|t i d|qid|q\.i\.d\.|q i d)\b/i,
    // Spelled out
    /\b(once|twice|three times|four times)\s+(daily|a day)\b/i,
    // Numeric (1x daily, 2x/day, etc.)
    /\b(\d+)\s*x\s*(daily|day|\/day)\b/i,
  ];

  for (const pattern of frequencyPatterns) {
    const match = sig.match(pattern);
    if (match) {
      const matched = match[0].toLowerCase().trim();
      const freq = normalizeFrequency(matched);
      if (freq) {
        return freq;
      }
      // Handle numeric frequencies (1x daily, 2x/day, etc.)
      const numMatch = matched.match(/(\d+)\s*x/i);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        if (num > 0 && num <= 10) {
          return num;
        }
      }
    }
  }

  return null;
}

/**
 * Extract quantity per dose from SIG text (with unit for liquid conversion)
 */
function extractQuantityPerDose(sig: string): { quantity: number; unit: string | null } | null {
  // Match patterns like "take 2 tablets", "1 tablet", "2 caps", "5 mL", "1 teaspoon", "2 puffs", "20 units", etc.
  const quantityPatterns = [
    /\b(take|use|administer|give|inhale|inject)\s+(\d+\.?\d*)\s+(tablet|tablets|tab|tabs|capsule|capsules|cap|caps|ml|milliliter|milliliters|teaspoon|teaspoons|tsp|tablespoon|tablespoons|tbsp|oz|ounce|ounces|puff|puffs|actuation|actuations|inhalation|inhalations|spray|sprays|unit|units)\b/i,
    /\b(\d+\.?\d*)\s+(tablet|tablets|tab|tabs|capsule|capsules|cap|caps|ml|milliliter|milliliters|teaspoon|teaspoons|tsp|tablespoon|tablespoons|tbsp|oz|ounce|ounces|puff|puffs|actuation|actuations|inhalation|inhalations|spray|sprays|unit|units)\b/i,
  ];

  for (let i = 0; i < quantityPatterns.length; i++) {
    const pattern = quantityPatterns[i];
    const match = sig.match(pattern);
    if (match) {
      // Pattern 1 (with verb): match[1]=verb, match[2]=quantity, match[3]=unit
      // Pattern 2 (without verb): match[1]=quantity, match[2]=unit
      const quantity = i === 0 ? parseFloat(match[2]) : parseFloat(match[1]);
      const unit = i === 0 ? match[3] : match[2];
      if (quantity > 0 && quantity <= 100) {
        return { quantity, unit };
      }
    }
  }

  // Default to 1 with no unit if no quantity specified
  return { quantity: 1, unit: null };
}

/**
 * Extract dose unit from SIG text
 */
function extractDoseUnit(sig: string, unitOverride?: string): string | null {
  // Use override if provided
  if (unitOverride) {
    return normalizeUnit(unitOverride) || unitOverride;
  }

  // Match unit patterns (including liquid units, inhaler units, and insulin units)
  const unitPatterns = [
    /\b(tablet|tablets|tab|tabs)\b/i,
    /\b(capsule|capsules|cap|caps)\b/i,
    /\b(ml|milliliter|milliliters|millilitre|millilitres|teaspoon|teaspoons|tsp|tablespoon|tablespoons|tbsp|oz|ounce|ounces)\b/i,
    /\b(puff|puffs|actuation|actuations|inhalation|inhalations|spray|sprays)\b/i,
    /\b(unit|units)\b/i,
  ];

  for (const pattern of unitPatterns) {
    const match = sig.match(pattern);
    if (match) {
      const unit = normalizeUnit(match[1]);
      if (unit) {
        return unit;
      }
    }
  }

  return null;
}

/**
 * Detect and parse time-based dosing patterns (e.g., "1 in morning and 2 in evening")
 * 
 * @param sig - Prescription SIG text
 * @returns ParsedSIG or null if not a time-based pattern
 */
function parseTimeBasedDosing(sig: string, unitOverride?: string): ParsedSIG | null {
  const normalizedSig = sig.toLowerCase().trim();
  
  // Time-based keywords that indicate we should SUM quantities, not multiply
  const timeKeywords = [
    /\b(in the morning|in the evening|at morning|at evening|morning|evening|at bedtime|at night|bedtime)\b/i,
    /\b(at \d{1,2}(:\d{2})?\s*(am|pm|AM|PM))\b/i,
    /\b(with breakfast|with lunch|with dinner|with meals)\b/i,
  ];
  
  // Check if SIG contains time-based keywords
  const hasTimeKeywords = timeKeywords.some(pattern => pattern.test(normalizedSig));
  
  if (!hasTimeKeywords) {
    return null; // Not a time-based pattern
  }
  
  // Pattern to extract all quantity + unit pairs
  // Matches: "1 capsule", "2 tablets", "5 mL", etc.
  const quantityPattern = /\b(\d+\.?\d*)\s+(tablet|tablets|tab|tabs|capsule|capsules|cap|caps|ml|milliliter|milliliters|teaspoon|teaspoons|tsp|tablespoon|tablespoons|tbsp|oz|ounce|ounces|puff|puffs|actuation|actuations|inhalation|inhalations|spray|sprays|unit|units)\b/gi;
  
  const matches = Array.from(normalizedSig.matchAll(quantityPattern));
  
  if (matches.length < 2) {
    // Need at least 2 quantities for time-based dosing
    return null;
  }
  
  // Extract all quantities and units
  const quantities: Array<{ quantity: number; unit: string }> = [];
  for (const match of matches) {
    const quantity = parseFloat(match[1]);
    const unit = match[2];
    if (quantity > 0 && quantity <= 100) {
      quantities.push({ quantity, unit });
    }
  }
  
  if (quantities.length < 2) {
    return null;
  }
  
  // Check if all units are the same (or can be normalized to same)
  const firstUnit = normalizeUnit(quantities[0].unit);
  if (!firstUnit) {
    return null;
  }
  
  // Verify all quantities use compatible units
  for (const qty of quantities) {
    const normalized = normalizeUnit(qty.unit);
    if (!normalized || normalized !== firstUnit) {
      // Units don't match - might not be time-based dosing
      return null;
    }
  }
  
  // Sum all quantities
  let totalPerDay = 0;
  for (const qty of quantities) {
    totalPerDay += qty.quantity;
  }
  
  // Use unit override if provided, otherwise use the detected unit
  const doseUnit = unitOverride ? normalizeUnit(unitOverride) || unitOverride : firstUnit;
  
  if (!doseUnit || totalPerDay <= 0 || totalPerDay > 100) {
    return null;
  }
  
  logInfo('Parsed time-based dosing pattern', {
    sig: '[REDACTED]',
    quantities: quantities.map(q => `${q.quantity} ${q.unit}`),
    totalPerDay,
    doseUnit,
  });
  
  return {
    dose_unit: doseUnit,
    per_day: totalPerDay,
    confidence: 'parsed',
  };
}

/**
 * Parse SIG using rules-based approach
 * 
 * @param sig - Prescription SIG text
 * @param unitOverride - Optional unit override from request
 * @returns ParsedSIG or null if parsing fails
 */
export function parseWithRules(sig: string, unitOverride?: string): ParsedSIG | null {
  if (!sig || typeof sig !== 'string' || sig.trim().length === 0) {
    return null;
  }

  const normalizedSig = sig.trim();

  // First, try to detect time-based dosing patterns
  const timeBasedResult = parseTimeBasedDosing(normalizedSig, unitOverride);
  if (timeBasedResult) {
    return timeBasedResult;
  }

  // Extract components for frequency-based parsing
  const quantityData = extractQuantityPerDose(normalizedSig);
  const frequency = extractFrequency(normalizedSig);
  const doseUnit = extractDoseUnit(normalizedSig, unitOverride);

  // Validate required components
  if (!frequency || !doseUnit || !quantityData) {
    logWarn('SIG parsing failed - missing required components', {
      sig: '[REDACTED]',
      hasFrequency: !!frequency,
      hasDoseUnit: !!doseUnit,
      hasQuantityData: !!quantityData,
    });
    return null;
  }

  let quantityPerDose = quantityData.quantity;
  
  // Handle liquid unit conversions (e.g., teaspoons, tablespoons, oz to mL)
  if (quantityData.unit && isLiquidUnit(quantityData.unit)) {
    try {
      // Convert to mL if it's a non-mL liquid unit
      const normalizedQuantityUnit = quantityData.unit.toLowerCase().trim();
      if (normalizedQuantityUnit !== 'ml' && normalizedQuantityUnit !== 'milliliter' && normalizedQuantityUnit !== 'milliliters') {
        quantityPerDose = convertToML(quantityData.quantity, quantityData.unit);
        logInfo('Converted liquid unit to mL', {
          sig: '[REDACTED]',
          originalQuantity: quantityData.quantity,
          originalUnit: quantityData.unit,
          convertedQuantity: quantityPerDose,
        });
      }
    } catch (error) {
      logWarn('Failed to convert liquid unit', {
        sig: '[REDACTED]',
        unit: quantityData.unit,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue with original quantity if conversion fails
    }
  }

  // Calculate per_day
  const perDay = quantityPerDose * frequency;

  // Validate per_day is reasonable
  if (perDay <= 0 || perDay > 100) {
    logWarn('SIG parsing failed - invalid per_day calculation', {
      sig: '[REDACTED]',
      perDay,
    });
    return null;
  }

  logInfo('SIG parsed successfully', {
    sig: '[REDACTED]',
    doseUnit,
    perDay,
    quantityPerDose,
    frequency,
  });

  return {
    dose_unit: doseUnit,
    per_day: perDay,
    confidence: 'parsed',
  };
}

/**
 * Parse with rules and return metadata for reasoning
 */
export function parseWithRulesWithMetadata(sig: string, unitOverride?: string): ParsedSIGWithMetadata {
  if (!sig || typeof sig !== 'string' || sig.trim().length === 0) {
    return { parsed: null, method: 'failed' };
  }

  const normalizedSig = sig.trim();

  // First, try to detect time-based dosing patterns
  const timeBasedResult = parseTimeBasedDosing(normalizedSig, unitOverride);
  if (timeBasedResult) {
    // For time-based dosing, we don't have separate quantity_per_dose and frequency
    // Estimate frequency as the number of dosing times
    const quantityPattern = /\b(\d+\.?\d*)\s+(tablet|tablets|tab|tabs|capsule|capsules|cap|caps|ml|milliliter|milliliters|teaspoon|teaspoons|tsp|tablespoon|tablespoons|tbsp|oz|ounce|ounces|puff|puffs|actuation|actuations|inhalation|inhalations|spray|sprays|unit|units)\b/gi;
    const matches = Array.from(normalizedSig.toLowerCase().matchAll(quantityPattern));
    const estimatedFrequency = matches.length >= 2 ? matches.length : 2; // Default to 2 if we can't count
    
    return {
      parsed: timeBasedResult,
      method: 'rules',
      sub_method: 'time-based',
      quantity_per_dose: timeBasedResult.per_day / estimatedFrequency, // Approximate
      frequency: estimatedFrequency,
    };
  }

  // Extract components for frequency-based parsing
  const quantityData = extractQuantityPerDose(normalizedSig);
  const frequency = extractFrequency(normalizedSig);
  const doseUnit = extractDoseUnit(normalizedSig, unitOverride);

  // Validate required components
  if (!frequency || !doseUnit || !quantityData) {
    return { parsed: null, method: 'failed' };
  }

  let quantityPerDose = quantityData.quantity;
  let unitConversion: { from: string; to: string; original: number; converted: number } | undefined;
  
  // Handle liquid unit conversions (e.g., teaspoons, tablespoons, oz to mL)
  if (quantityData.unit && isLiquidUnit(quantityData.unit)) {
    try {
      // Convert to mL if it's a non-mL liquid unit
      const normalizedQuantityUnit = quantityData.unit.toLowerCase().trim();
      if (normalizedQuantityUnit !== 'ml' && normalizedQuantityUnit !== 'milliliter' && normalizedQuantityUnit !== 'milliliters') {
        const converted = convertToML(quantityData.quantity, quantityData.unit);
        unitConversion = {
          from: quantityData.unit,
          to: 'mL',
          original: quantityData.quantity,
          converted: converted,
        };
        quantityPerDose = converted;
      }
    } catch {
      // Continue with original quantity if conversion fails
    }
  }

  // Calculate per_day
  const perDay = quantityPerDose * frequency;

  // Validate per_day is reasonable
  if (perDay <= 0 || perDay > 100) {
    return { parsed: null, method: 'failed' };
  }

  return {
    parsed: {
      dose_unit: doseUnit,
      per_day: perDay,
      confidence: 'parsed',
    },
    method: 'rules',
    sub_method: 'frequency-based',
    quantity_per_dose: quantityPerDose,
    frequency: frequency,
    unit_conversion: unitConversion,
  };
}

/**
 * Feature flag for AI fallback
 */
const USE_AI_FALLBACK = process.env.USE_AI_FALLBACK !== 'false'; // Default: true

/**
 * Create OpenAI client (lazy initialization)
 */
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!USE_AI_FALLBACK) {
    return null;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logWarn('OpenAI API key not found - AI fallback disabled', {});
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      timeout: 5000,
      maxRetries: 1,
    });
  }

  return openaiClient;
}

/**
 * Parse SIG using AI fallback
 * 
 * @param sig - Prescription SIG text
 * @param unitOverride - Optional unit override from request
 * @returns ParsedSIG or null if parsing fails
 */
async function parseWithAI(sig: string, unitOverride?: string): Promise<ParsedSIG | null> {
  const client = getOpenAIClient();
  if (!client) {
    return null;
  }

  const context = { sig: '[REDACTED]' };

  try {
    // Create prompt for AI parsing
    const prompt = `Parse the following prescription SIG (Signa) into structured data.

SIG: "${sig}"

Return a JSON object with the following structure:
{
  "dose_unit": "tab" | "cap" | "mL" | "actuation" | "unit",
  "per_day": number,
  "confidence": "parsed"
}

Rules:
- dose_unit: Normalize to "tab" (tablets), "cap" (capsules), "mL" (liquids), "actuation" (inhalers/sprays), or "unit" (insulin/other units)
- per_day: Calculate the TOTAL quantity per day. This is CRITICAL - read carefully:
  * TIME-BASED DOSING: If the SIG mentions specific times, times of day, or meals, you MUST ADD (sum) all quantities:
    - "1 capsule in the morning and 2 capsules in the evening" = 3 per day (1 + 2 = 3)
    - "1 tablet at 8am and 2 tablets at 8pm" = 3 per day (1 + 2 = 3)
    - "Take 1 cap in the morning and 2 caps at bedtime" = 3 per day (1 + 2 = 3)
    - "2 tablets with breakfast and 1 tablet with dinner" = 3 per day (2 + 1 = 3)
    - Look for keywords: "in the morning", "in the evening", "at [time]", "with [meal]", "at bedtime", "at night", etc.
    - When you see these patterns, DO NOT multiply - ADD the quantities together
  * FREQUENCY-BASED DOSING: Only multiply when there's a clear frequency without specific times:
    - "2 capsules twice daily" = 4 per day (2 × 2 = 4)
    - "1 tablet three times daily" = 3 per day (1 × 3 = 3)
    - "Take 5 mL by mouth three times daily" = 15 per day (5 × 3 = 15)
  * CRITICAL: If the SIG contains words like "morning", "evening", "bedtime", "breakfast", "lunch", "dinner", "at [time]", or similar time/meal references, it is TIME-BASED and you must ADD quantities, not multiply
- confidence: Always "parsed" for AI parsing

Examples (CRITICAL - follow these patterns exactly):
- "Take 1 tablet by mouth once daily" → {"dose_unit": "tab", "per_day": 1, "confidence": "parsed"}
- "Take 2 capsules by mouth twice daily" → {"dose_unit": "cap", "per_day": 4, "confidence": "parsed"} (frequency-based: 2 × 2)
- "Take 5 mL by mouth three times daily" → {"dose_unit": "mL", "per_day": 15, "confidence": "parsed"} (frequency-based: 5 × 3)
- "2 puffs BID" → {"dose_unit": "actuation", "per_day": 4, "confidence": "parsed"} (frequency-based: 2 × 2)
- "10 units SC BID" → {"dose_unit": "unit", "per_day": 20, "confidence": "parsed"} (frequency-based: 10 × 2)
- TIME-BASED EXAMPLES (MUST ADD, NOT MULTIPLY):
  * "1 tablet at 8am and 2 tablets at 8pm" → {"dose_unit": "tab", "per_day": 3, "confidence": "parsed"} (1 + 2 = 3)
  * "Take 1 capsule by mouth in the morning and 2 capsules in the evening" → {"dose_unit": "cap", "per_day": 3, "confidence": "parsed"} (1 + 2 = 3)
  * "Take 1 cap in the morning and 2 caps at bedtime" → {"dose_unit": "cap", "per_day": 3, "confidence": "parsed"} (1 + 2 = 3)
  * "1 tab at 9am, 1 tab at 1pm, 1 tab at 5pm" → {"dose_unit": "tab", "per_day": 3, "confidence": "parsed"} (1 + 1 + 1 = 3)
  * "Take 2 tablets with breakfast and 1 tablet with dinner" → {"dose_unit": "tab", "per_day": 3, "confidence": "parsed"} (2 + 1 = 3)
  * "1 capsule in the morning and 2 capsules in the evening" → {"dose_unit": "cap", "per_day": 3, "confidence": "parsed"} (1 + 2 = 3)

${unitOverride ? `Note: Use unit override "${unitOverride}" for dose_unit if applicable.` : ''}

Return only valid JSON, no additional text.`;

    logInfo('Calling OpenAI API for SIG parsing', context);

    // Call OpenAI API with retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const apiTimer = startTimer(METRICS.OPENAI_REQUEST_DURATION);
        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a medical prescription parser. Parse SIG text into structured JSON format.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1, // Low temperature for consistent parsing
          max_tokens: 200,
        });
        apiTimer.stop();
        
        // Record token usage
        if (response.usage) {
          recordCounter(METRICS.OPENAI_TOKEN_USAGE, response.usage.total_tokens, {
            model: 'gpt-4o-mini',
            operation: 'sig-parsing',
          });
        }

        const content = response.choices[0]?.message?.content;
        if (!content) {
          logWarn('OpenAI API returned empty response', context);
          return null;
        }

        // Parse JSON response
        try {
          const parsed = JSON.parse(content) as ParsedSIG;
          
          // Validate structure
          if (!parsed.dose_unit || !parsed.per_day || parsed.confidence !== 'parsed') {
            logWarn('OpenAI API returned invalid structure', {
              ...context,
              parsed,
            });
            return null;
          }

          // Apply unit override if provided
          if (unitOverride) {
            parsed.dose_unit = unitOverride;
          }

          // Validate per_day is reasonable
          if (parsed.per_day <= 0 || parsed.per_day > 100) {
            logWarn('OpenAI API returned invalid per_day', {
              ...context,
              per_day: parsed.per_day,
            });
            return null;
          }

          logInfo('OpenAI API parsed SIG successfully', {
            ...context,
            dose_unit: parsed.dose_unit,
            per_day: parsed.per_day,
          });

          return parsed;
        } catch (parseError) {
          logWarn('Failed to parse OpenAI JSON response', {
            ...context,
            error: parseError instanceof Error ? parseError.message : String(parseError),
            content,
          });
          return null;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Record OpenAI error
        recordCounter(METRICS.OPENAI_ERROR, 1, {
          error: lastError.message,
        });
        
        // Check if error is retryable (5xx or timeout)
        const errorWithStatus = error as { status?: number; code?: string };
        const isRetryable = 
          (errorWithStatus.status !== undefined && errorWithStatus.status >= 500) ||
          errorWithStatus.code === 'ECONNABORTED' ||
          errorWithStatus.code === 'ETIMEDOUT';
        
        if (!isRetryable || attempt >= 1) {
          break;
        }
        
        // Exponential backoff: 1000ms
        await new Promise((resolve) => setTimeout(resolve, 1000));
        logWarn('Retrying OpenAI API request', {
          ...context,
          attempt: attempt + 1,
        });
      }
    }

    // All retries failed
    if (lastError) {
      logError('OpenAI API request failed after retries', {
        ...context,
        error: lastError.message,
      });
    }

    return null;
  } catch (error) {
    logError('OpenAI API error', {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Main SIG parsing function (orchestrates rules and AI fallback)
 * 
 * @param sig - Prescription SIG text
 * @param unitOverride - Optional unit override from request
 * @returns ParsedSIG or null if parsing fails
 */
export async function parseSIG(sig: string, unitOverride?: string): Promise<ParsedSIG | null> {
  const timer = startTimer(METRICS.SIG_PARSE_DURATION);
  
  try {
    // Try rules-based parsing first
    const result = parseWithRules(sig, unitOverride);
    
    if (result) {
      timer.stop();
      recordCounter(METRICS.SIG_PARSE_SUCCESS, 1, { method: 'rules' });
      return result;
    }

    // Rules failed - try AI fallback if enabled
    if (USE_AI_FALLBACK) {
      logInfo('Rules-based parsing failed, trying AI fallback', {
        sig: '[REDACTED]',
      });
      
      const aiResult = await parseWithAI(sig, unitOverride);
      timer.stop();
      
      if (aiResult) {
        recordCounter(METRICS.SIG_PARSE_SUCCESS, 1, { method: 'ai' });
        recordCounter(METRICS.SIG_PARSE_FALLBACK, 1);
        return aiResult;
      }
      
      // Both failed
      recordCounter(METRICS.SIG_PARSE_ERROR, 1);
      return null;
    }

    // Both failed or AI fallback disabled
    timer.stop();
    recordCounter(METRICS.SIG_PARSE_ERROR, 1);
    return null;
  } catch (error) {
    timer.stop();
    recordCounter(METRICS.SIG_PARSE_ERROR, 1);
    throw error;
  }
}

/**
 * Parse SIG with metadata for reasoning
 */
export async function parseSIGWithMetadata(sig: string, unitOverride?: string): Promise<ParsedSIGWithMetadata> {
  const timer = startTimer(METRICS.SIG_PARSE_DURATION);
  
  try {
    // Try rules-based parsing first
    const rulesResult = parseWithRulesWithMetadata(sig, unitOverride);
    
    if (rulesResult.parsed) {
      timer.stop();
      recordCounter(METRICS.SIG_PARSE_SUCCESS, 1, { method: 'rules' });
      return rulesResult;
    }

    // Rules failed - try AI fallback if enabled
    if (USE_AI_FALLBACK) {
      logInfo('Rules-based parsing failed, trying AI fallback', {
        sig: '[REDACTED]',
      });
      
      const aiResult = await parseWithAI(sig, unitOverride);
      timer.stop();
      
      if (aiResult) {
        recordCounter(METRICS.SIG_PARSE_SUCCESS, 1, { method: 'ai' });
        recordCounter(METRICS.SIG_PARSE_FALLBACK, 1);
        // For AI parsing, we don't have intermediate values, so estimate frequency
        // This is a best-effort approximation
        const estimatedFrequency = aiResult.per_day >= 1 ? Math.round(aiResult.per_day) : 1;
        return {
          parsed: aiResult,
          method: 'ai',
          quantity_per_dose: 1, // AI doesn't provide this, use default
          frequency: estimatedFrequency,
        };
      }
      
      // Both failed
      recordCounter(METRICS.SIG_PARSE_ERROR, 1);
      return { parsed: null, method: 'failed' };
    }

    // Both failed or AI fallback disabled
    timer.stop();
    recordCounter(METRICS.SIG_PARSE_ERROR, 1);
    return { parsed: null, method: 'failed' };
  } catch {
    timer.stop();
    recordCounter(METRICS.SIG_PARSE_ERROR, 1);
    return { parsed: null, method: 'failed' };
  }
}

