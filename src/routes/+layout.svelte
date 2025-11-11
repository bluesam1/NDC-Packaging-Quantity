<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/components/Header.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>NPQC - NDC Packaging & Quantity Calculator</title>
</svelte:head>

<Header />
{@render children()}
<ToastContainer />
