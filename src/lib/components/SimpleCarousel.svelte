<script lang="ts">
	import { PdfBookResult } from '$lib/classes/PdfBookResult';

	let { carouselGroup }: {
		carouselGroup: (PdfBookResult | null)[];
		oncheckchange?: (pageNum: number, checked: boolean) => void;
	} = $props();

	let currentIndex: number = $state(1); // Start at matched page (index 1)
	let pageCheckedStates = $state(new Map<number, boolean>());

	// Get current displayed page
	let currentPage: PdfBookResult | null = $derived(carouselGroup[currentIndex] || null);
	let prevPage: PdfBookResult | null = $derived(currentIndex > 0 ? carouselGroup[currentIndex - 1] : null);
	let nextPage: PdfBookResult | null = $derived(currentIndex < carouselGroup.length - 1 ? carouselGroup[currentIndex + 1] : null);

	function handlePrev() {
		if (currentIndex > 0) {
			currentIndex--;
		}
	}

	function handleNext() {
		if (currentIndex < carouselGroup.length - 1) {
			currentIndex++;
		}
	}

	function getPageColor(pageNum: number): string {
		if (pageCheckedStates.get(pageNum)) {
			return 'green';
		}
		return 'inherit';
	}

	// Export checked states for parent component
	export function getCheckedPages(): Array<{pageNum: number, text: string}> {
		return carouselGroup
			.filter((page) => page && pageCheckedStates.get(page.pageNum))
			.map((page) => ({pageNum: page!.pageNum, text: page!.pageText}));
	}
</script>

<!-- // SimpleCarousel.svelte - Carousel component with prev/next navigation and checkboxes -->
<div class="simple-carousel w-full mt-3 bg-red-100 p-3 rounded">
	<!-- Current Page Display -->
	{#if currentPage}
		<div class="carousel-current mb-4 p-3 bg-white rounded border-2 border-blue-400">
			<div class="flex items-start gap-3 mb-2">
				<div class="flex-1">
					<span class="font-bold text-xl">Page {currentPage.pageNum}</span>
					<p
						class="m-0 break-words whitespace-normal overflow-visible !text-2xl font-comic mt-2"
						style:color={getPageColor(currentPage.pageNum)}
					>
						{currentPage.pageText || 'No text available'}
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Navigation Controls -->
	<div class="carousel-controls flex justify-between items-center gap-2">
		<button
			class="px-4 py-2 bg-blue-500 hover:bg-blue-700 text-white rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
			disabled={currentIndex === 0}
			onclick={handlePrev}
		>
			← Prev ({prevPage?.pageNum || '-'})
		</button>

		<span class="text-sm font-bold whitespace-nowrap">
			{currentIndex + 1} / {carouselGroup.length}
		</span>

		<button
			class="px-4 py-2 bg-blue-500 hover:bg-blue-700 text-white rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
			disabled={currentIndex === carouselGroup.length - 1}
			onclick={handleNext}
		>
			Next ({nextPage?.pageNum || '-'})
		</button>
	</div>

	<!-- Companion Pages Preview (Optional) -->
	{#if prevPage || nextPage}
		<div class="carousel-preview mt-4 text-sm text-gray-600">
			{#if prevPage}
				<p class="mb-1">← Prev: Page {prevPage.pageNum}</p>
			{/if}
			{#if nextPage}
				<p class="mb-1">Next: Page {nextPage.pageNum} →</p>
			{/if}
		</div>
	{/if}
</div>
