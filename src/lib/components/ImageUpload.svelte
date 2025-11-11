<script lang="ts">
	import { Button } from '$lib/components';

	interface ImageUploadProps {
		onUpload?: (file: File) => void;
		loading?: boolean;
		error?: string | null;
		class?: string;
	}

	let {
		onUpload,
		loading = false,
		error = null,
		class: className = '',
	}: ImageUploadProps = $props();

	let fileInput: HTMLInputElement | null = $state(null);
	let isDragging = $state(false);
	let previewUrl = $state<string | null>(null);
	let selectedFile: File | null = $state(null);

	const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
	const ACCEPTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

	function validateFile(file: File): string | null {
		// Check file type
		if (!ACCEPTED_FORMATS.includes(file.type)) {
			return 'Invalid file format. Please upload JPG, PNG, or PDF files.';
		}

		// Check file size
		if (file.size > MAX_FILE_SIZE) {
			return `File size exceeds 10MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`;
		}

		return null;
	}

	function handleFileSelect(file: File) {
		const validationError = validateFile(file);
		if (validationError) {
			// Don't proceed if validation fails
			// The error should be set by parent component
			return;
		}

		selectedFile = file;
		
		// Create preview for images (not PDFs)
		if (file.type.startsWith('image/')) {
			const reader = new FileReader();
			reader.onload = (e) => {
				previewUrl = e.target?.result as string;
			};
			reader.readAsDataURL(file);
		} else {
			previewUrl = null;
		}

		if (onUpload) {
			onUpload(file);
		}
	}

	function handleFileInputChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			handleFileSelect(file);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = false;

		const file = event.dataTransfer?.files[0];
		if (file) {
			handleFileSelect(file);
		}
	}

	function handleButtonClick() {
		fileInput?.click();
	}

	function clearFile() {
		selectedFile = null;
		previewUrl = null;
		if (fileInput) {
			fileInput.value = '';
		}
	}
</script>

<div class="image-upload {className}">
	<input
		type="file"
		accept="image/jpeg,image/jpg,image/png,application/pdf"
		bind:this={fileInput}
		onchange={handleFileInputChange}
		class="image-upload__input"
		aria-label="Upload prescription image"
	/>

	{#if !selectedFile && !loading}
		<div
			class="image-upload__dropzone {isDragging ? 'image-upload__dropzone--dragging' : ''}"
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
			role="button"
			tabindex="0"
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					handleButtonClick();
				}
			}}
		>
			<div class="image-upload__content">
				<div class="image-upload__icon">📄</div>
				<p class="image-upload__text">
					Drag and drop your prescription image here, or
				</p>
				<Button
					variant="secondary"
					onclick={handleButtonClick}
					ariaLabel="Select prescription image file"
				>
					Choose File
				</Button>
				<p class="image-upload__hint">
					Supports JPG, PNG, PDF (max 10MB)
				</p>
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="image-upload__loading">
			<div class="image-upload__spinner">⏳</div>
			<p class="image-upload__loading-text">Processing image...</p>
		</div>
	{/if}

	{#if selectedFile && !loading}
		<div class="image-upload__preview">
			{#if previewUrl}
				<img
					src={previewUrl}
					alt="Prescription preview"
					class="image-upload__preview-image"
				/>
			{:else}
				<div class="image-upload__preview-placeholder">
					📄 {selectedFile.name}
				</div>
			{/if}
			<div class="image-upload__preview-info">
				<p class="image-upload__preview-name">{selectedFile.name}</p>
				<p class="image-upload__preview-size">
					{(selectedFile.size / 1024 / 1024).toFixed(2)} MB
				</p>
			</div>
			<Button
				variant="ghost"
				onclick={clearFile}
				ariaLabel="Remove selected file"
				class="image-upload__remove"
			>
				✕
			</Button>
		</div>
	{/if}

	{#if error}
		<div class="image-upload__error" role="alert">
			{error}
		</div>
	{/if}
</div>

<style>
	.image-upload {
		width: 100%;
	}

	.image-upload__input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	.image-upload__dropzone {
		border: 2px dashed var(--gray-300);
		border-radius: var(--border-radius-md);
		padding: var(--space-8);
		text-align: center;
		background-color: var(--bg-primary);
		transition: all 150ms ease;
		cursor: pointer;
	}

	.image-upload__dropzone:hover {
		border-color: var(--primary-500);
		background-color: var(--primary-50);
	}

	.image-upload__dropzone--dragging {
		border-color: var(--primary-500);
		background-color: var(--primary-50);
	}

	.image-upload__dropzone:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 2px;
	}

	.image-upload__content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
	}

	.image-upload__icon {
		font-size: 3rem;
	}

	.image-upload__text {
		font-size: var(--text-base);
		color: var(--text-secondary);
		margin: 0;
	}

	.image-upload__hint {
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		margin: 0;
	}

	.image-upload__loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
		padding: var(--space-8);
		border: 2px dashed var(--gray-300);
		border-radius: var(--border-radius-md);
		background-color: var(--bg-primary);
	}

	.image-upload__spinner {
		font-size: 2rem;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.image-upload__loading-text {
		font-size: var(--text-base);
		color: var(--text-secondary);
		margin: 0;
	}

	.image-upload__preview {
		position: relative;
		border: 1px solid var(--gray-300);
		border-radius: var(--border-radius-md);
		overflow: hidden;
		background-color: var(--bg-primary);
	}

	.image-upload__preview-image {
		width: 100%;
		max-height: 300px;
		object-fit: contain;
		display: block;
	}

	.image-upload__preview-placeholder {
		padding: var(--space-8);
		text-align: center;
		font-size: var(--text-lg);
		color: var(--text-secondary);
		background-color: var(--gray-50);
	}

	.image-upload__preview-info {
		padding: var(--space-4);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-4);
	}

	.image-upload__preview-name {
		font-size: var(--text-sm);
		color: var(--text-primary);
		margin: 0;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.image-upload__preview-size {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		margin: 0;
	}

	.image-upload__remove {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		background-color: rgba(255, 255, 255, 0.9);
		border-radius: 50%;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		min-height: 32px;
	}

	.image-upload__error {
		margin-top: var(--space-2);
		padding: var(--space-3);
		background-color: var(--error-50);
		border: 1px solid var(--error-300);
		border-radius: var(--border-radius-md);
		color: var(--error-700);
		font-size: var(--text-sm);
	}
</style>

