/**
 * Mock API Server for RxNorm and FDA APIs
 * 
 * This server provides mock endpoints for local development and testing.
 * It simulates the RxNorm and FDA NDC Directory APIs.
 */

import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DELAY_MS = parseInt(process.env.DELAY_MS || '100', 10); // Simulate network latency

// Middleware
app.use(express.json());

// Helper function to add delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to load mock data
const loadMockData = (filename) => {
  try {
    const dataPath = join(__dirname, 'data', filename);
    const data = readFileSync(dataPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn(`Warning: Could not load ${filename}, using default data`);
    return null;
  }
};

// RxNorm Mock Endpoints

/**
 * GET /findRxcuiByString?name={drug_name}
 * Returns mock RxCUI for a drug name
 */
app.get('/findRxcuiByString', async (req, res) => {
  await delay(DELAY_MS);
  const name = req.query.name || '';
  
  // Default mock response
  const defaultResponse = {
    idGroup: {
      rxnormId: ['12345'],
      name: name || 'mock drug',
    },
  };
  
  res.json(defaultResponse);
});

/**
 * GET /rxcui/{rxcui}/ndcs
 * Returns mock NDC list for an RxCUI
 */
app.get('/rxcui/:rxcui/ndcs', async (req, res) => {
  await delay(DELAY_MS);
  const rxcui = req.params.rxcui;
  
  // Default mock response
  const defaultResponse = {
    ndcGroup: {
      ndc: ['00000-1111-22', '00000-3333-44', '00000-5555-66'],
    },
  };
  
  res.json(defaultResponse);
});

/**
 * GET /approximateTerm?term={drug_name}
 * Returns mock approximate match for a drug name
 */
app.get('/approximateTerm', async (req, res) => {
  await delay(DELAY_MS);
  const term = req.query.term || '';
  
  // Default mock response
  const defaultResponse = {
    approximateGroup: {
      candidate: [
        {
          rxcui: '12345',
          score: '100',
          name: term || 'mock drug',
        },
      ],
    },
  };
  
  res.json(defaultResponse);
});

// FDA Mock Endpoints

/**
 * GET /drug/ndc.json?search=product_ndc:{ndc} or ?search=brand_name:{name}
 * Returns mock NDC data for a product NDC or brand name search
 */
app.get('/drug/ndc.json', async (req, res) => {
  await delay(DELAY_MS);
  const search = req.query.search || '';
  
  // Parse search parameter
  let ndc = '';
  let brandName = '';
  
  if (search.startsWith('product_ndc:')) {
    ndc = search.replace('product_ndc:', '');
  } else if (search.startsWith('brand_name:')) {
    brandName = search.replace('brand_name:', '');
  }
  
  // Default mock response
  const defaultResponse = {
    results: [
      {
        product_ndc: ndc || '00000-1111-22',
        package_ndc: ndc || '00000-1111-22',
        package_description: '30 CAPSULE in 1 BOTTLE',
        marketing_status: 'Active',
        marketing_start_date: '20200101',
        ...(brandName && { brand_name: brandName }),
      },
    ],
  };
  
  res.json(defaultResponse);
});

// Start server
app.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
  console.log(`RxNorm endpoints: /findRxcuiByString, /rxcui/:rxcui/ndcs, /approximateTerm`);
  console.log(`FDA endpoints: /drug/ndc.json`);
  console.log(`Simulated delay: ${DELAY_MS}ms`);
});

