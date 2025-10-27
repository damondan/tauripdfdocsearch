<script lang="ts">
	import { browser } from "$app/environment";
	import { createEventDispatcher } from "svelte";
	import {
		previousSearchesWritable,
		searchQueryWritable,
	} from "$lib/store.js";

	let searchQuery: string = $state("");
	let { selectedSubject, pdfBookTitles } = $props();
	let showDropdown = $state(false);
	let loading: boolean = $state(false);
	const pdfLimit: number = 40;
	const dispatch = createEventDispatcher();

	// THis is a dispatch to the parent +page.svelte.
	// Replace the existing handleSearchDispatch function with this updated version:

	// Replace the existing handleSearchDispatch function with this updated version:

	async function handleSearchDispatch() {
		searchQueryWritable.set(searchQuery);

		const normPdfTitles: string[] = [...pdfBookTitles];
		console.log(
			"normPdfTitles:",
			normPdfTitles,
			"length:",
			normPdfTitles.length,
		);

		// Check if both search query and PDFs are missing
		if (!searchQuery.trim() && normPdfTitles.length == 0) {
			console.error("Both search query and PDFs are missing");
			dispatch("searchResults", "noSearchTermAndNoPdfs");
			return;
		}

		// Check if no PDFs are selected (but search query exists)
		if (normPdfTitles.length == 0) {
			dispatch("searchResults", "noPdfCheckBoxesChecked");
			return;
		}

		// Check if PDFs are selected but no search query is provided
		if (!searchQuery.trim()) {
			console.error("Search query is empty but PDFs are selected");
			dispatch("searchResults", "noSearchTerm");
			return;
		}

		// Check if too many PDFs are selected
		if (normPdfTitles.length > pdfLimit) {
			dispatch("searchResults", "pdfsOverLimit");
			return;
		}

		updateSearch(searchQuery);

		const payload = {
			selectedSubject,
			searchQuery,
			pdfBookTitles,
		};
		console.log("Payload before Tauri invoke:", payload);

		try {
			loading = true;
			dispatch("loadingChange", loading);

			const { searchPages } = await import('$lib/tauri-db');
			const result = await searchPages(
				selectedSubject,
				searchQuery,
				normPdfTitles
			);

			console.log("Search results:", result);

			loading = false;
			dispatch("loadingChange", loading);
			dispatch("searchResults", result);

			// Clear input and hide dropdown after successful search
			searchQuery = "";
			showDropdown = false;
		} catch (error) {
			console.error("Error in handleSearch:", error);
			loading = false;
			dispatch("loadingChange", loading);
		}
	}

	// Show dropdown if there are previous searches
	const handleInputClick = () => {
		if ($previousSearchesWritable.length > 0) {
			showDropdown = true;
		}
	};

	/**
	 * Handles selecting a search term from the dropdown.
	 * @param {string} term - The search term selected
	 */
	const handleSelectSearch = (term: string) => {
		console.log("Selected:", term);
		searchQuery = term; // Populate input with selected term
		showDropdown = false; // Hide dropdown
	};

	const handleClickOutside = (event: Event) => {
		console.log("nadleCLickOutside");
		const dropdown = document.getElementById("search-dropdn");
		const inputField = document.getElementById("search");
		const target = event.target as Node;
		if (
			dropdown &&
			inputField &&
			!dropdown.contains(target) &&
			!inputField.contains(target)
		) {
			showDropdown = false;
		}
	};

	function handleInputKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			console.log("Enter key pressed");
			handleSearchDispatch();
		}
	}

	const handleDelete = (searchTerm: string) => {
		previousSearchesWritable.update((searches) => {
			return searches.filter((term) => term !== searchTerm);
		});
	};

	function updateSearch(searchWord: string): void {
		previousSearchesWritable.update((searches: string[]) => {
			if (!searches.includes(searchWord)) {
				searches = [searchWord, ...searches].slice(0, 10);
			}
			return searches;
		});
		console.log($previousSearchesWritable);
	}

	// Close dropdown if clicked outside
	if (browser) {
		window.addEventListener("click", handleClickOutside);
	}
</script>

<div class="search-bar flex gap-1 relative w-[90%] max-w-[600px] mx-auto 
			shadow-soft md:w-[60%] lg:w-[40%]">
	<!-- Input Field with Click Event -->
	<input
		type="text"
		id="search"
		name="search"
		placeholder="Search..."
		bind:value={searchQuery}
		onclick={handleInputClick}
		onkeydown={handleInputKeydown}
		autocomplete="off"
	class="flex-grow font-comic !text-base sm:!text-lg md:!text-xl lg:!text-2xl text-black p-2 border border-gray-300 rounded"/>

	<!-- Search Button -->
	<button 
		onclick={handleSearchDispatch}
	class="bg-blue-600 hover:bg-blue-800 text-white px-3 py-2 rounded font-comic !text-base sm:!text-lg md:!text-xl lg:!text-2xl shadow-soft cursor-pointer"
	>Search</button>

	{#if loading}
		<div class="spinner"></div>
	{/if}

	<!-- Dropdown Menu -->
	{#if showDropdown && $previousSearchesWritable.length > 0}
		<ul id="search-dropdn" class="dropdn-menu absolute bg-white top-full left-0 rounded 
								w-[calc(100%-5px-110px)] list-none py-1 m-0 z-10 shadow-md">
			{#each $previousSearchesWritable as term}
				<li class="text-xl bg-gray-50 hover:bg-gray-200 p-2 border border-black 
						rounded mx-1 my-0.5 flex justify-between items-center">
					<button
						type="button"
						class="flex-1 text-left"
						onclick={() => handleSelectSearch(term)}
					>
						{term}
					</button>
					<button
						type="button"
						class="searchquery-delete bg-red-500 hover:bg-red-700 text-white px-1 
						rounded text-sm cursor-pointer"
						onclick={(e) => {
							e.stopPropagation();
							handleDelete(term);
						}}
						>X</button
					>
				</li>
			{/each}
		</ul>
	{/if}
</div>

