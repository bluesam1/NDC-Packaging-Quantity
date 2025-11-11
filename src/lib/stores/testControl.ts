/**
 * Test Control Store
 * 
 * Allows test runner to programmatically control the form inputs
 */

import { writable } from 'svelte/store';

export interface TestFormData {
	drug_input: string;
	sig: string;
	days_supply: number;
	preferred_ndcs?: string[];
	quantity_unit_override?: 'tab' | 'cap' | 'mL' | 'actuation' | 'unit';
}

// Store for test form data (null = no test running)
const testFormData = writable<TestFormData | null>(null);

// Store for test submission trigger (increments to trigger submission)
const testSubmitTrigger = writable<number>(0);

/**
 * Set form data for a test and trigger submission
 */
export function setTestFormData(data: TestFormData): void {
	testFormData.set(data);
	// Trigger submission by incrementing
	testSubmitTrigger.update(n => n + 1);
}

/**
 * Clear test form data
 */
export function clearTestFormData(): void {
	testFormData.set(null);
}

/**
 * Get the test form data store (read-only)
 */
export const testFormDataStore = {
	subscribe: testFormData.subscribe
};

/**
 * Get the test submit trigger store (read-only)
 */
export const testSubmitTriggerStore = {
	subscribe: testSubmitTrigger.subscribe
};


