<script lang="ts">
	let { result, ondelete, onchange } = $props();
	let isExpanded: boolean = $state(false);
	let checked = $derived(result?.isChecked ?? false);

	//If the clicked element is inside the .pdf-checkbox - returns without expansion of the page text
	//Outside of that, the click expands the page text.
	function handleBlockClick(event: CustomEvent) {
		const target = event.target as Element;
		if (target.closest(".pdf-checkbox")) {
			return; // Prevent expansion if clicking on checkbox or delete button
		}
		isExpanded = !isExpanded;
	}

	// This is a callback which returns result && checked to the parent +page.svelte main page.
	function handleCheckboxChangeDispatch(event: Event) {
		console.log("[PdfBlock] in handleCheckboxChangeDispatch");
		const target = event.target as HTMLInputElement;
		result.isChecked = target.checked;
		console.log("[PdfBlock] Checkbox changed - result.isChecked:", result.isChecked);
		console.log("[PdfBlock] onchange callback exists?", !!onchange);
		if (onchange) {
			console.log("[PdfBlock] Calling onchange callback with result:", result, "checked:", result.isChecked);
			onchange(result, result.isChecked);
		} else {
			console.error("[PdfBlock] onchange callback is undefined!");
		}
	}

	// This is a callback which returns result to the parent +page.svelte main page.
	function handleDeleteDispatch() {
		ondelete?.(result); // Send the result object to the parent
	}
</script>

<div 
	class="pdf-block grid grid-cols-[auto_1fr_auto] w-full items-center p-3 border-b border-gray-300 hover:bg-gray-100 cursor-pointer" 
	onclick={handleBlockClick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleBlockClick(e);
		}
	}}
	role="button"
	tabindex="0"
>
	<input
		type="checkbox"
		checked={result.isChecked}
		class="pdf-checkbox w-4 h-4 mx-3 pr-1 scale-150 cursor-pointer"
		onclick={(e) => {
			console.log("[PdfBlock] CHECKBOX CLICK EVENT FIRED!");
			e.stopPropagation();
			const target = e.target as HTMLInputElement;
			result.isChecked = !result.isChecked;
			console.log("[PdfBlock] New isChecked value:", result.isChecked);
			if (onchange) {
				console.log("[PdfBlock] Calling onchange");
				onchange(result, result.isChecked);
			} else {
				console.error("[PdfBlock] onchange is undefined!");
			}
		}}
	/>
	<p class="m-0 px-3 overflow-hidden break-words whitespace-normal !text-base sm:!text-lg md:!text-xl lg:!text-2xl font-bold font-comic tracking-wider2">{result.bookTitle} {result.pageNum} {result.sentence}</p>
	<button
		class="pdf-delete w-5 h-5 p-0 text-xs leading-5 text-center bg-red-500 hover:bg-red-700 text-white border-none rounded cursor-pointer"
		onclick={(e) => {
			e.stopPropagation();
			handleDeleteDispatch();
		}}>X</button
	>
	{#if isExpanded}
		<div class="pdf-page-text col-span-full w-full mt-3 bg-red-100 p-3">
			<p class="m-0 break-words whitespace-normal overflow-visible !text-base sm:!text-lg md:!text-xl lg:!text-2xl font-comic">{result.pageText || "No text available"}</p>
		</div>
	{/if}
</div>

