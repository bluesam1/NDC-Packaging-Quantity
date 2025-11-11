/**
 * Extract Prescription Handler
 * 
 * This module handles OCR extraction of prescription information from images
 * using OpenAI Vision API.
 */

import OpenAI from 'openai';
import { logInfo, logWarn, logError } from '../utils/logger';
import { ValidationError, DependencyError, InternalError } from '../utils/errors';
import type { ComputeRequest } from '../types/index';

/**
 * Extract prescription data from image using OpenAI Vision API
 * 
 * @param imageBase64 - Base64 encoded image
 * @param correlationId - Optional correlation ID for logging
 * @returns Extracted prescription data with field detection metadata
 */
export async function handleExtractPrescription(
  imageBase64: string,
  correlationId?: string
): Promise<{
  data: Partial<ComputeRequest>;
  fields_found: string[];
}> {
  const context = { correlationId };

  try {
    // Get OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logWarn('OpenAI API key not found', context);
      throw new DependencyError(
        'OCR service unavailable',
        'OpenAI API key is not configured'
      );
    }

    // Create OpenAI client
    const openai = new OpenAI({
      apiKey,
      maxRetries: 1,
    });

    // Create prompt for structured extraction
    const prompt = `Analyze this prescription image and extract the following information in JSON format:

{
  "drug_input": "drug name or NDC code if visible",
  "sig": "prescription directions/sig",
  "days_supply": number (days supply if visible)
}

Rules:
- drug_input: Extract the drug name (brand or generic) or NDC code if clearly visible. If not found, use null.
- sig: Extract the prescription directions (SIG/Signa) EXACTLY as written. This may include:
  * Frequency-based: "Take 1 tablet by mouth twice daily" or "1 cap PO BID"
  * Time-based: "1 tablet at 8am and 2 tablets at 8pm" or "Take 1 cap in the morning and 2 caps at bedtime"
  * Meal-based: "Take 2 tablets with breakfast and 1 tablet with dinner"
  Preserve the exact wording and structure, including all times, quantities, and instructions. If not found, use null.
- days_supply: Extract the number of days supply if visible (usually a number like 30, 60, 90). If not found, use null.

Important:
- Only extract information that is clearly visible and readable in the image
- If a field is not visible or unclear, set it to null
- Return valid JSON only, no additional text
- For days_supply, return a number or null, not a string
- For sig, preserve the exact text including all quantities, times, and instructions - do not simplify or summarize`;

    logInfo('Calling OpenAI Vision API for prescription extraction', context);

    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a medical prescription OCR system. Extract prescription information from images and return structured JSON data.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Low temperature for consistent extraction
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logWarn('OpenAI Vision API returned empty response', context);
      throw new DependencyError(
        'OCR extraction failed',
        'No data extracted from image'
      );
    }

    // Parse JSON response
    let extractedData: {
      drug_input?: string | null;
      sig?: string | null;
      days_supply?: number | null;
    };

    try {
      extractedData = JSON.parse(content);
    } catch (parseError) {
      logError('Failed to parse OpenAI response', {
        ...context,
        error: parseError instanceof Error ? parseError.message : String(parseError),
        content: content.substring(0, 200), // Log first 200 chars for debugging
      });
      throw new DependencyError(
        'OCR extraction failed',
        'Invalid response format from OCR service'
      );
    }

    // Build result with field detection metadata
    const fields_found: string[] = [];
    const data: Partial<ComputeRequest> = {};

    if (extractedData.drug_input && extractedData.drug_input.trim().length > 0) {
      data.drug_input = extractedData.drug_input.trim();
      fields_found.push('drug_input');
    }

    if (extractedData.sig && extractedData.sig.trim().length > 0) {
      data.sig = extractedData.sig.trim();
      fields_found.push('sig');
    }

    if (extractedData.days_supply !== null && extractedData.days_supply !== undefined) {
      const daysSupply = typeof extractedData.days_supply === 'number' 
        ? extractedData.days_supply 
        : parseInt(String(extractedData.days_supply), 10);
      
      if (!isNaN(daysSupply) && daysSupply > 0) {
        data.days_supply = daysSupply;
        fields_found.push('days_supply');
      }
    }

    logInfo('Prescription extraction completed', {
      ...context,
      fields_found: fields_found.length,
    });

    return {
      data,
      fields_found,
    };
  } catch (error) {
    if (error instanceof DependencyError || error instanceof ValidationError) {
      throw error;
    }

    logError('Prescription extraction error', {
      ...context,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw new InternalError(
      'Failed to extract prescription data',
      'An error occurred during OCR processing'
    );
  }
}

