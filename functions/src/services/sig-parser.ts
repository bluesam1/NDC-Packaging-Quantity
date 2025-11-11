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
 * Frequency mapping for common abbreviations and spellings
 */
const FREQUENCY_MAP: Record<string, number> = {
  // Abbreviations
  'qd': 1,
  'q.d.': 1,
  'q d': 1,
  'once daily': 1,
  'once a day': 1,
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

  for (const pattern of quantityPatterns) {
    const match = sig.match(pattern);
    if (match) {
      const quantity = parseFloat(match[2] || match[1]);
      const unit = match[3] || match[2];
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

  // Extract components
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
  "dose_unit": "tab" | "cap" | "mL",
  "per_day": number,
  "confidence": "parsed"
}

Rules:
- dose_unit: Normalize to "tab" (tablets), "cap" (capsules), or "mL" (liquids)
- per_day: Calculate as quantity_per_dose × frequency_per_day
- confidence: Always "parsed" for AI parsing

Examples:
- "Take 1 tablet by mouth once daily" → {"dose_unit": "tab", "per_day": 1, "confidence": "parsed"}
- "Take 2 capsules by mouth twice daily" → {"dose_unit": "cap", "per_day": 4, "confidence": "parsed"}
- "Take 5 mL by mouth three times daily" → {"dose_unit": "mL", "per_day": 15, "confidence": "parsed"}

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
        const isRetryable = 
          (error as any).status >= 500 ||
          (error as any).code === 'ECONNABORTED' ||
          (error as any).code === 'ETIMEDOUT';
        
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

