<script lang="ts">
	import type { PdfBookResult } from "$lib/classes/PdfBookResult";
	import SimpleCarousel from "./SimpleCarousel.svelte";
	
let { result, ondelete, isChecked, oncheckchange, carouselGroup }: {
	result: PdfBookResult;
	ondelete?: (result: PdfBookResult) => void;
	isChecked: boolean;
	oncheckchange?: (result: PdfBookResult, checked: boolean) => void;
	carouselGroup?: (PdfBookResult | null)[];
} = $props();
	
	let isExpanded: boolean = $state(false);
	let isRowClicked: boolean = $state(false);
	let simpleCarouselRef: any = $state(null);

	function handleBlockClick() {
		//console.log('[PdfBlock] Click detected, isRowClicked:', isRowClicked, 'isExpanded:', isExpanded);
		isRowClicked = !isRowClicked;
		isExpanded = !isExpanded;
		//console.log('[PdfBlock] After click - isRowClicked:', isRowClicked, 'isExpanded:', isExpanded);
	}

	function handleDeleteDispatch() {
		ondelete?.(result);
	}

	function handleCarouselCheckChange(pageNum: number, isChecked: boolean) {
		// Update the parent component with carousel page checkbox state
		oncheckchange?.(result, isChecked);
	}

	// Expose checked pages from carousel to parent
	export function getCarouselCheckedPages() {
		return simpleCarouselRef?.getCheckedPages?.() || [];
	}
</script>

<div class="pdf-block w-full border-b border-gray-300 hover:bg-gray-200">
	<!-- PdfBlockRow -->
	<div 
		class="pdf-block-row grid grid-cols-[auto_1fr_auto_auto] w-full items-center p-3 cursor-pointer transition-colors gap-2"
		style="color: {isRowClicked ? (result.isChecked ? 'green' : 'blue') : 'inherit'};"
		onclick={handleBlockClick}
		role="button"
		tabindex="0"
	>
		<input
			type="checkbox"
			checked={isChecked}
			onclick={(e: MouseEvent) => e.stopPropagation()}
			onchange={(e) => {
				e.stopPropagation();
				const target = e.target as HTMLInputElement;
				oncheckchange?.(result, target.checked);
			}}
			class="w-4 h-4 scale-150 cursor-pointer flex-shrink-0"
		/>
		<p class="m-0 px-3 overflow-hidden break-words whitespace-normal !text-base sm:!text-lg md:!text-xl lg:!text-2xl font-bold font-comic tracking-wider2">
			{result.bookTitle} {result.pageNum} {result.sentence}
		</p>
		<button
			class="pdf-delete w-5 h-5 p-0 text-xs leading-5 text-center bg-red-500 hover:bg-red-700 text-white border-none rounded cursor-pointer flex-shrink-0"
			onclick={(e) => {
				e.stopPropagation();
				handleDeleteDispatch();
			}}>X</button
		>
	</div>

	<!-- Simple Carousel Expansion -->
	{#if isExpanded && carouselGroup}
		<SimpleCarousel 
			carouselGroup={carouselGroup}
			bind:this={simpleCarouselRef}
			oncheckchange={handleCarouselCheckChange}
		/>
	{/if}
</div>

