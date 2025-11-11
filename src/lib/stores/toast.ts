/**
 * Toast Notification Store
 * 
 * Global state management for toast notifications.
 */

import { writable } from 'svelte/store';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
	id: string;
	type: ToastType;
	message: string;
	duration?: number;
}

const MAX_TOASTS = 5;

function generateId(): string {
	return `toast-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

const toasts = writable<Toast[]>([]);

/**
 * Show a toast notification
 * 
 * @param type - Toast type (success, warning, error, info)
 * @param message - Toast message text
 * @param duration - Auto-dismiss duration in milliseconds (default: 3000, 0 = no auto-dismiss)
 */
export function showToast(type: ToastType, message: string, duration = 3000): string {
	const id = generateId();
	const toast: Toast = { id, type, message, duration };
	
	toasts.update((current) => {
		const updated = [...current, toast];
		// Limit to MAX_TOASTS, remove oldest if exceeded
		if (updated.length > MAX_TOASTS) {
			return updated.slice(-MAX_TOASTS);
		}
		return updated;
	});
	
	return id;
}

/**
 * Dismiss a specific toast by ID
 * 
 * @param id - Toast ID to dismiss
 */
export function dismissToast(id: string): void {
	toasts.update((current) => current.filter((toast) => toast.id !== id));
}

/**
 * Clear all toasts
 */
export function clearAll(): void {
	toasts.set([]);
}

/**
 * Get the toast store (read-only)
 */
export const toastStore = {
	subscribe: toasts.subscribe
};





